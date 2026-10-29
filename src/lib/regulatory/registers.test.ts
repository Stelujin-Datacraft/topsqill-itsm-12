/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/regulatory/registers.test.ts
 */
import assert from 'node:assert/strict';
import { collectMandatoryFieldIssues } from '@/lib/formMandatoryValidation';
import { collectSingleParentReferenceErrors, prepareSubmissionData, uniqueValuesMatch } from '@/lib/formSubmitChecks';
import { RuleProcessor } from '@/utils/ruleProcessor';
import { provisionStandardLibraryIfMissing } from '@/lib/regulatory/provisionStandardLibrary';
import { STANDARD_LIBRARY_REFERENCE_ID } from '@/lib/regulatory/standardLibraryForm';
import {
  CLAUSE_CATEGORY_OPTIONS,
  CLAUSE_REGISTER_FORM_NAME,
  CLAUSE_REGISTER_PAGE_NAMES,
  CLAUSE_REGISTER_REFERENCE_ID,
  createClauseRegisterBlueprint,
} from '@/lib/regulatory/clauseRegisterForm';
import {
  IMPLEMENTATION_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  REQUIREMENT_REGISTER_FORM_NAME,
  REQUIREMENT_REGISTER_PAGE_NAMES,
  REQUIREMENT_REGISTER_REFERENCE_ID,
  REQUIREMENT_TYPE_OPTIONS,
  VERIFICATION_DATE_RULE_MESSAGE,
  createRequirementRegisterBlueprint,
} from '@/lib/regulatory/requirementRegisterForm';
import { provisionRegulatoryRegistersIfMissing } from '@/lib/regulatory/provisionRegulatoryRegisters';

const clause = createClauseRegisterBlueprint((key) => key, {
  targetFormId: 'standard-form',
  targetFormName: 'Regulatory Standard Library',
  displayColumns: ['standard_id', 'standard_name'],
});
const requirement = createRequirementRegisterBlueprint((key) => key, {
  targetFormId: 'clause-form',
  targetFormName: CLAUSE_REGISTER_FORM_NAME,
  displayColumns: ['clause_id', 'clause_number', 'clause_title'],
});

assert.equal(clause.name, CLAUSE_REGISTER_FORM_NAME);
assert.equal(clause.referenceId, CLAUSE_REGISTER_REFERENCE_ID);
assert.equal((['grc.regulatory.clause', 'grc.regulatory.requirement'] as string[]).includes(clause.referenceId), false);
assert.deepEqual(clause.layout, { columns: 2 });
assert.deepEqual(clause.pages.map((page) => page.name), [...CLAUSE_REGISTER_PAGE_NAMES]);
assert.deepEqual(clause.fields.map((field) => field.label), [
  'Clause ID',
  'Clause Number / Reference',
  'Clause Title',
  'Short Reference',
  'Clause Text',
  'Clause Summary',
  'Clause Category',
  'Topic / Keywords',
  'Effective Date',
  'Regulatory Standard',
]);
assert.equal(clause.fields.find((field) => field.label === 'Clause ID')?.validation?.unique, true);
assert.equal(clause.fields.find((field) => field.label === 'Clause ID')?.validation?.trim, true);
assert.equal(clause.fields.find((field) => field.label === 'Clause Text')?.type, 'textarea');
assert.equal(clause.fields.find((field) => field.label === 'Clause Text')?.required, true);
assert.equal(clause.fields.find((field) => field.label === 'Clause Summary')?.required, false);
assert.deepEqual(
  clause.fields.find((field) => field.label === 'Clause Category')?.options?.map((option) => option.value),
  [...CLAUSE_CATEGORY_OPTIONS],
);
const standardRef = clause.fields.find((field) => field.label === 'Regulatory Standard');
assert.equal(standardRef?.type, 'cross-reference');
assert.equal(standardRef?.required, true);
assert.equal(standardRef?.customConfig?.targetFormId, 'standard-form');
assert.deepEqual(standardRef?.customConfig?.displayColumns, ['standard_id', 'standard_name']);
assert.equal(clause.fields.some((field) => field.label === 'Status'), false);
assert.equal(clause.pages[3].fields.length, 1);

