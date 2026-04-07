"use client";

import * as fabric from "fabric";
import { useState, useEffect } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Trash2,
  Copy,
  Bold,
  Italic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FrameObject, TextZone, ShapeObject, PhotoZone, AssetObject, GradientObject } from "@/types/frame-template";
import { ALL_FONTS } from "@/lib/fonts";

interface PropertiesPanelProps {
  obj: fabric.Object;
  canvasWidth: number;
  canvasHeight: number;
  maxPhotos: number;
  onChange: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayerMove: (dir: "up" | "down" | "top" | "bottom") => void;
  onRebuildGradient: () => void;
}

export default function PropertiesPanel({
  obj,
  canvasWidth,
  canvasHeight,
  maxPhotos,
  onChange,
  onDelete,
  onDuplicate,
  onLayerMove,
  onRebuildGradient,
}: PropertiesPanelProps) {
  const data = (obj as unknown as { data?: { frameObject: FrameObject } }).data;
  const frameObj = data?.frameObject;
  const [, forceUpdate] = useState({});

  // Re-render when fabric object is modified externally
  useEffect(() => {
    const handler = () => forceUpdate({});
    obj.on("modified", handler);
    return () => { obj.off("modified", handler); };
  }, [obj]);

  if (!frameObj) return null;

  const update = (updates: Partial<fabric.Object>) => {
    obj.set(updates);
    obj.setCoords();
    onChange();
    forceUpdate({});
  };

  const align = (target: "left" | "center-x" | "right" | "top" | "center-y" | "bottom") => {
    const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
    const updates: Partial<fabric.Object> = {};
    if (target === "left") updates.left = 0;
    if (target === "center-x") updates.left = (canvasWidth - w) / 2;
    if (target === "right") updates.left = canvasWidth - w;
    if (target === "top") updates.top = 0;
    if (target === "center-y") updates.top = (canvasHeight - h) / 2;
    if (target === "bottom") updates.top = canvasHeight - h;
    update(updates);
  };

  // Numeric x/y/w/h inputs
  const positionFields = (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position & Size</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">X</Label>
          <Input
            type="number"
            value={Math.round(obj.left ?? 0)}
            onChange={(e) => update({ left: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Y</Label>
          <Input
            type="number"
            value={Math.round(obj.top ?? 0)}
            onChange={(e) => update({ top: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">W</Label>
          <Input
            type="number"
            value={Math.round((obj.width ?? 0) * (obj.scaleX ?? 1))}
            onChange={(e) => {
              const newW = Number(e.target.value);
              const baseW = obj.width || 1;
              update({ scaleX: newW / baseW });
            }}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">H</Label>
          <Input
            type="number"
            value={Math.round((obj.height ?? 0) * (obj.scaleY ?? 1))}
            onChange={(e) => {
              const newH = Number(e.target.value);
              const baseH = obj.height || 1;
              update({ scaleY: newH / baseH });
            }}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
        <p className="text-sm font-medium capitalize">{frameObj.type.replace("-", " ")}</p>
      </div>

      {positionFields}

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Opacity</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round((obj.opacity ?? 1) * 100)}%
          </span>
        </div>
        <Slider
          value={[obj.opacity ?? 1]}
          onValueChange={(v) => update({ opacity: Array.isArray(v) ? v[0] : v })}
          min={0}
          max={1}
          step={0.01}
        />
      </div>

      {/* Rotation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rotation</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(obj.angle ?? 0)}°
          </span>
        </div>
        <Slider
          value={[obj.angle ?? 0]}
          onValueChange={(v) => update({ angle: Array.isArray(v) ? v[0] : v })}
          min={-180}
          max={180}
          step={1}
        />
      </div>

      {/* Layer order */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Layer Order</Label>
        <div className="grid grid-cols-4 gap-1">
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onLayerMove("top")} title="Bring to front">
            <ChevronsUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onLayerMove("up")} title="Move up">
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onLayerMove("down")} title="Move down">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => onLayerMove("bottom")} title="Send to back">
            <ChevronsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Align to Canvas</Label>
        <div className="grid grid-cols-3 gap-1">
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("left")} title="Align left">
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("center-x")} title="Center horizontally">
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("right")} title="Align right">
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("top")} title="Align top">
            <AlignStartHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("center-y")} title="Center vertically">
            <AlignCenterHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-full" onClick={() => align("bottom")} title="Align bottom">
            <AlignEndHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Type-specific properties */}
      {frameObj.type === "shape" && (
        <ShapeProps frameObj={frameObj} obj={obj} update={update} />
      )}
      {frameObj.type === "text-zone" && obj instanceof fabric.Textbox && (
        <TextProps frameObj={frameObj} obj={obj} update={update} />
      )}
      {frameObj.type === "photo-zone" && (
        <PhotoZoneProps frameObj={frameObj} maxPhotos={maxPhotos} update={() => { onChange(); forceUpdate({}); }} />
      )}
      {frameObj.type === "asset" && (
        <AssetProps frameObj={frameObj} update={() => { onChange(); forceUpdate({}); }} />
      )}
      {frameObj.type === "gradient" && (
        <GradientProps frameObj={frameObj} onRebuildGradient={onRebuildGradient} />
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="h-3 w-3 mr-1" />
          Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Type-specific property editors
// ============================================================

function ShapeProps({ frameObj, obj, update }: {
  frameObj: ShapeObject;
  obj: fabric.Object;
  update: (u: Partial<fabric.Object>) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Shape</Label>
      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Fill</Label>
        <input
          type="color"
          value={typeof obj.fill === "string" ? obj.fill : "#000000"}
          onChange={(e) => {
            update({ fill: e.target.value });
            frameObj.fill = e.target.value;
          }}
          className="w-full h-8 rounded cursor-pointer"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Stroke</Label>
        <input
          type="color"
          value={typeof obj.stroke === "string" ? obj.stroke : "#000000"}
          onChange={(e) => {
            update({ stroke: e.target.value });
            frameObj.stroke = e.target.value;
          }}
          className="w-full h-8 rounded cursor-pointer"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Stroke Width</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">{obj.strokeWidth ?? 0}px</span>
        </div>
        <Slider
          value={[obj.strokeWidth ?? 0]}
          onValueChange={(v) => {
            const w = Array.isArray(v) ? v[0] : v;
            update({ strokeWidth: w });
            frameObj.strokeWidth = w;
          }}
          min={0}
          max={50}
          step={1}
        />
      </div>
      {obj instanceof fabric.Rect && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Border Radius</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">{obj.rx ?? 0}px</span>
          </div>
          <Slider
            value={[(obj as fabric.Rect).rx ?? 0]}
            onValueChange={(v) => {
              const r = Array.isArray(v) ? v[0] : v;
              (obj as fabric.Rect).set({ rx: r, ry: r });
              obj.setCoords();
              frameObj.borderRadius = r;
              update({});
            }}
            min={0}
            max={200}
            step={1}
          />
        </div>
      )}
    </div>
  );
}

function TextProps({ frameObj, obj, update }: {
  frameObj: TextZone;
  obj: fabric.Textbox;
  update: (u: Partial<fabric.Object>) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Text</Label>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Default Text</Label>
        <Input
          value={frameObj.defaultText || ""}
          onChange={(e) => {
            frameObj.defaultText = e.target.value;
            obj.set({ text: e.target.value });
            update({});
          }}
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Placeholder</Label>
        <Select
          value={frameObj.placeholder}
          onValueChange={(v) => {
            if (!v) return;
            frameObj.placeholder = v as TextZone["placeholder"];
            update({});
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="heading" className="text-xs">Heading (user input)</SelectItem>
            <SelectItem value="subheading" className="text-xs">Subheading (user input)</SelectItem>
            <SelectItem value="custom" className="text-xs">Custom (static text)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Color</Label>
        <input
          type="color"
          value={typeof obj.fill === "string" ? obj.fill : "#ffffff"}
          onChange={(e) => {
            update({ fill: e.target.value });
            frameObj.color = e.target.value;
          }}
          className="w-full h-8 rounded cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Font Family</Label>
        <Select
          value={obj.fontFamily as string || "Arial"}
          onValueChange={(v) => {
            if (!v) return;
            obj.set({ fontFamily: v });
            frameObj.fontFamily = v;
            update({});
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_FONTS.map((f) => (
              <SelectItem key={f.family} value={f.family} className="text-xs" style={{ fontFamily: `"${f.family}"` }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Font Size</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(obj.fontSize ?? 24)}</span>
        </div>
        <Slider
          value={[obj.fontSize ?? 24]}
          onValueChange={(v) => {
            const size = Array.isArray(v) ? v[0] : v;
            obj.set({ fontSize: size });
            frameObj.fontSize = size;
            update({});
          }}
          min={8}
          max={300}
          step={1}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Style</Label>
        <div className="flex gap-1">
          <Button
            variant={obj.fontWeight === "bold" || obj.fontWeight === "700" ? "secondary" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const newWeight = obj.fontWeight === "bold" || obj.fontWeight === "700" ? "normal" : "bold";
              obj.set({ fontWeight: newWeight });
              frameObj.fontWeight = newWeight;
              update({});
            }}
          >
            <Bold className="h-3 w-3" />
          </Button>
          <Button
            variant={obj.fontStyle === "italic" ? "secondary" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const newStyle = obj.fontStyle === "italic" ? "normal" : "italic";
              obj.set({ fontStyle: newStyle });
              update({});
            }}
          >
            <Italic className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Align</Label>
        <div className="grid grid-cols-3 gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <Button
              key={a}
              variant={obj.textAlign === a ? "secondary" : "outline"}
              size="icon"
              className="h-7 w-full"
              onClick={() => {
                obj.set({ textAlign: a });
                frameObj.textAlign = a;
                update({});
              }}
            >
              {a === "left" && <AlignLeft className="h-3 w-3" />}
              {a === "center" && <AlignCenter className="h-3 w-3" />}
              {a === "right" && <AlignRight className="h-3 w-3" />}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] text-muted-foreground">Uppercase</Label>
        <input
          type="checkbox"
          checked={frameObj.uppercase || false}
          onChange={(e) => {
            frameObj.uppercase = e.target.checked;
            update({});
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] text-muted-foreground">Drop Shadow</Label>
        <input
          type="checkbox"
          checked={frameObj.shadow || false}
          onChange={(e) => {
            frameObj.shadow = e.target.checked;
            update({});
          }}
        />
      </div>
    </div>
  );
}

function PhotoZoneProps({ frameObj, maxPhotos, update }: {
  frameObj: PhotoZone;
  maxPhotos: number;
  update: () => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Photo Zone</Label>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Photo Slot</Label>
        <Select
          value={String(frameObj.photoIndex)}
          onValueChange={(v) => {
            if (v === null) return;
            frameObj.photoIndex = Number(v);
            update();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: Math.max(maxPhotos, 4) }).map((_, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                Photo {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Scale Mode</Label>
        <Select
          value={frameObj.scaleMode}
          onValueChange={(v) => {
            if (!v) return;
            frameObj.scaleMode = v as "cover" | "contain";
            update();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover" className="text-xs">Cover (crop to fill)</SelectItem>
            <SelectItem value="contain" className="text-xs">Contain (fit inside)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] text-muted-foreground">Grayscale</Label>
        <input
          type="checkbox"
          checked={frameObj.filters?.grayscale || false}
          onChange={(e) => {
            frameObj.filters = { ...(frameObj.filters || {}), grayscale: e.target.checked };
            update();
          }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Brightness</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round((frameObj.filters?.brightness || 0) * 100)}
          </span>
        </div>
        <Slider
          value={[frameObj.filters?.brightness || 0]}
          onValueChange={(v) => {
            const val = Array.isArray(v) ? v[0] : v;
            frameObj.filters = { ...(frameObj.filters || {}), brightness: val };
            update();
          }}
          min={-1}
          max={1}
          step={0.05}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Contrast</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round((frameObj.filters?.contrast || 0) * 100)}
          </span>
        </div>
        <Slider
          value={[frameObj.filters?.contrast || 0]}
          onValueChange={(v) => {
            const val = Array.isArray(v) ? v[0] : v;
            frameObj.filters = { ...(frameObj.filters || {}), contrast: val };
            update();
          }}
          min={-1}
          max={1}
          step={0.05}
        />
      </div>
    </div>
  );
}

function AssetProps({ frameObj, update }: {
  frameObj: AssetObject;
  update: () => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logo / Asset</Label>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Scale Mode</Label>
        <Select
          value={frameObj.scaleMode}
          onValueChange={(v) => {
            if (!v) return;
            frameObj.scaleMode = v as "cover" | "contain";
            update();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contain" className="text-xs">Contain (fit inside)</SelectItem>
            <SelectItem value="cover" className="text-xs">Cover (crop to fill)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Background Plate</Label>
        <Select
          value={frameObj.backing || "none"}
          onValueChange={(v) => {
            if (!v) return;
            frameObj.backing = v === "none" ? null : (v as "dark" | "light");
            update();
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">None</SelectItem>
            <SelectItem value="dark" className="text-xs">Dark plate</SelectItem>
            <SelectItem value="light" className="text-xs">Light plate</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function GradientProps({ frameObj, onRebuildGradient }: {
  frameObj: GradientObject;
  onRebuildGradient: () => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Curve</Label>
        <div className="grid grid-cols-2 gap-1">
          {(["linear", "long-tail", "short-tail", "smooth"] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                frameObj.curve = c;
                onRebuildGradient();
              }}
              className={`text-[10px] py-1.5 px-2 rounded border transition-colors ${
                (frameObj.curve || "linear") === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gradient Stops</Label>
      {(["start", "end"] as const).map((which, idx) => {
        const stop = frameObj.stops[idx === 0 ? 0 : frameObj.stops.length - 1];
        const { color, alpha } = parseRgba(stop.color);
        return (
          <div key={which} className="space-y-2 p-2 rounded border border-border/60">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{which}</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const newStop = formatRgba(e.target.value, alpha);
                if (idx === 0) frameObj.stops[0] = { ...stop, color: newStop };
                else frameObj.stops[frameObj.stops.length - 1] = { ...stop, color: newStop };
                onRebuildGradient();
              }}
              className="w-full h-8 rounded cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Opacity</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(alpha * 100)}%</span>
            </div>
            <Slider
              value={[alpha]}
              onValueChange={(v) => {
                const a = Array.isArray(v) ? v[0] : v;
                const newStop = formatRgba(color, a);
                if (idx === 0) frameObj.stops[0] = { ...stop, color: newStop };
                else frameObj.stops[frameObj.stops.length - 1] = { ...stop, color: newStop };
                onRebuildGradient();
              }}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        );
      })}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Angle</Label>
          <span className="text-[10px] tabular-nums text-muted-foreground">{frameObj.angle}°</span>
        </div>
        <Slider
          value={[frameObj.angle]}
          onValueChange={(v) => {
            frameObj.angle = Array.isArray(v) ? v[0] : v;
            onRebuildGradient();
          }}
          min={0}
          max={360}
          step={1}
        />
      </div>
    </div>
  );
}

// rgba helpers (duplicated from page)
function parseRgba(str: string): { color: string; alpha: number } {
  if (str.startsWith("#")) {
    return { color: str.length === 9 ? str.slice(0, 7) : str, alpha: str.length === 9 ? parseInt(str.slice(7), 16) / 255 : 1 };
  }
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return { color: "#000000", alpha: 1 };
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  const [r, g, b, a = 1] = parts;
  const hex = "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return { color: hex, alpha: a };
}

function formatRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
