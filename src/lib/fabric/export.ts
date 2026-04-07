import * as fabric from "fabric";

export interface ExportOptions {
  format: "png" | "jpeg" | "webp";
  quality: number; // 0-1
  multiplier: number; // for high-res export
}

export function exportCanvas(
  canvas: fabric.Canvas,
  projectWidth: number,
  projectHeight: number,
  options: ExportOptions
): string {
  // Store current zoom
  const currentZoom = canvas.getZoom();

  // Reset zoom for export
  canvas.setZoom(1);
  canvas.setDimensions({ width: projectWidth, height: projectHeight });

  // Deselect all objects
  canvas.discardActiveObject();
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({
    format: options.format,
    quality: options.quality,
    multiplier: options.multiplier,
  });

  // Restore zoom
  canvas.setZoom(currentZoom);
  canvas.setDimensions({
    width: projectWidth * currentZoom,
    height: projectHeight * currentZoom,
  });
  canvas.renderAll();

  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
