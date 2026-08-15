import { describe, expect, it } from "vitest";
import { buildPreviewCanvasBackground } from "../client/src/lib/previewCanvas";

describe("print preview canvas", () => {
  it("keeps the checkerboard canvas transparent", () => {
    expect(buildPreviewCanvasBackground("checkerboard", "#172a3a", "#111827", "#7c3aed")).toBeUndefined();
  });

  it("creates solid and gradient display canvases independently from image data", () => {
    expect(buildPreviewCanvasBackground("solid", "#172a3a", "#111827", "#7c3aed")).toBe("#172a3a");
    expect(buildPreviewCanvasBackground("gradient", "#172a3a", "#111827", "#7c3aed")).toBe("linear-gradient(135deg, #111827 0%, #7c3aed 100%)");
  });
});
