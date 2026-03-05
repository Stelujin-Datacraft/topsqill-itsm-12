export interface ComplianceFramework {
  id: string;
  name: string;
  description?: string;
  version?: string;
  framework_type: string;
  status: string;
  organization_id?: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceControl {
  id: string;
  framework_id: string;
  control_id_ref: string;
  title: string;
  description?: string;
  category?: string;
  parent_control_id?: string;
  implementation_status: string;
  effectiveness: string;
  owner_id?: string;
  risk_level: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyControlMapping {
  id: string;
  policy_id: string;
  control_id: string;
  mapping_notes?: string;
  coverage_status: string;
  created_by: string;
  created_at: string;
}

export interface AuditProgram {
  id: string;
  name: string;
  description?: string;
  audit_type: string;
  status: string;
  scope?: string;
  objectives?: string;
  lead_auditor_id?: string;
  start_date?: string;
  end_date?: string;
  framework_id?: string;
  folder_id?: string;
  organization_id?: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  id: string;
  audit_id: string;
  finding_ref?: string;
  title: string;
  description?: string;
  finding_type: string;
  severity: string;
  status: string;
  control_id?: string;
  policy_id?: string;
  assigned_to?: string;
  due_date?: string;
  root_cause?: string;
  recommendation?: string;
  management_response?: string;
  remediation_plan?: string;
  closed_at?: string;
  closed_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceItem {
  id: string;
  name: string;
  description?: string;
  evidence_type: string;
  file_path?: string;
  file_url?: string;
  file_size_bytes?: number;
  mime_type?: string;
  status: string;
  collection_date?: string;
  expiry_date?: string;
  control_id?: string;
  audit_id?: string;
  finding_id?: string;
  policy_id?: string;
  organization_id?: string;
  project_id: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ControlTest {
  id: string;
  control_id: string;
  test_name: string;
  test_description?: string;
  test_type: string;
  test_procedure?: string;
  expected_result?: string;
  actual_result?: string;
  test_result: string;
  tested_by?: string;
  tested_at?: string;
  next_test_date?: string;
  notes?: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RemediationTask {
  id: string;
  finding_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  verification_notes?: string;
  verified_by?: string;
  verified_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const FRAMEWORK_TYPES = [
  { value: 'soc2', label: 'SOC 2' },
  { value: 'iso27001', label: 'ISO 27001' },
  { value: 'nist', label: 'NIST CSF' },
  { value: 'hipaa', label: 'HIPAA' },
  { value: 'gdpr', label: 'GDPR' },
  { value: 'pci_dss', label: 'PCI DSS' },
  { value: 'custom', label: 'Custom' },
] as const;

export const IMPLEMENTATION_STATUSES = [
  { value: 'not_implemented', label: 'Not Implemented', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'partially_implemented', label: 'Partially Implemented', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'implemented', label: 'Implemented', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'not_applicable', label: 'N/A', color: 'bg-muted text-muted-foreground' },
] as const;

export const EFFECTIVENESS_LEVELS = [
  { value: 'not_tested', label: 'Not Tested', color: 'bg-muted text-muted-foreground' },
  { value: 'effective', label: 'Effective', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'partially_effective', label: 'Partially Effective', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'ineffective', label: 'Ineffective', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
] as const;

export const AUDIT_TYPES = [
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'self_assessment', label: 'Self Assessment' },
] as const;

export const AUDIT_STATUSES = [
  { value: 'planned', label: 'Planned', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
] as const;

export const FINDING_TYPES = [
  { value: 'non_conformity', label: 'Non-Conformity' },
  { value: 'observation', label: 'Observation' },
  { value: 'opportunity', label: 'Opportunity for Improvement' },
  { value: 'strength', label: 'Strength' },
] as const;

export const FINDING_SEVERITIES = [
  { value: 'low', label: 'Low', color: 'bg-muted text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
] as const;

export const FINDING_STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'remediated', label: 'Remediated', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'closed', label: 'Closed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'accepted_risk', label: 'Accepted Risk', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
] as const;

export const TEST_RESULTS = [
  { value: 'not_tested', label: 'Not Tested', color: 'bg-muted text-muted-foreground' },
  { value: 'pass', label: 'Pass', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'fail', label: 'Fail', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'partial_pass', label: 'Partial Pass', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'not_applicable', label: 'N/A', color: 'bg-muted text-muted-foreground' },
] as const;

export const EVIDENCE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'log', label: 'Log File' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'report', label: 'Report' },
  { value: 'test_result', label: 'Test Result' },
] as const;
