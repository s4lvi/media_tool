import * as fabric from "fabric";

export interface CanvasOptions {
  width: number;
  height: number;
  backgroundColor?: string;
}

export function initializeCanvas(
  canvasEl: HTMLCanvasElement,
  options: CanvasOptions
): fabric.Canvas {
  const canvas = new fabric.Canvas(canvasEl, {
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor || "#ffffff",
    preserveObjectStacking: true,
    selection: true,
    controlsAboveOverlay: true,
  });

  // Set default object controls style
  fabric.FabricObject.prototype.set({
    cornerColor: "#2563eb",
    cornerStrokeColor: "#2563eb",
    cornerSize: 10,
    cornerStyle: "circle",
    transparentCorners: false,
    borderColor: "#2563eb",
    borderScaleFactor: 2,
  });

  return canvas;
}

export function fitCanvasToContainer(
  canvas: fabric.Canvas,
  containerWidth: number,
  containerHeight: number,
  projectWidth: number,
  projectHeight: number
): number {
  const padding = 40;
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;

  const scaleX = availableWidth / projectWidth;
  const scaleY = availableHeight / projectHeight;
  const zoom = Math.min(scaleX, scaleY, 1);

  canvas.setDimensions({
    width: projectWidth * zoom,
    height: projectHeight * zoom,
  });
  canvas.setZoom(zoom);

  return zoom;
}

export function addImageToCanvas(
  canvas: fabric.Canvas,
  imageUrl: string,
  options?: Partial<fabric.FabricObject>
): Promise<fabric.FabricImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const fabricImage = new fabric.FabricImage(img, {
        ...options,
      });

      // Scale to fit canvas if larger
      const canvasWidth = canvas.getWidth() / canvas.getZoom();
      const canvasHeight = canvas.getHeight() / canvas.getZoom();

      if (fabricImage.width! > canvasWidth || fabricImage.height! > canvasHeight) {
        const scale = Math.min(
          canvasWidth / fabricImage.width!,
          canvasHeight / fabricImage.height!
        );
        fabricImage.scale(scale);
      }

      // Center on canvas
      fabricImage.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: "center",
        originY: "center",
      });

      canvas.add(fabricImage);
      canvas.setActiveObject(fabricImage);
      canvas.renderAll();
      resolve(fabricImage);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

export function addFrameToCanvas(
  canvas: fabric.Canvas,
  frameUrl: string,
  blendMode: GlobalCompositeOperation = "source-over"
): Promise<fabric.FabricImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvasWidth = canvas.getWidth() / canvas.getZoom();
      const canvasHeight = canvas.getHeight() / canvas.getZoom();

      const fabricImage = new fabric.FabricImage(img, {
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        globalCompositeOperation: blendMode,
        selectable: true,
        evented: true,
      });

      // Scale frame to fill entire canvas
      const scaleX = canvasWidth / fabricImage.width!;
      const scaleY = canvasHeight / fabricImage.height!;
      fabricImage.set({
        scaleX,
        scaleY,
      });

      // Add frame on top
      canvas.add(fabricImage);
      canvas.renderAll();
      resolve(fabricImage);
    };
    img.onerror = reject;
    img.src = frameUrl;
  });
}

export function addTextToCanvas(
  canvas: fabric.Canvas,
  text: string,
  options?: Partial<fabric.Textbox>
): fabric.Textbox {
  const canvasWidth = canvas.getWidth() / canvas.getZoom();
  const canvasHeight = canvas.getHeight() / canvas.getZoom();

  const textbox = new fabric.Textbox(text, {
    left: canvasWidth / 2,
    top: canvasHeight / 2,
    originX: "center",
    originY: "center",
    width: canvasWidth * 0.6,
    fontSize: 48,
    fontFamily: "Arial",
    fill: "#ffffff",
    textAlign: "center",
    ...options,
  });

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  return textbox;
}
