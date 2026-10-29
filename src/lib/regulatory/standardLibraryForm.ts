import type { FormField, FormPage, FormRule } from '@/types/form';

/** Stable form key. Distinct from the removed grc.regulatory.* module ids. */
export const STANDARD_LIBRARY_REFERENCE_ID = 'grc.standard-library';
export const STANDARD_LIBRARY_FORM_NAME = 'Regulatory Standard Library';
export const REGULATORY_CLAUSE_REGISTER_FORM_NAME = 'Regulatory Clause Register';

export const STANDARD_LIBRARY_PAGE_NAMES = [
  'Standard Identification',
  'Classification and Jurisdiction',
  'Official Source and Version',
  'Legal Status',
  'Related Clauses',
] as const;

const STANDARD_TYPE_OPTIONS = [
  'Regulation',
  'Act / Legislation',
  'Regulatory Rule',
  'Technical Standard',
  'Industry Standard',
  'Code of Practice',
  'Framework',
  'Guidance',
  'Other',
] as const;

const JURISDICTION_TYPE_OPTIONS = [
  'Global / International',
  'Regional / Supranational',
  'National',
  'State / Provincial',
  'Local',
  'Industry-Specific',
  'Other',
] as const;

const INDUSTRY_SECTOR_OPTIONS = [
  'Financial Services',
  'Healthcare',
  'Technology',
  'Government / Public Sector',
  'Manufacturing',
  'Energy',
  'Telecommunications',
  'Cross-Industry',
  'Other',
] as const;

const LEGAL_STATUS_OPTIONS = [
  'Unknown',
  'Proposed',
  'Published',
  'Enacted / Adopted',
  'In Force',
  'Partially In Force',
  'Superseded',
  'Repealed',
  'Withdrawn',
] as const;

export const EFFECTIVE_DATE_RULE_MESSAGE = 'Effective Date must not precede Publication Date.';

/**
 * Related Clauses is deferred. A cross-reference stores a target form id and
 * display columns; Regulatory Clause Register does not exist, and a placeholder
 * form or empty target would render as a broken reference.
 */
export const RELATED_CLAUSES = {
  label: 'Related Clauses',
  configured: false as const,
  controlType: 'cross-reference' as const,
  required: false,
  targetFormName: REGULATORY_CLAUSE_REGISTER_FORM_NAME,
  relationship: 'one Regulatory Standard to multiple Clause records',
  reason:
    'Regulatory Clause Register does not exist. The platform cross-reference requires an existing target form id and display columns, so the field is deferred. Page 5 is present and contains no field.',
};

type FieldSpec = {
  key: string;
  label: string;
  type: FormField['type'];
  required: boolean;
  pageName: (typeof STANDARD_LIBRARY_PAGE_NAMES)[number];
  options?: readonly string[];
  defaultValue?: string;
  validation?: FormField['validation'];
  customConfig?: FormField['customConfig'];
  placeholder?: string;
};

