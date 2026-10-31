/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/grc/assetScoring.test.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  GRC_FOUNDATION_CALCULATIONS,
  resolveCalculationQuery,
  type FoundationCalculation,
} from '@/lib/grc/assetScoring';
import { MAX_ASSET_VALUE_SCORE } from '@/lib/grc/assetScoringRule';
import { ASSET_ASSESSMENT_REFERENCE_ID, ASSET_REGISTER_REFERENCE_ID } from '@/lib/grc/foundationCatalog';
import { evaluateUpdateFormula, evaluateWhereCondition } from '@/services/sqlRowExpressions';
import { parseUpdateFormQuery } from '@/services/sqlUpdateFormParser';
import { isCurrentRecordUpdate, updateFormTarget } from '@/utils/currentRecordQuery';

const ids = new Map<string, string>();
const idFor = (name: string) => {
  if (!ids.has(name)) ids.set(name, randomUUID());
  return ids.get(name)!;
};
const formIdOf = (ref: string) => idFor(`form:${ref}`);
const fieldIdOf = (ref: string, key: string) => idFor(`field:${ref}:${key}`);

function resolved(calc: FoundationCalculation): string {
  const query = resolveCalculationQuery(calc.query, {
    formId: (ref) => formIdOf(ref || calc.formReferenceId),
    fieldId: (key, ref) => fieldIdOf(ref || calc.formReferenceId, key),
  });
  assert.ok(query, `${calc.key} resolves`);
  assert.equal(query.includes('{{'), false);
  return query;
}

