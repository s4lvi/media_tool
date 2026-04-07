import * as fabric from "fabric";

export function serializeCanvas(canvas: fabric.Canvas): object {
  return canvas.toJSON();
}

export async function deserializeCanvas(
  canvas: fabric.Canvas,
  json: object
): Promise<void> {
  await canvas.loadFromJSON(json);
  canvas.renderAll();
}

export function generateThumbnail(
  canvas: fabric.Canvas,
  maxWidth: number = 400,
  maxHeight: number = 400
): string {
  const currentZoom = canvas.getZoom();
  const width = canvas.getWidth() / currentZoom;
  const height = canvas.getHeight() / currentZoom;

  const scale = Math.min(maxWidth / width, maxHeight / height);

  canvas.setZoom(scale);
  canvas.setDimensions({ width: width * scale, height: height * scale });
  canvas.discardActiveObject();
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({
    format: "jpeg",
    quality: 0.7,
    multiplier: 1,
  });

  // Restore
  canvas.setZoom(currentZoom);
  canvas.setDimensions({
    width: width * currentZoom,
    height: height * currentZoom,
  });
  canvas.renderAll();

  return dataUrl;
}
