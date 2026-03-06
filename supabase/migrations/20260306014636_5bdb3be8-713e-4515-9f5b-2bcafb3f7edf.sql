
-- Drop existing policies
DROP POLICY IF EXISTS "Project members can manage compliance_frameworks" ON public.compliance_frameworks;
DROP POLICY IF EXISTS "Project members can view compliance_frameworks" ON public.compliance_frameworks;
DROP POLICY IF EXISTS "Project members can update compliance_frameworks" ON public.compliance_frameworks;
DROP POLICY IF EXISTS "Project members can delete compliance_frameworks" ON public.compliance_frameworks;

-- Create helper function for compliance access
CREATE OR REPLACE FUNCTION public.can_access_compliance_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_users WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM projects WHERE id = _project_id AND created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN projects p ON p.organization_id = up.organization_id
    WHERE up.id = _user_id AND up.role = 'admin' AND p.id = _project_id
  );
$$;

-- compliance_frameworks policies
CREATE POLICY "Users can view compliance_frameworks" ON public.compliance_frameworks FOR SELECT TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can create compliance_frameworks" ON public.compliance_frameworks FOR INSERT TO authenticated WITH CHECK (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can update compliance_frameworks" ON public.compliance_frameworks FOR UPDATE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can delete compliance_frameworks" ON public.compliance_frameworks FOR DELETE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));

-- compliance_controls policies
DROP POLICY IF EXISTS "Project members can view compliance_controls" ON public.compliance_controls;
DROP POLICY IF EXISTS "Project members can manage compliance_controls" ON public.compliance_controls;
DROP POLICY IF EXISTS "Project members can update compliance_controls" ON public.compliance_controls;
DROP POLICY IF EXISTS "Project members can delete compliance_controls" ON public.compliance_controls;

CREATE POLICY "Users can view compliance_controls" ON public.compliance_controls FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM compliance_frameworks cf WHERE cf.id = framework_id AND can_access_compliance_project(cf.project_id, auth.uid())));
CREATE POLICY "Users can create compliance_controls" ON public.compliance_controls FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM compliance_frameworks cf WHERE cf.id = framework_id AND can_access_compliance_project(cf.project_id, auth.uid())));
CREATE POLICY "Users can update compliance_controls" ON public.compliance_controls FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM compliance_frameworks cf WHERE cf.id = framework_id AND can_access_compliance_project(cf.project_id, auth.uid())));
CREATE POLICY "Users can delete compliance_controls" ON public.compliance_controls FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM compliance_frameworks cf WHERE cf.id = framework_id AND can_access_compliance_project(cf.project_id, auth.uid())));

-- audit_programs policies
DROP POLICY IF EXISTS "Project members can view audit_programs" ON public.audit_programs;
DROP POLICY IF EXISTS "Project members can manage audit_programs" ON public.audit_programs;
DROP POLICY IF EXISTS "Project members can update audit_programs" ON public.audit_programs;
DROP POLICY IF EXISTS "Project members can delete audit_programs" ON public.audit_programs;

CREATE POLICY "Users can view audit_programs" ON public.audit_programs FOR SELECT TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can create audit_programs" ON public.audit_programs FOR INSERT TO authenticated WITH CHECK (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can update audit_programs" ON public.audit_programs FOR UPDATE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can delete audit_programs" ON public.audit_programs FOR DELETE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));

-- audit_findings policies
DROP POLICY IF EXISTS "Project members can view audit_findings" ON public.audit_findings;
DROP POLICY IF EXISTS "Project members can manage audit_findings" ON public.audit_findings;
DROP POLICY IF EXISTS "Project members can update audit_findings" ON public.audit_findings;
DROP POLICY IF EXISTS "Project members can delete audit_findings" ON public.audit_findings;

CREATE POLICY "Users can view audit_findings" ON public.audit_findings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM audit_programs ap WHERE ap.id = audit_id AND can_access_compliance_project(ap.project_id, auth.uid())));
CREATE POLICY "Users can create audit_findings" ON public.audit_findings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM audit_programs ap WHERE ap.id = audit_id AND can_access_compliance_project(ap.project_id, auth.uid())));
CREATE POLICY "Users can update audit_findings" ON public.audit_findings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM audit_programs ap WHERE ap.id = audit_id AND can_access_compliance_project(ap.project_id, auth.uid())));
CREATE POLICY "Users can delete audit_findings" ON public.audit_findings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM audit_programs ap WHERE ap.id = audit_id AND can_access_compliance_project(ap.project_id, auth.uid())));

-- evidence_items policies
DROP POLICY IF EXISTS "Project members can view evidence_items" ON public.evidence_items;
DROP POLICY IF EXISTS "Project members can manage evidence_items" ON public.evidence_items;
DROP POLICY IF EXISTS "Project members can update evidence_items" ON public.evidence_items;
DROP POLICY IF EXISTS "Project members can delete evidence_items" ON public.evidence_items;

CREATE POLICY "Users can view evidence_items" ON public.evidence_items FOR SELECT TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can create evidence_items" ON public.evidence_items FOR INSERT TO authenticated WITH CHECK (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can update evidence_items" ON public.evidence_items FOR UPDATE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));
CREATE POLICY "Users can delete evidence_items" ON public.evidence_items FOR DELETE TO authenticated USING (can_access_compliance_project(project_id, auth.uid()));

-- policy_control_mappings policies
DROP POLICY IF EXISTS "Project members can view policy_control_mappings" ON public.policy_control_mappings;
DROP POLICY IF EXISTS "Project members can manage policy_control_mappings" ON public.policy_control_mappings;
DROP POLICY IF EXISTS "Project members can delete policy_control_mappings" ON public.policy_control_mappings;

CREATE POLICY "Users can view policy_control_mappings" ON public.policy_control_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create policy_control_mappings" ON public.policy_control_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete policy_control_mappings" ON public.policy_control_mappings FOR DELETE TO authenticated USING (true);
