-- Fix RLS for control_tests table
DROP POLICY IF EXISTS "Project members can view control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Project members can insert control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Project members can update control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Project members can delete control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Users can view control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Users can create control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Users can update control_tests" ON public.control_tests;
DROP POLICY IF EXISTS "Users can delete control_tests" ON public.control_tests;

CREATE POLICY "Users can view control_tests" ON public.control_tests FOR SELECT TO authenticated
USING (can_access_compliance_project(project_id, auth.uid()));

CREATE POLICY "Users can create control_tests" ON public.control_tests FOR INSERT TO authenticated
WITH CHECK (can_access_compliance_project(project_id, auth.uid()));

CREATE POLICY "Users can update control_tests" ON public.control_tests FOR UPDATE TO authenticated
USING (can_access_compliance_project(project_id, auth.uid()));

CREATE POLICY "Users can delete control_tests" ON public.control_tests FOR DELETE TO authenticated
USING (can_access_compliance_project(project_id, auth.uid()));