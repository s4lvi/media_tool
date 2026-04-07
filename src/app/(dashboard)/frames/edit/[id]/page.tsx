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
import { renderFrameTemplate, frameToDataUrl } from "@/lib/frames/renderer";
import { useHistory } from "@/lib/frames/use-history";
import PropertiesPanel from "@/components/frame-editor/PropertiesPanel";
import LayersPanel from "@/components/frame-editor/LayersPanel";
import { ASPECT_RATIO_PRESETS } from "@/types/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Palette,
  Save,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";
import type { FrameTemplate, FrameObject } from "@/types/frame-template";
// re-export note: FrameObject is imported above and re-used in handlers below
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

  // History stack and clipboard hoisted so the canvas useEffect can use them
  const history = useHistory<{ objects: FrameObject[] }>();
  const clipboardRef = useRef<FrameObject | null>(null);

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
    canvas.on("object:modified", () => {
      forceUpdate({});
      // Snapshot AFTER modification commits
      history.push({ objects: extractFrameObjects(canvas) });
    });

    // Initial snapshot
    history.push({ objects: extractFrameObjects(canvas) });

    // Keyboard shortcuts
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const cmd = e.metaKey || e.ctrlKey;

      if ((e.key === "Delete" || e.key === "Backspace") && canvas.getActiveObject()) {
        const active = canvas.getActiveObject();
        if (active && !("isEditing" in active && (active as { isEditing: boolean }).isEditing)) {
          canvas.remove(active);
          canvas.discardActiveObject();
          canvas.renderAll();
          history.push({ objects: extractFrameObjects(canvas) });
        }
      }

      if (cmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const snap = history.undo();
        if (snap && template) {
          canvas.discardActiveObject();
          setSelectedObj(null);
          loadFrameIntoEditor(canvas, { ...template, objects: snap.objects });
        }
      }
      if (cmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const snap = history.redo();
        if (snap && template) {
          canvas.discardActiveObject();
          setSelectedObj(null);
          loadFrameIntoEditor(canvas, { ...template, objects: snap.objects });
        }
      }
      if (cmd && e.key === "c") {
        const active = canvas.getActiveObject();
        if (active) {
          const data = (active as unknown as { data?: { frameObject: FrameObject } }).data;
          if (data?.frameObject) {
            clipboardRef.current = JSON.parse(JSON.stringify(data.frameObject));
          }
        }
      }
      if (cmd && e.key === "v" && clipboardRef.current) {
        e.preventDefault();
        const cloned: FrameObject = {
          ...JSON.parse(JSON.stringify(clipboardRef.current)),
          id: crypto.randomUUID(),
          x: (clipboardRef.current.x ?? 0) + 20,
          y: (clipboardRef.current.y ?? 0) + 20,
        };
        createEditorObject(cloned).then((fabricObj) => {
          if (fabricObj && fabricCanvasRef.current) {
            fabricCanvasRef.current.add(fabricObj);
            fabricCanvasRef.current.setActiveObject(fabricObj);
            fabricCanvasRef.current.renderAll();
            setSelectedObj(fabricObj);
            history.push({ objects: extractFrameObjects(fabricCanvasRef.current) });
          }
        });
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

  // History helpers (history is hoisted above)
  const snapshotHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    history.push({ objects: extractFrameObjects(canvas) });
  }, [history]);

  const restoreSnapshot = useCallback(async (snap: { objects: FrameObject[] } | null) => {
    if (!snap || !template) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    setSelectedObj(null);
    await loadFrameIntoEditor(canvas, { ...template, objects: snap.objects });
    canvas.renderAll();
  }, [template]);

  const handleUndo = useCallback(async () => {
    const snap = history.undo();
    await restoreSnapshot(snap);
  }, [history, restoreSnapshot]);

  const handleRedo = useCallback(async () => {
    const snap = history.redo();
    await restoreSnapshot(snap);
  }, [history, restoreSnapshot]);

  // Copy/paste handlers (clipboardRef is hoisted above)
  const handleCopy = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const data = (active as unknown as { data?: { frameObject: FrameObject } }).data;
    if (data?.frameObject) {
      clipboardRef.current = JSON.parse(JSON.stringify(data.frameObject));
    }
  }, []);

  const handlePaste = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !clipboardRef.current) return;
    const cloned: FrameObject = {
      ...JSON.parse(JSON.stringify(clipboardRef.current)),
      id: crypto.randomUUID(),
      x: (clipboardRef.current.x ?? 0) + 20,
      y: (clipboardRef.current.y ?? 0) + 20,
    };
    const fabricObj = await createEditorObject(cloned);
    if (!fabricObj) return;
    canvas.add(fabricObj);
    canvas.setActiveObject(fabricObj);
    canvas.renderAll();
    setSelectedObj(fabricObj);
    snapshotHistory();
  }, [snapshotHistory]);

  // Export the current frame template as a PNG
  const handleExportPng = useCallback(async () => {
    if (!template || !fabricCanvasRef.current) return;
    fabricCanvasRef.current.discardActiveObject();
    fabricCanvasRef.current.renderAll();
    const objects = extractFrameObjects(fabricCanvasRef.current);
    const offscreen = document.createElement("canvas");
    document.body.appendChild(offscreen);
    let fc: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
    try {
      fc = await renderFrameTemplate(offscreen, { ...template, objects }, {
        scale: 1,
        editorMode: true, // show photo zone placeholders
      });
      const dataUrl = frameToDataUrl(fc, "png", 1);
      const link = document.createElement("a");
      link.download = `${template.name}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      if (fc) fc.dispose();
      if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
    }
  }, [template]);

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
        is_public: template.is_public,
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
        <label className="flex items-center gap-1.5 text-xs cursor-pointer mr-3 text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={template.is_public}
            onChange={(e) => setTemplate({ ...template, is_public: e.target.checked })}
            className="rounded"
          />
          <span>Public</span>
        </label>

        {/* Undo / Redo / Export */}
        <div className="flex items-center gap-0.5 mr-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleUndo} title="Undo (Cmd+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleRedo} title="Redo (Cmd+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleExportPng} title="Export PNG">
            <Download className="h-4 w-4" />
          </Button>
        </div>

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

        {/* Right: properties + layers */}
        <div className="w-64 bg-card border-l border-border/50 p-4 overflow-y-auto">
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-2">Layers</h3>
            <LayersPanel
              canvas={fabricCanvasRef.current}
              selectedObj={selectedObj}
              onSelect={setSelectedObj}
              onChange={() => { snapshotHistory(); forceUpdate({}); }}
            />
          </div>
          <h3 className="text-sm font-medium mb-3 pt-3 border-t border-border/50">Properties</h3>
          {selectedObj ? (
            <PropertiesPanel
              obj={selectedObj}
              canvasWidth={template.width}
              canvasHeight={template.height}
              maxPhotos={template.max_photos}
              onChange={() => {
                fabricCanvasRef.current?.renderAll();
                forceUpdate({});
                snapshotHistory();
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
