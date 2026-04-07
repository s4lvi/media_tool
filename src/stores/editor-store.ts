import { create } from "zustand";
import type { EditorTool, BlendMode } from "@/types/editor";

interface EditorState {
  // Tool state
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;

  // Project info
  projectId: string | null;
  projectName: string;
  projectWidth: number;
  projectHeight: number;
  setProjectInfo: (info: {
    id: string;
    name: string;
    width: number;
    height: number;
  }) => void;

  // Selection
  selectedObjectId: string | null;
  selectedBlendMode: BlendMode;
  selectedOpacity: number;
  setSelection: (
    objectId: string | null,
    blendMode?: BlendMode,
    opacity?: number
  ) => void;

  // Canvas zoom
  zoom: number;
  setZoom: (zoom: number) => void;

  // Panel visibility
  showProperties: boolean;
  showLayers: boolean;
  toggleProperties: () => void;
  toggleLayers: () => void;

  // Dirty state
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;

  // Saving state
  isSaving: boolean;
  setSaving: (saving: boolean) => void;
  lastSaved: Date | null;
  setLastSaved: (date: Date) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),

  projectId: null,
  projectName: "Untitled Project",
  projectWidth: 1080,
  projectHeight: 1080,
  setProjectInfo: (info) =>
    set({
      projectId: info.id,
      projectName: info.name,
      projectWidth: info.width,
      projectHeight: info.height,
    }),

  selectedObjectId: null,
  selectedBlendMode: "source-over",
  selectedOpacity: 1,
  setSelection: (objectId, blendMode, opacity) =>
    set({
      selectedObjectId: objectId,
      ...(blendMode && { selectedBlendMode: blendMode }),
      ...(opacity !== undefined && { selectedOpacity: opacity }),
    }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  showProperties: true,
  showLayers: false,
  toggleProperties: () =>
    set((state) => ({ showProperties: !state.showProperties })),
  toggleLayers: () => set((state) => ({ showLayers: !state.showLayers })),

  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),

  isSaving: false,
  setSaving: (saving) => set({ isSaving: saving }),
  lastSaved: null,
  setLastSaved: (date) => set({ lastSaved: date }),
}));
