import { REQUIREMENT_REGISTER_FORM_NAME, REQUIREMENT_REGISTER_REFERENCE_ID } from '@/lib/regulatory/requirementRegisterForm';
import { ASSESSMENT_OUTPUT_TOOLTIPS, ASSET_REGISTER_OUTPUT_TOOLTIPS } from '@/lib/grc/assetScoringRule';

export const CONTROL_OBJECTIVE_REFERENCE_ID = 'grc.control-objective-register';
export const ASSET_TYPE_REFERENCE_ID = 'grc.asset-type-register';
export const ASSET_REGISTER_REFERENCE_ID = 'grc.asset-register';
export const ASSET_ASSESSMENT_REFERENCE_ID = 'grc.asset-assessment-questionnaire';

export const CONTROL_OBJECTIVE_FORM_NAME = 'Control Objective Register';
export const ASSET_TYPE_FORM_NAME = 'Asset Type Register';
export const ASSET_REGISTER_FORM_NAME = 'Asset Register';
export const ASSET_ASSESSMENT_FORM_NAME = 'Asset Assessment Questionnaire';

export const IMPACT_OPTIONS = ['Very Low', 'Low', 'Moderate', 'High', 'Critical'] as const;
export const YES_NO_UNKNOWN_OPTIONS = ['Yes', 'No', 'Unknown'] as const;
export const ENVIRONMENT_OPTIONS = ['Production', 'Development', 'Test', 'Disaster Recovery', 'Corporate', 'Other'] as const;
export const ASSET_CATEGORY_OPTIONS = [
  'Hardware', 'Software', 'Data', 'Network', 'Cloud Service', 'Business Application',
  'Infrastructure', 'Facility', 'Service', 'Other',
] as const;
export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'Other'] as const;
export const BUSINESS_VALUE_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const ASSET_CRITICALITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical', 'Assessment Required'] as const;
export const CONTROL_METHOD_OPTIONS = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const;
export const CONTROL_EXECUTION_OPTIONS = ['Manual', 'Automated', 'Hybrid'] as const;
export const CONTROL_FREQUENCY_OPTIONS = [
  'Continuous', 'Real-Time', 'Daily', 'Weekly', 'Monthly', 'Quarterly',
  'Semi-Annual', 'Annual', 'Event-Driven', 'As Required',
] as const;
export const CONTROL_OBJECTIVE_STATUS_OPTIONS = ['Draft', 'Active', 'Under Review', 'Retired'] as const;
export const ASSET_TYPE_STATUS_OPTIONS = ['Active', 'Inactive'] as const;
export const ASSET_LIFECYCLE_OPTIONS = [
  'Planned', 'Requested', 'Ordered', 'In Stock', 'In Use', 'Under Maintenance',
  'Suspended', 'Retired', 'Disposed',
] as const;
export const RECOVERY_METHOD_OPTIONS = [
  'Backup and Restore', 'High Availability / Failover', 'Disaster Recovery Site',
  'Cloud Recovery', 'Manual Recovery', 'Other', 'Unknown',
] as const;
export const DATA_CLASSIFICATION_OPTIONS = ['Public', 'Internal', 'Confidential', 'Restricted'] as const;
export const ASSESSMENT_TYPE_OPTIONS = [
  'Initial Assessment', 'Periodic Review', 'Material Change', 'Incident-Triggered Review', 'Reassessment',
] as const;
export const ASSESSMENT_STATUS_OPTIONS = [
  'Draft', 'Submitted for Review', 'Changes Required', 'Approved', 'Rejected',
] as const;

export const DURATION_PLACEHOLDER = 'Include a unit, for example 4 hours';

/** One parent record. The cross-reference picker can still select several until submit. */
export const SINGLE_PARENT_LIBRARY_KEYS = [
  'regulatory_standard',
  'regulatory_clause',
  'regulatory_requirement',
  'asset_type',
  'parent_asset',
  'latest_approved_assessment',
  'assessed_asset',
] as const;

export const DURATION_LIBRARY_KEYS = [
  'required_rto',
  'required_rpo',
  'maximum_tolerable_downtime',
  'backup_frequency',
  'suggested_rto',
  'suggested_rpo',
  'final_approved_rto',
  'final_approved_rpo',
] as const;

