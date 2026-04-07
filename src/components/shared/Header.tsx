"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { LogOut, Plus, Settings, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getActiveOrgIdFromCookie, setActiveOrgIdCookie, resolveActiveOrgId } from "@/lib/active-org";
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function switchOrg(orgId: string) {
    setActiveOrgIdCookie(orgId);
    setActiveOrgIdState(orgId);
    // Hard reload so all queries pick up the new active org
    window.location.reload();
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <header className="h-14 border-b border-border/50 bg-card flex items-center px-4">
      <Link href="/posts" className="flex items-center gap-2 mr-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logos/ACP-Logo-White.svg" alt="" className="h-7 w-7 object-contain" />
        <span className="text-lg font-semibold">Media Tool</span>
      </Link>

      {/* Org switcher */}
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
    </header>
  );
}
