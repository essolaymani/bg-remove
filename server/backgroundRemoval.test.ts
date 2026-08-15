import { describe, expect, it } from "vitest";
import { ImageValidationError, normalizeProcessingError, validateImagePayload } from "./backgroundRemoval";

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLJzQAAAABJRU5ErkJggg==";

describe("background image validation", () => {
  it("accepts a correctly declared PNG data URL", () => {
    expect(validateImagePayload(`data:image/png;base64,${TINY_PNG}`, "image/png")).toMatchObject({ extension: "png" });
  });

  it("rejects a MIME type that does not match its source image", () => {
    expect(() => validateImagePayload(`data:image/jpeg;base64,${TINY_PNG}`, "image/jpeg")).toThrow(ImageValidationError);
  });

  it("converts engine failures into clear user-facing messages", () => {
    expect(normalizeProcessingError("Processing timed out.")).toMatch(/longer than expected/i);
    expect(normalizeProcessingError("cannot identify image file")).toMatch(/could not open/i);
    expect(normalizeProcessingError("Printed artwork could not be separated.")).toMatch(/contrasts with the shirt colour/i);
  });
});
