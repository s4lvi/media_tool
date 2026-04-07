"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { renderFrameTemplate, frameToDataUrl } from "@/lib/frames/renderer";
import { ASPECT_RATIO_PRESETS } from "@/types/editor";
import { uploadFile, getStoragePath } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ImagePlus,
  X,
  Wand2,
  Download,
  Pencil,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { FrameTemplate } from "@/types/frame-template";

type Step = "upload" | "details" | "results";

interface GeneratedResult {
  dataUrl: string;
  templateId: string;
  templateName: string;
}

export default function QuickCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIO_PRESETS[0]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load frame templates
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("frame_templates")
        .select("*");
      if (data) setFrameTemplates(data);
    }
    load();
  }, []);

  const handleAddImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.filter((f) => f.type.startsWith("image/")).map((f) => ({
      url: URL.createObjectURL(f),
      file: f,
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Track all object URLs ever created so we can revoke them on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    images.forEach((img) => objectUrlsRef.current.add(img.url));
  }, [images]);
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  // Keyboard nav for preview
  useEffect(() => {
    if (previewIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewIndex(null);
      if (e.key === "ArrowLeft") setPreviewIndex((p) => Math.max(0, (p ?? 0) - 1));
      if (e.key === "ArrowRight") setPreviewIndex((p) => Math.min(results.length - 1, (p ?? 0) + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewIndex, results.length]);

  // A template is compatible if user has AT LEAST min_photos and the ratio matches
  // (extra photos beyond max_photos are simply unused)
  const compatible = frameTemplates.filter(
    (t) =>
      images.length >= t.min_photos &&
      t.aspect_ratio === selectedRatio.ratio
  );

  const generateAll = useCallback(async () => {
    if (images.length === 0) return;
    setGenerating(true);
    setProgress({ current: 0, total: compatible.length });
    const generated: GeneratedResult[] = [];

    for (let i = 0; i < compatible.length; i++) {
      const tmpl = compatible[i];
      setProgress({ current: i + 1, total: compatible.length });

      let offscreen: HTMLCanvasElement | null = null;
      let fabricCanvas: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
      try {
        offscreen = document.createElement("canvas");
        document.body.appendChild(offscreen);
        fabricCanvas = await renderFrameTemplate(offscreen, tmpl, {
          scale: 0.5,
          photos: images.map((i) => i.url),
          texts: { heading, subheading },
        });
        const dataUrl = frameToDataUrl(fabricCanvas, "jpeg", 0.88);
        generated.push({ dataUrl, templateId: tmpl.id, templateName: tmpl.name });
      } catch (e) {
        console.error("Failed to render:", tmpl.name, e);
      } finally {
        if (fabricCanvas) fabricCanvas.dispose();
        if (offscreen?.parentNode) offscreen.parentNode.removeChild(offscreen);
      }
    }

    setResults(generated);
    setGenerating(false);
    setStep("results");
  }, [compatible, images, heading, subheading]);

  const handleExport = useCallback(async (index: number) => {
    const result = results[index];
    const tmpl = frameTemplates.find((t) => t.id === result.templateId);
    if (!tmpl) return;

    let offscreen: HTMLCanvasElement | null = null;
    let fabricCanvas: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
    try {
      offscreen = document.createElement("canvas");
      document.body.appendChild(offscreen);
      fabricCanvas = await renderFrameTemplate(offscreen, tmpl, {
        scale: 1,
        photos: images.map((i) => i.url),
        texts: { heading, subheading },
      });
      const dataUrl = frameToDataUrl(fabricCanvas, "png", 1);
      const link = document.createElement("a");
      link.download = `${tmpl.name}-${tmpl.aspect_ratio.replace(":", "x")}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      if (fabricCanvas) fabricCanvas.dispose();
      if (offscreen?.parentNode) offscreen.parentNode.removeChild(offscreen);
    }
  }, [results, frameTemplates, images, heading, subheading]);

  const handleEditInEditor = useCallback(async (index: number) => {
    const result = results[index];
    const tmpl = frameTemplates.find((t) => t.id === result.templateId);
    if (!tmpl) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) return;
    const orgId = membership.organization_id;

    // Upload all local photos to storage so they survive page navigation
    const persistentPhotoUrls: string[] = [];
    for (const img of images) {
      const path = getStoragePath(orgId, "uploads", img.file.name);
      try {
        await uploadFile("assets", path, img.file);
        const { data: signed } = await supabase.storage
          .from("assets")
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
        if (signed?.signedUrl) persistentPhotoUrls.push(signed.signedUrl);
      } catch (e) {
        console.error("Photo upload failed:", e);
        return;
      }
    }

    // Render with persistent URLs and serialize for the manual editor
    let offscreen: HTMLCanvasElement | null = null;
    let fabricCanvas: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
    let canvasJson: object = {};
    try {
      offscreen = document.createElement("canvas");
      document.body.appendChild(offscreen);
      fabricCanvas = await renderFrameTemplate(offscreen, tmpl, {
        scale: 1,
        photos: persistentPhotoUrls,
        texts: { heading, subheading },
      });
      fabricCanvas.getObjects().forEach((o) => o.set({ selectable: true, evented: true }));
      canvasJson = fabricCanvas.toJSON();
    } finally {
      if (fabricCanvas) fabricCanvas.dispose();
      if (offscreen?.parentNode) offscreen.parentNode.removeChild(offscreen);
    }

    const { data: project } = await supabase
      .from("projects")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        name: `${tmpl.name} - ${heading || "Untitled"}`,
        width: tmpl.width,
        height: tmpl.height,
        canvas_json: canvasJson,
      })
      .select()
      .single();
    if (project) router.push(`/editor/${project.id}`);
  }, [results, frameTemplates, images, heading, subheading, router]);

  const imageCount = images.length;
  const hasImages = imageCount > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Quick Create</h1>
          <p className="text-sm text-muted-foreground">
            Upload photos, set details, generate every compatible frame template
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-8 border-b border-border pb-4">
        {[
          { id: "upload" as Step, label: "1. Upload Photos", enabled: true },
          { id: "details" as Step, label: "2. Details", enabled: hasImages },
          { id: "results" as Step, label: "3. Results", enabled: results.length > 0 },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => s.enabled && setStep(s.id)}
            className={`text-sm font-medium pb-1 transition-colors border-b-2 -mb-[17px] ${
              step === s.id
                ? "border-primary text-primary"
                : s.enabled
                  ? "border-transparent text-muted-foreground hover:text-foreground"
                  : "border-transparent text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            id="quick-upload"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddImages}
          />
          {images.length === 0 ? (
            <label
              htmlFor="quick-upload"
              className="flex flex-col items-center justify-center w-full h-72 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer gap-3"
            >
              <ImagePlus className="h-12 w-12 text-muted-foreground" />
              <span className="text-lg text-muted-foreground">Click to upload photos</span>
              <span className="text-sm text-muted-foreground/60">Upload one or more images</span>
            </label>
          ) : (
            <div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                <label
                  htmlFor="quick-upload"
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex items-center justify-center"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {imageCount} photo{imageCount !== 1 ? "s" : ""} uploaded
              </p>
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep("details")} disabled={!hasImages}>
              Next: Set Details
            </Button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Aspect Ratio
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {ASPECT_RATIO_PRESETS.slice(0, 8).map((ratio) => (
                  <button
                    key={ratio.label}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors flex flex-col items-center gap-1.5 ${
                      selectedRatio.label === ratio.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {(() => {
                      const [w, h] = ratio.ratio.split(":").map(Number);
                      const maxDim = 20;
                      const aspect = w / h;
                      const iconW = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
                      const iconH = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;
                      return (
                        <div
                          className={`rounded-[2px] ${
                            selectedRatio.label === ratio.label
                              ? "bg-primary/40 border border-primary/60"
                              : "bg-muted-foreground/20 border border-muted-foreground/30"
                          }`}
                          style={{ width: iconW, height: iconH }}
                        />
                      );
                    })()}
                    <div className="text-xs font-medium">{ratio.ratio}</div>
                    <div className="text-[10px] text-muted-foreground leading-none">{ratio.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="heading" className="text-xs text-muted-foreground uppercase tracking-wider">
                Heading (optional)
              </Label>
              <Input
                id="heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="e.g. Community Garden Work"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="sub" className="text-xs text-muted-foreground uppercase tracking-wider">
                Subheading (optional)
              </Label>
              <Input
                id="sub"
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                placeholder="e.g. Join us every Saturday at 10am"
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm">
                <Sparkles className="h-4 w-4 inline mr-1 text-primary" />
                <strong>{compatible.length}</strong> frame template{compatible.length !== 1 ? "s" : ""} compatible with {imageCount} photo{imageCount !== 1 ? "s" : ""} at {selectedRatio.ratio}
              </p>
              {compatible.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No templates match. <Link href="/frames/edit/new" className="text-primary underline">Create one</Link>.
                </p>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            <Button onClick={generateAll} disabled={generating || compatible.length === 0} size="lg">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating {progress.current}/{progress.total}...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "results" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} at {selectedRatio.ratio}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("details")}>
                Adjust & Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setResults([]);
                }}
              >
                Start Over
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((result, i) => (
              <div
                key={i}
                className="rounded-xl border border-border overflow-hidden bg-card group hover:border-primary/30 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.dataUrl}
                  alt={result.templateName}
                  className="w-full cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setPreviewIndex(i)}
                />
                <div className="p-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{result.templateName}</p>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEditInEditor(i)}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleExport(i)}>
                      <Download className="h-3 w-3 mr-1" />
                      PNG
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewIndex !== null && results[previewIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewIndex(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white">
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={results[previewIndex].dataUrl}
              alt={results[previewIndex].templateName}
              className="max-h-[75vh] w-auto rounded-lg object-contain"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                  disabled={previewIndex === 0}
                  className="text-white/70 hover:text-white disabled:text-white/20 text-sm"
                >
                  &larr; Prev
                </button>
                <span className="text-white/50 text-sm">{previewIndex + 1} / {results.length}</span>
                <button
                  onClick={() => setPreviewIndex(Math.min(results.length - 1, previewIndex + 1))}
                  disabled={previewIndex === results.length - 1}
                  className="text-white/70 hover:text-white disabled:text-white/20 text-sm"
                >
                  Next &rarr;
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/70 text-sm font-medium">{results[previewIndex].templateName}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { handleEditInEditor(previewIndex); setPreviewIndex(null); }}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => handleExport(previewIndex)}>
                  <Download className="h-3 w-3 mr-1" />
                  PNG
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
