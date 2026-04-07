import { createClient } from "@/lib/supabase/client";

const COOKIE_NAME = "current_org_id";
const COOKIE_DAYS = 365;

export function getActiveOrgIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(COOKIE_NAME + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function setActiveOrgIdCookie(orgId: string) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_DAYS);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(orgId)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Resolve the active org id for the current user.
 * Uses cookie if set, otherwise falls back to first org membership.
 * Returns null if user has no orgs.
 */
export async function resolveActiveOrgId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Load all memberships
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) return null;
  const memberOrgIds = memberships.map((m) => m.organization_id);

  // Try cookie value first
  const cookieOrgId = getActiveOrgIdFromCookie();
  if (cookieOrgId && memberOrgIds.includes(cookieOrgId)) {
    return cookieOrgId;
  }

  // Fallback to first membership; persist to cookie
  const fallback = memberOrgIds[0];
  setActiveOrgIdCookie(fallback);
  return fallback;
}
