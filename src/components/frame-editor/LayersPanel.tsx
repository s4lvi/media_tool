"use client";

import * as fabric from "fabric";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ImageIcon,
  Type as TypeIcon,
  Square,
  Stamp,
  Palette,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { FrameObject } from "@/types/frame-template";
import { Button } from "@/components/ui/button";

interface LayersPanelProps {
  canvas: fabric.Canvas | null;
  selectedObj: fabric.Object | null;
  onSelect: (obj: fabric.Object | null) => void;
  onChange: () => void;
}

const TYPE_ICONS: Record<FrameObject["type"], typeof ImageIcon> = {
  "photo-zone": ImageIcon,
  "text-zone": TypeIcon,
  "asset": Stamp,
  "shape": Square,
  "gradient": Palette,
};

const TYPE_LABELS: Record<FrameObject["type"], string> = {
  "photo-zone": "Photo Zone",
  "text-zone": "Text",
  "asset": "Logo",
  "shape": "Shape",
  "gradient": "Gradient",
};

export default function LayersPanel({
  canvas,
  selectedObj,
  onSelect,
  onChange,
}: LayersPanelProps) {
  if (!canvas) return null;

  // fabric layers are bottom-to-top in the array; show top-to-bottom in UI
  const objects = [...canvas.getObjects()].reverse();

  function toggleVisibility(obj: fabric.Object) {
    obj.visible = !obj.visible;
    canvas?.renderAll();
    onChange();
  }

  function toggleLock(obj: fabric.Object) {
    const locked = !obj.selectable;
    obj.set({
      selectable: locked,
      evented: locked,
      lockMovementX: !locked,
      lockMovementY: !locked,
      lockRotation: !locked,
      lockScalingX: !locked,
      lockScalingY: !locked,
    });
    canvas?.renderAll();
    onChange();
  }

  function deleteLayer(obj: fabric.Object) {
    canvas?.remove(obj);
    if (selectedObj === obj) onSelect(null);
    canvas?.renderAll();
    onChange();
  }

  function moveUp(obj: fabric.Object) {
    canvas?.bringObjectForward(obj);
    canvas?.renderAll();
    onChange();
  }

  function moveDown(obj: fabric.Object) {
    canvas?.sendObjectBackwards(obj);
    canvas?.renderAll();
    onChange();
  }

  return (
    <div className="space-y-1">
      {objects.map((obj, i) => {
        const data = (obj as unknown as { data?: { frameObject: FrameObject } }).data;
        const frameObj = data?.frameObject;
        if (!frameObj) return null;
        const Icon = TYPE_ICONS[frameObj.type];
        const label = frameObj.type === "text-zone"
          ? `${TYPE_LABELS[frameObj.type]}: ${(frameObj as { defaultText?: string }).defaultText || "—"}`
          : TYPE_LABELS[frameObj.type];
        const isSelected = selectedObj === obj;
        const isLocked = !obj.selectable;
        const isHidden = obj.visible === false;

        return (
          <div
            key={i}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
              isSelected
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              if (!isLocked) {
                canvas.setActiveObject(obj);
                canvas.renderAll();
                onSelect(obj);
              }
            }}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); moveUp(obj); }}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); moveDown(obj); }}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); toggleVisibility(obj); }}
                title={isHidden ? "Show" : "Hide"}
              >
                {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); toggleLock(obj); }}
                title={isLocked ? "Unlock" : "Lock"}
              >
                {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteLayer(obj); }}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
      {objects.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No objects yet</p>
      )}
    </div>
  );
}
