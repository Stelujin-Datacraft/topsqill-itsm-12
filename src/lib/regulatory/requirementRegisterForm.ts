import type { FormField, FormPage, FormRule } from '@/types/form';
import type { CrossReferenceTarget } from '@/lib/regulatory/clauseRegisterForm';

/** Distinct from the removed grc.regulatory.requirement id. */
export const REQUIREMENT_REGISTER_REFERENCE_ID = 'grc.requirement-register';
export const REQUIREMENT_REGISTER_FORM_NAME = 'Regulatory Requirement Register';
export const VERIFICATION_DATE_RULE_MESSAGE = 'Verification Date must not precede Last Assessment Date.';

export const REQUIREMENT_REGISTER_PAGE_NAMES = [
  'Requirement Identification',
  'Requirement Details',
  'Classification',
  'Implementation Lifecycle',
  'Related Clause',
] as const;

export const REQUIREMENT_TYPE_OPTIONS = [
  'Governance',
  'Policy',
  'Process',
  'Operational Control',
  'Technical Control',
  'Reporting',
  'Recordkeeping',
  'Training',
  'Third-Party Obligation',
  'Monitoring',
  'Incident Management',
  'Business Continuity',
  'Other',
] as const;

export const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'] as const;

export const IMPLEMENTATION_STATUS_OPTIONS = [
  'Not Started',
  'Partially Implemented',
  'Not Implemented',
  'Implemented',
  'Not Applicable',
] as const;

export const IMPLEMENTATION_STATUS_TOOLTIP = [
  'Not Started: Implementation work has not started.',
  'Partially Implemented: Some, but not all, required implementation work is complete.',
  'Not Implemented: The requirement has been assessed and implementation has not been completed.',
  'Implemented: Implementation has been completed.',
  'Not Applicable: The requirement has been assessed as not applicable.',
].join(' ');

const FIELD_SPECS = [
  { key: 'requirement_id', label: 'Requirement ID', type: 'text' as const, required: true, pageName: 'Requirement Identification' as const, validation: { unique: true, trim: true }, placeholder: 'Stable requirement identifier' },
  { key: 'requirement_title', label: 'Requirement Title', type: 'text' as const, required: true, pageName: 'Requirement Identification' as const },
  { key: 'requirement_reference', label: 'Requirement Reference', type: 'text' as const, required: false, pageName: 'Requirement Identification' as const },
  { key: 'requirement_description', label: 'Requirement Description', type: 'textarea' as const, required: true, pageName: 'Requirement Details' as const },
  { key: 'implementation_guidance', label: 'Implementation Guidance', type: 'textarea' as const, required: false, pageName: 'Requirement Details' as const },
  { key: 'implementation_evidence', label: 'Implementation Evidence / Notes', type: 'textarea' as const, required: false, pageName: 'Requirement Details' as const },
  { key: 'requirement_type', label: 'Requirement Type', type: 'select' as const, required: true, pageName: 'Classification' as const, options: REQUIREMENT_TYPE_OPTIONS },
  { key: 'priority', label: 'Priority', type: 'select' as const, required: true, pageName: 'Classification' as const, options: PRIORITY_OPTIONS },
  { key: 'implementation_status', label: 'Implementation Status', type: 'select' as const, required: true, pageName: 'Implementation Lifecycle' as const, options: IMPLEMENTATION_STATUS_OPTIONS, defaultValue: 'Not Started', tooltip: IMPLEMENTATION_STATUS_TOOLTIP },
  { key: 'implementation_notes', label: 'Implementation Notes', type: 'textarea' as const, required: false, pageName: 'Implementation Lifecycle' as const },
  { key: 'last_assessment_date', label: 'Last Assessment Date', type: 'date' as const, required: false, pageName: 'Implementation Lifecycle' as const },
  { key: 'verification_date', label: 'Verification Date', type: 'date' as const, required: false, pageName: 'Implementation Lifecycle' as const },
  { key: 'regulatory_clause', label: 'Regulatory Clause', type: 'cross-reference' as const, required: true, pageName: 'Related Clause' as const },
];

export const REQUIREMENT_CLAUSE_DISPLAY_KEYS = ['clause_id', 'clause_number', 'clause_title'] as const;

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

export function createRequirementRegisterBlueprint(
  idForKey: (key: string) => string = (key) => key,
  clauseTarget?: CrossReferenceTarget,
) {
  const idByKey = new Map(FIELD_SPECS.map((spec) => [spec.key, idForKey(spec.key)]));
  const fields: FormField[] = FIELD_SPECS.map((spec) => ({
    id: idByKey.get(spec.key)!,
    type: spec.type,
    label: spec.label,
    placeholder: spec.placeholder || '',
    required: spec.required,
    defaultValue: spec.defaultValue,
    options: spec.options ? optionList(spec.options) : undefined,
    validation: spec.validation,
    permissions: { read: ['*'], write: ['*'] },
    triggers: [],
    isVisible: true,
    isEnabled: true,
    tooltip: spec.tooltip || '',
    pageId: pageIdForName(spec.pageName),
    customConfig: spec.key === 'regulatory_clause'
      ? {
          libraryKey: spec.key,
          ...(clauseTarget ? {
            targetFormId: clauseTarget.targetFormId,
            targetFormName: clauseTarget.targetFormName,
            displayColumns: clauseTarget.displayColumns,
            tableDisplayFields: clauseTarget.displayColumns,
            hyperlinkField: clauseTarget.displayColumns[0],
            enableSorting: true,
            enableSearch: true,
            pageSize: 10,
          } : {}),
        }
      : { libraryKey: spec.key },
  }));

  const pages: FormPage[] = REQUIREMENT_REGISTER_PAGE_NAMES.map((name, order) => ({
    id: pageIdForName(name),
    name,
    order,
    fields: FIELD_SPECS.filter((spec) => spec.pageName === name).map((spec) => idByKey.get(spec.key)!),
  }));

  const formRules: FormRule[] = [
    {
      id: 'rule-verification-date-order',
      name: 'Verification date cannot precede last assessment date',
      isActive: true,
      action: 'preventSubmit',
      actionValue: VERIFICATION_DATE_RULE_MESSAGE,
      conditions: [
        {
          id: 'verification-before-assessment',
          type: 'single',
          fieldId: idByKey.get('verification_date'),
          operator: '<',
          compareToField: idByKey.get('last_assessment_date'),
          value: '',
        },
      ],
    },
  ];

  return {
    name: REQUIREMENT_REGISTER_FORM_NAME,
    description: 'Requirements linked to a regulatory clause, with an implementation status chosen by the user.',
    referenceId: REQUIREMENT_REGISTER_REFERENCE_ID,
    layout: { columns: 2 as const },
    pages,
    fields,
    formRules,
  };
}
