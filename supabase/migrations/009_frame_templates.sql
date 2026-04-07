-- Frame templates: composable poster layouts with placeholders

CREATE TABLE frame_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  aspect_ratio TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  min_photos INT NOT NULL DEFAULT 1,
  max_photos INT NOT NULL DEFAULT 1,
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  is_seeded BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE frame_templates ENABLE ROW LEVEL SECURITY;

-- Members see their org's templates + seeded + public
CREATE POLICY "frame_templates_select"
  ON frame_templates FOR SELECT
  USING (
    is_seeded = true
    OR is_public = true
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "frame_templates_insert"
  ON frame_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "frame_templates_update"
  ON frame_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "frame_templates_delete"
  ON frame_templates FOR DELETE
  USING (created_by = auth.uid());
