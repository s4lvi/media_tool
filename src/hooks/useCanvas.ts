"use client";

import { useRef, useCallback } from "react";
import * as fabric from "fabric";
import {
  initializeCanvas,
  addImageToCanvas,
  addFrameToCanvas,
  addTextToCanvas,
  fitCanvasToContainer,
  type CanvasOptions,
} from "@/lib/fabric/setup";
import { useEditorStore } from "@/stores/editor-store";
import type { BlendMode } from "@/types/editor";

export function useCanvas() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const { setSelection, setZoom, setDirty } = useEditorStore();

  const initialize = useCallback(
    (canvasEl: HTMLCanvasElement, options: CanvasOptions) => {
      if (canvasRef.current) {
        canvasRef.current.dispose();
      }

      const canvas = initializeCanvas(canvasEl, options);
      canvasRef.current = canvas;

      // Selection events
      canvas.on("selection:created", (e) => {
        const obj = e.selected?.[0];
        if (obj) {
          setSelection(
            (obj as unknown as { name?: string }).name || String(canvas.getObjects().indexOf(obj)),
            (obj.globalCompositeOperation as BlendMode) || "source-over",
            obj.opacity
          );
        }
      });

      canvas.on("selection:updated", (e) => {
        const obj = e.selected?.[0];
        if (obj) {
          setSelection(
            (obj as unknown as { name?: string }).name || String(canvas.getObjects().indexOf(obj)),
            (obj.globalCompositeOperation as BlendMode) || "source-over",
            obj.opacity
          );
        }
      });

      canvas.on("selection:cleared", () => {
        setSelection(null);
      });

      // Mark dirty on modifications
      canvas.on("object:modified", () => setDirty(true));
      canvas.on("object:added", () => setDirty(true));
      canvas.on("object:removed", () => setDirty(true));

      return canvas;
    },
    [setSelection, setDirty]
  );

  const getCanvas = useCallback(() => canvasRef.current, []);

  const addImage = useCallback(async (imageUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return addImageToCanvas(canvas, imageUrl);
  }, []);

  const addFrame = useCallback(
    async (frameUrl: string, blendMode: BlendMode = "source-over") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      return addFrameToCanvas(canvas, frameUrl, blendMode);
    },
    []
  );

  const addText = useCallback(
    (text: string, options?: Partial<fabric.Textbox>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      return addTextToCanvas(canvas, text, options);
    },
    []
  );

  const removeSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  const setBlendMode = useCallback(
    (mode: BlendMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (active) {
        active.set("globalCompositeOperation", mode);
        canvas.renderAll();
        setSelection(
          (active as unknown as { name?: string }).name || String(canvas.getObjects().indexOf(active)),
          mode,
          active.opacity
        );
        setDirty(true);
      }
    },
    [setSelection, setDirty]
  );

  const setOpacity = useCallback(
    (opacity: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (active) {
        active.set("opacity", opacity);
        canvas.renderAll();
        setDirty(true);
      }
    },
    [setDirty]
  );

  const moveLayer = useCallback(
    (direction: "up" | "down" | "top" | "bottom") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;

      switch (direction) {
        case "up":
          canvas.bringObjectForward(active);
          break;
        case "down":
          canvas.sendObjectBackwards(active);
          break;
        case "top":
          canvas.bringObjectToFront(active);
          break;
        case "bottom":
          canvas.sendObjectToBack(active);
          break;
      }
      canvas.renderAll();
      setDirty(true);
    },
    [setDirty]
  );

  const fitToContainer = useCallback(
    (
      containerWidth: number,
      containerHeight: number,
      projectWidth: number,
      projectHeight: number
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const zoom = fitCanvasToContainer(
        canvas,
        containerWidth,
        containerHeight,
        projectWidth,
        projectHeight
      );
      setZoom(zoom);
    },
    [setZoom]
  );

  const toJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toJSON();
  }, []);

  const loadFromJSON = useCallback(async (json: object) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await canvas.loadFromJSON(json);
    canvas.renderAll();
  }, []);

  const dispose = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.dispose();
      canvasRef.current = null;
    }
  }, []);

  return {
    initialize,
    getCanvas,
    addImage,
    addFrame,
    addText,
    removeSelected,
    setBlendMode,
    setOpacity,
    moveLayer,
    fitToContainer,
    toJSON,
    loadFromJSON,
    dispose,
  };
}
