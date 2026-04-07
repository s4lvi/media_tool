-- Open update/delete on frame_templates to all org members
DROP POLICY IF EXISTS "frame_templates_update" ON frame_templates;
DROP POLICY IF EXISTS "frame_templates_delete" ON frame_templates;

CREATE POLICY "frame_templates_update"
  ON frame_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "frame_templates_delete"
  ON frame_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
