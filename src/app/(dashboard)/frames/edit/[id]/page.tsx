"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import * as fabric from "fabric";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  loadFrameIntoEditor,
  createEditorObject,
  extractFrameObjects,
  newPhotoZone,
  newTextZone,
  newAsset,
  newShape,
  newGradient,
} from "@/lib/frames/editor-canvas";
import { ASPECT_RATIO_PRESETS } from "@/types/editor";
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
import {
  ChevronLeft,
  ImagePlus,
  Type as TypeIcon,
  Square,
  Stamp,
  Palette,
  Trash2,
  Save,
  Copy,
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
} from "lucide-react";
import type { FrameTemplate, FrameObject } from "@/types/frame-template";
import type { Asset } from "@/types/database";
import { uploadFile, getStoragePath } from "@/lib/supabase/storage";
import { makeAssetRef } from "@/lib/frames/asset-resolver";

const BUILTIN_LOGOS = [
  { label: "ACP Classic", path: "/assets/logos/ACP Logo Classic.png" },
  { label: "ACP Refined", path: "/assets/logos/ACP_logo_refined-removebg-preview.png" },
  { label: "ACP White", path: "/assets/logos/ACP-Logo-White.svg" },
  { label: "ACP White Border", path: "/assets/logos/ACP Logo White Border.svg" },
  { label: "ACP Ribbon", path: "/assets/logos/ACP_Ribbon.png" },
  { label: "ACP Wide", path: "/assets/logos/ACP_Wide.png" },
];

