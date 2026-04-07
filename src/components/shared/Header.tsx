"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { LogOut, Plus } from "lucide-react";

const NAV_LINKS = [
  { href: "/posts", label: "Posts" },
  { href: "/frames", label: "Frames" },
  { href: "/assets", label: "Assets" },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-border/50 bg-card flex items-center px-4">
      <Link href="/posts" className="flex items-center gap-2 mr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logos/ACP-Logo-White.svg" alt="" className="h-7 w-7 object-contain" />
        <span className="text-lg font-semibold">Media Tool</span>
      </Link>

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

      <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
