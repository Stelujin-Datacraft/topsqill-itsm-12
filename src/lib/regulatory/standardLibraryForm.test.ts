/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/regulatory/standardLibraryForm.test.ts
 */
import assert from 'node:assert/strict';
import { collectMandatoryFieldIssues } from '@/lib/formMandatoryValidation';
import { collectHttpUrlErrors, prepareSubmissionData, uniqueValuesMatch } from '@/lib/formSubmitChecks';
import { compareOrdered } from '@/lib/orderedCompare';
import { isAbsoluteHttpUrl } from '@/lib/urlFieldValidation';
import { RuleProcessor } from '@/utils/ruleProcessor';
import { provisionStandardLibraryIfMissing } from '@/lib/regulatory/provisionStandardLibrary';
import {
  EFFECTIVE_DATE_RULE_MESSAGE,
  RELATED_CLAUSES,
  STANDARD_LIBRARY_FORM_NAME,
  STANDARD_LIBRARY_PAGE_NAMES,
  STANDARD_LIBRARY_REFERENCE_ID,
  createStandardLibraryBlueprint,
} from '@/lib/regulatory/standardLibraryForm';

const REMOVED_MODULE_IDS = [
  'grc.regulatory.standard',
  'grc.regulatory.clause',
  'grc.regulatory.requirement',
];

const blueprint = createStandardLibraryBlueprint((key) => key);

assert.equal(blueprint.name, STANDARD_LIBRARY_FORM_NAME);
assert.equal(blueprint.referenceId, STANDARD_LIBRARY_REFERENCE_ID);
assert.equal(REMOVED_MODULE_IDS.includes(blueprint.referenceId), false);
assert.deepEqual(blueprint.layout, { columns: 2 });
assert.deepEqual(blueprint.pages.map((page) => page.name), [...STANDARD_LIBRARY_PAGE_NAMES]);
assert.deepEqual(blueprint.pages.map((page) => page.order), [0, 1, 2, 3, 4]);

const labels = blueprint.fields.map((field) => field.label);
assert.deepEqual(labels, [
  'Standard ID',
  'Standard Name',
  'Short Name / Acronym',
  'Standard Type',
  'Description',
  'Jurisdiction Type',
  'Country / Region',
  'Issuing Authority',
  'Industry / Sector',
  'Official Source URL',
  'Official Publication Reference',
  'Version / Edition',
  'Publication Date',
  'Effective Date',
  'Source Language',
  'Legal Status',
  'Repeal / Expiry Date',
]);

for (const page of blueprint.pages) {
  for (const fieldId of page.fields) {
    const field = blueprint.fields.find((item) => item.id === fieldId);
    assert.ok(field, `missing field ${fieldId}`);
    assert.equal(field.pageId, page.id);
  }
}
assert.deepEqual(blueprint.pages[4].fields, []);
assert.equal(blueprint.fields.some((field) => field.type === 'cross-reference'), false);
assert.equal(RELATED_CLAUSES.configured, false);
assert.equal(RELATED_CLAUSES.targetFormName, 'Regulatory Clause Register');

function field(label: string) {
  const match = blueprint.fields.find((item) => item.label === label);
  assert.ok(match, label);
  return match;
}

assert.equal(field('Standard ID').type, 'text');
assert.equal(field('Standard ID').required, true);
assert.deepEqual(field('Standard ID').validation, { unique: true, trim: true });
assert.equal(field('Standard ID').customConfig?.libraryKey, 'standard_id');

assert.equal(field('Standard Name').required, true);
assert.equal(field('Standard Type').type, 'select');
assert.equal(field('Standard Type').required, true);
assert.deepEqual(field('Standard Type').options?.map((option) => option.value), [
  'Regulation',
  'Act / Legislation',
  'Regulatory Rule',
  'Technical Standard',
  'Industry Standard',
  'Code of Practice',
  'Framework',
  'Guidance',
  'Other',
]);

assert.equal(field('Description').type, 'textarea');
assert.equal(field('Description').required, false);
assert.equal(field('Jurisdiction Type').required, true);
assert.deepEqual(field('Jurisdiction Type').options?.map((option) => option.value), [
  'Global / International',
  'Regional / Supranational',
  'National',
  'State / Provincial',
  'Local',
  'Industry-Specific',
  'Other',
]);
assert.equal(field('Country / Region').type, 'country');
assert.equal(field('Country / Region').required, false);
assert.equal(field('Country / Region').customConfig?.libraryKey, 'country_region');
assert.equal(field('Country / Region').customConfig?.searchable, true);
assert.equal(field('Country / Region').placeholder, 'Select a country');
assert.equal(field('Issuing Authority').required, true);
assert.equal(field('Industry / Sector').type, 'multi-select');
assert.deepEqual(field('Industry / Sector').options?.map((option) => option.value), [
  'Financial Services',
  'Healthcare',
  'Technology',
  'Government / Public Sector',
  'Manufacturing',
  'Energy',
  'Telecommunications',
  'Cross-Industry',
  'Other',
]);