/** Same steps as QueryField + executeUpdateQuery for one row of the open record. */
function run(calc: FoundationCalculation, values: Record<string, unknown>): unknown {
  const query = resolved(calc);
  assert.equal(isCurrentRecordUpdate(query), true, `${calc.key} targets the open record`);
  const target = updateFormTarget(query);
  assert.equal(target?.formId, formIdOf(calc.formReferenceId));
  assert.equal(target?.fieldId, fieldIdOf(calc.formReferenceId, calc.outputKey));

  const forExisting = parseUpdateFormQuery(query.replace('@submission_id', `'${randomUUID()}'`));
  const forNew = parseUpdateFormQuery(query.replace('@submission_id', 'NULL'));
  assert.deepEqual(forExisting.errors, [], `${calc.key} parses for a saved record`);
  assert.deepEqual(forNew.errors, [], `${calc.key} parses for a new record`);

  const parts = forExisting.sql!.split('||');
  assert.equal(parts.length, 6, `${calc.key} keeps the batch format`);
  assert.equal(parts[2], formIdOf(calc.formReferenceId));
  assert.equal(parts[3], fieldIdOf(calc.formReferenceId, calc.outputKey));
  const value = parts[4];
  const row = Object.fromEntries(
    Object.entries(values).map(([key, v]) => [fieldIdOf(calc.formReferenceId, key), v]),
  );
  if (value.startsWith('FUNC::')) {
    const expr = value.slice(6);
    return /CASE\s+WHEN/i.test(expr) ? evaluateUpdateFormula(expr, row) : expr;
  }
  if (value.startsWith('SUBQUERY::')) return value;
  return value.replace(/^['"]|['"]$/g, '');
}

const calc = (formReferenceId: string, key: string) => {
  const found = GRC_FOUNDATION_CALCULATIONS.find((item) => item.formReferenceId === formReferenceId && item.key === key);
  assert.ok(found, key);
  return found;
};

const score = calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_asset_value_score');
const criticality = calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_asset_criticality');
const rto = calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_suggested_rto');
const rpo = calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_suggested_rpo');

// Evaluator regressions the formulas depend on.
assert.equal(evaluateUpdateFormula("CASE WHEN 'a' = 'a' THEN 5 ELSE 0 END", {}), 5);
assert.equal(evaluateWhereCondition('62 >= 50', {}), true);
assert.equal(evaluateWhereCondition('49 >= 50', {}), false);
assert.equal(evaluateWhereCondition("'High' != 'Low'", {}), true);
assert.equal(evaluateWhereCondition('10 <= 10', {}), true);

const allHigh = {
  financial_impact_of_loss: 'Critical',
  operational_impact_of_loss: 'Critical',
  regulatory_impact_of_loss: 'Critical',
  customer_impact_of_loss: 'Critical',
  reputational_impact_of_loss: 'Critical',
  confidentiality_impact: 'Critical',
  integrity_impact: 'Critical',
  availability_impact: 'Critical',
  data_classification: 'Restricted',
  business_value_rating: 'Critical',
  contains_personal_data: 'Yes',
  internet_accessible: 'Yes',
  supports_critical_business_service: 'Yes',
  single_point_of_failure: 'Yes',
};
assert.equal(MAX_ASSET_VALUE_SCORE, 100);
assert.equal(run(score, allHigh), 100);
assert.equal(run(score, {}), 0);

const mixed = {
  financial_impact_of_loss: 'High',
  operational_impact_of_loss: 'Moderate',
  regulatory_impact_of_loss: 'Low',
  customer_impact_of_loss: 'Very Low',
  reputational_impact_of_loss: 'High',
  confidentiality_impact: 'Critical',
  integrity_impact: 'Moderate',
  availability_impact: 'High',
  data_classification: 'Confidential',
  business_value_rating: 'Medium',
  contains_personal_data: 'Yes',
  internet_accessible: 'No',
  supports_critical_business_service: 'Yes',
  single_point_of_failure: 'Unknown',
};
// 8+6+4+2+8+10+6+8 = 52, Confidential 4, Medium 2, two Yes flags 4.
assert.equal(run(score, mixed), 62);

for (const [value, expected] of [
  [100, 'Critical'], [75, 'Critical'], [74, 'High'], [62, 'High'], [50, 'High'], [49, 'Medium'],
  [25, 'Medium'], [24, 'Low'], [1, 'Low'], [0, 'Assessment Required'], ['', 'Assessment Required'],
  [null, 'Assessment Required'], ['62', 'High'],
] as const) {
  assert.equal(run(criticality, { asset_value_score: value }), expected, `score ${value}`);
}

for (const [level, expectedRto, expectedRpo] of [
  ['Critical', '4 hours', '1 hour'],
  ['High', '24 hours', '4 hours'],
  ['Medium', '72 hours', '24 hours'],
  ['Low', '7 days', '72 hours'],
  ['Assessment Required', '', ''],
] as const) {
  assert.equal(run(rto, { asset_criticality: level }), expectedRto);
  assert.equal(run(rpo, { asset_criticality: level }), expectedRpo);
}

assert.equal(run(calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_calculation_timestamp'), {}), 'NOW()');
assert.equal(run(calc(ASSET_ASSESSMENT_REFERENCE_ID, 'calc_calculation_rule_version'), {}), 'Asset scoring v1');

// Asset Register copies use the executor's cross-reference subquery form.
const executorJsonExtract = /submission_ref_id\s*=\s*JSON_UNQUOTE\s*\(\s*JSON_EXTRACT\s*\(\s*FIELD\s*\(\s*['"]([0-9a-fA-F-]{36})['"]\s*\)\s*,\s*['"](\$\[0\]\.submission_ref_id)['"]\s*\)\s*\)/i;
const executorSelect = /^\s*\(\s*SELECT\s+FIELD\s*\(\s*['"]([0-9a-fA-F-]{36})['"]\s*\)\s+FROM\s+['"]([0-9a-fA-F-]{36})['"]\s+WHERE\s+/i;
const registerCalcs = GRC_FOUNDATION_CALCULATIONS.filter((item) => item.formReferenceId === ASSET_REGISTER_REFERENCE_ID);
assert.equal(registerCalcs.length, 7);
for (const item of registerCalcs) {
  const value = String(run(item, {}));
  assert.ok(value.startsWith('SUBQUERY::'), item.key);
  const subquery = value.slice('SUBQUERY::'.length);
  const select = subquery.match(executorSelect);
  assert.ok(select, `${item.key} select`);
  assert.equal(select[2], formIdOf(ASSET_ASSESSMENT_REFERENCE_ID));
  const link = subquery.match(executorJsonExtract);
  assert.ok(link, `${item.key} cross-reference`);
  assert.equal(link[1], fieldIdOf(ASSET_REGISTER_REFERENCE_ID, 'latest_approved_assessment'));
  assert.equal(item.watchKey, 'latest_approved_assessment');
}
assert.equal(
  String(run(calc(ASSET_REGISTER_REFERENCE_ID, 'calc_last_assessment_date'), {})).includes(fieldIdOf(ASSET_ASSESSMENT_REFERENCE_ID, 'assessment_date')),
  true,
);

assert.equal(
  resolveCalculationQuery(score.query, { formId: () => 'f', fieldId: (key) => (key === 'integrity_impact' ? undefined : 'x') }),
  null,
);
assert.equal(isCurrentRecordUpdate('UPDATE FORM "11111111-1111-1111-1111-111111111111" SET FIELD("22222222-2222-2222-2222-222222222222") = 1 WHERE true'), false);

console.log('asset scoring checks passed');