export const GRC_FOUNDATION_LIMITATIONS = [
  'it_assets remains the discovery inventory. These forms do not insert or update it_assets rows.',
  'Asset Category is stored on the Asset Type Register and shown through the Asset Type cross-reference. The Asset Register does not store a second category.',
  'Cross-reference links are stored on the source record. Target forms do not receive an automatic child cross-reference.',
  'Applicable Asset Types and Asset Assessments accept multiple records. Regulatory Requirement, Asset Type, Parent Asset, Latest Approved Assessment, and the questionnaire Asset field accept one record.',
  'Asset scoring weights (Asset scoring v1) are a starting rule, not an approved policy. They live in the SQL of the calculation query fields and can be edited in the form builder.',
  'Calculation query fields run in the browser when the record is open. Records that are never opened again keep their stored values.',
  'No workflow definition is created, because approver identities must not be hardcoded. Assessment Status records Draft, Submitted for Review, Changes Required, Approved, and Rejected.',
  'Asset Register values are copied from the record selected in Latest Approved Assessment. The copy does not check that assessment\'s status.',
  'Support Team uses the group picker and organization groups. Submission Access Control is not used for ownership.',
  'Location, department, vendor, business service, and dependency fields are text. No location, vendor, or business-service form exists to reference.',
] as const;

export interface FoundationFieldSpec {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'datetime' | 'number' | 'cross-reference' | 'user-picker' | 'group-picker';
  required: boolean;
  page: string;
  options?: readonly string[];
  defaultValue?: string;
  placeholder?: string;
  tooltip?: string;
  validation?: { unique?: boolean; trim?: boolean; min?: number; message?: string };
  enabled?: boolean;
}

export interface FoundationFormSpec {
  referenceId: string;
  name: string;
  description: string;
  pages: readonly string[];
  fields: readonly FoundationFieldSpec[];
}

export interface FoundationCrossLink {
  sourceReferenceId: string;
  libraryKey: string;
  targetReferenceId: string;
  targetFormName: string;
  displayKeys: readonly string[];
}

const money = { min: 0, message: 'Amount must be zero or greater.' };
const uniqueText = { unique: true, trim: true };
const duration = { placeholder: DURATION_PLACEHOLDER };

function impactFields(page: string, enabled: boolean): FoundationFieldSpec[] {
  const labels: Array<[string, string]> = [
    ['financial_impact_of_loss', 'Financial Impact of Loss'],
    ['operational_impact_of_loss', 'Operational Impact of Loss'],
    ['regulatory_impact_of_loss', 'Regulatory Impact of Loss'],
    ['customer_impact_of_loss', 'Customer Impact of Loss'],
    ['reputational_impact_of_loss', 'Reputational Impact of Loss'],
  ];
  return labels.map(([key, label]) => ({
    key, label, type: 'select', required: false, page, options: IMPACT_OPTIONS, enabled,
  }));
}

function securityFields(page: string, enabled: boolean): FoundationFieldSpec[] {
  const impacts: Array<[string, string]> = [
    ['confidentiality_impact', 'Confidentiality Impact'],
    ['integrity_impact', 'Integrity Impact'],
    ['availability_impact', 'Availability Impact'],
  ];
  const flags: Array<[string, string]> = [
    ['contains_personal_data', 'Contains Personal Data'],
    ['contains_sensitive_data', 'Contains Sensitive Data'],
    ['internet_accessible', 'Internet Accessible'],
    ['privileged_access_supported', 'Privileged Access Supported'],
    ['supports_critical_business_service', 'Supports Critical Business Service'],
    ['third_party_hosted', 'Third-Party Hosted'],
    ['single_point_of_failure', 'Single Point of Failure'],
  ];
  return [
    ...impacts.map(([key, label]) => ({
      key, label, type: 'select' as const, required: false, page, options: IMPACT_OPTIONS, enabled,
    })),
    {
      key: 'data_classification', label: 'Data Classification', type: 'select' as const, required: false, page,
      options: DATA_CLASSIFICATION_OPTIONS, enabled,
    },
    ...flags.map(([key, label]) => ({
      key, label, type: 'select' as const, required: false, page, options: YES_NO_UNKNOWN_OPTIONS, enabled,
    })),
  ];
}

