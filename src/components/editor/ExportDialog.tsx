"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "@/stores/editor-store";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: string, quality: number) => void;
}

export default function ExportDialog({
  open,
  onOpenChange,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(0.92);
  const { projectWidth, projectHeight } = useEditorStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => v && setFormat(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG (lossless)</SelectItem>
                <SelectItem value="jpeg">JPEG (smaller file)</SelectItem>
                <SelectItem value="webp">WebP (modern)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {format !== "png" && (
            <div className="space-y-2">
              <Label>Quality: {Math.round(quality * 100)}%</Label>
              <Slider
                value={[quality]}
                onValueChange={(v) => setQuality(Array.isArray(v) ? v[0] : v)}
                min={0.1}
                max={1}
                step={0.01}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Output Size</Label>
            <p className="text-sm text-muted-foreground">
              {projectWidth} x {projectHeight} px
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onExport(format, quality);
              onOpenChange(false);
            }}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
