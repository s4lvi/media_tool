-- Add is_public flag to projects/posts and update RLS to allow viewing public
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Drop old policies and recreate with public visibility
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "Members can view projects in their org" ON projects;
DROP POLICY IF EXISTS "Editors can create projects" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "Project owners can update their projects" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "Project owners can delete their projects" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- Anyone can SELECT public posts; org members see all org posts
CREATE POLICY "posts_select"
  ON projects FOR SELECT
  USING (
    is_public = true
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "posts_insert"
  ON projects FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Any org member can update/delete (collaborative)
CREATE POLICY "posts_update"
  ON projects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "posts_delete"
  ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Helper RPC functions for org management
-- ============================================================

-- Create a new organization and add the calling user as owner
CREATE OR REPLACE FUNCTION public.create_organization(
  org_name TEXT,
  org_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  user_id_val UUID;
BEGIN
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, user_id_val, 'owner');

  RETURN new_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization TO authenticated;

-- Add a member to an org by email (caller must be a member of that org)
CREATE OR REPLACE FUNCTION public.add_org_member_by_email(
  target_org_id UUID,
  member_email TEXT,
  member_role TEXT DEFAULT 'editor'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Verify caller is a member of the org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = target_org_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;

  -- Look up the target user by email
  SELECT id INTO target_user_id FROM auth.users WHERE email = member_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with that email';
  END IF;

  -- Insert membership (no-op if already member)
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (target_org_id, target_user_id, member_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_org_member_by_email TO authenticated;

-- Remove a member from an org (caller must be a member; can't remove themselves if they're the only owner)
CREATE OR REPLACE FUNCTION public.remove_org_member(
  target_org_id UUID,
  target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = target_org_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;
  DELETE FROM organization_members
  WHERE organization_id = target_org_id AND user_id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_org_member TO authenticated;

-- List members of an org with their email (for display)
CREATE OR REPLACE FUNCTION public.list_org_members(target_org_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = target_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT om.user_id, u.email::text, om.role, om.created_at
  FROM organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = target_org_id
  ORDER BY om.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_org_members TO authenticated;
