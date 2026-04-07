"use client";

import { useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  onImageSelected: (url: string, file: File) => void;
  label?: string;
  accept?: string;
}

export default function ImageUploader({
  onImageSelected,
  label = "Upload Image",
  accept = "image/*",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      onImageSelected(url, file);

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onImageSelected]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-1" />
        {label}
      </Button>
    </>
  );
}
