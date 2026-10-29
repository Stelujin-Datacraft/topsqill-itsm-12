/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/grc/foundation.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFoundationValueErrors, collectSingleParentReferenceErrors } from '@/lib/formSubmitChecks';
import { createFoundationBlueprint } from '@/lib/grc/createFoundationBlueprint';
import {
  ASSET_ASSESSMENT_FORM_NAME,
  ASSET_ASSESSMENT_REFERENCE_ID,
  ASSET_CATEGORY_OPTIONS,
  ASSET_LIFECYCLE_OPTIONS,
  ASSET_REGISTER_FORM_NAME,
  ASSET_REGISTER_REFERENCE_ID,
  ASSET_TYPE_FORM_NAME,
  ASSET_TYPE_REFERENCE_ID,
  ASSESSMENT_STATUS_OPTIONS,
  CONTROL_OBJECTIVE_FORM_NAME,
  CONTROL_OBJECTIVE_REFERENCE_ID,
  CONTROL_OBJECTIVE_STATUS_OPTIONS,
  GRC_FOUNDATION_FORMS,
  GRC_FOUNDATION_LIMITATIONS,
} from '@/lib/grc/foundationCatalog';
import { buildGrcFoundationSql } from '@/lib/grc/grcFoundationSql';
import { provisionGrcFoundationIfMissing } from '@/lib/grc/provisionGrcFoundation';
import { provisionRegulatoryRegistersIfMissing } from '@/lib/regulatory/provisionRegulatoryRegisters';
import { provisionStandardLibraryIfMissing } from '@/lib/regulatory/provisionStandardLibrary';
import { REQUIREMENT_REGISTER_REFERENCE_ID } from '@/lib/regulatory/requirementRegisterForm';

