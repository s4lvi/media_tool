"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { LogOut, Plus, Settings, ChevronDown, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveOrgIdCookie, resolveActiveOrgId } from "@/lib/active-org";
import type { Organization } from "@/types/database";

const NAV_LINKS = [
  { href: "/posts", label: "Posts" },
  { href: "/frames", label: "Frames" },
  { href: "/assets", label: "Assets" },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function loadOrgs() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id);
      if (!memberships || memberships.length === 0) return;
      const orgIds = memberships.map((m) => m.organization_id);
      const { data: orgsData } = await supabase
        .from("organizations")
        .select("*")
        .in("id", orgIds);
      if (orgsData) setOrgs(orgsData as Organization[]);

      const active = await resolveActiveOrgId();
      setActiveOrgIdState(active);
    }
    loadOrgs();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function switchOrg(orgId: string) {
    setActiveOrgIdCookie(orgId);
    setActiveOrgIdState(orgId);
    window.location.reload();
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <>
      <header className="h-14 border-b border-border/50 bg-card flex items-center px-4 relative z-30">
        <Link href="/posts" className="flex items-center gap-2 mr-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logos/ACP-Logo-White.svg" alt="" className="h-7 w-7 object-contain" />
          <span className="text-base sm:text-lg font-semibold">Media Tool</span>
        </Link>

        {/* DESKTOP — visible md+ */}
        <div className="hidden md:flex items-center flex-1">
          {orgs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-4 outline-none">
                {activeOrg?.name || "Select org"}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {orgs.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrg(org.id)}
                    className={activeOrgId === org.id ? "bg-primary/10 text-primary" : ""}
                  >
                    {org.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="h-3 w-3 mr-2" />
                  Manage Organizations
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <nav className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <Link href="/posts/new" className={buttonVariants({ size: "sm" }) + " mr-2"}>
            <Plus className="h-4 w-4 mr-1" />
            New Post
          </Link>

          <Link href="/settings" className="mr-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* MOBILE — visible below md */}
        <div className="flex md:hidden items-center flex-1 justify-end gap-1">
          <Link href="/posts/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* MOBILE drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-card border-l border-border/50 flex flex-col">
            <div className="flex items-center justify-between h-14 px-4 border-b border-border/50">
              <span className="text-sm font-semibold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {/* Org switcher */}
              {orgs.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                    Organization
                  </div>
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => switchOrg(org.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        activeOrgId === org.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {org.name}
                    </button>
                  ))}
                  <div className="border-t border-border/50 my-2" />
                </>
              )}

              {/* Nav */}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1">
                Navigate
              </div>
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <div className="border-t border-border/50 my-2" />

              <Link
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
