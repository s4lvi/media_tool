"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setActiveOrgIdCookie } from "@/lib/active-org";

const CREATE_NEW = "__create_new__";

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgChoice, setOrgChoice] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState("");
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load available organizations
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.rpc("list_all_organizations");
      if (data) setOrgs(data as OrgOption[]);
    }
    load();
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!orgChoice) {
      setError("Please pick an organization or create a new one");
      setLoading(false);
      return;
    }
    if (orgChoice === CREATE_NEW && !newOrgName.trim()) {
      setError("Enter a name for your new organization");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Signup failed");
      setLoading(false);
      return;
    }

    let orgId: string | null = null;

    if (orgChoice === CREATE_NEW) {
      const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data, error: createErr } = await supabase.rpc("create_organization_for_user", {
        org_name: newOrgName,
        org_slug: slug,
        user_id: authData.user.id,
      });
      if (createErr) {
        setError(createErr.message);
        setLoading(false);
        return;
      }
      orgId = data as unknown as string;
    } else {
      // Join existing org
      const { error: joinErr } = await supabase.rpc("join_organization", {
        target_org_id: orgChoice,
      });
      if (joinErr) {
        setError(joinErr.message);
        setLoading(false);
        return;
      }
      orgId = orgChoice;
    }

    if (orgId) setActiveOrgIdCookie(orgId);

    router.push("/posts");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Sign up to start creating branded posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              <Select value={orgChoice} onValueChange={(v) => v && setOrgChoice(v)}>
                <SelectTrigger id="org">
                  <SelectValue placeholder="Pick an organization..." />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={CREATE_NEW}>+ Create new organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {orgChoice === CREATE_NEW && (
              <div className="space-y-2">
                <Label htmlFor="newOrgName">New Organization Name</Label>
                <Input
                  id="newOrgName"
                  type="text"
                  placeholder="My Organization"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
