"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  UserPlus,
  Trash2,
  Check,
  Building2,
} from "lucide-react";
import { getActiveOrgIdFromCookie, setActiveOrgIdCookie, resolveActiveOrgId } from "@/lib/active-org";
import type { Organization } from "@/types/database";

interface OrgMember {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function SettingsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create org form
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const loadOrgs = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);
    if (!memberships || memberships.length === 0) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    const orgIds = memberships.map((m) => m.organization_id);
    const { data: orgsData } = await supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds);
    if (orgsData) setOrgs(orgsData as Organization[]);
    const active = await resolveActiveOrgId();
    setActiveOrgId(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const loadMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_org_members", { target_org_id: orgId });
    if (error) {
      console.error("Failed to load members:", error);
      setMembers([]);
    } else {
      setMembers((data || []) as OrgMember[]);
    }
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    if (activeOrgId) loadMembers(activeOrgId);
  }, [activeOrgId, loadMembers]);

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data: newOrgId, error } = await supabase.rpc("create_organization", {
      org_name: newOrgName.trim(),
      org_slug: slug,
    });
    if (error) {
      console.error("Create org failed:", error);
    } else if (newOrgId) {
      setActiveOrgIdCookie(newOrgId as unknown as string);
      setNewOrgName("");
      setShowCreateOrg(false);
      await loadOrgs();
      setActiveOrgId(newOrgId as unknown as string);
    }
    setCreating(false);
  }

  async function handleInviteMember() {
    if (!inviteEmail.trim() || !activeOrgId) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_org_member_by_email", {
      target_org_id: activeOrgId,
      member_email: inviteEmail.trim(),
      member_role: "editor",
    });
    if (error) {
      setInviteError(error.message);
    } else {
      setInviteSuccess(true);
      setInviteEmail("");
      await loadMembers(activeOrgId);
    }
    setInviting(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!activeOrgId) return;
    const supabase = createClient();
    await supabase.rpc("remove_org_member", {
      target_org_id: activeOrgId,
      target_user_id: userId,
    });
    await loadMembers(activeOrgId);
  }

  function switchOrg(orgId: string) {
    setActiveOrgIdCookie(orgId);
    setActiveOrgId(orgId);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Organizations */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your Organizations</h2>
          <Button variant="outline" size="sm" onClick={() => setShowCreateOrg(!showCreateOrg)}>
            <Plus className="h-4 w-4 mr-1" />
            New Organization
          </Button>
        </div>

        {showCreateOrg && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="org-name" className="text-xs">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Organization"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowCreateOrg(false); setNewOrgName(""); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {orgs.map((org) => (
            <Card key={org.id} className={activeOrgId === org.id ? "border-primary" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </div>
                </div>
                {activeOrgId === org.id ? (
                  <Badge variant="outline" className="text-primary border-primary">
                    <Check className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => switchOrg(org.id)}>
                    Switch
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Members of active org */}
      {activeOrg && (
        <section>
          <h2 className="text-lg font-medium mb-4">
            Members of <span className="text-primary">{activeOrg.name}</span>
          </h2>

          {/* Invite */}
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="invite-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Add member by email
              </Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1"
                />
                <Button onClick={handleInviteMember} disabled={inviting || !inviteEmail.trim()}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  {inviting ? "Adding..." : "Add"}
                </Button>
              </div>
              {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
              {inviteSuccess && <p className="text-xs text-green-500">Member added.</p>}
              <p className="text-[10px] text-muted-foreground">
                The user must already have an account. Invite-by-link coming soon.
              </p>
            </CardContent>
          </Card>

          {loadingMembers ? (
            <div className="text-sm text-muted-foreground">Loading members...</div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                    </div>
                    {m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRemoveMember(m.user_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
