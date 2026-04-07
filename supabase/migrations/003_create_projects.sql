CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  template_id UUID,
  name TEXT NOT NULL,
  canvas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects in their org"
  ON projects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project owners can update their projects"
  ON projects FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Project owners can delete their projects"
  ON projects FOR DELETE
  USING (created_by = auth.uid());
