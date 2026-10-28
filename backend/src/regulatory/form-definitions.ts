export const REGULATORY_FORM_REFS = {
  standard: 'grc.regulatory.standard',
  clause: 'grc.regulatory.clause',
  requirement: 'grc.regulatory.requirement',
} as const;

export const REGULATORY_WORKFLOW_REFS = {
  standardReview: 'grc.regulatory.workflow.standard-review',
  sourceReview: 'grc.regulatory.workflow.source-review',
  requirementReview: 'grc.regulatory.workflow.requirement-review',
} as const;

export const REGULATORY_REPORT_REFS = {
  standards: 'grc.regulatory.report.standards',
  standardsAwaiting: 'grc.regulatory.report.standards-awaiting-verification',
  clauses: 'grc.regulatory.report.clauses',
  clausesAwaiting: 'grc.regulatory.report.clauses-awaiting-verification',
  requirements: 'grc.regulatory.report.requirements',
  aiSuggested: 'grc.regulatory.report.ai-suggested-requirements',
  humanReview: 'grc.regulatory.report.requirements-awaiting-review',
  applicability: 'grc.regulatory.report.applicability-open',
} as const;

export const REGULATORY_DASHBOARD_REF = 'grc.regulatory.dashboard';

export type FieldKind = 'text' | 'textarea' | 'select' | 'date' | 'url' | 'user-picker' | 'cross-reference';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldKind;
  required?: boolean;
  page: string;
  options?: Array<{ value: string; label: string }>;
  target?: 'standard' | 'clause' | 'requirement';
}

const lifecycleSource = [
  'Draft',
  'Imported',
  'Awaiting Verification',
  'Verified',
  'Under Review',
  'Superseded',
  'Repealed',
  'Retired',
].map((value) => ({ value, label: value }));

const lifecycleRequirement = [
  'Draft',
  'AI Suggested',
  'Awaiting Source Verification',
  'Awaiting Compliance Review',
  'Approved',
  'Active',
  'Under Assessment',
  'Superseded',
  'Retired',
].map((value) => ({ value, label: value }));

const yesNo = ['Not decided', 'Applicable', 'Not applicable', 'Partially applicable'].map((value) => ({ value, label: value }));
const verification = ['Not checked', 'Awaiting Verification', 'Verified', 'Rejected'].map((value) => ({ value, label: value }));

