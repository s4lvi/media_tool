"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Trash2,
  Copy,
} from "lucide-react";
import BlendModeSelector from "./BlendModeSelector";
import type { BlendMode } from "@/types/editor";

interface PropertiesPanelProps {
  onBlendModeChange: (mode: BlendMode) => void;
  onOpacityChange: (opacity: number) => void;
  onLayerMove: (direction: "up" | "down" | "top" | "bottom") => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function PropertiesPanel({
  onBlendModeChange,
  onOpacityChange,
  onLayerMove,
  onDelete,
  onDuplicate,
}: PropertiesPanelProps) {
  const { selectedObjectId, selectedBlendMode, selectedOpacity } =
    useEditorStore();

  if (!selectedObjectId) return null;

  return (
    <div className="w-64 bg-card border-l border-border/50 flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-border/50">
        <h2 className="text-sm font-medium">Properties</h2>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1">
        {/* Blend Mode */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Blend Mode
          </Label>
          <BlendModeSelector
            value={selectedBlendMode}
            onChange={onBlendModeChange}
          />
        </div>

        {/* Opacity */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Opacity
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(selectedOpacity * 100)}%
            </span>
          </div>
          <Slider
            value={[selectedOpacity]}
            onValueChange={(v) => onOpacityChange(Array.isArray(v) ? v[0] : v)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        {/* Layer ordering */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Layer Order
          </Label>
          <div className="grid grid-cols-4 gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-full"
              onClick={() => onLayerMove("top")}
              title="Bring to front"
            >
              <ChevronsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-full"
              onClick={() => onLayerMove("up")}
              title="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-full"
              onClick={() => onLayerMove("down")}
              title="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-full"
              onClick={() => onLayerMove("bottom")}
              title="Send to back"
            >
              <ChevronsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Actions
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onDuplicate}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
