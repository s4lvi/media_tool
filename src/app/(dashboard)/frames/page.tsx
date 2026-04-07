"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import type { FrameTemplate } from "@/types/frame-template";
import { SEED_TEMPLATES } from "@/lib/frames/seed-templates";
import { renderFrameTemplate, frameToDataUrl } from "@/lib/frames/renderer";

export default function FramesPage() {
  const [templates, setTemplates] = useState<FrameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("frame_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTemplates(data);
      setLoading(false);
    }
    load();
  }, []);

  async function deleteTemplate(id: string) {
    const supabase = createClient();
    await supabase.from("frame_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function seedDefaults() {
    setSeeding(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSeeding(false);
      return;
    }
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      setSeeding(false);
      return;
    }

    // Skip any templates that already exist by name
    const existingNames = new Set(templates.map((t) => t.name));
    const toInsert = SEED_TEMPLATES.filter((t) => !existingNames.has(t.name)).map((t) => ({
      ...t,
      organization_id: membership.organization_id,
      created_by: user.id,
    }));

    if (toInsert.length === 0) {
      setSeeding(false);
      return;
    }

    const { data: inserted } = await supabase
      .from("frame_templates")
      .insert(toInsert)
      .select();

    if (inserted) {
      setTemplates((prev) => [...inserted, ...prev]);

      // Generate thumbnails in the background and update rows
      for (const tmpl of inserted as FrameTemplate[]) {
        try {
          const offscreen = document.createElement("canvas");
          document.body.appendChild(offscreen);
          const fc = await renderFrameTemplate(offscreen, tmpl, {
            scale: 0.3,
            editorMode: true,
          });
          const dataUrl = frameToDataUrl(fc, "jpeg", 0.7);
          fc.dispose();
          if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);

          await supabase
            .from("frame_templates")
            .update({ thumbnail_url: dataUrl })
            .eq("id", tmpl.id);

          setTemplates((prev) =>
            prev.map((t) => (t.id === tmpl.id ? { ...t, thumbnail_url: dataUrl } : t))
          );
        } catch (e) {
          console.error("Thumbnail gen failed for", tmpl.name, e);
        }
      }
    }
    setSeeding(false);
  }

  // Regenerate thumbnails for templates that are missing them
  async function regenerateMissingThumbnails() {
    const missing = templates.filter((t) => !t.thumbnail_url);
    if (missing.length === 0) return;
    setSeeding(true);
    const supabase = createClient();
    for (const tmpl of missing) {
      try {
        const offscreen = document.createElement("canvas");
        document.body.appendChild(offscreen);
        const fc = await renderFrameTemplate(offscreen, tmpl, {
          scale: 0.3,
          editorMode: true,
        });
        const dataUrl = frameToDataUrl(fc, "jpeg", 0.7);
        fc.dispose();
        if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);

        await supabase
          .from("frame_templates")
          .update({ thumbnail_url: dataUrl })
          .eq("id", tmpl.id);

        setTemplates((prev) =>
          prev.map((t) => (t.id === tmpl.id ? { ...t, thumbnail_url: dataUrl } : t))
        );
      } catch (e) {
        console.error("Thumbnail regen failed for", tmpl.name, e);
      }
    }
    setSeeding(false);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Frame Templates</h1>
        <div className="flex gap-2">
          {templates.some((t) => !t.thumbnail_url) && (
            <Button variant="outline" onClick={regenerateMissingThumbnails} disabled={seeding}>
              {seeding ? "Generating..." : "Generate Thumbnails"}
            </Button>
          )}
          <Button variant="outline" onClick={seedDefaults} disabled={seeding}>
            <Sparkles className="h-4 w-4 mr-1" />
            {seeding ? "Seeding..." : "Seed Defaults"}
          </Button>
          <Link href="/frames/edit/new" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-1" />
            New Frame
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Build reusable frame templates with photo placeholders, text, logos, shapes, and gradients.
        Used in Quick Create to compose branded posts.
      </p>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No frame templates yet</p>
          <Link href="/frames/edit/new" className={buttonVariants()}>
            Create your first frame
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="group overflow-hidden">
              <Link href={`/frames/edit/${tmpl.id}`}>
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {tmpl.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tmpl.thumbnail_url}
                      alt={tmpl.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{tmpl.aspect_ratio}</span>
                  )}
                </div>
              </Link>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tmpl.name}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {tmpl.aspect_ratio}
                      </Badge>
                      {tmpl.is_seeded && (
                        <Badge variant="outline" className="text-[10px]">seeded</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/frames/edit/${tmpl.id}`}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </Link>
                    {!tmpl.is_seeded && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteTemplate(tmpl.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
