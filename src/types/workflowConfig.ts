// Configuration interfaces for new workflow action types

export interface ChangeFieldValueConfig {
  targetFormId: string;
  targetFormName?: string;
  targetFieldId: string;
  targetFieldName?: string;
  valueType: 'static' | 'dynamic';
  staticValue?: any;
  dynamicValuePath?: string; // e.g., "email" or "userDetails.phoneNumber"
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
  valueType: 'static' | 'dynamic';
  staticValue?: any;
  dynamicValuePath?: string;
}

export interface CreateRecordConfig {
  targetFormId: string;
  targetFormName?: string;
  recordCount: number;
  fieldValues: CreateRecordFieldValue[];
}
