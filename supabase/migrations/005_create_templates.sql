CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  aspect_ratio TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  thumbnail_url TEXT,
  canvas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  zone_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org templates"
  ON templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    OR (is_published = true AND is_public = true)
  );

CREATE POLICY "Editors can create templates"
  ON templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Template creators can update"
  ON templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete templates"
  ON templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Add foreign key to projects now that templates table exists
ALTER TABLE projects
  ADD CONSTRAINT projects_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL;