assert.equal(requirement.name, REQUIREMENT_REGISTER_FORM_NAME);
assert.equal(requirement.referenceId, REQUIREMENT_REGISTER_REFERENCE_ID);
assert.equal((['grc.regulatory.clause', 'grc.regulatory.requirement'] as string[]).includes(requirement.referenceId), false);
assert.deepEqual(requirement.layout, { columns: 2 });
assert.deepEqual(requirement.pages.map((page) => page.name), [...REQUIREMENT_REGISTER_PAGE_NAMES]);
assert.deepEqual(requirement.fields.map((field) => field.label), [
  'Requirement ID',
  'Requirement Title',
  'Requirement Reference',
  'Requirement Description',
  'Implementation Guidance',
  'Implementation Evidence / Notes',
  'Requirement Type',
  'Priority',
  'Implementation Status',
  'Implementation Notes',
  'Last Assessment Date',
  'Verification Date',
  'Regulatory Clause',
]);
assert.deepEqual(
  requirement.fields.find((field) => field.label === 'Requirement Type')?.options?.map((option) => option.value),
  [...REQUIREMENT_TYPE_OPTIONS],
);
assert.deepEqual(
  requirement.fields.find((field) => field.label === 'Priority')?.options?.map((option) => option.value),
  [...PRIORITY_OPTIONS],
);
const status = requirement.fields.find((field) => field.label === 'Implementation Status');
assert.equal(status?.required, true);
assert.equal(status?.defaultValue, 'Not Started');
assert.deepEqual(status?.options?.map((option) => option.value), [...IMPLEMENTATION_STATUS_OPTIONS]);
const clauseRef = requirement.fields.find((field) => field.label === 'Regulatory Clause');
assert.equal(clauseRef?.type, 'cross-reference');
assert.equal(clauseRef?.required, true);
assert.equal(clauseRef?.customConfig?.targetFormId, 'clause-form');
assert.deepEqual(clauseRef?.customConfig?.displayColumns, ['clause_id', 'clause_number', 'clause_title']);

const clauseMissing = collectMandatoryFieldIssues({
  fields: clause.fields,
  pages: clause.pages,
  formData: { clause_number: '   ', clause_title: ' ', clause_text: '\n' },
});
assert.deepEqual(clauseMissing.map((issue) => issue.fieldName).sort(), [
  'Clause Category',
  'Clause ID',
  'Clause Number / Reference',
  'Clause Text',
  'Clause Title',
  'Regulatory Standard',
].sort());

const requirementMissing = collectMandatoryFieldIssues({
  fields: requirement.fields,
  pages: requirement.pages,
  formData: { requirement_title: '  ', requirement_description: ' ' },
});
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Requirement ID'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Requirement Title'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Requirement Description'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Requirement Type'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Priority'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Implementation Status'));
assert.ok(requirementMissing.some((issue) => issue.fieldName === 'Regulatory Clause'));
assert.equal(requirementMissing.some((issue) => issue.fieldName === 'Implementation Guidance'), false);

const trimmed = prepareSubmissionData(clause.fields, { clause_id: '  CL-1  ', clause_text: 'Original legal wording.' });
assert.equal(trimmed.clause_id, 'CL-1');
assert.equal(trimmed.clause_text, 'Original legal wording.');
assert.deepEqual(collectSingleParentReferenceErrors(clause.fields, {
  regulatory_standard: [{ id: 'a' }, { id: 'b' }],
}), { regulatory_standard: 'Select one Regulatory Standard.' });
assert.deepEqual(collectSingleParentReferenceErrors(clause.fields, {
  regulatory_standard: [{ id: 'a' }],
}), {});
assert.equal(uniqueValuesMatch(' cl-1 ', trimmed.clause_id), true);

const preceded = RuleProcessor.preventSubmitMessages(
  requirement.formRules as any,
  { last_assessment_date: '2024-06-01', verification_date: '2024-05-01' },
  requirement.fields as any,
);
assert.equal(preceded.length, 1);
assert.equal(preceded[0].message, VERIFICATION_DATE_RULE_MESSAGE);
assert.equal(RuleProcessor.preventSubmitMessages(
  requirement.formRules as any,
  { last_assessment_date: '2024-06-01', verification_date: '2024-06-01' },
  requirement.fields as any,
).length, 0);
assert.equal(RuleProcessor.preventSubmitMessages(
  requirement.formRules as any,
  { verification_date: '2024-05-01' },
  requirement.fields as any,
).length, 0);

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
      limit() { return api; },
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

const input = { organizationId: 'org-1', projectId: 'project-1', createdBy: 'user-1' };