export const STANDARD_FIELDS: FieldDef[] = [
  { key: 'standard_id', label: 'Standard ID', type: 'text', required: true, page: 'Identity' },
  { key: 'standard_name', label: 'Standard name', type: 'text', required: true, page: 'Identity' },
  { key: 'standard_type', label: 'Standard type', type: 'select', page: 'Identity', options: ['Regulation', 'Act', 'Framework', 'Other'].map((value) => ({ value, label: value })) },
  { key: 'issuing_authority', label: 'Issuing authority', type: 'text', page: 'Identity' },
  { key: 'jurisdiction', label: 'Jurisdiction and geographic scope', type: 'text', page: 'Identity' },
  { key: 'industry', label: 'Industry or sector', type: 'text', page: 'Identity' },
  { key: 'publication_reference', label: 'Official publication reference', type: 'textarea', page: 'Identity' },
  { key: 'official_source_url', label: 'Official source URL', type: 'url', page: 'Identity' },
  { key: 'citation_url', label: 'Citation URL', type: 'url', page: 'Identity' },
  { key: 'source_language', label: 'Source language', type: 'text', page: 'Identity' },
  { key: 'edition', label: 'Edition or version', type: 'textarea', page: 'Status' },
  { key: 'adoption_date', label: 'Original adoption or enactment date', type: 'date', page: 'Status' },
  { key: 'publication_date', label: 'Publication date', type: 'date', page: 'Status' },
  { key: 'effective_date', label: 'Effective date', type: 'date', page: 'Status' },
  { key: 'repeal_date', label: 'Repeal, expiry, or supersession date', type: 'date', page: 'Status' },
  { key: 'legal_status', label: 'Legal status', type: 'textarea', page: 'Status' },
  { key: 'commencement_status', label: 'Commencement status', type: 'textarea', page: 'Status' },
  { key: 'source_verification_status', label: 'Source verification status', type: 'select', page: 'Status', options: verification },
  { key: 'source_retrieval_date', label: 'Source retrieval date', type: 'date', page: 'Status' },
  { key: 'last_verified_date', label: 'Last verified date', type: 'date', page: 'Status' },
  { key: 'next_verification_date', label: 'Next verification date', type: 'date', page: 'Status' },
  { key: 'source_checksum', label: 'Source document checksum', type: 'text', page: 'Status' },
  { key: 'licensing_notes', label: 'Licensing and reuse notes', type: 'textarea', page: 'Status' },
  { key: 'commencement_notification_reference', label: 'Commencement notification reference', type: 'text', page: 'Status' },
  { key: 'commencement_notification_url', label: 'Commencement notification URL', type: 'url', page: 'Status' },
  { key: 'commencement_notification_date', label: 'Commencement notification date', type: 'date', page: 'Status' },
  { key: 'applicability_status', label: 'Applicability status', type: 'select', page: 'Governance', options: yesNo },
  { key: 'applicability_rationale', label: 'Applicability rationale', type: 'textarea', page: 'Governance' },
  { key: 'compliance_owner', label: 'Compliance owner', type: 'user-picker', page: 'Governance' },
  { key: 'reviewer', label: 'Reviewer', type: 'user-picker', page: 'Governance' },
  { key: 'approver', label: 'Approver', type: 'user-picker', page: 'Governance' },
  { key: 'record_approval_status', label: 'Record approval status', type: 'select', page: 'Governance', options: ['Not reviewed', 'Awaiting approval', 'Approved', 'Rejected'].map((value) => ({ value, label: value })) },
  { key: 'lifecycle_status', label: 'Lifecycle status', type: 'select', page: 'Governance', options: lifecycleSource },
  { key: 'reverification_required', label: 'Re-verification required', type: 'select', page: 'Governance', options: ['No', 'Yes'].map((value) => ({ value, label: value })) },
  { key: 'source_key', label: 'Source key', type: 'text', required: true, page: 'Governance' },
];

