"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  ImagePlus,
  Frame,
  Type,
  Download,
  ArrowRight,
} from "lucide-react";
import type { Project } from "@/types/database";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (data) setProjects(data);
      setLoading(false);
    }

    loadProjects();
  }, []);

  async function deleteProject(id: string) {
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state with guided onboarding
  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-3">Welcome to Media Tool</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Create branded social media posts for your organization in minutes.
          </p>

          <Link
            href="/editor/new"
            className={buttonVariants({ size: "lg" }) + " text-base px-8 py-6 mb-12"}
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Post
          </Link>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">1. Upload Photos</h3>
            <p className="text-xs text-muted-foreground">
              Drag and drop your photos onto the canvas or use the upload button.
            </p>
          </div>

          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Frame className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">2. Add a Frame</h3>
            <p className="text-xs text-muted-foreground">
              Apply your branded frame overlay with configurable blend modes.
            </p>
          </div>

          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Type className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">3. Add Text & Logos</h3>
            <p className="text-xs text-muted-foreground">
              Add headings, body text, and organization logos to your design.
            </p>
          </div>

          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">4. Export</h3>
            <p className="text-xs text-muted-foreground">
              Download your finished post as a high-resolution PNG or JPEG.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-border bg-card p-6">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            Quick Start Tips
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>Go to <strong>Frames</strong> to upload your branded frame overlays (PNG with transparency)</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>Use the <strong>Logos</strong> tab in the editor to quickly add your organization logos</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>Choose from preset canvas sizes like <strong>Square (1:1)</strong>, <strong>Story (9:16)</strong>, or <strong>Landscape (16:9)</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>Use <strong>blend modes</strong> (multiply, screen, overlay) to control how frames mix with your photos</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/editor/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="group overflow-hidden">
            <Link href={`/editor/${project.id}`}>
              <div className="aspect-square bg-muted flex items-center justify-center">
                {project.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.thumbnail_url}
                    alt={project.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {project.width}x{project.height}
                  </span>
                )}
              </div>
            </Link>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium truncate">
                  {project.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  deleteProject(project.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
