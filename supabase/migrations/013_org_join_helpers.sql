-- List all organizations (id/name/slug only — for signup picker)
CREATE OR REPLACE FUNCTION public.list_all_organizations()
RETURNS TABLE (id UUID, name TEXT, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.slug
  FROM organizations o
  ORDER BY o.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_organizations TO anon, authenticated;

-- Self-service join: add the calling user as a member of the org
CREATE OR REPLACE FUNCTION public.join_organization(target_org_id UUID)
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
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = target_org_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (target_org_id, caller_id, 'editor')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_organization TO authenticated;