export const CLAUSE_FIELDS: FieldDef[] = [
  { key: 'clause_id', label: 'Clause ID', type: 'text', required: true, page: 'Identity' },
  { key: 'clause_title', label: 'Clause title', type: 'text', required: true, page: 'Identity' },
  { key: 'clause_type', label: 'Clause type', type: 'select', page: 'Identity', options: ['chapter', 'section', 'article', 'paragraph', 'recital', 'subsection', 'schedule'].map((value) => ({ value, label: value })) },
  { key: 'official_identifier', label: 'Official clause identifier', type: 'text', required: true, page: 'Identity' },
  { key: 'parent_clause', label: 'Parent clause', type: 'cross-reference', page: 'Identity', target: 'clause' },
  { key: 'regulatory_standard', label: 'Regulatory Standard reference', type: 'cross-reference', required: true, page: 'Identity', target: 'standard' },
  { key: 'standard_edition', label: 'Standard edition or source version', type: 'textarea', page: 'Source' },
  { key: 'official_source_url', label: 'Official source URL', type: 'url', page: 'Source' },
  { key: 'source_document_identifier', label: 'Source document identifier', type: 'text', page: 'Source' },
  { key: 'source_location', label: 'Source location', type: 'text', page: 'Source' },
  { key: 'authoritative_text', label: 'Authoritative source text or permitted excerpt', type: 'textarea', page: 'Source' },
  { key: 'source_provenance', label: 'Source text provenance', type: 'textarea', page: 'Source' },
  { key: 'source_language', label: 'Source language', type: 'text', page: 'Source' },
  { key: 'publication_date', label: 'Publication date', type: 'date', page: 'Source' },
  { key: 'effective_date', label: 'Effective date', type: 'date', page: 'Source' },
  { key: 'repeal_status', label: 'Repeal or supersession status', type: 'textarea', page: 'Source' },
  { key: 'source_verification_status', label: 'Source verification status', type: 'select', page: 'Source', options: verification },
  { key: 'last_verified_date', label: 'Last verified date', type: 'date', page: 'Source' },
  { key: 'legal_status', label: 'Legal status', type: 'textarea', page: 'Source' },
  { key: 'commencement_status', label: 'Commencement status', type: 'textarea', page: 'Source' },
  { key: 'source_checksum', label: 'Source text checksum', type: 'text', page: 'Source' },
  { key: 'ai_summary', label: 'AI-generated plain-language summary', type: 'textarea', page: 'AI' },
  { key: 'ai_classification', label: 'AI-generated clause classification', type: 'textarea', page: 'AI' },
  { key: 'ai_candidate_obligations', label: 'AI-extracted candidate obligations', type: 'textarea', page: 'AI' },
  { key: 'ai_citations', label: 'AI source citations', type: 'textarea', page: 'AI' },
  { key: 'human_verification_status', label: 'Human verification status', type: 'select', page: 'AI', options: ['Not reviewed', 'Awaiting review', 'Reviewed', 'Rejected'].map((value) => ({ value, label: value })) },
  { key: 'reviewer_comments', label: 'Reviewer comments', type: 'textarea', page: 'AI' },
  { key: 'lifecycle_status', label: 'Lifecycle status', type: 'select', page: 'AI', options: lifecycleSource },
  { key: 'reverification_required', label: 'Re-verification required', type: 'select', page: 'AI', options: ['No', 'Yes'].map((value) => ({ value, label: value })) },
  { key: 'source_key', label: 'Source key', type: 'text', required: true, page: 'AI' },
];