const empty = memoryClient();
const blocked = await provisionRegulatoryRegistersIfMissing(empty, input);
assert.equal(blocked.clauseCreated, false);
assert.equal(blocked.requirementCreated, false);
assert.match(blocked.blockedReason || '', /Regulatory Standard Library was not found/);
assert.equal(empty.tables.forms.length, 0);

const db = memoryClient();
const standard = await provisionStandardLibraryIfMissing(db, input);
assert.equal(standard.created, true);
const standardFieldCount = db.tables.form_fields.length;
const standardFormId = standard.form.id;

const created = await provisionRegulatoryRegistersIfMissing(db, input);
assert.equal(created.blockedReason, null);
assert.equal(created.clauseCreated, true);
assert.equal(created.requirementCreated, true);
assert.equal(created.clauseForm.name, CLAUSE_REGISTER_FORM_NAME);
assert.equal(created.requirementForm.name, REQUIREMENT_REGISTER_FORM_NAME);
assert.equal(db.tables.form_fields.filter((row) => row.form_id === standardFormId).length, standardFieldCount);
assert.equal(db.tables.form_fields.some((row) => row.field_type === 'child-cross-reference'), false);
assert.equal(db.tables.form_fields.some((row) => row.form_id === standardFormId && row.field_type === 'cross-reference'), false);

const clauseFields = db.tables.form_fields.filter((row) => row.form_id === created.clauseForm.id);
const standardLink = clauseFields.find((row) => row.label === 'Regulatory Standard');
const standardLinkConfig = JSON.parse(standardLink.custom_config);
const standardIdField = db.tables.form_fields.find((row) => row.form_id === standardFormId && row.label === 'Standard ID');
const standardNameField = db.tables.form_fields.find((row) => row.form_id === standardFormId && row.label === 'Standard Name');
assert.equal(standardLinkConfig.targetFormId, standardFormId);
assert.deepEqual(standardLinkConfig.displayColumns, [standardIdField.id, standardNameField.id]);

const requirementFields = db.tables.form_fields.filter((row) => row.form_id === created.requirementForm.id);
const clauseLink = requirementFields.find((row) => row.label === 'Regulatory Clause');
const clauseLinkConfig = JSON.parse(clauseLink.custom_config);
const clauseIdField = clauseFields.find((row) => row.label === 'Clause ID');
assert.equal(clauseLinkConfig.targetFormId, created.clauseForm.id);
assert.deepEqual(clauseLinkConfig.displayColumns[0], clauseIdField.id);
assert.equal(JSON.parse(requirementFields.find((row) => row.label === 'Implementation Status').options).map((option: { value: string }) => option.value).join('|'), IMPLEMENTATION_STATUS_OPTIONS.join('|'));
assert.equal(requirementFields.find((row) => row.label === 'Implementation Status').default_value, 'Not Started');

const again = await provisionRegulatoryRegistersIfMissing(db, input);
assert.equal(again.clauseCreated, false);
assert.equal(again.requirementCreated, false);
assert.equal(db.tables.forms.filter((row) => row.reference_id === CLAUSE_REGISTER_REFERENCE_ID).length, 1);
assert.equal(db.tables.forms.filter((row) => row.reference_id === REQUIREMENT_REGISTER_REFERENCE_ID).length, 1);
assert.equal(db.tables.forms.filter((row) => row.reference_id === STANDARD_LIBRARY_REFERENCE_ID).length, 1);

const statusFieldId = requirementFields.find((row) => row.label === 'Implementation Status').id;
for (const value of IMPLEMENTATION_STATUS_OPTIONS) {
  const saved = { [statusFieldId]: value, [clauseLink.id]: [{ id: 'clause-sub', submission_ref_id: 'CL-1', form_id: created.clauseForm.id }] };
  const reopened = JSON.parse(JSON.stringify(saved));
  assert.equal(reopened[statusFieldId], value);
  assert.equal(reopened[clauseLink.id][0].form_id, created.clauseForm.id);
  assert.equal(reopened[clauseLink.id][0].submission_ref_id, 'CL-1');
}

const clauseRecord = {
  [clauseIdField.id]: 'CL-9',
  [standardLink.id]: [{ id: 'std-sub', submission_ref_id: 'STD-9', form_id: standardFormId }],
};
const reopenedClause = JSON.parse(JSON.stringify(clauseRecord));
assert.equal(reopenedClause[standardLink.id][0].form_id, standardFormId);
assert.equal(reopenedClause[clauseIdField.id], 'CL-9');

console.log('Regulatory clause and requirement register checks: ok');
