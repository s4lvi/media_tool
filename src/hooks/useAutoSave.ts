"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/stores/editor-store";
import * as fabric from "fabric";

const AUTO_SAVE_DELAY = 2000;

function generateThumbnailDataUrl(canvas: fabric.Canvas, maxSize: number = 300): string | null {
  try {
    const zoom = canvas.getZoom();
    const w = canvas.getWidth() / zoom;
    const h = canvas.getHeight() / zoom;
    const scale = Math.min(maxSize / w, maxSize / h);

    return canvas.toDataURL({
      format: "jpeg",
      quality: 0.6,
      multiplier: scale / zoom,
    });
  } catch {
    return null;
  }
}

export function useAutoSave(
  getCanvasJSON: () => object | null,
  getCanvas?: () => fabric.Canvas | null
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { projectId, isDirty, setDirty, setSaving, setLastSaved } =
    useEditorStore();

  const save = useCallback(async () => {
    if (!projectId) return;

    const json = getCanvasJSON();
    if (!json) return;

    setSaving(true);

    // Generate thumbnail
    let thumbnailUrl: string | null = null;
    if (getCanvas) {
      const canvas = getCanvas();
      if (canvas) {
        thumbnailUrl = generateThumbnailDataUrl(canvas);
      }
    }

    const supabase = createClient();
    const updateData: Record<string, unknown> = {
      canvas_json: json,
      updated_at: new Date().toISOString(),
    };
    if (thumbnailUrl) {
      updateData.thumbnail_url = thumbnailUrl;
    }

    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId);

    setSaving(false);

    if (!error) {
      setDirty(false);
      setLastSaved(new Date());
    } else {
      console.error("Auto-save failed:", error);
    }
  }, [projectId, getCanvasJSON, getCanvas, setSaving, setDirty, setLastSaved]);

  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      save();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isDirty, save]);

  return { save };
}
