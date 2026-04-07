"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload } from "lucide-react";
import { uploadFile, getStoragePath } from "@/lib/supabase/storage";
import type { Asset } from "@/types/database";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (membership) {
        setOrgId(membership.organization_id);

        const { data } = await supabase
          .from("assets")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("created_at", { ascending: false });

        if (data) setAssets(data);
      }

      setLoading(false);
    }

    load();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!orgId) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of files) {
      const path = getStoragePath(orgId, "assets", file.name);
      try {
        await uploadFile("assets", path, file);

        const { data } = await supabase
          .from("assets")
          .insert({
            organization_id: orgId,
            uploaded_by: user?.id,
            name: file.name.replace(/\.[^.]+$/, ""),
            type: "image",
            storage_path: path,
            file_size_bytes: file.size,
          })
          .select()
          .single();

        if (data) {
          setAssets((prev) => [data, ...prev]);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [orgId]);

  async function deleteAsset(id: string) {
    const supabase = createClient();
    await supabase.from("assets").delete().eq("id", id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !orgId}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? "Uploading..." : "Upload Assets"}
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No assets yet</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !orgId}
          >
            Upload your first asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="group overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  {asset.name}
                </span>
              </div>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium truncate">{asset.name}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {asset.type}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteAsset(asset.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
