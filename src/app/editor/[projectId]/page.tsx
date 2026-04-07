"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/stores/editor-store";
import { useCanvas } from "@/hooks/useCanvas";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useAutoSave } from "@/hooks/useAutoSave";
import { exportCanvas, downloadDataUrl } from "@/lib/fabric/export";
import { uploadFile, getStoragePath } from "@/lib/supabase/storage";
import EditorCanvas from "@/components/editor/Canvas";
import Toolbar from "@/components/editor/Toolbar";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import LeftPanel from "@/components/editor/LeftPanel";
import type { BlendMode } from "@/types/editor";
import type { Project } from "@/types/database";

export default function EditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<ReturnType<typeof useCanvas> | null>(null);

  const {
    setProjectInfo,
    projectWidth,
    projectHeight,
  } = useEditorStore();

  // Load project
  useEffect(() => {
    async function loadProject() {
      const supabase = createClient();

      if (projectId === "new") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (!membership) {
          setLoading(false);
          return;
        }

        setOrgId(membership.organization_id);

        const { data: newProject } = await supabase
          .from("projects")
          .insert({
            organization_id: membership.organization_id,
            created_by: user.id,
            name: "Untitled Project",
            width: 1080,
            height: 1080,
            canvas_json: {},
          })
          .select()
          .single();

        if (newProject) {
          setProject(newProject);
          setProjectInfo({
            id: newProject.id,
            name: newProject.name,
            width: newProject.width,
            height: newProject.height,
          });
          window.history.replaceState(null, "", `/editor/${newProject.id}`);
        }
      } else {
        const { data } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (data) {
          setProject(data);
          setOrgId(data.organization_id);
          setProjectInfo({
            id: data.id,
            name: data.name,
            width: data.width,
            height: data.height,
          });
        }
      }

      setLoading(false);
    }

    loadProject();
  }, [projectId, setProjectInfo]);

  const handleCanvasReady = useCallback(
    (canvas: ReturnType<typeof useCanvas>) => {
      canvasRef.current = canvas;
      if (
        project?.canvas_json &&
        Object.keys(project.canvas_json).length > 0
      ) {
        canvas.loadFromJSON(project.canvas_json);
      }
    },
    [project]
  );

  const undoRedo = useUndoRedo(() => canvasRef.current?.getCanvas() ?? null);
  useAutoSave(
    () => canvasRef.current?.toJSON() ?? null,
    () => canvasRef.current?.getCanvas() ?? null
  );

  const handleAddImage = useCallback(async (url: string) => {
    if (!canvasRef.current) return;
    await canvasRef.current.addImage(url);
  }, []);

  const handleAddFrame = useCallback(
    async (frameUrl: string, blendMode: BlendMode) => {
      if (!canvasRef.current) return;
      await canvasRef.current.addFrame(frameUrl, blendMode);
    },
    []
  );

  const handleFrameUpload = useCallback(
    async (file: File) => {
      if (!orgId) return;

      const path = getStoragePath(orgId, "frames", file.name);
      await uploadFile("frames", path, file);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("frames").insert({
        organization_id: orgId,
        created_by: user?.id,
        name: file.name.replace(/\.[^.]+$/, ""),
        aspect_ratio: `${projectWidth}:${projectHeight}`,
        storage_path: path,
        blend_mode: "source-over",
      });

      const { data: signed } = await supabase.storage.from("frames").createSignedUrl(path, 3600);
      if (canvasRef.current && signed?.signedUrl) {
        await canvasRef.current.addFrame(signed.signedUrl, "source-over");
      }
    },
    [orgId, projectWidth, projectHeight]
  );

  const handleAddText = useCallback((preset: "heading" | "subheading" | "body", fontFamily?: string) => {
    if (!canvasRef.current) return;
    const presets = {
      heading: { text: "HEADING", fontSize: 72, fontWeight: "bold" },
      subheading: { text: "Subheading", fontSize: 48, fontWeight: "600" },
      body: { text: "Body text", fontSize: 24, fontWeight: "normal" },
    };
    const p = presets[preset];
    canvasRef.current.addText(p.text, {
      fontSize: p.fontSize,
      fontWeight: p.fontWeight,
      fontFamily: fontFamily || "Arial",
    });
  }, []);

  const handleAddLogo = useCallback(async (url: string) => {
    if (!canvasRef.current) return;
    await canvasRef.current.addImage(url);
  }, []);

  const handleExport = useCallback(
    (format: string, quality: number) => {
      const canvas = canvasRef.current?.getCanvas();
      if (!canvas) return;

      const dataUrl = exportCanvas(canvas, projectWidth, projectHeight, {
        format: format as "png" | "jpeg" | "webp",
        quality,
        multiplier: 1,
      });

      const projectName = useEditorStore.getState().projectName;
      downloadDataUrl(dataUrl, `${projectName}.${format}`);
    },
    [projectWidth, projectHeight]
  );

  const handleRename = useCallback(async (name: string) => {
    if (!project) return;
    const supabase = createClient();
    await supabase.from("projects").update({ name }).eq("id", project.id);
    setProject((prev) => prev ? { ...prev, name } : prev);
    useEditorStore.getState().setProjectInfo({
      id: project.id,
      name,
      width: projectWidth,
      height: projectHeight,
    });
  }, [project, projectWidth, projectHeight]);

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || !project) return;
    const json = canvasRef.current.toJSON();
    if (!json) return;

    const supabase = createClient();
    await supabase
      .from("projects")
      .update({
        canvas_json: json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    useEditorStore.getState().setDirty(false);
    useEditorStore.getState().setLastSaved(new Date());
  }, [project]);

  const handleDuplicate = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: typeof active) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  }, []);

  const handleChangeSize = useCallback(
    (width: number, height: number) => {
      setProjectInfo({
        id: project?.id || "",
        name: project?.name || "Untitled",
        width,
        height,
      });
    },
    [project, setProjectInfo]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Toolbar
        onUndo={undoRedo.undo}
        onRedo={undoRedo.redo}
        canUndo={undoRedo.canUndo}
        canRedo={undoRedo.canRedo}
        onSave={handleSave}
        onExport={handleExport}
        onRename={handleRename}
      />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel
          organizationId={orgId}
          onAddImage={(url) => handleAddImage(url)}
          onAddFrame={handleAddFrame}
          onFrameUpload={handleFrameUpload}
          onAddText={handleAddText}
          onAddLogo={handleAddLogo}
          onChangeSize={handleChangeSize}
        />
        <EditorCanvas onCanvasReady={handleCanvasReady} />
        <PropertiesPanel
          onBlendModeChange={(mode) => canvasRef.current?.setBlendMode(mode)}
          onOpacityChange={(opacity) => canvasRef.current?.setOpacity(opacity)}
          onLayerMove={(dir) => canvasRef.current?.moveLayer(dir)}
          onDelete={() => canvasRef.current?.removeSelected()}
          onDuplicate={handleDuplicate}
        />
      </div>
    </div>
  );
}
