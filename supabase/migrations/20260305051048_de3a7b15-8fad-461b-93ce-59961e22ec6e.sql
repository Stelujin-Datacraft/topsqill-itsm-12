
-- =============================================
-- COMPLIANCE FRAMEWORKS & CONTROLS
-- =============================================

CREATE TABLE public.compliance_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  framework_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'active',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE NOT NULL,
  control_id_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  parent_control_id UUID REFERENCES public.compliance_controls(id) ON DELETE SET NULL,
  implementation_status TEXT NOT NULL DEFAULT 'not_implemented',
  effectiveness TEXT DEFAULT 'not_tested',
  owner_id UUID,
  risk_level TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.policy_control_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID REFERENCES public.policies(id) ON DELETE CASCADE NOT NULL,
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE NOT NULL,
  mapping_notes TEXT,
  coverage_status TEXT DEFAULT 'full',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, control_id)
);

-- =============================================
-- AUDIT MANAGEMENT
-- =============================================

CREATE TABLE public.audit_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  audit_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'planned',
  scope TEXT,
  objectives TEXT,
  lead_auditor_id UUID,
  start_date DATE,
  end_date DATE,
  framework_id UUID REFERENCES public.compliance_frameworks(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.knowledge_base_folders(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID REFERENCES public.audit_programs(id) ON DELETE CASCADE NOT NULL,
  finding_ref TEXT,
  title TEXT NOT NULL,
  description TEXT,
  finding_type TEXT NOT NULL DEFAULT 'observation',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  assigned_to UUID,
  due_date DATE,
  root_cause TEXT,
  recommendation TEXT,
  management_response TEXT,
  remediation_plan TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- EVIDENCE MANAGEMENT
-- =============================================

CREATE TABLE public.evidence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL DEFAULT 'document',
  file_path TEXT,
  file_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'current',
  collection_date DATE,
  expiry_date DATE,
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE SET NULL,
  audit_id UUID REFERENCES public.audit_programs(id) ON DELETE SET NULL,
  finding_id UUID REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CONTROL TESTING
-- =============================================

CREATE TABLE public.control_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE NOT NULL,
  test_name TEXT NOT NULL,
  test_description TEXT,
  test_type TEXT NOT NULL DEFAULT 'manual',
  test_procedure TEXT,
  expected_result TEXT,
  actual_result TEXT,
  test_result TEXT NOT NULL DEFAULT 'not_tested',
  tested_by UUID,
  tested_at TIMESTAMPTZ,
  next_test_date DATE,
  notes TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- REMEDIATION TASKS
-- =============================================

CREATE TABLE public.remediation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  finding_id UUID REFERENCES public.audit_findings(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  verification_notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_control_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view compliance_frameworks"
  ON public.compliance_frameworks FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can manage compliance_frameworks"
  ON public.compliance_frameworks FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can update compliance_frameworks"
  ON public.compliance_frameworks FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can delete compliance_frameworks"
  ON public.compliance_frameworks FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can view compliance_controls"
  ON public.compliance_controls FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.compliance_frameworks cf WHERE cf.id = framework_id AND public.is_project_member(cf.project_id, auth.uid())));

CREATE POLICY "Project members can insert compliance_controls"
  ON public.compliance_controls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.compliance_frameworks cf WHERE cf.id = framework_id AND public.is_project_member(cf.project_id, auth.uid())));

CREATE POLICY "Project members can update compliance_controls"
  ON public.compliance_controls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.compliance_frameworks cf WHERE cf.id = framework_id AND public.is_project_member(cf.project_id, auth.uid())));

CREATE POLICY "Project members can delete compliance_controls"
  ON public.compliance_controls FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.compliance_frameworks cf WHERE cf.id = framework_id AND public.is_project_member(cf.project_id, auth.uid())));

CREATE POLICY "Project members can view policy_control_mappings"
  ON public.policy_control_mappings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_id AND public.is_project_member(p.project_id, auth.uid())));

CREATE POLICY "Project members can insert policy_control_mappings"
  ON public.policy_control_mappings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_id AND public.is_project_member(p.project_id, auth.uid())));

CREATE POLICY "Project members can update policy_control_mappings"
  ON public.policy_control_mappings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_id AND public.is_project_member(p.project_id, auth.uid())));

CREATE POLICY "Project members can delete policy_control_mappings"
  ON public.policy_control_mappings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_id AND public.is_project_member(p.project_id, auth.uid())));

CREATE POLICY "Project members can view audit_programs"
  ON public.audit_programs FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert audit_programs"
  ON public.audit_programs FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can update audit_programs"
  ON public.audit_programs FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can delete audit_programs"
  ON public.audit_programs FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can view audit_findings"
  ON public.audit_findings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.audit_programs ap WHERE ap.id = audit_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can insert audit_findings"
  ON public.audit_findings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.audit_programs ap WHERE ap.id = audit_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can update audit_findings"
  ON public.audit_findings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.audit_programs ap WHERE ap.id = audit_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can delete audit_findings"
  ON public.audit_findings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.audit_programs ap WHERE ap.id = audit_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can view evidence_items"
  ON public.evidence_items FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert evidence_items"
  ON public.evidence_items FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can update evidence_items"
  ON public.evidence_items FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can delete evidence_items"
  ON public.evidence_items FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can view control_tests"
  ON public.control_tests FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert control_tests"
  ON public.control_tests FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can update control_tests"
  ON public.control_tests FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can delete control_tests"
  ON public.control_tests FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can view remediation_tasks"
  ON public.remediation_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.audit_findings af JOIN public.audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can insert remediation_tasks"
  ON public.remediation_tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.audit_findings af JOIN public.audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can update remediation_tasks"
  ON public.remediation_tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.audit_findings af JOIN public.audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND public.is_project_member(ap.project_id, auth.uid())));

CREATE POLICY "Project members can delete remediation_tasks"
  ON public.remediation_tasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.audit_findings af JOIN public.audit_programs ap ON ap.id = af.audit_id WHERE af.id = finding_id AND public.is_project_member(ap.project_id, auth.uid())));

-- =============================================
-- TRIGGERS & INDEXES
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_finding_ref()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  IF NEW.finding_ref IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN finding_ref ~ '^FND-[0-9]+$'
        THEN SUBSTRING(finding_ref FROM 5)::INTEGER
        ELSE 0
      END
    ), 0) + 1 INTO seq_num FROM audit_findings;
    NEW.finding_ref := 'FND-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_finding_ref
  BEFORE INSERT ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.generate_finding_ref();

CREATE INDEX idx_compliance_controls_framework ON public.compliance_controls(framework_id);
CREATE INDEX idx_policy_control_mappings_policy ON public.policy_control_mappings(policy_id);
CREATE INDEX idx_policy_control_mappings_control ON public.policy_control_mappings(control_id);
CREATE INDEX idx_audit_findings_audit ON public.audit_findings(audit_id);
CREATE INDEX idx_audit_findings_status ON public.audit_findings(status);
CREATE INDEX idx_evidence_items_project ON public.evidence_items(project_id);
CREATE INDEX idx_evidence_items_control ON public.evidence_items(control_id);
CREATE INDEX idx_control_tests_control ON public.control_tests(control_id);
CREATE INDEX idx_remediation_tasks_finding ON public.remediation_tasks(finding_id);
CREATE INDEX idx_audit_programs_project ON public.audit_programs(project_id);
CREATE INDEX idx_compliance_frameworks_project ON public.compliance_frameworks(project_id);