assert.equal(field('Official Source URL').type, 'url');
assert.equal(field('Official Source URL').required, true);
assert.equal(field('Official Source URL').customConfig?.protocolRestriction, 'http-or-https');
assert.equal(field('Publication Date').type, 'date');
assert.equal(field('Effective Date').type, 'date');
assert.equal(field('Source Language').type, 'text');
assert.equal(field('Legal Status').type, 'select');
assert.equal(field('Legal Status').required, true);
assert.equal(field('Legal Status').defaultValue, 'Unknown');
assert.deepEqual(field('Legal Status').options?.map((option) => option.value), [
  'Unknown',
  'Proposed',
  'Published',
  'Enacted / Adopted',
  'In Force',
  'Partially In Force',
  'Superseded',
  'Repealed',
  'Withdrawn',
]);
assert.equal(field('Repeal / Expiry Date').type, 'date');
assert.equal(field('Repeal / Expiry Date').required, false);

const forbidden = [
  'Record Lifecycle Status',
  'Status',
  'Applicability',
  'Owner',
  'Reviewer',
  'Source verification status',
];
for (const label of forbidden) {
  assert.equal(blueprint.fields.some((item) => item.label === label), false, label);
}

function filled(overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {};
  for (const item of blueprint.fields) {
    if (item.defaultValue) data[item.id] = item.defaultValue;
  }
  data.standard_id = '  STD-1  ';
  data.standard_name = 'Sample standard';
  data.standard_type = 'Regulation';
  data.jurisdiction_type = 'National';
  data.issuing_authority = 'Sample authority';
  data.official_source_url = 'https://example.com/standard';
  data.legal_status = data.legal_status || 'Unknown';
  return { ...data, ...overrides };
}

const trimmed = prepareSubmissionData(blueprint.fields, filled());
assert.equal(trimmed.standard_id, 'STD-1');
assert.equal(trimmed.legal_status, 'Unknown');

const missing = collectMandatoryFieldIssues({
  fields: blueprint.fields,
  pages: blueprint.pages,
  formData: { standard_name: '   ', issuing_authority: '\t' },
});
const missingLabels = missing.map((issue) => issue.fieldName).sort();
assert.deepEqual(missingLabels, [
  'Issuing Authority',
  'Jurisdiction Type',
  'Legal Status',
  'Official Source URL',
  'Standard ID',
  'Standard Name',
  'Standard Type',
].sort());

assert.equal(isAbsoluteHttpUrl('https://example.com/a'), true);
assert.equal(isAbsoluteHttpUrl('http://example.com/a'), true);
assert.equal(isAbsoluteHttpUrl('example.com'), false);
assert.equal(isAbsoluteHttpUrl('ftp://example.com/a'), false);
assert.equal(isAbsoluteHttpUrl('javascript:alert(1)'), false);

const urlErrors = collectHttpUrlErrors(blueprint.fields, filled({ official_source_url: 'ftp://example.com/a' }));
assert.match(urlErrors.official_source_url, /HTTP or HTTPS/);
assert.deepEqual(collectHttpUrlErrors(blueprint.fields, filled()), {});

assert.equal(compareOrdered('2024-05-02', '2024-05-01', '<'), false);
assert.equal(compareOrdered('2024-04-01', '2024-05-01', '<'), true);
assert.equal(compareOrdered('10', '2', '<'), false);
assert.equal(compareOrdered(2, 10, '<'), true);

const preceded = RuleProcessor.preventSubmitMessages(
  blueprint.formRules as any,
  { publication_date: '2024-05-01', effective_date: '2024-04-30' },
  blueprint.fields as any,
);
assert.equal(preceded.length, 1);
assert.equal(preceded[0].message, EFFECTIVE_DATE_RULE_MESSAGE);
assert.equal(preceded[0].fieldId, 'effective_date');

assert.equal(RuleProcessor.preventSubmitMessages(
  blueprint.formRules as any,
  { publication_date: '2024-05-01', effective_date: '2024-05-01' },
  blueprint.fields as any,
).length, 0);

assert.equal(RuleProcessor.preventSubmitMessages(
  blueprint.formRules as any,
  { publication_date: '', effective_date: '2024-04-01' },
  blueprint.fields as any,
).length, 0);

assert.equal(RuleProcessor.preventSubmitMessages(
  blueprint.formRules as any,
  { effective_date: '2024-04-01' },
  blueprint.fields as any,
).length, 0);

assert.equal(uniqueValuesMatch(' STD-1 ', 'std-1'), true);
assert.equal(uniqueValuesMatch('STD-1', 'STD-2'), false);