export const REQUIREMENT_FIELDS: FieldDef[] = [
  { key: 'requirement_id', label: 'Requirement ID', type: 'text', required: true, page: 'Identity' },
  { key: 'requirement_title', label: 'Requirement title', type: 'text', required: true, page: 'Identity' },
  { key: 'requirement_type', label: 'Requirement type', type: 'text', page: 'Identity' },
  { key: 'requirement_statement', label: 'Requirement statement', type: 'textarea', required: true, page: 'Identity' },
  { key: 'requirement_rationale', label: 'Requirement rationale or interpretation', type: 'textarea', page: 'Identity' },
  { key: 'requirement_classification', label: 'Requirement classification', type: 'textarea', page: 'Identity' },
  { key: 'primary_source_clause', label: 'Primary source clause', type: 'cross-reference', required: true, page: 'Source', target: 'clause' },
  { key: 'additional_source_clauses', label: 'Additional source clauses', type: 'cross-reference', page: 'Source', target: 'clause' },
  { key: 'regulatory_standard', label: 'Regulatory Standard reference', type: 'cross-reference', required: true, page: 'Source', target: 'standard' },
  { key: 'source_edition', label: 'Source edition or version', type: 'textarea', page: 'Source' },
  { key: 'official_source_url', label: 'Official source URL', type: 'url', page: 'Source' },
  { key: 'source_pinpoint', label: 'Exact source article, section, or paragraph', type: 'text', page: 'Source' },
  { key: 'source_verification_status', label: 'Source verification status', type: 'select', page: 'Source', options: verification },
  { key: 'requirement_validation_status', label: 'Requirement validation status', type: 'select', page: 'Source', options: ['Unverified candidate', 'Validated', 'Rejected'].map((value) => ({ value, label: value })) },
  { key: 'applicability_status', label: 'Applicability status', type: 'select', page: 'Applicability', options: yesNo },
  { key: 'applicability_rationale', label: 'Applicability rationale', type: 'textarea', page: 'Applicability' },
  { key: 'applicability_owner', label: 'Applicability decision owner', type: 'user-picker', page: 'Applicability' },
  { key: 'applicability_reviewer', label: 'Applicability reviewer', type: 'user-picker', page: 'Applicability' },
  { key: 'business_unit', label: 'Business unit or process in scope', type: 'text', page: 'Applicability' },
  { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', page: 'Applicability' },
  { key: 'effective_date', label: 'Effective date', type: 'date', page: 'Applicability' },
  { key: 'legal_status', label: 'Legal status', type: 'textarea', page: 'Applicability' },
  { key: 'expected_outcome', label: 'Expected outcome', type: 'textarea', page: 'Assessment' },
  { key: 'suggested_procedure', label: 'Suggested assessment procedure', type: 'textarea', page: 'Assessment' },
  { key: 'suggested_evidence', label: 'Suggested evidence types', type: 'textarea', page: 'Assessment' },
  { key: 'compliance_owner', label: 'Compliance owner', type: 'user-picker', page: 'Assessment' },
  { key: 'reviewer', label: 'Reviewer', type: 'user-picker', page: 'Assessment' },
  { key: 'approver', label: 'Approver', type: 'user-picker', page: 'Assessment' },
  { key: 'assessment_frequency', label: 'Assessment frequency', type: 'text', page: 'Assessment' },
  { key: 'assessment_frequency_basis', label: 'Assessment frequency basis', type: 'select', page: 'Assessment', options: ['Not determined', 'Legally specified', 'Internal recommendation'].map((value) => ({ value, label: value })) },
  { key: 'assessment_status', label: 'Requirement assessment status', type: 'select', page: 'Assessment', options: ['Not assessed', 'In progress', 'Assessed'].map((value) => ({ value, label: value })) },
  { key: 'gap_status', label: 'Gap status', type: 'select', page: 'Assessment', options: ['Not assessed', 'No gap recorded', 'Gap under review'].map((value) => ({ value, label: value })) },
  { key: 'last_assessment_date', label: 'Last assessment date', type: 'date', page: 'Assessment' },
  { key: 'next_assessment_date', label: 'Next assessment date', type: 'date', page: 'Assessment' },
  { key: 'ai_explanation', label: 'AI-generated plain-language explanation', type: 'textarea', page: 'AI' },
  { key: 'ai_suggested_controls', label: 'AI-suggested control measures', type: 'textarea', page: 'AI' },
  { key: 'ai_suggested_evidence', label: 'AI-suggested evidence', type: 'textarea', page: 'AI' },
  { key: 'ai_ambiguities', label: 'AI-identified ambiguities', type: 'textarea', page: 'AI' },
  { key: 'ai_missing_information', label: 'AI-identified missing information', type: 'textarea', page: 'AI' },
  { key: 'ai_analysis_status', label: 'AI analysis status', type: 'text', page: 'AI' },
  { key: 'human_review_status', label: 'Human review status', type: 'select', page: 'AI', options: ['Not reviewed', 'Awaiting review', 'Reviewed', 'Rejected'].map((value) => ({ value, label: value })) },
  { key: 'related_policies', label: 'Related policies', type: 'textarea', page: 'AI' },
  { key: 'lifecycle_status', label: 'Lifecycle status', type: 'select', page: 'AI', options: lifecycleRequirement },
  { key: 'source_key', label: 'Source key', type: 'text', required: true, page: 'AI' },
];

export const SYSTEM_STATUS_OPTIONS = [
  { id: 'status-opt-draft', value: 'Draft', label: 'Draft' },
  { id: 'status-opt-inprogress', value: 'Inprogress', label: 'Inprogress' },
  { id: 'status-opt-pending', value: 'Pending', label: 'Pending' },
  { id: 'status-opt-completed', value: 'Completed', label: 'Completed' },
  { id: 'status-opt-archived', value: 'Archived', label: 'Archived' },
];