function recoveryFields(page: string, enabled: boolean): FoundationFieldSpec[] {
  const textDuration = (key: string, label: string): FoundationFieldSpec => ({
    key, label, type: 'text', required: false, page, placeholder: DURATION_PLACEHOLDER, enabled,
  });
  return [
    textDuration('required_rto', 'Required RTO'),
    textDuration('required_rpo', 'Required RPO'),
    textDuration('maximum_tolerable_downtime', 'Maximum Tolerable Downtime'),
    textDuration('backup_frequency', 'Backup Frequency'),
    { key: 'backup_available', label: 'Backup Available', type: 'select', required: false, page, options: YES_NO_UNKNOWN_OPTIONS, enabled },
    { key: 'recovery_method', label: 'Recovery Method', type: 'select', required: false, page, options: RECOVERY_METHOD_OPTIONS, enabled },
    { key: 'redundancy_failover_available', label: 'Redundancy / Failover Available', type: 'select', required: false, page, options: YES_NO_UNKNOWN_OPTIONS, enabled },
    { key: 'recovery_tested', label: 'Recovery Tested', type: 'select', required: false, page, options: YES_NO_UNKNOWN_OPTIONS, enabled },
    { key: 'last_recovery_test_date', label: 'Last Recovery Test Date', type: 'date', required: false, page, enabled },
    { key: 'recovery_dependencies', label: 'Recovery Dependencies', type: 'textarea', required: false, page, enabled },
  ];
}

function calculatedFields(page: string, tooltips: Readonly<Record<string, string>>): FoundationFieldSpec[] {
  return [
    { key: 'asset_value_score', label: 'Asset Value Score', type: 'number', required: false, page, enabled: false, tooltip: tooltips.asset_value_score },
    { key: 'asset_criticality', label: 'Asset Criticality', type: 'select', required: false, page, options: ASSET_CRITICALITY_OPTIONS, enabled: false, tooltip: tooltips.asset_criticality },
    { key: 'suggested_rto', label: 'Suggested RTO', type: 'text', required: false, page, ...duration, enabled: false, tooltip: tooltips.suggested_rto },
    { key: 'suggested_rpo', label: 'Suggested RPO', type: 'text', required: false, page, ...duration, enabled: false, tooltip: tooltips.suggested_rpo },
    { key: 'calculation_timestamp', label: 'Calculation Timestamp', type: 'datetime', required: false, page, enabled: false, tooltip: tooltips.calculation_timestamp },
    { key: 'calculation_rule_version', label: 'Calculation Rule Version', type: 'text', required: false, page, enabled: false, tooltip: tooltips.calculation_rule_version },
  ];
}

