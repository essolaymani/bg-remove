#!/usr/bin/env python3
"""Extract contrasting printed artwork from a T-shirt photograph as a transparent PNG."""

import sys

import numpy as np
from PIL import Image, UnidentifiedImageError
from withoutbg import WithoutBG


MAX_PIXELS = 12_000_000


def main() -> int:
    if len(sys.argv) != 3:
        print("Expected an input image path and output PNG path.", file=sys.stderr)
        return 2

    input_path, output_path = sys.argv[1], sys.argv[2]
    try:
        with Image.open(input_path) as source:
            if source.width * source.height > MAX_PIXELS:
                print("Image resolution exceeds the 12 megapixel processing limit.", file=sys.stderr)
                return 3

        # The required SDK removes the scene surrounding the shirt first. The print
        # extraction below then compares central garment pixels against the shirt colour.
        model = WithoutBG.open_weights()
        garment = model.remove_background(input_path).convert("RGBA")
        pixels = np.asarray(garment).copy()
        height, width = pixels.shape[:2]

        # Printed chest artwork is normally centred. Restricting the canvas prevents
        # facial features, hands, sleeves, and scene remnants from being mistaken for
        # the design.
        left, right = int(width * 0.075), int(width * 0.925)
        top, bottom = int(height * 0.22), int(height * 0.82)
        central_region = np.zeros((height, width), dtype=bool)
        central_region[top:bottom, left:right] = True

        original_alpha = pixels[:, :, 3]
        usable_pixels = central_region & (original_alpha > 12)
        if np.count_nonzero(usable_pixels) < 500:
            print("Could not locate enough of the T-shirt. Use a front-facing photo that shows the printed area clearly.", file=sys.stderr)
            return 4

        # Sample a broad ring around the normal print position instead of sampling
        # inside it. This prevents a large, colourful design from shifting the
        # inferred fabric colour toward its own colours.
        print_window = np.zeros((height, width), dtype=bool)
        print_window[int(height * 0.25):int(height * 0.80), int(width * 0.18):int(width * 0.82)] = True
        fabric_samples = pixels[:, :, :3][usable_pixels & ~print_window]
        if len(fabric_samples) < 300:
            fabric_samples = pixels[:, :, :3][usable_pixels]

        # A palette of common quantised fabric shades is more stable than one mean or
        # median value. It captures dark shirts' highlights and shadows as fabric,
        # while keeping the contrasting printed ink.
        quantised = (fabric_samples // 16).astype(np.uint8)
        colour_bins, counts = np.unique(quantised, axis=0, return_counts=True)
        palette_indexes = np.argsort(counts)[-12:]
        fabric_palette = (colour_bins[palette_indexes].astype(np.float32) * 16.0) + 8.0

        pixel_rgb = pixels[:, :, :3].astype(np.float32)
        distance = np.empty((height, width), dtype=np.float32)
        # Process in rows to cap memory on the hosted server while preserving the
        # original print resolution.
        for row_start in range(0, height, 256):
            row_end = min(row_start + 256, height)
            chunk = pixel_rgb[row_start:row_end]
            closest_distance_squared = np.full(chunk.shape[:2], np.inf, dtype=np.float32)
            for fabric_colour in fabric_palette:
                colour_distance_squared = np.sum((chunk - fabric_colour) ** 2, axis=2)
                closest_distance_squared = np.minimum(closest_distance_squared, colour_distance_squared)
            distance[row_start:row_end] = np.sqrt(closest_distance_squared)

        # Pixels close to the garment colour are fabric; distinct colours become the
        # transparent-PNG artwork. Ink-aware filtering additionally rejects neutral,
        # very dark fabric shading that can otherwise look far from one sampled fabric
        # colour because of lighting. A soft edge retains anti-aliased print detail.
        channel_max = np.max(pixel_rgb, axis=2)
        channel_min = np.min(pixel_rgb, axis=2)
        chroma = channel_max - channel_min
        looks_like_colour_or_light_ink = (chroma > 24) | (channel_max > 145)
        looks_like_dark_contrasting_ink = (channel_max < 65) & (distance > 150)
        looks_like_ink = looks_like_colour_or_light_ink | looks_like_dark_contrasting_ink
        contrast_alpha = np.clip((distance - 78.0) * 15.0, 0, 255).astype(np.uint8)
        contrast_alpha[~looks_like_ink] = 0
        output_alpha = np.minimum(original_alpha, contrast_alpha)
        output_alpha[~print_window] = 0

        if np.count_nonzero(output_alpha > 20) < 150:
            print("Printed artwork could not be separated. Use a well-lit, front-facing image where the design contrasts with the fabric.", file=sys.stderr)
            return 5

        pixels[:, :, 3] = output_alpha
        Image.fromarray(pixels, "RGBA").save(output_path, format="PNG")
        return 0
    except UnidentifiedImageError:
        print("Cannot identify the uploaded image.", file=sys.stderr)
        return 6
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