function memoryClient() {
  const tables: Record<string, any[]> = { forms: [], form_fields: [], form_submissions: [] };
  function from(table: string) {
    const filters: Array<(row: any) => boolean> = [];
    const api: any = {
      select() { return api; },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return api;
      },
      neq(column: string, value: unknown) {
        filters.push((row) => row[column] !== value);
        return api;
      },
      limit() { return api; },
      order() { return api; },
      insert(payload: any) {
        const rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
          ...row,
          id: row.id || crypto.randomUUID(),
        }));
        tables[table].push(...rows);
        const inserted = { data: rows, error: null };
        return {
          select() {
            return { single: async () => ({ data: rows[0], error: null }) };
          },
          then(resolve: (value: typeof inserted) => unknown) {
            return Promise.resolve(inserted).then(resolve);
          },
        };
      },
      update(payload: any) {
        return {
          eq(column: string, value: unknown) {
            const row = tables[table].find((item) => item[column] === value);
            if (row) Object.assign(row, payload);
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
      delete() {
        return {
          eq(column: string, value: unknown) {
            tables[table] = tables[table].filter((row) => row[column] !== value);
            return Promise.resolve({ error: null });
          },
        };
      },
      then(resolve: (value: { data: any[]; error: null }) => unknown) {
        const data = tables[table].filter((row) => filters.every((filter) => filter(row)));
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return api;
  }
  return { from, tables };
}

const db = memoryClient();
const first = await provisionStandardLibraryIfMissing(db, {
  organizationId: 'org-1',
  projectId: 'project-1',
  createdBy: 'user-1',
});
assert.equal(first.created, true);
assert.ok(first.form);
assert.equal(first.form.name, STANDARD_LIBRARY_FORM_NAME);
assert.equal(first.form.reference_id, STANDARD_LIBRARY_REFERENCE_ID);
assert.equal(JSON.parse(String(first.form.layout)).columns, 2);
const storedPages = JSON.parse(String(first.form.pages));
assert.deepEqual(storedPages.map((page: { name: string }) => page.name), [...STANDARD_LIBRARY_PAGE_NAMES]);
assert.equal(storedPages[4].fields.length, 0);
assert.equal(db.tables.form_fields.length, 17);
assert.equal(db.tables.form_fields.some((row) => row.field_type === 'cross-reference'), false);
assert.equal(db.tables.form_fields.some((row) => row.label === 'Status'), false);

const second = await provisionStandardLibraryIfMissing(db, {
  organizationId: 'org-1',
  projectId: 'project-1',
  createdBy: 'user-1',
});
assert.equal(second.created, false);
assert.equal(db.tables.forms.length, 1);

const standardId = db.tables.form_fields.find((row) => row.label === 'Standard ID');
const legalStatus = db.tables.form_fields.find((row) => row.label === 'Legal Status');
assert.equal(JSON.parse(standardId.validation).unique, true);
assert.equal(JSON.parse(standardId.validation).trim, true);
assert.equal(JSON.parse(standardId.custom_config).libraryKey, 'standard_id');
assert.equal(legalStatus.default_value, 'Unknown');

const submission = {
  id: 'submission-1',
  form_id: first.form.id,
  submission_data: prepareSubmissionData(
    db.tables.form_fields.map((row) => ({
      id: row.id,
      validation: row.validation ? JSON.parse(row.validation) : undefined,
    })),
    {
      [standardId.id]: '  LIB-100  ',
      [legalStatus.id]: 'Unknown',
    },
  ),
};
db.tables.form_submissions.push(submission);
const reopened = db.tables.form_submissions.find((row) => row.id === 'submission-1');
assert.equal(reopened.submission_data[standardId.id], 'LIB-100');
assert.equal(reopened.submission_data[legalStatus.id], 'Unknown');
assert.equal(uniqueValuesMatch('lib-100', reopened.submission_data[standardId.id]), true);

const countryField = db.tables.form_fields.find((row) => row.label === 'Country / Region');
assert.equal(countryField.field_type, 'country');
assert.equal(JSON.parse(countryField.custom_config).libraryKey, 'country_region');

const legacy = memoryClient();
legacy.tables.forms.push({
  id: 'form-legacy',
  organization_id: 'org-1',
  project_id: 'project-1',
  reference_id: STANDARD_LIBRARY_REFERENCE_ID,
  name: STANDARD_LIBRARY_FORM_NAME,
});
legacy.tables.form_fields.push({
  id: 'field-country',
  form_id: 'form-legacy',
  field_type: 'text',
  label: 'Country / Region',
  custom_config: JSON.stringify({ libraryKey: 'country_region' }),
});
const upgraded = await provisionStandardLibraryIfMissing(legacy, {
  organizationId: 'org-1',
  projectId: 'project-1',
  createdBy: 'user-1',
  alreadyPresent: true,
});
assert.equal(upgraded.created, false);
assert.equal(legacy.tables.form_fields[0].field_type, 'country');
assert.equal(legacy.tables.form_fields[0].placeholder, 'Select a country');
assert.equal(JSON.parse(legacy.tables.form_fields[0].custom_config).searchable, true);
assert.equal(legacy.tables.forms.length, 1);

console.log('Regulatory Standard Library form checks: ok');
