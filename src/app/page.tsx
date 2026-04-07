"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-bold">Media Tool</h1>
        <p className="text-lg text-muted-foreground">
          Create branded social media posts, posters, and collages for your
          organization. Upload frames, apply blend modes, and export
          high-resolution images.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className={buttonVariants()}>
            Sign In
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
