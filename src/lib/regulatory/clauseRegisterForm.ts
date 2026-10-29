import type { FormField, FormPage, FormRule } from '@/types/form';

/** Distinct from the removed grc.regulatory.clause id. */
export const CLAUSE_REGISTER_REFERENCE_ID = 'grc.clause-register';
export const CLAUSE_REGISTER_FORM_NAME = 'Regulatory Clause Register';

export const CLAUSE_REGISTER_PAGE_NAMES = [
  'Clause Identification',
  'Clause Content',
  'Classification',
  'Related Standard',
] as const;

export const CLAUSE_CATEGORY_OPTIONS = [
  'Governance',
  'Risk Management',
  'Compliance Obligations',
  'Reporting and Disclosure',
  'Recordkeeping and Documentation',
  'Data Protection and Privacy',
  'Information Security',
  'Incident Management',
  'Third-Party Management',
  'Training and Awareness',
  'Monitoring and Testing',
  'Business Continuity',
  'Technical Requirements',
  'Other',
] as const;

export interface CrossReferenceTarget {
  targetFormId: string;
  targetFormName: string;
  displayColumns: string[];
}

type FieldSpec = {
  key: string;
  label: string;
  type: FormField['type'];
  required: boolean;
  pageName: (typeof CLAUSE_REGISTER_PAGE_NAMES)[number];
  options?: readonly string[];
  validation?: FormField['validation'];
  placeholder?: string;
};

const FIELD_SPECS: FieldSpec[] = [
  { key: 'clause_id', label: 'Clause ID', type: 'text', required: true, pageName: 'Clause Identification', validation: { unique: true, trim: true }, placeholder: 'Stable clause identifier' },
  { key: 'clause_number', label: 'Clause Number / Reference', type: 'text', required: true, pageName: 'Clause Identification' },
  { key: 'clause_title', label: 'Clause Title', type: 'text', required: true, pageName: 'Clause Identification' },
  { key: 'short_reference', label: 'Short Reference', type: 'text', required: false, pageName: 'Clause Identification' },
  { key: 'clause_text', label: 'Clause Text', type: 'textarea', required: true, pageName: 'Clause Content' },
  { key: 'clause_summary', label: 'Clause Summary', type: 'textarea', required: false, pageName: 'Clause Content' },
  { key: 'clause_category', label: 'Clause Category', type: 'select', required: true, pageName: 'Classification', options: CLAUSE_CATEGORY_OPTIONS },
  { key: 'topic_keywords', label: 'Topic / Keywords', type: 'text', required: false, pageName: 'Classification' },
  { key: 'effective_date', label: 'Effective Date', type: 'date', required: false, pageName: 'Classification' },
  { key: 'regulatory_standard', label: 'Regulatory Standard', type: 'cross-reference', required: true, pageName: 'Related Standard' },
];

export const CLAUSE_STANDARD_DISPLAY_KEYS = ['standard_id', 'standard_name'] as const;

function optionList(labels: readonly string[]) {
  return labels.map((label) => ({
    id: `opt-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    value: label,
    label,
  }));
}

function pageIdForName(name: string): string {
  return `page-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function createClauseRegisterBlueprint(
  idForKey: (key: string) => string = (key) => key,
  standardTarget?: CrossReferenceTarget,
): { name: string; description: string; referenceId: string; layout: { columns: 2 }; pages: FormPage[]; fields: FormField[]; formRules: FormRule[] } {
  const idByKey = new Map(FIELD_SPECS.map((spec) => [spec.key, idForKey(spec.key)]));
  const fields: FormField[] = FIELD_SPECS.map((spec) => ({
    id: idByKey.get(spec.key)!,
    type: spec.type,
    label: spec.label,
    placeholder: spec.placeholder || '',
    required: spec.required,
    options: spec.options ? optionList(spec.options) : undefined,
    validation: spec.validation,
    permissions: { read: ['*'], write: ['*'] },
    triggers: [],
    isVisible: true,
    isEnabled: true,
    pageId: pageIdForName(spec.pageName),
    customConfig: spec.key === 'regulatory_standard'
      ? {
          libraryKey: spec.key,
          ...(standardTarget ? {
            targetFormId: standardTarget.targetFormId,
            targetFormName: standardTarget.targetFormName,
            displayColumns: standardTarget.displayColumns,
            tableDisplayFields: standardTarget.displayColumns,
            hyperlinkField: standardTarget.displayColumns[0],
            enableSorting: true,
            enableSearch: true,
            pageSize: 10,
          } : {}),
        }
      : { libraryKey: spec.key },
  }));

  const pages: FormPage[] = CLAUSE_REGISTER_PAGE_NAMES.map((name, order) => ({
    id: pageIdForName(name),
    name,
    order,
    fields: FIELD_SPECS.filter((spec) => spec.pageName === name).map((spec) => idByKey.get(spec.key)!),
  }));

  return {
    name: CLAUSE_REGISTER_FORM_NAME,
    description: 'Clauses linked to a regulatory standard. Clause text is stored as entered.',
    referenceId: CLAUSE_REGISTER_REFERENCE_ID,
    layout: { columns: 2 },
    pages,
    fields,
    formRules: [],
  };
}
