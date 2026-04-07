"use client";

import { useRef, useCallback } from "react";
import * as fabric from "fabric";

const MAX_HISTORY = 50;

export function useUndoRedo(getCanvas: () => fabric.Canvas | null) {
  const historyRef = useRef<string[]>([]);
  const currentIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);

  const saveState = useCallback(() => {
    if (isRestoringRef.current) return;

    const canvas = getCanvas();
    if (!canvas) return;

    const json = JSON.stringify(canvas.toJSON());

    // Remove any forward history
    historyRef.current = historyRef.current.slice(
      0,
      currentIndexRef.current + 1
    );

    historyRef.current.push(json);

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }

    currentIndexRef.current = historyRef.current.length - 1;
  }, [getCanvas]);

  const undo = useCallback(async () => {
    const canvas = getCanvas();
    if (!canvas || currentIndexRef.current <= 0) return;

    isRestoringRef.current = true;
    currentIndexRef.current--;

    const json = JSON.parse(historyRef.current[currentIndexRef.current]);
    await canvas.loadFromJSON(json);
    canvas.renderAll();

    isRestoringRef.current = false;
  }, [getCanvas]);

  const redo = useCallback(async () => {
    const canvas = getCanvas();
    if (
      !canvas ||
      currentIndexRef.current >= historyRef.current.length - 1
    )
      return;

    isRestoringRef.current = true;
    currentIndexRef.current++;

    const json = JSON.parse(historyRef.current[currentIndexRef.current]);
    await canvas.loadFromJSON(json);
    canvas.renderAll();

    isRestoringRef.current = false;
  }, [getCanvas]);

  const canUndo = useCallback(() => currentIndexRef.current > 0, []);
  const canRedo = useCallback(
    () => currentIndexRef.current < historyRef.current.length - 1,
    []
  );

  const clear = useCallback(() => {
    historyRef.current = [];
    currentIndexRef.current = -1;
  }, []);

  return { saveState, undo, redo, canUndo, canRedo, clear };
}
