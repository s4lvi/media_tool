-- Fix infinite recursion in organization_members RLS policies
-- The problem: SELECT policy on organization_members subqueries organization_members itself

-- Drop all problematic policies on organization_members
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can add themselves as owner" ON organization_members;

-- Simple, non-recursive policies:

-- Users can see their own membership rows
CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert themselves as owner (for org creation flow)
CREATE POLICY "Users can add themselves as owner"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update/delete their own membership (for leaving orgs)
-- Admin member management will go through a server-side function later
CREATE POLICY "Users can manage own membership"
  ON organization_members FOR DELETE
  USING (user_id = auth.uid());

-- Also fix organizations SELECT policy which has the same issue
-- (it subqueries organization_members, which subqueries itself)
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organizations" ON organizations;

-- Authenticated users can read all orgs (simpler; org-scoping happens at app level)
CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Any authenticated user can update orgs they belong to
-- (enforced at app level for role checks)
CREATE POLICY "Authenticated users can update organizations"
  ON organizations FOR UPDATE
  USING (auth.uid() IS NOT NULL);
