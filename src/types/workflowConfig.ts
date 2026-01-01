// Configuration interfaces for new workflow action types

export interface ChangeFieldValueConfig {
  targetFormId: string;
  targetFormName?: string;
  targetFieldId: string;
  targetFieldName?: string;
  targetFieldType?: string;
  valueType: 'static' | 'dynamic';
  staticValue?: any;
  dynamicValuePath?: string; // e.g., "email" or "userDetails.phoneNumber"
  dynamicFieldType?: string; // Type of the source field for value normalization
  submissionSource: 'trigger' | 'specific'; // Use submission from trigger or specify an ID
  specificSubmissionId?: string;
}

export interface ChangeRecordStatusConfig {
  targetFormId: string;
  targetFormName?: string;
  newStatus: 'pending' | 'approved' | 'rejected' | 'in_review';
  statusNotes?: string;
  submissionSource: 'trigger' | 'specific';
  specificSubmissionId?: string;
}

export interface CreateRecordFieldValue {
  fieldId: string;
  fieldName?: string;
  fieldType?: string;
  fieldOptions?: Array<{ label: string; value: string }>;
  customConfig?: any; // Custom configuration for submission-access and other special fields
  valueType: 'static' | 'dynamic';
  staticValue?: any;
  dynamicValuePath?: string;
}

export interface FieldMapping {
  sourceFieldId: string;
  sourceFieldName?: string;
  targetFieldId: string;
  targetFieldName?: string;
}

export interface CreateRecordConfig {
  targetFormId: string;
  targetFormName?: string;
  recordCount: number;
  fieldValues: CreateRecordFieldValue[];
  // Enhanced options
  setSubmittedBy?: 'trigger_submitter' | 'system' | 'specific_user';
  specificSubmitterId?: string;
  initialStatus?: 'pending' | 'approved' | 'rejected' | 'in_review';
  fieldConfigMode?: 'field_values' | 'field_mapping'; // Toggle between setting values or mapping fields
  fieldMappings?: FieldMapping[]; // Custom field mappings when fieldConfigMode is 'field_mapping'
  assignToSubmitter?: boolean; // Assign created records to trigger form submitter
}

export interface CreateLinkedRecordConfig {
  // The cross-reference field from the trigger form that points to the child form
  crossReferenceFieldId: string;
  crossReferenceFieldName?: string;
  // The target (child) form where the new record will be created
  targetFormId: string;
  targetFormName?: string;
  // Number of records to create
  recordCount: number;
  // Optional field values for the new child record
  fieldValues?: CreateRecordFieldValue[];
  // Optional field mappings from trigger form to child form
  fieldMappings?: FieldMapping[];
  fieldConfigMode?: 'field_values' | 'field_mapping' | 'none';
  // Submitter settings
  setSubmittedBy?: 'trigger_submitter' | 'system' | 'specific_user';
  specificSubmitterId?: string;
  // Initial status for the new record
  initialStatus?: 'pending' | 'approved' | 'rejected' | 'in_review';
}

export interface UpdateLinkedRecordsConfig {
  // The cross-reference field in the current (parent) form that holds linked record refs
  crossReferenceFieldId: string;
  crossReferenceFieldName?: string;
  // The linked (child) form where records will be updated
  targetFormId: string;
  targetFormName?: string;
  // Update scope - how to handle multiple linked records
  updateScope: 'all' | 'first' | 'last';
  // Field mappings from current form to the linked records
  fieldMappings: FieldMapping[];
}

// New configuration for creating combination records
// Supports combining TWO cross-reference fields from trigger form (Cartesian product)
export interface CreateCombinationRecordsConfig {
  // --- MODE SELECTION ---
  // 'single' = Combine trigger form with ONE cross-ref field (legacy behavior)
  // 'dual' = Combine TWO cross-ref fields from trigger form (Cartesian product)
  combinationMode?: 'single' | 'dual';

  // --- FIRST SOURCE CROSS-REFERENCE FIELD ---
  // The cross-reference field in the trigger form that contains linked records (e.g., Entity)
  sourceCrossRefFieldId: string;
  sourceCrossRefFieldName?: string;
  // The form referenced by the first source cross-reference field (e.g., Entity form)
  sourceLinkedFormId: string;
  sourceLinkedFormName?: string;

  // --- SECOND SOURCE CROSS-REFERENCE FIELD (for dual mode) ---
  // The second cross-reference field in the trigger form (e.g., Control Objective)
  secondSourceCrossRefFieldId?: string;
  secondSourceCrossRefFieldName?: string;
  // The form referenced by the second source cross-reference field
  secondSourceLinkedFormId?: string;
  secondSourceLinkedFormName?: string;

  // --- TARGET FORM ---
  // The target form where combination records will be created (e.g., Control form)
  targetFormId: string;
  targetFormName?: string;

  // --- TARGET FORM LINK FIELDS (User-selectable) ---
  // Array of target cross-reference fields to auto-link
  targetLinkFields?: TargetLinkFieldConfig[];

  // Legacy fields (kept for backward compatibility, prefer targetLinkFields)
  // Cross-reference field in target form that links back to trigger form (e.g., Control → Entity)
  targetTriggerCrossRefFieldId?: string;
  targetTriggerCrossRefFieldName?: string;
  // Cross-reference field in target form that links to the source linked form (e.g., Control → Risk)
  targetLinkedCrossRefFieldId?: string;
  targetLinkedCrossRefFieldName?: string;

  // --- SUBMITTER SETTINGS ---
  setSubmittedBy?: 'trigger_submitter' | 'system' | 'specific_user';
  specificSubmitterId?: string;

  // --- INITIAL STATUS ---
  initialStatus?: 'pending' | 'approved' | 'rejected' | 'in_review';

  // --- DUPLICATE PREVENTION ---
  preventDuplicates?: boolean;

  // --- FIELD MAPPINGS FROM TRIGGER FORM ---
  fieldMappings?: FieldMapping[];

  // --- FIELD MAPPINGS FROM FIRST LINKED FORM ---
  linkedFormFieldMappings?: FieldMapping[];

  // --- FIELD MAPPINGS FROM SECOND LINKED FORM (for dual mode) ---
  secondLinkedFormFieldMappings?: FieldMapping[];

  // --- AUTO-LINK BACK TO TRIGGER ---
  updateTriggerCrossRefFieldId?: string;
  updateTriggerCrossRefFieldName?: string;
}

// Configuration for which target cross-ref fields to auto-link
export interface TargetLinkFieldConfig {
  // The cross-reference field ID in the target form
  targetFieldId: string;
  targetFieldName?: string;
  // Which source to link: 'first_source' or 'second_source'
  linkTo: 'first_source' | 'second_source';
  // The form ID being linked (resolved from source)
  linkedFormId?: string;
  linkedFormName?: string;
}
