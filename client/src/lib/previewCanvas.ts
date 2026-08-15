export type PreviewBackground = "checkerboard" | "solid" | "gradient";

export function buildPreviewCanvasBackground(
  choice: PreviewBackground,
  solid: string,
  gradientStart: string,
  gradientEnd: string
): string | undefined {
  if (choice === "checkerboard") return undefined;
  if (choice === "solid") return solid;
  return `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;
}
