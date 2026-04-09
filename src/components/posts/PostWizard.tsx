"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { renderFrameTemplate, frameToDataUrl } from "@/lib/frames/renderer";
import { resolveAssetPath, makeAssetRef, isAssetRef } from "@/lib/frames/asset-resolver";
import { exportVideoWithFrame, downloadBlob, isVideoFile, isVideoUrl, extractVideoPoster } from "@/lib/frames/video-export";
import { ASPECT_RATIO_PRESETS } from "@/types/editor";
import { uploadFile, getStoragePath } from "@/lib/supabase/storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ImagePlus,
  X,
  Wand2,
  Download,
  ChevronLeft,
  Loader2,
  Sparkles,
  Save,
} from "lucide-react";
import type { FrameTemplate } from "@/types/frame-template";
import type { Post } from "@/types/database";

type Step = "photos" | "frame" | "details" | "preview";

interface PostWizardProps {
  initialPost?: Post;
}

interface PhotoItem {
  // Either a local file (just uploaded) or a persistent ref (loaded from existing post)
  file?: File;
  ref?: string;        // assets://bucket/path
  previewUrl: string;  // local blob: or signed URL for display
  isVideo?: boolean;
}

export default function PostWizard({ initialPost }: PostWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialPost ? "preview" : "photos");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosLoading, setPhotosLoading] = useState(!!initialPost);
  const [heading, setHeading] = useState(initialPost?.text_content?.heading || "");
  const [subheading, setSubheading] = useState(initialPost?.text_content?.subheading || "");
  const [selectedRatio, setSelectedRatio] = useState(
    initialPost
      ? ASPECT_RATIO_PRESETS.find(
          (r) => r.width === initialPost.width && r.height === initialPost.height
        ) || ASPECT_RATIO_PRESETS[0]
      : ASPECT_RATIO_PRESETS[0]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialPost?.frame_template_id || null
  );
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postId, setPostId] = useState<string | null>(initialPost?.id || null);
  const [postName, setPostName] = useState(initialPost?.name || "Untitled Post");
  const [isPublic, setIsPublic] = useState(initialPost?.is_public || false);
  const [videoExportProgress, setVideoExportProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track all object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    photos.forEach((p) => {
      if (p.previewUrl.startsWith("blob:")) objectUrlsRef.current.add(p.previewUrl);
    });
  }, [photos]);
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  // Load frame templates
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("frame_templates").select("*");
      if (data) setFrameTemplates(data as FrameTemplate[]);
    }
    load();
  }, []);

  // Load existing post photos (resolve refs to signed URLs for display)
  useEffect(() => {
    if (!initialPost) return;
    async function loadPhotos() {
      const refs = initialPost!.photo_refs || [];
      const items = await Promise.all(
        refs.map(async (ref) => {
          const previewUrl = await resolveAssetPath(ref);
          return {
            ref,
            previewUrl,
            isVideo: isVideoUrl(ref) || isVideoUrl(previewUrl),
          } as PhotoItem;
        })
      );
      setPhotos(items);
      setPhotosLoading(false);
    }
    loadPhotos();
  }, [initialPost]);

  const handleAddPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: PhotoItem[] = files
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
        isVideo: isVideoFile(f),
      }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed.previewUrl.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Resolve any unresolved photo refs (e.g. when re-rendering with assets:// refs)
  const getRenderPhotoUrls = useCallback(async (): Promise<string[]> => {
    return Promise.all(
      photos.map(async (p) => {
        if (p.ref && isAssetRef(p.ref)) return resolveAssetPath(p.ref);
        return p.previewUrl;
      })
    );
  }, [photos]);

  // Filter compatible templates
  const compatible = frameTemplates.filter(
    (t) =>
      photos.length >= t.min_photos &&
      t.aspect_ratio === selectedRatio.ratio
  );

  const selectedTemplate = frameTemplates.find((t) => t.id === selectedTemplateId);

  // Render preview when entering preview step or when settings change
  const renderPreview = useCallback(async () => {
    if (!selectedTemplate) return;
    setRendering(true);
    let offscreen: HTMLCanvasElement | null = null;
    let fc: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
    try {
      const rawPhotoUrls = await getRenderPhotoUrls();
      const photoUrls = await Promise.all(
        rawPhotoUrls.map(async (url, i) => {
          if (photos[i]?.isVideo) {
            try { return await extractVideoPoster(url); } catch { return url; }
          }
          return url;
        })
      );
      offscreen = document.createElement("canvas");
      offscreen.style.position = "fixed";
      offscreen.style.left = "-99999px";
      document.body.appendChild(offscreen);
      fc = await renderFrameTemplate(offscreen, selectedTemplate, {
        scale: 0.7,
        photos: photoUrls,
        texts: { heading, subheading },
      });
      const dataUrl = frameToDataUrl(fc, "png", 1);
      setPreviewDataUrl(dataUrl);
    } catch (e) {
      console.error("Render failed:", e);
    } finally {
      if (fc) fc.dispose();
      if (offscreen?.parentNode) offscreen.parentNode.removeChild(offscreen);
      setRendering(false);
    }
  }, [selectedTemplate, getRenderPhotoUrls, heading, subheading]);

  useEffect(() => {
    if (step === "preview" && selectedTemplate && photos.length > 0 && !photosLoading) {
      renderPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTemplateId, heading, subheading, photosLoading]);

  // Upload local files to storage and convert to refs
  const ensurePersistentPhotos = useCallback(async (): Promise<string[]> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) throw new Error("No org");

    const refs: string[] = [];
    for (const photo of photos) {
      if (photo.ref) {
        refs.push(photo.ref);
        continue;
      }
      if (photo.file) {
        const path = getStoragePath(membership.organization_id, "uploads", photo.file.name);
        await uploadFile("assets", path, photo.file);
        refs.push(makeAssetRef("assets", path));
      }
    }
    return refs;
  }, [photos]);

  // Save the post
  const handleSave = useCallback(async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return;

      // Upload any local files to get persistent refs
      const photoRefs = await ensurePersistentPhotos();

      const payload = {
        organization_id: membership.organization_id,
        created_by: user.id,
        frame_template_id: selectedTemplate.id,
        name: postName,
        width: selectedTemplate.width,
        height: selectedTemplate.height,
        photo_refs: photoRefs,
        text_content: { heading, subheading },
        thumbnail_url: previewDataUrl,
        is_public: isPublic,
        canvas_json: {},
      };

      if (postId) {
        await supabase.from("projects").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", postId);
      } else {
        const { data: created } = await supabase.from("projects").insert(payload).select().single();
        if (created) {
          setPostId(created.id);
          window.history.replaceState(null, "", `/posts/${created.id}`);
        }
      }
    } finally {
      setSaving(false);
    }
  }, [selectedTemplate, postName, postId, heading, subheading, previewDataUrl, ensurePersistentPhotos]);

  const videoPhoto = photos.find((p) => p.isVideo);

  const handleExportVideo = useCallback(async (format: "webm" | "mp4") => {
    if (!selectedTemplate || !videoPhoto) return;
    setVideoExportProgress(0);
    try {
      const resolved = await Promise.all(
        photos.map(async (p) => ({
          url: p.ref ? await resolveAssetPath(p.ref) : p.previewUrl,
          isVideo: !!p.isVideo,
        }))
      );
      const blob = await exportVideoWithFrame(
        selectedTemplate,
        resolved,
        { heading, subheading },
        format,
        (pct) => setVideoExportProgress(pct)
      );
      downloadBlob(blob, `${postName}.${format}`);
    } catch (e) {
      console.error("Video export failed:", e);
      alert("Video export failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setVideoExportProgress(null);
    }
  }, [selectedTemplate, videoPhoto, photos, heading, subheading, postName]);

  // Export PNG at full resolution
  const handleExport = useCallback(async () => {
    if (!selectedTemplate) return;
    let offscreen: HTMLCanvasElement | null = null;
    let fc: Awaited<ReturnType<typeof renderFrameTemplate>> | null = null;
    try {
      const photoUrls = await getRenderPhotoUrls();
      offscreen = document.createElement("canvas");
      document.body.appendChild(offscreen);
      fc = await renderFrameTemplate(offscreen, selectedTemplate, {
        scale: 1,
        photos: photoUrls,
        texts: { heading, subheading },
      });
      const dataUrl = frameToDataUrl(fc, "png", 1);
      const link = document.createElement("a");
      link.download = `${postName}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      if (fc) fc.dispose();
      if (offscreen?.parentNode) offscreen.parentNode.removeChild(offscreen);
    }
  }, [selectedTemplate, getRenderPhotoUrls, heading, subheading, postName]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/posts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          {step === "preview" ? (
            <Input
              value={postName}
              onChange={(e) => setPostName(e.target.value)}
              className="h-9 text-lg font-bold bg-transparent border-none px-0"
            />
          ) : (
            <h1 className="text-2xl font-bold">{initialPost ? "Edit Post" : "New Post"}</h1>
          )}
          <p className="text-sm text-muted-foreground">
            {step === "photos" && "Pick the photos you want to feature."}
            {step === "frame" && "Choose a frame template."}
            {step === "details" && "Add a heading and subheading."}
            {step === "preview" && "Preview, save, and download."}
          </p>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-4 mb-8 border-b border-border pb-4">
        {[
          { id: "photos" as Step, label: "1. Photos", enabled: true },
          { id: "frame" as Step, label: "2. Frame", enabled: photos.length > 0 },
          { id: "details" as Step, label: "3. Details", enabled: !!selectedTemplateId },
          { id: "preview" as Step, label: "4. Preview", enabled: !!selectedTemplateId },
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

      {/* STEP 1: Photos */}
      {step === "photos" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleAddPhotos}
          />
          {photos.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full h-72 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors gap-3"
            >
              <ImagePlus className="h-12 w-12 text-muted-foreground" />
              <span className="text-lg text-muted-foreground">Click to upload photos</span>
              <span className="text-sm text-muted-foreground/60">Upload one or more images</span>
            </button>
          ) : (
            <>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group bg-black">
                    {p.isVideo ? (
                      <video src={p.previewUrl} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {p.isVideo && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                        VIDEO
                      </span>
                    )}
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex items-center justify-center"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {photos.length} photo{photos.length !== 1 ? "s" : ""} selected
              </p>
            </>
          )}
          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep("frame")} disabled={photos.length === 0}>
              Next: Pick a Frame
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Frame */}
      {step === "frame" && (
        <div>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Aspect Ratio
            </Label>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {ASPECT_RATIO_PRESETS.slice(0, 8).map((ratio) => (
                <button
                  key={ratio.label}
                  onClick={() => {
                    setSelectedRatio(ratio);
                    setSelectedTemplateId(null);
                  }}
                  className={`py-2 px-2 rounded-lg border text-center transition-colors flex flex-col items-center gap-1.5 ${
                    selectedRatio.label === ratio.label
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {(() => {
                    const [w, h] = ratio.ratio.split(":").map(Number);
                    const maxDim = 18;
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
                </button>
              ))}
            </div>
          </div>

          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
            Compatible Frames ({compatible.length})
          </Label>
          {compatible.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No frame templates match {photos.length} photo{photos.length !== 1 ? "s" : ""} at {selectedRatio.ratio}.
              </p>
              <Link href="/frames" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Manage Frames
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {compatible.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`group rounded-lg border overflow-hidden transition-colors text-left ${
                    selectedTemplateId === tmpl.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="aspect-square bg-muted">
                    {tmpl.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tmpl.thumbnail_url} alt={tmpl.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        {tmpl.aspect_ratio}
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{tmpl.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep("photos")}>Back</Button>
            <Button onClick={() => setStep("details")} disabled={!selectedTemplateId}>
              Next: Details
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Details */}
      {step === "details" && (
        <div className="max-w-lg">
          <div className="space-y-5">
            <div>
              <Label htmlFor="heading" className="text-xs text-muted-foreground uppercase tracking-wider">
                Heading
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
                Subheading
              </Label>
              <Input
                id="sub"
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                placeholder="e.g. Join us every Saturday"
                className="mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
              These fill the heading/subheading text zones in your selected frame.
            </p>
          </div>
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => setStep("frame")}>Back</Button>
            <Button onClick={() => setStep("preview")}>
              <Wand2 className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Preview */}
      {step === "preview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-muted/30 rounded-xl p-6 flex items-center justify-center min-h-[400px]">
            {rendering || photosLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : previewDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewDataUrl} alt="Preview" className="max-w-full max-h-[70vh] rounded shadow-2xl" />
            ) : (
              <p className="text-sm text-muted-foreground">No preview yet</p>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-medium">Summary</h3>
              <div className="text-xs space-y-1.5 text-muted-foreground">
                <div><strong className="text-foreground">Frame:</strong> {selectedTemplate?.name}</div>
                <div><strong className="text-foreground">Photos:</strong> {photos.length}</div>
                <div><strong className="text-foreground">Heading:</strong> {heading || "—"}</div>
                <div><strong className="text-foreground">Subheading:</strong> {subheading || "—"}</div>
                <div><strong className="text-foreground">Size:</strong> {selectedTemplate?.width}x{selectedTemplate?.height}</div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer pt-2 border-t border-border/50">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded"
                />
                <span>Public — visible to all users</span>
              </label>
            </div>
            <div className="space-y-2">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : postId ? "Save Changes" : "Save Post"}
              </Button>
              {videoPhoto ? (
                <>
                  <Button
                    onClick={() => handleExportVideo("mp4")}
                    variant="outline"
                    className="w-full"
                    disabled={videoExportProgress !== null}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {videoExportProgress !== null
                      ? `Rendering ${Math.round(videoExportProgress * 100)}%`
                      : "Download MP4"}
                  </Button>
                  <Button
                    onClick={() => handleExportVideo("webm")}
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    disabled={videoExportProgress !== null}
                  >
                    Download WebM
                  </Button>
                </>
              ) : (
                <Button onClick={handleExport} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
              )}
              <Button onClick={() => setStep("frame")} variant="ghost" className="w-full">
                Change Frame
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
