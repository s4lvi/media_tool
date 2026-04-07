"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  ImagePlus,
  Frame,
  Wand2,
  Download,
} from "lucide-react";
import type { Post } from "@/types/database";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setPosts(data as Post[]);
      setLoading(false);
    }
    load();
  }, []);

  async function deletePost(id: string) {
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state with onboarding
  if (posts.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-3">Welcome to Media Tool</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Create branded social media posts in three steps.
          </p>
          <Link
            href="/posts/new"
            className={buttonVariants({ size: "lg" }) + " text-base px-8 py-6 mb-12"}
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Post
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">1. Upload Photos</h3>
            <p className="text-xs text-muted-foreground">
              Pick one or more photos you want to feature.
            </p>
          </div>
          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Frame className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">2. Pick a Frame</h3>
            <p className="text-xs text-muted-foreground">
              Choose from your reusable frame templates.
            </p>
          </div>
          <div className="text-center space-y-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">3. Customize & Save</h3>
            <p className="text-xs text-muted-foreground">
              Add a heading, save the post, download as PNG.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-border bg-card p-6">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Need a frame template?
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Frames are reusable layouts you build once and apply to many posts.
          </p>
          <Link href="/frames" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Manage Frames
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Posts</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {posts.map((post) => (
          <Card key={post.id} className="group overflow-hidden">
            <Link href={`/posts/${post.id}`}>
              <div className="aspect-square bg-muted flex items-center justify-center">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnail_url}
                    alt={post.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {post.width}x{post.height}
                  </span>
                )}
              </div>
            </Link>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{post.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(post.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  deletePost(post.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