const controlObjective: FoundationFormSpec = {
  referenceId: CONTROL_OBJECTIVE_REFERENCE_ID,
  name: CONTROL_OBJECTIVE_FORM_NAME,
  description: 'Reusable control objectives. Each objective references one regulatory requirement and the asset types it applies to.',
  pages: [
    'Control Objective Identification',
    'Control Objective Details',
    'Control Method and Frequency',
    'Asset Type Mapping',
    'Lifecycle and Governance',
  ],
  fields: [
    { key: 'control_objective_id', label: 'Control Objective ID', type: 'text', required: true, page: 'Control Objective Identification', validation: uniqueText, placeholder: 'Stable control objective identifier' },
    { key: 'control_objective_name', label: 'Control Objective Name', type: 'text', required: true, page: 'Control Objective Identification' },
    { key: 'control_objective_description', label: 'Control Objective Description', type: 'textarea', required: true, page: 'Control Objective Identification' },
    { key: 'control_objective_reference', label: 'Control Objective Reference', type: 'text', required: false, page: 'Control Objective Identification' },
    { key: 'regulatory_requirement', label: 'Regulatory Requirement', type: 'cross-reference', required: true, page: 'Control Objective Details' },
    { key: 'control_rationale', label: 'Control Rationale', type: 'textarea', required: false, page: 'Control Objective Details' },
    { key: 'expected_outcome', label: 'Expected Outcome', type: 'textarea', required: true, page: 'Control Objective Details' },
    { key: 'implementation_guidance', label: 'Implementation Guidance', type: 'textarea', required: false, page: 'Control Objective Details' },
    { key: 'evidence_requirements', label: 'Evidence Requirements', type: 'textarea', required: false, page: 'Control Objective Details' },
    { key: 'control_method', label: 'Control Method', type: 'select', required: true, page: 'Control Method and Frequency', options: CONTROL_METHOD_OPTIONS },
    { key: 'control_execution_type', label: 'Control Execution Type', type: 'select', required: true, page: 'Control Method and Frequency', options: CONTROL_EXECUTION_OPTIONS },
    { key: 'control_frequency', label: 'Control Frequency', type: 'select', required: true, page: 'Control Method and Frequency', options: CONTROL_FREQUENCY_OPTIONS },
    { key: 'control_procedure', label: 'Control Procedure', type: 'textarea', required: false, page: 'Control Method and Frequency' },
    { key: 'evidence_expected', label: 'Evidence Expected', type: 'textarea', required: false, page: 'Control Method and Frequency' },
    { key: 'applicable_asset_types', label: 'Applicable Asset Types', type: 'cross-reference', required: true, page: 'Asset Type Mapping' },
    { key: 'control_objective_status', label: 'Control Objective Status', type: 'select', required: true, page: 'Lifecycle and Governance', options: CONTROL_OBJECTIVE_STATUS_OPTIONS, defaultValue: 'Draft' },
    { key: 'effective_date', label: 'Effective Date', type: 'date', required: false, page: 'Lifecycle and Governance' },
    { key: 'review_date', label: 'Review Date', type: 'date', required: false, page: 'Lifecycle and Governance' },
    { key: 'objective_owner', label: 'Objective Owner', type: 'user-picker', required: false, page: 'Lifecycle and Governance' },
    { key: 'governance_notes', label: 'Governance Notes', type: 'textarea', required: false, page: 'Lifecycle and Governance' },
  ],
};

const assetType: FoundationFormSpec = {
  referenceId: ASSET_TYPE_REFERENCE_ID,
  name: ASSET_TYPE_FORM_NAME,
  description: 'Reusable catalog of asset types for inventory and control mapping.',
  pages: ['Asset Type Identification', 'Classification', 'Lifecycle and Governance'],
  fields: [
    { key: 'asset_type_id', label: 'Asset Type ID', type: 'text', required: true, page: 'Asset Type Identification', validation: uniqueText, placeholder: 'Stable asset type identifier' },
    { key: 'asset_type_name', label: 'Asset Type Name', type: 'text', required: true, page: 'Asset Type Identification' },
    { key: 'description', label: 'Description', type: 'textarea', required: false, page: 'Asset Type Identification' },
    { key: 'asset_type_code', label: 'Asset Type Code', type: 'text', required: false, page: 'Asset Type Identification' },
    { key: 'asset_category', label: 'Asset Category', type: 'select', required: true, page: 'Classification', options: ASSET_CATEGORY_OPTIONS },
    { key: 'asset_subcategory', label: 'Asset Subcategory', type: 'text', required: false, page: 'Classification' },
    { key: 'typical_asset_examples', label: 'Typical Asset Examples', type: 'textarea', required: false, page: 'Classification' },
    { key: 'default_environment', label: 'Default Environment', type: 'select', required: false, page: 'Classification', options: ENVIRONMENT_OPTIONS },
    { key: 'record_status', label: 'Record Status', type: 'select', required: true, page: 'Lifecycle and Governance', options: ASSET_TYPE_STATUS_OPTIONS, defaultValue: 'Active' },
    { key: 'type_owner', label: 'Type Owner', type: 'user-picker', required: false, page: 'Lifecycle and Governance' },
    { key: 'type_notes', label: 'Type Notes', type: 'textarea', required: false, page: 'Lifecycle and Governance' },
  ],
};

const assetIdentification = 'Asset Identification';
const assetLocation = 'Classification and Location';
const assetOwnership = 'Ownership and Responsibility';
const assetFinancial = 'Financial and Business Information';
const assetSecurity = 'Security, Impact and Recovery';
const assetLifecycle = 'Lifecycle and Assessment Results';

