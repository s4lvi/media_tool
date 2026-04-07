-- Extend projects table with the new "post" model:
-- A post = frame template + photos + text content (lightweight, re-rendered on demand)
-- The legacy canvas_json column becomes optional/unused

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS frame_template_id UUID REFERENCES frame_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_refs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS text_content JSONB DEFAULT '{}'::jsonb,
  ALTER COLUMN canvas_json DROP NOT NULL,
  ALTER COLUMN canvas_json SET DEFAULT '{}'::jsonb;
