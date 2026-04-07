-- ============================================================
-- Comprehensive RLS fix
-- Fixes: recursive policies, signup auth issues, cross-table issues
-- ============================================================

-- ===================
-- ORGANIZATION_MEMBERS: drop ALL existing policies
-- ===================
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can add themselves as owner" ON organization_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can manage own membership" ON organization_members;

-- Users see their own memberships only (no self-reference)
CREATE POLICY "org_members_select_own"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Users can delete their own membership (leave org)
CREATE POLICY "org_members_delete_own"
  ON organization_members FOR DELETE
  USING (user_id = auth.uid());

-- INSERT handled by security definer function below (no direct insert policy needed
-- except as fallback for authenticated users adding themselves)
CREATE POLICY "org_members_insert_self"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ===================
-- ORGANIZATIONS: drop ALL existing policies
-- ===================
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON organizations;

-- Users can see orgs they belong to (uses org_members which is safe now)
CREATE POLICY "orgs_select_members"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Users can update orgs they belong to
CREATE POLICY "orgs_update_members"
  ON organizations FOR UPDATE
  USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- INSERT handled by security definer function (no direct insert needed)
-- But keep a fallback for authenticated users
CREATE POLICY "orgs_insert_authenticated"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ===================
-- FRAMES: fix policies that may recurse through org_members
-- ===================
DROP POLICY IF EXISTS "Members can view frames in their org" ON frames;
DROP POLICY IF EXISTS "Editors can create frames" ON frames;
DROP POLICY IF EXISTS "Editors can update frames" ON frames;
DROP POLICY IF EXISTS "Admins can delete frames" ON frames;

CREATE POLICY "frames_select"
  ON frames FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "frames_insert"
  ON frames FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "frames_update"
  ON frames FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "frames_delete"
  ON frames FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- ===================
-- PROJECTS: fix policies
-- ===================
DROP POLICY IF EXISTS "Members can view projects in their org" ON projects;
DROP POLICY IF EXISTS "Editors can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners can update their projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete their projects" ON projects;

CREATE POLICY "projects_select"
  ON projects FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "projects_insert"
  ON projects FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "projects_update"
  ON projects FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "projects_delete"
  ON projects FOR DELETE
  USING (created_by = auth.uid());

-- ===================
-- ASSETS: fix policies
-- ===================
DROP POLICY IF EXISTS "Members can view assets" ON assets;
DROP POLICY IF EXISTS "Editors can create assets" ON assets;
DROP POLICY IF EXISTS "Editors can delete assets" ON assets;

CREATE POLICY "assets_select"
  ON assets FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_insert"
  ON assets FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_delete"
  ON assets FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- ===================
-- EXPORTS: these are fine (user_id based, no recursion) but recreate for consistency
-- ===================
DROP POLICY IF EXISTS "Users can view their exports" ON exports;
DROP POLICY IF EXISTS "Users can create exports" ON exports;

CREATE POLICY "exports_select"
  ON exports FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "exports_insert"
  ON exports FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- ===================
-- TEMPLATES: fix policies
-- ===================
DROP POLICY IF EXISTS "Members can view org templates" ON templates;
DROP POLICY IF EXISTS "Editors can create templates" ON templates;
DROP POLICY IF EXISTS "Template creators can update" ON templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON templates;

CREATE POLICY "templates_select"
  ON templates FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR (is_published = true AND is_public = true)
  );

CREATE POLICY "templates_insert"
  ON templates FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "templates_update"
  ON templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "templates_delete"
  ON templates FOR DELETE
  USING (created_by = auth.uid());

-- ===================
-- SECURITY DEFINER function for signup (bypasses RLS)
-- ===================
CREATE OR REPLACE FUNCTION public.create_organization_for_user(
  org_name TEXT,
  org_slug TEXT,
  user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create org
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  -- Add user as owner
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, user_id, 'owner');

  RETURN new_org_id;
END;
$$;

-- Allow any authenticated user (or anon during signup) to call this function
GRANT EXECUTE ON FUNCTION public.create_organization_for_user TO anon, authenticated;
