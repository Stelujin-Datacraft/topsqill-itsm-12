export interface Policy {
  id: string;
  name: string;
  description?: string;
  category: string;
  department?: string;
  status: 'draft' | 'published' | 'retired' | 'pending_approval';
  owner_type: 'user' | 'group';
  owner_id: string;
  compliance_standard?: string;
  compliance_reference?: string;
  content: Record<string, any>;
  attachments: PolicyAttachment[];
  tags: string[];
  current_version: number;
  template_id?: string;
  form_id?: string;
  workflow_id?: string;
  organization_id?: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  retired_at?: string;
  reference_id?: string;
}

export interface PolicyAttachment {
  name: string;
  url: string;
  type: 'document' | 'url' | 'file';
  size?: number;
  uploaded_at?: string;
}

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  name: string;
  description?: string;
  category?: string;
  department?: string;
  content: Record<string, any>;
  attachments: PolicyAttachment[];
  change_summary?: string;
  changed_by: string;
  changed_at: string;
}

export interface PolicyLinkage {
  id: string;
  policy_id: string;
  linked_entity_type: 'form' | 'workflow' | 'report' | 'dashboard' | 'policy';
  linked_entity_id: string;
  link_description?: string;
  created_by: string;
  created_at: string;
}

export interface PolicyApproval {
  id: string;
  policy_id: string;
  version_number: number;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approved_at?: string;
  created_at: string;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  content_structure: Record<string, any>;
  template_file_path?: string;
  is_system_template: boolean;
  organization_id?: string;
  project_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const POLICY_CATEGORIES = [
  'Security', 'IT', 'HR', 'Compliance', 'Finance',
  'Operations', 'Legal', 'Privacy', 'Risk Management', 'General'
] as const;

export const POLICY_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'pending_approval', label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'published', label: 'Published', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'retired', label: 'Retired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
] as const;
