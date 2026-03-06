
DROP POLICY IF EXISTS "Project members can view remediation_tasks" ON public.remediation_tasks;
DROP POLICY IF EXISTS "Project members can insert remediation_tasks" ON public.remediation_tasks;
DROP POLICY IF EXISTS "Project members can update remediation_tasks" ON public.remediation_tasks;
DROP POLICY IF EXISTS "Project members can delete remediation_tasks" ON public.remediation_tasks;

CREATE POLICY "Users can view remediation_tasks" ON public.remediation_tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM audit_findings af JOIN audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND can_access_compliance_project(ap.project_id, auth.uid())));

CREATE POLICY "Users can create remediation_tasks" ON public.remediation_tasks FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM audit_findings af JOIN audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND can_access_compliance_project(ap.project_id, auth.uid())));

CREATE POLICY "Users can update remediation_tasks" ON public.remediation_tasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM audit_findings af JOIN audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND can_access_compliance_project(ap.project_id, auth.uid())));

CREATE POLICY "Users can delete remediation_tasks" ON public.remediation_tasks FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM audit_findings af JOIN audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND can_access_compliance_project(ap.project_id, auth.uid())));
