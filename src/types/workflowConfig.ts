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
export interface CreateCombinationRecordsConfig {
  // The cross-reference field in the trigger form that contains linked records (e.g., Entity → Risk)
  sourceCrossRefFieldId: string;
  sourceCrossRefFieldName?: string;
  // The form referenced by the source cross-reference field (e.g., Risk form)
  sourceLinkedFormId: string;
  sourceLinkedFormName?: string;
  // The target form where combination records will be created (e.g., Control form)
  targetFormId: string;
  targetFormName?: string;
  // Cross-reference field in target form that links back to trigger form (e.g., Control → Entity)
  targetTriggerCrossRefFieldId: string;
  targetTriggerCrossRefFieldName?: string;
  // Cross-reference field in target form that links to the source linked form (e.g., Control → Risk)
  targetLinkedCrossRefFieldId: string;
  targetLinkedCrossRefFieldName?: string;
  // Submitter settings
  setSubmittedBy?: 'trigger_submitter' | 'system' | 'specific_user';
  specificSubmitterId?: string;
  // Initial status for the new records
  initialStatus?: 'pending' | 'approved' | 'rejected' | 'in_review';
  // Prevent duplicate combinations
  preventDuplicates?: boolean;
  // Optional field mappings from trigger form to target form
  fieldMappings?: FieldMapping[];
  // Optional field mappings from linked (source) form to target form
  linkedFormFieldMappings?: FieldMapping[];
  // Auto-link created records back to trigger form's cross-ref field
  updateTriggerCrossRefFieldId?: string;
  updateTriggerCrossRefFieldName?: string;
}
