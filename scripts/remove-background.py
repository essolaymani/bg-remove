#!/usr/bin/env python3
"""Remove the background from a photograph and save it as a transparent PNG."""

import sys

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

        model = WithoutBG.open_weights()
        result = model.remove_background(input_path).convert("RGBA")
        result.save(output_path, format="PNG")
        return 0
    except UnidentifiedImageError:
        print("Cannot identify the uploaded image.", file=sys.stderr)
        return 6
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