const assetRegister: FoundationFormSpec = {
  referenceId: ASSET_REGISTER_REFERENCE_ID,
  name: ASSET_REGISTER_FORM_NAME,
  description: 'Inventory of individual assets that other modules can select through a cross-reference. Discovery records in it_assets are left unchanged.',
  pages: [assetIdentification, assetLocation, assetOwnership, assetFinancial, assetSecurity, assetLifecycle],
  fields: [
    { key: 'asset_id', label: 'Asset ID', type: 'text', required: true, page: assetIdentification, validation: uniqueText, placeholder: 'Stable asset identifier' },
    { key: 'asset_name', label: 'Asset Name', type: 'text', required: true, page: assetIdentification, validation: { trim: true } },
    { key: 'asset_description', label: 'Asset Description', type: 'textarea', required: false, page: assetIdentification },
    { key: 'asset_type', label: 'Asset Type', type: 'cross-reference', required: true, page: assetIdentification },
    { key: 'asset_tag', label: 'Asset Tag / Inventory Number', type: 'text', required: false, page: assetIdentification, validation: uniqueText },
    { key: 'serial_number', label: 'Serial Number', type: 'text', required: false, page: assetIdentification },
    { key: 'environment', label: 'Environment', type: 'select', required: true, page: assetLocation, options: ENVIRONMENT_OPTIONS },
    { key: 'location', label: 'Location', type: 'text', required: false, page: assetLocation },
    { key: 'department', label: 'Department / Business Unit', type: 'text', required: false, page: assetLocation },
    { key: 'parent_asset', label: 'Parent Asset', type: 'cross-reference', required: false, page: assetLocation },
    { key: 'asset_owner', label: 'Asset Owner', type: 'user-picker', required: true, page: assetOwnership },
    { key: 'asset_manager', label: 'Asset Manager', type: 'user-picker', required: true, page: assetOwnership },
    { key: 'assigned_user', label: 'Assigned User / Custodian', type: 'user-picker', required: false, page: assetOwnership },
    { key: 'support_team', label: 'Support Team', type: 'group-picker', required: false, page: assetOwnership },
    { key: 'acquisition_date', label: 'Acquisition Date', type: 'date', required: false, page: assetFinancial },
    { key: 'acquisition_cost', label: 'Acquisition Cost', type: 'number', required: false, page: assetFinancial, validation: money },
    { key: 'currency', label: 'Currency', type: 'select', required: false, page: assetFinancial, options: CURRENCY_OPTIONS },
    { key: 'replacement_cost', label: 'Replacement Cost', type: 'number', required: false, page: assetFinancial, validation: money },
    { key: 'vendor', label: 'Vendor / Supplier', type: 'text', required: false, page: assetFinancial },
    { key: 'warranty_expiry_date', label: 'Warranty Expiry Date', type: 'date', required: false, page: assetFinancial },
    { key: 'cost_of_downtime_per_hour', label: 'Cost of Downtime per Hour', type: 'number', required: false, page: assetFinancial, validation: money },
    { key: 'estimated_financial_loss', label: 'Estimated Financial Loss', type: 'number', required: false, page: assetFinancial, validation: money },
    { key: 'business_value_rating', label: 'Business Value Rating', type: 'select', required: false, page: assetFinancial, options: BUSINESS_VALUE_OPTIONS },
    ...impactFields(assetSecurity, false),
    ...securityFields(assetSecurity, false),
    ...recoveryFields(assetSecurity, false),
    { key: 'business_service', label: 'Business Service', type: 'text', required: false, page: assetSecurity, enabled: false },
    { key: 'upstream_dependencies', label: 'Upstream Dependencies', type: 'textarea', required: false, page: assetSecurity, enabled: false },
    { key: 'downstream_dependencies', label: 'Downstream Dependencies', type: 'textarea', required: false, page: assetSecurity, enabled: false },
    { key: 'external_provider', label: 'External Provider / Vendor', type: 'text', required: false, page: assetSecurity, enabled: false },
    { key: 'asset_lifecycle_status', label: 'Asset Lifecycle Status', type: 'select', required: true, page: assetLifecycle, options: ASSET_LIFECYCLE_OPTIONS, defaultValue: 'Planned' },
    { key: 'lifecycle_notes', label: 'Lifecycle Notes', type: 'textarea', required: false, page: assetLifecycle },
    { key: 'commissioning_date', label: 'Commissioning Date', type: 'date', required: false, page: assetLifecycle },
    { key: 'retirement_date', label: 'Retirement Date', type: 'date', required: false, page: assetLifecycle },
    { key: 'asset_assessments', label: 'Asset Assessments', type: 'cross-reference', required: false, page: assetLifecycle },
    { key: 'latest_approved_assessment', label: 'Latest Approved Assessment', type: 'cross-reference', required: false, page: assetLifecycle },
    ...calculatedFields(assetLifecycle, ASSET_REGISTER_OUTPUT_TOOLTIPS),
    { key: 'last_assessment_date', label: 'Last Assessment Date', type: 'date', required: false, page: assetLifecycle, enabled: false, tooltip: ASSET_REGISTER_OUTPUT_TOOLTIPS.last_assessment_date },
    { key: 'next_review_date', label: 'Next Review Date', type: 'date', required: false, page: assetLifecycle, enabled: false },
  ],
};