function optionList(labels: readonly string[]) {
  return labels.map((label) => ({
    id: `opt-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    value: label,
    label,
  }));
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: 'standard_id',
    label: 'Standard ID',
    type: 'text',
    required: true,
    pageName: 'Standard Identification',
    validation: { unique: true, trim: true },
    placeholder: 'Stable standard identifier',
  },
  {
    key: 'standard_name',
    label: 'Standard Name',
    type: 'text',
    required: true,
    pageName: 'Standard Identification',
  },
  {
    key: 'short_name',
    label: 'Short Name / Acronym',
    type: 'text',
    required: false,
    pageName: 'Standard Identification',
  },
  {
    key: 'standard_type',
    label: 'Standard Type',
    type: 'select',
    required: true,
    pageName: 'Standard Identification',
    options: STANDARD_TYPE_OPTIONS,
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    required: false,
    pageName: 'Standard Identification',
  },
  {
    key: 'jurisdiction_type',
    label: 'Jurisdiction Type',
    type: 'select',
    required: true,
    pageName: 'Classification and Jurisdiction',
    options: JURISDICTION_TYPE_OPTIONS,
  },
  {
    key: 'country_region',
    label: 'Country / Region',
    type: 'text',
    required: false,
    pageName: 'Classification and Jurisdiction',
  },
  {
    key: 'issuing_authority',
    label: 'Issuing Authority',
    type: 'text',
    required: true,
    pageName: 'Classification and Jurisdiction',
  },
  {
    key: 'industry_sector',
    label: 'Industry / Sector',
    type: 'multi-select',
    required: false,
    pageName: 'Classification and Jurisdiction',
    options: INDUSTRY_SECTOR_OPTIONS,
  },
  {
    key: 'official_source_url',
    label: 'Official Source URL',
    type: 'url',
    required: true,
    pageName: 'Official Source and Version',
    placeholder: 'https://',
    customConfig: {
      protocolRestriction: 'http-or-https',
      realTimeValidation: true,
      validationMessage: 'Enter an absolute HTTP or HTTPS URL.',
    },
  },
  {
    key: 'publication_reference',
    label: 'Official Publication Reference',
    type: 'text',
    required: false,
    pageName: 'Official Source and Version',
  },
  {
    key: 'version_edition',
    label: 'Version / Edition',
    type: 'text',
    required: false,
    pageName: 'Official Source and Version',
  },
  {
    key: 'publication_date',
    label: 'Publication Date',
    type: 'date',
    required: false,
    pageName: 'Official Source and Version',
  },
  {
    key: 'effective_date',
    label: 'Effective Date',
    type: 'date',
    required: false,
    pageName: 'Official Source and Version',
  },
  {
    key: 'source_language',
    label: 'Source Language',
    type: 'text',
    required: false,
    pageName: 'Official Source and Version',
  },
  {
    key: 'legal_status',
    label: 'Legal Status',
    type: 'select',
    required: true,
    pageName: 'Legal Status',
    options: LEGAL_STATUS_OPTIONS,
    defaultValue: 'Unknown',
  },
  {
    key: 'repeal_expiry_date',
    label: 'Repeal / Expiry Date',
    type: 'date',
    required: false,
    pageName: 'Legal Status',
  },
];

export function standardLibraryFieldSpecs() {
  return FIELD_SPECS.map((spec) => ({ ...spec, options: spec.options ? [...spec.options] : undefined }));
}

export interface StandardLibraryBlueprint {
  name: string;
  description: string;
  referenceId: string;
  layout: { columns: 2 };
  pages: FormPage[];
  fields: FormField[];
  formRules: FormRule[];
  relatedClauses: typeof RELATED_CLAUSES;
}

export function createStandardLibraryBlueprint(
  idForKey: (key: string) => string = (key) => key,
): StandardLibraryBlueprint {
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
    pageId: pageIdForName(spec.pageName),
    customConfig: {
      libraryKey: spec.key,
      ...(spec.customConfig || {}),
    },
  }));

  const pages: FormPage[] = STANDARD_LIBRARY_PAGE_NAMES.map((name, order) => ({
    id: pageIdForName(name),
    name,
    order,
    fields: FIELD_SPECS.filter((spec) => spec.pageName === name).map((spec) => idByKey.get(spec.key)!),
  }));

  const formRules: FormRule[] = [
    {
      id: 'rule-effective-date-order',
      name: 'Effective date cannot precede publication date',
      isActive: true,
      action: 'preventSubmit',
      actionValue: EFFECTIVE_DATE_RULE_MESSAGE,
      conditions: [
        {
          id: 'effective-before-publication',
          type: 'single',
          fieldId: idByKey.get('effective_date'),
          operator: '<',
          compareToField: idByKey.get('publication_date'),
          value: '',
        },
      ],
    },
  ];

  return {
    name: STANDARD_LIBRARY_FORM_NAME,
    description: 'Catalog of regulatory standards: identification, jurisdiction, official source, and legal status.',
    referenceId: STANDARD_LIBRARY_REFERENCE_ID,
    layout: { columns: 2 },
    pages,
    fields,
    formRules,
    relatedClauses: RELATED_CLAUSES,
  };
}

export function pageIdForName(name: string): string {
  return `page-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function libraryKeyForField(field: { customConfig?: { libraryKey?: string }; id: string }): string {
  return field.customConfig?.libraryKey || field.id;
}