function memoryClient() {
  const tables: Record<string, any[]> = { forms: [], form_fields: [] };
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

function spec(referenceId: string) {
  const found = GRC_FOUNDATION_FORMS.find((form) => form.referenceId === referenceId);
  assert.ok(found);
  return found;
}

function blueprint(referenceId: string) {
  return createFoundationBlueprint(spec(referenceId));
}

const objective = blueprint(CONTROL_OBJECTIVE_REFERENCE_ID);
assert.equal(objective.name, CONTROL_OBJECTIVE_FORM_NAME);
assert.deepEqual(objective.pages.map((page) => page.name), [
  'Control Objective Identification',
  'Control Objective Details',
  'Control Method and Frequency',
  'Asset Type Mapping',
  'Lifecycle and Governance',
]);
assert.equal(objective.fields.find((field) => field.label === 'Control Objective Status')?.defaultValue, 'Draft');
assert.deepEqual(
  objective.fields.find((field) => field.label === 'Control Objective Status')?.options?.map((option) => option.value),
  [...CONTROL_OBJECTIVE_STATUS_OPTIONS],
);
assert.equal(objective.fields.find((field) => field.label === 'Regulatory Requirement')?.type, 'cross-reference');
assert.equal(objective.fields.find((field) => field.label === 'Applicable Asset Types')?.required, true);
assert.equal(objective.fields.some((field) => field.label === 'Status'), false);

const assetType = blueprint(ASSET_TYPE_REFERENCE_ID);
assert.equal(assetType.name, ASSET_TYPE_FORM_NAME);
assert.deepEqual(assetType.pages.map((page) => page.name), ['Asset Type Identification', 'Classification', 'Lifecycle and Governance']);
assert.equal(assetType.fields.find((field) => field.label === 'Record Status')?.defaultValue, 'Active');
assert.deepEqual(
  assetType.fields.find((field) => field.label === 'Asset Category')?.options?.map((option) => option.value),
  [...ASSET_CATEGORY_OPTIONS],
);

const asset = blueprint(ASSET_REGISTER_REFERENCE_ID);
assert.equal(asset.name, ASSET_REGISTER_FORM_NAME);
assert.equal(asset.pages.length, 6);
assert.equal(asset.fields.find((field) => field.label === 'Asset Lifecycle Status')?.defaultValue, 'Planned');
assert.deepEqual(
  asset.fields.find((field) => field.label === 'Asset Lifecycle Status')?.options?.map((option) => option.value),
  [...ASSET_LIFECYCLE_OPTIONS],
);
assert.equal(asset.fields.some((field) => field.label === 'Asset Category'), false);
assert.equal(asset.fields.find((field) => field.label === 'Support Team')?.type, 'group-picker');
assert.equal(asset.fields.find((field) => field.label === 'Asset Owner')?.type, 'user-picker');
assert.equal(asset.fields.find((field) => field.label === 'Asset Value Score')?.isEnabled, false);
assert.equal(asset.fields.find((field) => field.customConfig?.libraryKey === 'acquisition_cost')?.validation?.min, 0);
assert.equal(asset.fields.find((field) => field.customConfig?.libraryKey === 'asset_tag')?.validation?.unique, true);
assert.equal(asset.fields.find((field) => field.customConfig?.libraryKey === 'asset_tag')?.required, false);

const assessment = blueprint(ASSET_ASSESSMENT_REFERENCE_ID);
assert.equal(assessment.name, ASSET_ASSESSMENT_FORM_NAME);
assert.equal(assessment.pages.length, 6);
assert.equal(assessment.fields.find((field) => field.label === 'Assessment Status')?.defaultValue, 'Draft');
assert.deepEqual(
  assessment.fields.find((field) => field.label === 'Assessment Status')?.options?.map((option) => option.value),
  [...ASSESSMENT_STATUS_OPTIONS],
);
assert.equal(assessment.fields.find((field) => field.label === 'Asset')?.type, 'cross-reference');
assert.equal(assessment.fields.find((field) => field.label === 'Asset Value Score')?.isEnabled, false);
assert.equal(assessment.fields.find((field) => field.label === 'Final Approved RTO')?.isEnabled, true);
assert.equal(GRC_FOUNDATION_FORMS.some((form) => form.fields.some((field) => field.type === 'query-field' as never)), false);
assert.ok(GRC_FOUNDATION_LIMITATIONS.some((item) => item.includes('it_assets')));
assert.ok(GRC_FOUNDATION_LIMITATIONS.some((item) => item.includes('scoring')));

const input = { organizationId: 'org-1', projectId: 'project-1', createdBy: 'user-1' };
const db = memoryClient();
await provisionStandardLibraryIfMissing(db, input);
await provisionRegulatoryRegistersIfMissing(db, input);
const requirementId = db.tables.forms.find((row) => row.reference_id === REQUIREMENT_REGISTER_REFERENCE_ID).id;
const requirementFieldCount = db.tables.form_fields.filter((row) => row.form_id === requirementId).length;

const created = await provisionGrcFoundationIfMissing(db, input);
assert.deepEqual(created.createdReferenceIds, [
  ASSET_TYPE_REFERENCE_ID,
  ASSET_REGISTER_REFERENCE_ID,
  ASSET_ASSESSMENT_REFERENCE_ID,
  CONTROL_OBJECTIVE_REFERENCE_ID,
]);
assert.equal(db.tables.form_fields.filter((row) => row.form_id === requirementId).length, requirementFieldCount);
assert.equal(db.tables.form_fields.some((row) => row.field_type === 'child-cross-reference'), false);

const objectiveForm = db.tables.forms.find((row) => row.reference_id === CONTROL_OBJECTIVE_REFERENCE_ID);
const requirementLink = db.tables.form_fields.find((row) => row.form_id === objectiveForm.id && row.label === 'Regulatory Requirement');
const requirementConfig = JSON.parse(requirementLink.custom_config);
assert.equal(requirementConfig.targetFormId, requirementId);
assert.equal(requirementConfig.displayColumns.length, 2);

const assetForm = db.tables.forms.find((row) => row.reference_id === ASSET_REGISTER_REFERENCE_ID);
const typeLink = db.tables.form_fields.find((row) => row.form_id === assetForm.id && row.label === 'Asset Type');
const typeConfig = JSON.parse(typeLink.custom_config);
assert.equal(typeConfig.displayColumns.length, 3);
const typeForm = db.tables.forms.find((row) => row.reference_id === ASSET_TYPE_REFERENCE_ID);
const categoryField = db.tables.form_fields.find((row) => row.form_id === typeForm.id && row.label === 'Asset Category');
assert.equal(typeConfig.displayColumns[2], categoryField.id);

const assessmentForm = db.tables.forms.find((row) => row.reference_id === ASSET_ASSESSMENT_REFERENCE_ID);
const assetLink = db.tables.form_fields.find((row) => row.form_id === assessmentForm.id && row.label === 'Asset');
assert.equal(JSON.parse(assetLink.custom_config).targetFormId, assetForm.id);

const again = await provisionGrcFoundationIfMissing(db, input);
assert.deepEqual(again.createdReferenceIds, []);
assert.equal(db.tables.forms.filter((row) => row.reference_id === ASSET_REGISTER_REFERENCE_ID).length, 1);

const assetFields = assessment.fields;
assert.deepEqual(collectSingleParentReferenceErrors(assetFields, {
  [assetFields.find((field) => field.customConfig?.libraryKey === 'assessed_asset')!.id]: [{ id: 'a' }, { id: 'b' }],
}), {
  [assetFields.find((field) => field.customConfig?.libraryKey === 'assessed_asset')!.id]: 'Select one Asset.',
});
assert.deepEqual(collectSingleParentReferenceErrors(asset.fields, {
  [asset.fields.find((field) => field.customConfig?.libraryKey === 'asset_assessments')!.id]: [{ id: 'a' }, { id: 'b' }],
}), {});

const rto = assessment.fields.find((field) => field.customConfig?.libraryKey === 'required_rto')!;
const cost = assessment.fields.find((field) => field.customConfig?.libraryKey === 'estimated_financial_loss')!;
assert.match(collectFoundationValueErrors([rto], { [rto.id]: '4' })[rto.id] || '', /unit/);
assert.equal(collectFoundationValueErrors([rto], { [rto.id]: '4 hours' })[rto.id], undefined);
assert.equal(collectFoundationValueErrors([rto], { [rto.id]: '' })[rto.id], undefined);
assert.match(collectFoundationValueErrors([cost], { [cost.id]: -1 })[cost.id] || '', /zero or greater/);

const migrationPath = resolve('supabase/migrations/20261029170000_provision_grc_foundation_forms.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');
assert.equal(migrationSql, buildGrcFoundationSql());
assert.equal(migrationSql.includes('grc.regulatory.'), false);
assert.equal(migrationSql.includes('INSERT INTO public.it_assets'), false);
assert.match(migrationSql, /Control Objective Register/);
assert.match(migrationSql, /Asset Assessment Questionnaire/);
assert.match(migrationSql, /btrim\(created_by::text\)/);
assert.match(migrationSql, /created_by::text AS created_by/);
const embeddedSql = readFileSync(resolve('backend/src/grc/grc-foundation.sql.ts'), 'utf8');
assert.equal(embeddedSql.includes(`export const GRC_FOUNDATION_SQL = ${JSON.stringify(migrationSql)};`), true);

console.log('grc foundation checks passed');