export default function FrameEditorPage() {
  const params = useParams();
  const router = useRouter();
  const frameId = params.id as string;
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [template, setTemplate] = useState<FrameTemplate | null>(null);
  const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null);
  const [, forceUpdate] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orgAssets, setOrgAssets] = useState<{ label: string; path: string; previewUrl: string; id: string }[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewBg, setPreviewBg] = useState<"white" | "black" | "checker">("white");

  // Load or create frame template
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadError("Not authenticated");
        return;
      }
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) {
        setLoadError("No organization found for your account");
        return;
      }
      setOrgId(membership.organization_id);

      // Load org assets (logos/images)
      const { data: assetsData } = await supabase
        .from("assets")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false });

      if (assetsData) {
        // Store assets:// refs (used in saved templates) + signed previewUrl for the picker thumbnail
        const refs = await Promise.all(
          assetsData.map(async (a: Asset) => {
            const { data: signed } = await supabase.storage
              .from("assets")
              .createSignedUrl(a.storage_path, 3600);
            return {
              id: a.id,
              label: a.name,
              path: makeAssetRef("assets", a.storage_path),
              previewUrl: signed?.signedUrl || "",
            };
          })
        );
        setOrgAssets(refs.filter((r) => r.previewUrl));
      }

      if (frameId === "new") {

        const blank: Omit<FrameTemplate, "id" | "created_at" | "updated_at"> = {
          organization_id: membership.organization_id,
          created_by: user.id,
          name: "Untitled Frame",
          description: null,
          category: "frame",
          aspect_ratio: "4:5",
          width: 1080,
          height: 1350,
          min_photos: 1,
          max_photos: 1,
          objects: [newPhotoZone(1080, 1350)],
          thumbnail_url: null,
          is_seeded: false,
          is_public: false,
          tags: [],
        };

        const { data: created, error } = await supabase
          .from("frame_templates")
          .insert(blank)
          .select()
          .single();

        if (error) {
          setLoadError(`Failed to create frame: ${error.message}`);
          return;
        }
        if (created) {
          setTemplate(created);
          window.history.replaceState(null, "", `/frames/edit/${created.id}`);
        }
      } else {
        const { data, error } = await supabase
          .from("frame_templates")
          .select("*")
          .eq("id", frameId)
          .single();
        if (error) {
          setLoadError(`Failed to load frame: ${error.message}`);
          return;
        }
        if (data) setTemplate(data);
      }
    }
    load();
  }, [frameId]);

  // Initialize fabric canvas
  useEffect(() => {
    if (!template || !canvasElRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const scale = Math.min(
      (containerRect.width - padding * 2) / template.width,
      (containerRect.height - padding * 2) / template.height,
      1
    );

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: template.width * scale,
      height: template.height * scale,
      backgroundColor: previewBg === "black" ? "#000000" : "#ffffff",
      preserveObjectStacking: true,
    });
    canvas.setZoom(scale);
    fabricCanvasRef.current = canvas;

    loadFrameIntoEditor(canvas, template);

    canvas.on("selection:created", (e) => {
      setSelectedObj(e.selected?.[0] ?? null);
    });
    canvas.on("selection:updated", (e) => {
      setSelectedObj(e.selected?.[0] ?? null);
    });
    canvas.on("selection:cleared", () => {
      setSelectedObj(null);
    });
    canvas.on("object:modified", () => forceUpdate({}));

    // Keyboard delete
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when an input/textarea has focus
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && canvas.getActiveObject()) {
        const active = canvas.getActiveObject();
        if (active && !("isEditing" in active && (active as { isEditing: boolean }).isEditing)) {
          canvas.remove(active);
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, template?.width, template?.height]);

  const addObject = useCallback(
    async (factory: () => FrameObject) => {
      const canvas = fabricCanvasRef.current;
      if (!template || !canvas) return;
      const newObj = factory();
      const fabricObj = await createEditorObject(newObj);
      if (!fabricObj) return;
      canvas.add(fabricObj);
      canvas.setActiveObject(fabricObj);
      canvas.renderAll();
      setSelectedObj(fabricObj);
    },
    [template]
  );

  const handleDelete = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      setSelectedObj(null);
    }
  }, []);

  const handleDuplicate = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const cloned = await active.clone(["data"]);
    cloned.set({
      left: (cloned.left ?? 0) + 20,
      top: (cloned.top ?? 0) + 20,
    });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();
  }, []);

  // Apply preview background changes without rebuilding canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.backgroundColor = previewBg === "black" ? "#000000" : "#ffffff";
    canvas.renderAll();
  }, [previewBg]);

  const handleLayerMove = useCallback((direction: "up" | "down" | "top" | "bottom") => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    if (direction === "up") canvas.bringObjectForward(active);
    if (direction === "down") canvas.sendObjectBackwards(active);
    if (direction === "top") canvas.bringObjectToFront(active);
    if (direction === "bottom") canvas.sendObjectToBack(active);
    canvas.renderAll();
  }, []);

  const handleRebuildGradient = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObj) return;
    const data = (selectedObj as unknown as { data?: { frameObject: FrameObject } }).data;
    if (!data?.frameObject || data.frameObject.type !== "gradient") return;

    // Capture current transform state
    const left = selectedObj.left;
    const top = selectedObj.top;
    const angle = selectedObj.angle;
    const scaleX = selectedObj.scaleX;
    const scaleY = selectedObj.scaleY;

    // Recreate the fabric object with new gradient
    const newFabricObj = await createEditorObject(data.frameObject);
    if (!newFabricObj) return;
    newFabricObj.set({ left, top, angle, scaleX, scaleY });

    canvas.remove(selectedObj);
    canvas.add(newFabricObj);
    canvas.setActiveObject(newFabricObj);
    canvas.renderAll();
    setSelectedObj(newFabricObj);
  }, [selectedObj]);

  const handleSave = useCallback(async () => {
    if (!template || !fabricCanvasRef.current) return;
    setSaving(true);

    // Discard any active selection BEFORE extracting so coords are committed
    fabricCanvasRef.current.discardActiveObject();
    fabricCanvasRef.current.renderAll();

    const objects = extractFrameObjects(fabricCanvasRef.current);
    const thumbnail = fabricCanvasRef.current.toDataURL({
      format: "jpeg",
      quality: 0.7,
      multiplier: 1,
    });

    const supabase = createClient();
    const { error } = await supabase
      .from("frame_templates")
      .update({
        name: template.name,
        description: template.description,
        category: template.category,
        aspect_ratio: template.aspect_ratio,
        width: template.width,
        height: template.height,
        min_photos: template.min_photos,
        max_photos: template.max_photos,
        objects,
        thumbnail_url: thumbnail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);

    if (error) console.error("Save failed:", error);
    setSaving(false);
  }, [template]);

  const handleSizeChange = useCallback((width: number, height: number, ratio: string) => {
    if (!template) return;
    setTemplate({ ...template, width, height, aspect_ratio: ratio });
  }, [template]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId || !template) return;
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const path = getStoragePath(orgId, "assets", file.name);
      await uploadFile("assets", path, file);

      const { data: asset } = await supabase
        .from("assets")
        .insert({
          organization_id: orgId,
          uploaded_by: user?.id,
          name: file.name.replace(/\.[^.]+$/, ""),
          type: "logo",
          storage_path: path,
          file_size_bytes: file.size,
        })
        .select()
        .single();

      if (asset) {
        const assetRef = makeAssetRef("assets", path);
        const { data: signed } = await supabase.storage
          .from("assets")
          .createSignedUrl(path, 3600);
        const newAssetRecord = {
          id: asset.id,
          label: asset.name,
          path: assetRef,
          previewUrl: signed?.signedUrl || "",
        };
        setOrgAssets((prev) => [newAssetRecord, ...prev]);
        // Auto-add to canvas using the asset ref (resolves at render time)
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const newObj = newAsset(template.width, template.height, assetRef);
          const fabricObj = await createEditorObject(newObj);
          if (fabricObj) {
            canvas.add(fabricObj);
            canvas.setActiveObject(fabricObj);
            canvas.renderAll();
            setSelectedObj(fabricObj);
          }
        }
      }
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setUploadingLogo(false);
      if (logoUploadRef.current) logoUploadRef.current.value = "";
    }
  }, [orgId, template]);

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive text-sm">{loadError}</p>
        <Link href="/frames" className="text-sm text-muted-foreground hover:text-foreground underline">
          Back to Frames
        </Link>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top toolbar */}
      <div className="h-12 border-b border-border/50 bg-card flex items-center px-3 gap-3">
        <Link href="/frames">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Input
          value={template.name}
          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
          className="h-7 w-64 text-sm bg-muted border-none"
        />
        <div className="flex-1" />
        <div className="flex items-center gap-1 mr-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Preview BG</span>
          <button
            onClick={() => setPreviewBg("white")}
            className={`w-6 h-6 rounded border-2 transition-all ${previewBg === "white" ? "border-primary scale-110" : "border-border"}`}
            style={{ backgroundColor: "#ffffff" }}
            title="White background"
          />
          <button
            onClick={() => setPreviewBg("black")}
            className={`w-6 h-6 rounded border-2 transition-all ${previewBg === "black" ? "border-primary scale-110" : "border-border"}`}
            style={{ backgroundColor: "#000000" }}
            title="Black background"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: object palette */}
        <div className="w-56 bg-card border-r border-border/50 p-3 overflow-y-auto">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Add Object</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addObject(() => newPhotoZone(template.width, template.height))}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Photo Zone
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addObject(() => newTextZone(template.width, template.height, "heading"))}
            >
              <TypeIcon className="h-4 w-4 mr-2" />
              Heading Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addObject(() => newTextZone(template.width, template.height, "subheading"))}
            >
              <TypeIcon className="h-3 w-3 mr-2" />
              Subheading Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addObject(() => newShape(template.width, template.height))}
            >
              <Square className="h-4 w-4 mr-2" />
              Shape
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => addObject(() => newGradient(template.width, template.height))}
            >
              <Palette className="h-4 w-4 mr-2" />
              Gradient
            </Button>
          </div>

          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-2">Add Logo / Asset</h3>
          <input
            ref={logoUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
          <div className="grid grid-cols-3 gap-2">
            {BUILTIN_LOGOS.map((logo) => (
              <button
                key={logo.path}
                onClick={() => addObject(() => newAsset(template.width, template.height, logo.path))}
                className="aspect-square rounded border border-border hover:border-primary/50 p-1 checkerboard transition-colors"
                title={logo.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.path} alt={logo.label} className="w-full h-full object-contain" />
              </button>
            ))}
            {orgAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => addObject(() => newAsset(template.width, template.height, asset.path))}
                className="aspect-square rounded border border-border hover:border-primary/50 p-1 checkerboard transition-colors"
                title={asset.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.previewUrl} alt={asset.label} className="w-full h-full object-contain" />
              </button>
            ))}
            <button
              onClick={() => logoUploadRef.current?.click()}
              disabled={uploadingLogo}
              className="aspect-square rounded border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Upload new logo"
            >
              {uploadingLogo ? (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </button>
          </div>

          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-2">Canvas Size</h3>
          <Select
            value={template.aspect_ratio}
            onValueChange={(v) => {
              if (!v) return;
              const preset = ASPECT_RATIO_PRESETS.find((p) => p.ratio === v);
              if (preset) handleSizeChange(preset.width, preset.height, preset.ratio);
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIO_PRESETS.map((p) => (
                <SelectItem key={p.label} value={p.ratio} className="text-xs">
                  {p.label} ({p.ratio})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Center: canvas */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-muted/40 overflow-hidden">
          <div className="shadow-2xl shadow-black/40">
            <canvas ref={canvasElRef} />
          </div>
        </div>

        {/* Right: properties */}
        <div className="w-64 bg-card border-l border-border/50 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium mb-3">Properties</h3>
          {selectedObj ? (
            <PropertiesEditor
              obj={selectedObj}
              canvasWidth={template.width}
              canvasHeight={template.height}
              onChange={() => {
                fabricCanvasRef.current?.renderAll();
                forceUpdate({});
              }}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onLayerMove={handleLayerMove}
              onRebuildGradient={handleRebuildGradient}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Select an object to edit its properties.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertiesEditor({
  obj,
  canvasWidth,
  canvasHeight,
  onChange,
  onDelete,
  onDuplicate,
  onLayerMove,
  onRebuildGradient,
}: {
  obj: fabric.Object;
  canvasWidth: number;
  canvasHeight: number;
  onChange: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayerMove: (dir: "up" | "down" | "top" | "bottom") => void;
  onRebuildGradient: () => void;
}) {
  const data = (obj as unknown as { data?: { frameObject: FrameObject } }).data;
  const frameObj = data?.frameObject;
  if (!frameObj) return null;

  const update = (updates: Partial<fabric.Object>) => {
    obj.set(updates);
    obj.setCoords();
    onChange();
  };

  // Alignment helpers — align selected object's bounding box to canvas
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

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
        <p className="text-sm font-medium capitalize">{frameObj.type.replace("-", " ")}</p>
      </div>

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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Align</Label>
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

      {/* Type-specific */}
      {frameObj.type === "shape" && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fill</Label>
          <input
            type="color"
            value={typeof obj.fill === "string" ? obj.fill : "#000000"}
            onChange={(e) => {
              update({ fill: e.target.value });
              if (frameObj.type === "shape") frameObj.fill = e.target.value;
            }}
            className="w-full h-8 rounded cursor-pointer"
          />
        </div>
      )}

      {frameObj.type === "gradient" && (
        <div className="space-y-3">
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
      )}

      {frameObj.type === "text-zone" && obj instanceof fabric.Textbox && (
        <>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Color</Label>
            <input
              type="color"
              value={typeof obj.fill === "string" ? obj.fill : "#ffffff"}
              onChange={(e) => {
                update({ fill: e.target.value });
                (frameObj as { color: string }).color = e.target.value;
              }}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Font Size</Label>
            <Slider
              value={[obj.fontSize ?? 24]}
              onValueChange={(v) => {
                const size = Array.isArray(v) ? v[0] : v;
                obj.set({ fontSize: size });
                (frameObj as { fontSize: number }).fontSize = size;
                onChange();
              }}
              min={8}
              max={200}
              step={1}
            />
          </div>
        </>
      )}

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

      <div className="pt-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground">
          Tip: drag to move, drag corners to resize, drag the top handle to rotate.
        </p>
      </div>
    </div>
  );
}

// rgba/hex helpers for gradient stops
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
  // Clamp alpha so 0 stays 0 (some renderers treat very small alpha as opaque)
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