const assessmentInfo = 'Assessment Information';
const assessmentImpact = 'Business Impact';
const assessmentSecurity = 'Security and Data Sensitivity';
const assessmentRecovery = 'Recovery Requirements';
const assessmentEvidence = 'Dependencies and Evidence';
const assessmentResults = 'Calculated Results and Approval';

const assetAssessment: FoundationFormSpec = {
  referenceId: ASSET_ASSESSMENT_REFERENCE_ID,
  name: ASSET_ASSESSMENT_FORM_NAME,
  description: 'An assessment of one Asset Register record. An asset can have many assessments over time.',
  pages: [assessmentInfo, assessmentImpact, assessmentSecurity, assessmentRecovery, assessmentEvidence, assessmentResults],
  fields: [
    { key: 'assessment_id', label: 'Assessment ID', type: 'text', required: true, page: assessmentInfo, validation: uniqueText, placeholder: 'Stable assessment identifier' },
    { key: 'assessed_asset', label: 'Asset', type: 'cross-reference', required: true, page: assessmentInfo },
    { key: 'assessment_owner', label: 'Assessment Owner', type: 'user-picker', required: true, page: assessmentInfo },
    { key: 'assessment_date', label: 'Assessment Date', type: 'date', required: true, page: assessmentInfo },
    { key: 'assessment_type', label: 'Assessment Type', type: 'select', required: true, page: assessmentInfo, options: ASSESSMENT_TYPE_OPTIONS },
    { key: 'assessment_status', label: 'Assessment Status', type: 'select', required: true, page: assessmentInfo, options: ASSESSMENT_STATUS_OPTIONS, defaultValue: 'Draft' },
    { key: 'assessment_rationale', label: 'Assessment Rationale', type: 'textarea', required: true, page: assessmentInfo },
    ...impactFields(assessmentImpact, true),
    { key: 'business_value_rating', label: 'Business Value Rating', type: 'select', required: false, page: assessmentImpact, options: BUSINESS_VALUE_OPTIONS },
    { key: 'estimated_financial_loss', label: 'Estimated Financial Loss', type: 'number', required: false, page: assessmentImpact, validation: money },
    { key: 'cost_of_downtime_per_hour', label: 'Cost of Downtime per Hour', type: 'number', required: false, page: assessmentImpact, validation: money },
    ...securityFields(assessmentSecurity, true),
    ...recoveryFields(assessmentRecovery, true),
    { key: 'business_service', label: 'Business Service', type: 'text', required: false, page: assessmentEvidence },
    { key: 'upstream_dependencies', label: 'Upstream Dependencies', type: 'textarea', required: false, page: assessmentEvidence },
    { key: 'downstream_dependencies', label: 'Downstream Dependencies', type: 'textarea', required: false, page: assessmentEvidence },
    { key: 'external_provider', label: 'External Provider / Vendor', type: 'text', required: false, page: assessmentEvidence },
    { key: 'assessment_findings', label: 'Assessment Findings', type: 'textarea', required: false, page: assessmentEvidence },
    { key: 'recommended_actions', label: 'Recommended Actions', type: 'textarea', required: false, page: assessmentEvidence },
    { key: 'supporting_evidence', label: 'Supporting Evidence / Notes', type: 'textarea', required: false, page: assessmentEvidence },
    ...calculatedFields(assessmentResults, ASSESSMENT_OUTPUT_TOOLTIPS),
    { key: 'reviewing_asset_manager', label: 'Reviewing Asset Manager', type: 'user-picker', required: false, page: assessmentResults },
    { key: 'review_comments', label: 'Review Comments', type: 'textarea', required: false, page: assessmentResults },
    { key: 'approval_date', label: 'Approval Date', type: 'date', required: false, page: assessmentResults },
    { key: 'final_approved_rto', label: 'Final Approved RTO', type: 'text', required: false, page: assessmentResults, ...duration },
    { key: 'final_approved_rpo', label: 'Final Approved RPO', type: 'text', required: false, page: assessmentResults, ...duration },
    { key: 'final_approved_asset_criticality', label: 'Final Approved Asset Criticality', type: 'select', required: false, page: assessmentResults, options: ASSET_CRITICALITY_OPTIONS },
  ],
};

