
-- ========================================
-- Policy Management Module - Full Schema
-- ========================================

-- 1. Policy Templates table
CREATE TABLE public.policy_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  content_structure JSONB NOT NULL DEFAULT '{}',
  template_file_path TEXT,
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id),
  project_id UUID REFERENCES public.projects(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Policies table (core)
CREATE TABLE public.policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  department TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired', 'pending_approval')),
  owner_type TEXT NOT NULL DEFAULT 'user' CHECK (owner_type IN ('user', 'group')),
  owner_id UUID NOT NULL,
  compliance_standard TEXT,
  compliance_reference TEXT,
  content JSONB NOT NULL DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  current_version INTEGER NOT NULL DEFAULT 1,
  template_id UUID REFERENCES public.policy_templates(id) ON DELETE SET NULL,
  form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  reference_id TEXT
);

-- 3. Policy Versions table
CREATE TABLE public.policy_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  department TEXT,
  content JSONB NOT NULL DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  change_summary TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, version_number)
);

-- 4. Policy Linkages table
CREATE TABLE public.policy_linkages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  linked_entity_type TEXT NOT NULL CHECK (linked_entity_type IN ('form', 'workflow', 'report', 'dashboard', 'policy')),
  linked_entity_id UUID NOT NULL,
  link_description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, linked_entity_type, linked_entity_id)
);

-- 5. Policy Approvals table
CREATE TABLE public.policy_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  approver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_policies_project_id ON public.policies(project_id);
CREATE INDEX idx_policies_organization_id ON public.policies(organization_id);
CREATE INDEX idx_policies_status ON public.policies(status);
CREATE INDEX idx_policies_category ON public.policies(category);
CREATE INDEX idx_policies_owner ON public.policies(owner_type, owner_id);
CREATE INDEX idx_policy_versions_policy_id ON public.policy_versions(policy_id);
CREATE INDEX idx_policy_linkages_policy_id ON public.policy_linkages(policy_id);
CREATE INDEX idx_policy_approvals_policy_id ON public.policy_approvals(policy_id);
CREATE INDEX idx_policy_templates_org ON public.policy_templates(organization_id);

-- Enable RLS
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_linkages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for policies table
CREATE POLICY "Users can view policies in their projects"
ON public.policies FOR SELECT
USING (
  public.can_view_project(project_id, auth.uid())
);

CREATE POLICY "Project editors can create policies"
ON public.policies FOR INSERT
WITH CHECK (
  public.can_create_asset_in_project(project_id, auth.uid())
);

CREATE POLICY "Project editors can update policies"
ON public.policies FOR UPDATE
USING (
  public.can_create_asset_in_project(project_id, auth.uid())
);

CREATE POLICY "Project admins can delete policies"
ON public.policies FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = policies.project_id
    AND pu.user_id = auth.uid()
    AND pu.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = policies.project_id
    AND p.created_by = auth.uid()
  )
);

-- RLS for policy_templates
CREATE POLICY "Users can view templates in their org"
ON public.policy_templates FOR SELECT
USING (
  is_system_template = true
  OR organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can create templates"
ON public.policy_templates FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update their templates"
ON public.policy_templates FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.is_current_user_admin()
);

CREATE POLICY "Users can delete their templates"
ON public.policy_templates FOR DELETE
USING (
  created_by = auth.uid()
  OR public.is_current_user_admin()
);

-- RLS for policy_versions
CREATE POLICY "Users can view versions of accessible policies"
ON public.policy_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_view_project(p.project_id, auth.uid())
  )
);

CREATE POLICY "Users can create versions"
ON public.policy_versions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_create_asset_in_project(p.project_id, auth.uid())
  )
);

-- RLS for policy_linkages
CREATE POLICY "Users can view linkages of accessible policies"
ON public.policy_linkages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_view_project(p.project_id, auth.uid())
  )
);

CREATE POLICY "Users can manage linkages"
ON public.policy_linkages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_create_asset_in_project(p.project_id, auth.uid())
  )
);

CREATE POLICY "Users can delete linkages"
ON public.policy_linkages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_create_asset_in_project(p.project_id, auth.uid())
  )
);

-- RLS for policy_approvals
CREATE POLICY "Users can view approvals"
ON public.policy_approvals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_id
    AND public.can_view_project(p.project_id, auth.uid())
  )
);

CREATE POLICY "Users can create approvals"
ON public.policy_approvals FOR INSERT
WITH CHECK (
  approver_id = auth.uid()
);

CREATE POLICY "Approvers can update their approvals"
ON public.policy_approvals FOR UPDATE
USING (approver_id = auth.uid());

-- Updated_at triggers
CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_security_params_updated_at();

CREATE TRIGGER update_policy_templates_updated_at
  BEFORE UPDATE ON public.policy_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_security_params_updated_at();
