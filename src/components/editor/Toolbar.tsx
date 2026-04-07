"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editor-store";
import ExportDialog from "./ExportDialog";

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  onSave: () => void;
  onExport: (format: string, quality: number) => void;
  onRename?: (name: string) => void;
}

export default function Toolbar({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onExport,
  onRename,
}: ToolbarProps) {
  const [showExport, setShowExport] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const {
    projectName,
    zoom,
    setZoom,
    isSaving,
    lastSaved,
  } = useEditorStore();

  return (
    <div className="h-12 border-b border-border/50 bg-card flex items-center px-3 gap-2">
      {/* Back */}
      <Link href="/projects">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </Link>

      {/* Project name */}
      {editingName ? (
        <Input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={() => {
            setEditingName(false);
            if (nameValue.trim() && onRename) onRename(nameValue.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditingName(false);
              if (nameValue.trim() && onRename) onRename(nameValue.trim());
            }
          }}
          className="h-7 w-48 text-sm bg-muted border-none"
          autoFocus
        />
      ) : (
        <button
          className="text-sm font-medium text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          onClick={() => {
            setNameValue(projectName);
            setEditingName(true);
          }}
        >
          {projectName}
        </button>
      )}

      {/* Save status */}
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {isSaving ? (
          "Saving..."
        ) : lastSaved ? (
          <>
            <Check className="h-3 w-3 text-green-500" />
            Saved
          </>
        ) : (
          ""
        )}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onUndo}
          disabled={!canUndo()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onRedo}
          disabled={!canRedo()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-0.5 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setZoom(Math.min(3, zoom + 0.1))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Save + Export */}
      <div className="flex items-center gap-2 ml-2">
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" className="h-8" onClick={() => setShowExport(true)}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        onExport={onExport}
      />
    </div>
  );
}