export const GRC_FOUNDATION_FORMS: readonly FoundationFormSpec[] = [
  assetType,
  assetRegister,
  assetAssessment,
  controlObjective,
];

export const GRC_FOUNDATION_REFERENCE_IDS = GRC_FOUNDATION_FORMS.map((form) => form.referenceId);

export const GRC_CROSS_LINKS: readonly FoundationCrossLink[] = [
  {
    sourceReferenceId: CONTROL_OBJECTIVE_REFERENCE_ID,
    libraryKey: 'regulatory_requirement',
    targetReferenceId: REQUIREMENT_REGISTER_REFERENCE_ID,
    targetFormName: REQUIREMENT_REGISTER_FORM_NAME,
    displayKeys: ['requirement_id', 'requirement_title'],
  },
  {
    sourceReferenceId: CONTROL_OBJECTIVE_REFERENCE_ID,
    libraryKey: 'applicable_asset_types',
    targetReferenceId: ASSET_TYPE_REFERENCE_ID,
    targetFormName: ASSET_TYPE_FORM_NAME,
    displayKeys: ['asset_type_id', 'asset_type_name'],
  },
  {
    sourceReferenceId: ASSET_REGISTER_REFERENCE_ID,
    libraryKey: 'asset_type',
    targetReferenceId: ASSET_TYPE_REFERENCE_ID,
    targetFormName: ASSET_TYPE_FORM_NAME,
    displayKeys: ['asset_type_id', 'asset_type_name', 'asset_category'],
  },
  {
    sourceReferenceId: ASSET_REGISTER_REFERENCE_ID,
    libraryKey: 'parent_asset',
    targetReferenceId: ASSET_REGISTER_REFERENCE_ID,
    targetFormName: ASSET_REGISTER_FORM_NAME,
    displayKeys: ['asset_id', 'asset_name'],
  },
  {
    sourceReferenceId: ASSET_REGISTER_REFERENCE_ID,
    libraryKey: 'asset_assessments',
    targetReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    targetFormName: ASSET_ASSESSMENT_FORM_NAME,
    displayKeys: ['assessment_id', 'assessment_date'],
  },
  {
    sourceReferenceId: ASSET_REGISTER_REFERENCE_ID,
    libraryKey: 'latest_approved_assessment',
    targetReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    targetFormName: ASSET_ASSESSMENT_FORM_NAME,
    displayKeys: ['assessment_id', 'assessment_status'],
  },
  {
    sourceReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    libraryKey: 'assessed_asset',
    targetReferenceId: ASSET_REGISTER_REFERENCE_ID,
    targetFormName: ASSET_REGISTER_FORM_NAME,
    displayKeys: ['asset_id', 'asset_name'],
  },
];

export function isGrcFoundationReference(referenceId: unknown): boolean {
  return GRC_FOUNDATION_REFERENCE_IDS.includes(String(referenceId));
}

export function grcFoundationSortIndex(referenceId: unknown): number {
  const index = GRC_FOUNDATION_REFERENCE_IDS.indexOf(String(referenceId));
  return index === -1 ? GRC_FOUNDATION_REFERENCE_IDS.length : index;
}
