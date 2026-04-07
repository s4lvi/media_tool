"use client";

import { useRef, useCallback } from "react";

const MAX_HISTORY = 50;

/**
 * Generic undo/redo history stack. Stores serialized snapshots (strings).
 */
export function useHistory<T>() {
  const stackRef = useRef<string[]>([]);
  const indexRef = useRef(-1);

  const push = useCallback((state: T) => {
    const serialized = JSON.stringify(state);
    // Drop forward history
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push(serialized);
    if (stackRef.current.length > MAX_HISTORY) stackRef.current.shift();
    indexRef.current = stackRef.current.length - 1;
  }, []);

  const undo = useCallback((): T | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    return JSON.parse(stackRef.current[indexRef.current]) as T;
  }, []);

  const redo = useCallback((): T | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current++;
    return JSON.parse(stackRef.current[indexRef.current]) as T;
  }, []);

  const canUndo = useCallback(() => indexRef.current > 0, []);
  const canRedo = useCallback(() => indexRef.current < stackRef.current.length - 1, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    indexRef.current = -1;
  }, []);

  return { push, undo, redo, canUndo, canRedo, clear };
}
