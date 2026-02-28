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
  // ServiceNow-style fields
  policy_number?: string;
  effective_date?: string;
  expiry_date?: string;
  next_review_date?: string;
  review_cycle_days?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  acknowledgment_required?: boolean;
  exception_allowed?: boolean;
}

export interface PolicyAttachment {
  name: string;
  url: string;
  type: 'document' | 'url' | 'file';
  size?: number;
  uploaded_at?: string;
  show_in_pdf?: boolean;
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

export interface PolicyAcknowledgment {
  id: string;
  policy_id: string;
  user_id: string;
  version_acknowledged: number;
  acknowledged_at: string;
  ip_address?: string;
  comments?: string;
}

export interface PolicyException {
  id: string;
  policy_id: string;
  requested_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reason: string;
  justification?: string;
  risk_assessment?: string;
  compensating_controls?: string;
  start_date: string;
  end_date: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyReviewCycle {
  id: string;
  policy_id: string;
  review_date: string;
  reviewer_id?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  findings?: string;
  outcome?: 'no_change' | 'minor_update' | 'major_revision' | 'retire';
  completed_at?: string;
  created_at: string;
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

export const POLICY_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-muted text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
] as const;

export const REVIEW_CYCLE_OPTIONS = [
  { value: 90, label: 'Quarterly (90 days)' },
  { value: 180, label: 'Semi-Annual (180 days)' },
  { value: 365, label: 'Annual (365 days)' },
  { value: 730, label: 'Biennial (2 years)' },
] as const;
