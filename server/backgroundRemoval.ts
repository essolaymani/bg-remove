import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export type RemovalMode = "background" | "tshirt-design";

export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const MAX_PROCESSING_TIME_MS = 145_000;
let activeRemovalCount = 0;

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

type ValidatedImage = {
  buffer: Buffer;
  extension: "jpg" | "png" | "webp";
};

function decodeDataUrl(dataUrl: string, declaredType: SupportedImageType): Buffer {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[1] !== declaredType) {
    throw new ImageValidationError("The uploaded image could not be read. Please choose a valid JPG, PNG, or WEBP file.");
  }

  const encoded = match[2];
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length === 0 || buffer.toString("base64") !== encoded) {
    throw new ImageValidationError("The uploaded image appears to be corrupted. Please try another file.");
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new ImageValidationError("Please choose an image smaller than 8 MB.");
  }

  return buffer;
}

function detectImageType(buffer: Buffer): SupportedImageType | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

export function validateImagePayload(dataUrl: string, mimeType: SupportedImageType): ValidatedImage {
  const buffer = decodeDataUrl(dataUrl, mimeType);
  const detectedType = detectImageType(buffer);
  if (!detectedType || detectedType !== mimeType) {
    throw new ImageValidationError("The file type does not match the image data. Please upload a JPG, PNG, or WEBP image.");
  }

  return {
    buffer,
    extension: detectedType === "image/jpeg" ? "jpg" : detectedType === "image/png" ? "png" : "webp",
  };
}

export function normalizeProcessingError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("printed artwork") || normalized.includes("t-shirt")) {
    return "We couldn’t cleanly separate this print from the fabric. Please use a straight-on, well-lit T-shirt photo where the artwork contrasts with the shirt colour.";
  }
  if (normalized.includes("pixel") || normalized.includes("resolution") || normalized.includes("large")) {
    return "This image is too large to process. Please use an image no larger than 12 megapixels.";
  }
  if (normalized.includes("no module named") || normalized.includes("cannot import name")) {
    return "The background-removal engine is temporarily unavailable. Please try again in a moment.";
  }
  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return "Processing took longer than expected. Please try a smaller image.";
  }
  if (normalized.includes("cannot identify") || normalized.includes("unidentifiedimage")) {
    return "We could not open this image. Please choose a valid JPG, PNG, or WEBP file.";
  }
  return "We couldn’t remove the background from this image. Please try another image in a moment.";
}

function runPythonRemoval(inputPath: string, outputPath: string, mode: RemovalMode): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = mode === "tshirt-design" ? "scripts/extract-tshirt-artwork.py" : "scripts/remove-background.py";
    const child = spawn("python3", [script, inputPath, outputPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      settle(() => reject(new Error("Processing timed out.")));
    }, MAX_PROCESSING_TIME_MS);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: Error) => settle(() => reject(error)));
    child.on("close", (code: number | null) => {
      if (code === 0) settle(resolve);
      else settle(() => reject(new Error(stderr.trim() || "The processing engine exited unexpectedly.")));
    });
  });
}

export async function removeImageBackground(dataUrl: string, mimeType: SupportedImageType, mode: RemovalMode = "background") {
  if (activeRemovalCount >= 1) {
    throw new Error("The removal studio is busy with another image. Please wait a moment and try again.");
  }

  activeRemovalCount += 1;
  const jobDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "withoutbg-"));
  try {
    const image = validateImagePayload(dataUrl, mimeType);
    const inputPath = path.join(jobDirectory, `${randomUUID()}.${image.extension}`);
    const outputPath = path.join(jobDirectory, "without-background.png");
    await fs.writeFile(inputPath, image.buffer, { mode: 0o600 });
    await runPythonRemoval(inputPath, outputPath, mode);

    const result = await fs.readFile(outputPath);
    if (!result.length || result.length > MAX_OUTPUT_BYTES) {
      throw new Error("The processed image was too large to deliver.");
    }

    return { dataUrl: `data:image/png;base64,${result.toString("base64")}` };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new Error(normalizeProcessingError(error instanceof Error ? error.message : ""));
  } finally {
    activeRemovalCount -= 1;
    await fs.rm(jobDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
