"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Frame as FrameIcon } from "lucide-react";
import type { Frame } from "@/types/database";
import type { BlendMode } from "@/types/editor";

interface FrameSelectorProps {
  organizationId: string | null;
  onFrameSelect: (frameUrl: string, blendMode: BlendMode) => void;
  onFrameUpload: (file: File) => void;
}

export default function FrameSelector({
  organizationId,
  onFrameSelect,
  onFrameUpload,
}: FrameSelectorProps) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    async function loadFrames() {
      const supabase = createClient();
      const { data } = await supabase
        .from("frames")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (data) setFrames(data);
      setLoading(false);
    }

    loadFrames();
  }, [organizationId]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        onFrameUpload(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onFrameUpload]
  );

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <FrameIcon className="h-7 w-7" />
        <span className="text-sm">Upload Frame</span>
        <span className="text-[10px] text-muted-foreground">PNG with transparency</span>
      </button>

      <Separator />

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
      ) : frames.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No frames yet. Upload a PNG with transparency to create a frame overlay.
        </p>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="grid grid-cols-2 gap-2">
            {frames.map((frame) => (
              <button
                key={frame.id}
                className="relative aspect-square rounded-lg border border-border hover:border-primary/50 overflow-hidden checkerboard transition-colors group"
                onClick={async () => {
                  const supabase = createClient();
                  const { data } = await supabase.storage
                    .from("frames")
                    .createSignedUrl(frame.storage_path, 3600);
                  if (data?.signedUrl) {
                    onFrameSelect(data.signedUrl, frame.blend_mode as BlendMode);
                  }
                }}
              >
                {frame.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={frame.thumbnail_url}
                    alt={frame.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                      {frame.name}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
