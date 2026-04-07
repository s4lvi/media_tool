"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEditorStore } from "@/stores/editor-store";

interface CanvasProps {
  onCanvasReady?: (canvas: ReturnType<typeof useCanvas>) => void;
}

export default function EditorCanvas({ onCanvasReady }: CanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas = useCanvas();
  const undoRedo = useUndoRedo(canvas.getCanvas);
  const { projectWidth, projectHeight } = useEditorStore();
  const [isDragOver, setIsDragOver] = useState(false);

  useAutoSave(canvas.toJSON, canvas.getCanvas);

  // Initialize canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const c = canvas.initialize(canvasElRef.current, {
      width: projectWidth,
      height: projectHeight,
      backgroundColor: "#ffffff",
    });

    // Fit to container
    const rect = containerRef.current.getBoundingClientRect();
    canvas.fitToContainer(rect.width, rect.height, projectWidth, projectHeight);

    // Save initial state for undo
    undoRedo.saveState();

    // Listen for modifications to save undo states
    c.on("object:modified", () => undoRedo.saveState());
    c.on("object:added", () => undoRedo.saveState());
    c.on("object:removed", () => undoRedo.saveState());

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    return () => {
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectWidth, projectHeight]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvas.fitToContainer(
        rect.width,
        rect.height,
        projectWidth,
        projectHeight
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [canvas, projectWidth, projectHeight]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getCanvas()?.getActiveObject();
        const isEditing = active && "isEditing" in active && (active as { isEditing: boolean }).isEditing;
        if (active && !isEditing) {
          canvas.removeSelected();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRedo.undo();
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        undoRedo.redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvas, undoRedo]);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          await canvas.addImage(url);
        }
      }
    },
    [canvas]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex items-center justify-center bg-background overflow-hidden relative ${isDragOver ? "drop-active" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Canvas size indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 tabular-nums">
        {projectWidth} x {projectHeight}
      </div>

      <div className="shadow-2xl shadow-black/40 rounded-sm overflow-hidden">
        <canvas ref={canvasElRef} />
      </div>

      {/* Empty state */}
      {!canvas.getCanvas()?.getObjects().length && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground/30">
            <p className="text-lg font-medium">Drop an image here</p>
            <p className="text-sm mt-1">or use the sidebar to add content</p>
          </div>
        </div>
      )}
    </div>
  );
}
