import { createClient } from "@/lib/supabase/client";

const ASSET_PREFIX = "assets://";

/**
 * Wrap a Supabase storage path so we know to re-sign it later.
 */
export function makeAssetRef(bucket: string, storagePath: string): string {
  return `${ASSET_PREFIX}${bucket}/${storagePath}`;
}

export function isAssetRef(path: string): boolean {
  return path.startsWith(ASSET_PREFIX);
}

/**
 * Resolve any asset path:
 * - assets://bucket/path → fresh signed URL
 * - http(s)://... → returned as-is
 * - /assets/... or other static → returned as-is
 */
export async function resolveAssetPath(path: string): Promise<string> {
  if (!isAssetRef(path)) return path;
  const stripped = path.slice(ASSET_PREFIX.length);
  const slashIdx = stripped.indexOf("/");
  if (slashIdx === -1) return path;
  const bucket = stripped.slice(0, slashIdx);
  const storagePath = stripped.slice(slashIdx + 1);

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error || !data?.signedUrl) {
    console.warn("Failed to resolve asset:", path, error);
    return path;
  }
  return data.signedUrl;
}

/**
 * Batch resolve a set of paths efficiently.
 */
export async function resolveAssetPaths(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      const resolved = await resolveAssetPath(p);
      result.set(p, resolved);
    })
  );
  return result;
}
