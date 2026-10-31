import {
  ASSET_ASSESSMENT_REFERENCE_ID,
  ASSET_REGISTER_REFERENCE_ID,
} from '@/lib/grc/foundationCatalog';
import {
  ASSET_SCORING_RULE_VERSION,
  BUSINESS_VALUE_POINTS,
  CRITICALITY_BANDS,
  DATA_CLASSIFICATION_POINTS,
  EXPOSURE_FLAG_KEYS,
  EXPOSURE_FLAG_POINTS,
  IMPACT_POINTS,
  RECOVERY_TARGETS,
  SCORED_IMPACT_KEYS,
  UNSCORED_CRITICALITY,
} from '@/lib/grc/assetScoringRule';

/**
 * A query field that calculates one value on the open record with
 * UPDATE FORM ... WHERE submission_id = @submission_id.
 *
 * Query templates use {{form}}, {{field:key}}, {{form:referenceId}}, and {{field:referenceId:key}};
 * keys are the libraryKey values of the foundation fields and are resolved per project.
 */
export interface FoundationCalculation {
  formReferenceId: string;
  key: string;
  label: string;
  /** Field the query writes. The query field is placed right after it. */
  outputKey: string;
  executeOn: 'load' | 'field-change';
  watchKey?: string;
  query: string;
  tooltip: string;
}

const field = (key: string) => `FIELD("{{field:${key}}}")`;

function pointsCase(key: string, points: ReadonlyArray<readonly [string, number]>, fallback = 0): string {
  const whens = points.map(([label, value]) => `WHEN ${field(key)} = '${label}' THEN ${value}`).join(' ');
  return `CASE ${whens} ELSE ${fallback} END`;
}

function updateCurrentRecord(outputKey: string, value: string): string {
  return [
    'UPDATE FORM "{{form}}"',
    `SET FIELD("{{field:${outputKey}}}") = ${value}`,
    'WHERE submission_id = @submission_id',
  ].join('\n');
}

export function assetValueScoreExpression(): string {
  const terms = [
    ...SCORED_IMPACT_KEYS.map((key) => pointsCase(key, IMPACT_POINTS)),
    pointsCase('data_classification', DATA_CLASSIFICATION_POINTS),
    pointsCase('business_value_rating', BUSINESS_VALUE_POINTS),
    ...EXPOSURE_FLAG_KEYS.map((key) => pointsCase(key, [['Yes', EXPOSURE_FLAG_POINTS]])),
  ];
  return terms.join('\n  + ');
}

export function assetCriticalityExpression(): string {
  const whens = CRITICALITY_BANDS
    .map(([min, label]) => `WHEN ${field('asset_value_score')} >= ${min} THEN '${label}'`)
    .join(' ');
  return `CASE ${whens} ELSE '${UNSCORED_CRITICALITY}' END`;
}

function recoveryExpression(column: 'rto' | 'rpo'): string {
  const whens = RECOVERY_TARGETS
    .map((row) => `WHEN ${field('asset_criticality')} = '${row.criticality}' THEN '${row[column]}'`)
    .join(' ');
  return `CASE ${whens} ELSE '' END`;
}

function copyFromLatestApprovedAssessment(assessmentKey: string): string {
  return `(SELECT FIELD("{{field:${ASSET_ASSESSMENT_REFERENCE_ID}:${assessmentKey}}}") FROM "{{form:${ASSET_ASSESSMENT_REFERENCE_ID}}}" WHERE submission_ref_id = JSON_UNQUOTE(JSON_EXTRACT(${field('latest_approved_assessment')}, '$[0].submission_ref_id')))`;
}

const assessmentCalculations: FoundationCalculation[] = [
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_asset_value_score',
    label: 'Asset Value Score Calculation',
    outputKey: 'asset_value_score',
    executeOn: 'load',
    query: updateCurrentRecord('asset_value_score', assetValueScoreExpression()),
    tooltip: 'Adds the impact, data classification, business value, and exposure ratings into Asset Value Score when this page opens. Edit the CASE points here to change the rule.',
  },
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_asset_criticality',
    label: 'Asset Criticality Calculation',
    outputKey: 'asset_criticality',
    executeOn: 'field-change',
    watchKey: 'asset_value_score',
    query: updateCurrentRecord('asset_criticality', assetCriticalityExpression()),
    tooltip: 'Sets Asset Criticality from the Asset Value Score band whenever the score changes.',
  },
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_suggested_rto',
    label: 'Suggested RTO Calculation',
    outputKey: 'suggested_rto',
    executeOn: 'field-change',
    watchKey: 'asset_criticality',
    query: updateCurrentRecord('suggested_rto', recoveryExpression('rto')),
    tooltip: 'Sets Suggested RTO from Asset Criticality whenever criticality changes.',
  },
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_suggested_rpo',
    label: 'Suggested RPO Calculation',
    outputKey: 'suggested_rpo',
    executeOn: 'field-change',
    watchKey: 'asset_criticality',
    query: updateCurrentRecord('suggested_rpo', recoveryExpression('rpo')),
    tooltip: 'Sets Suggested RPO from Asset Criticality whenever criticality changes.',
  },
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_calculation_timestamp',
    label: 'Calculation Timestamp',
    outputKey: 'calculation_timestamp',
    executeOn: 'field-change',
    watchKey: 'asset_value_score',
    query: updateCurrentRecord('calculation_timestamp', 'NOW()'),
    tooltip: 'Records when Asset Value Score was last recalculated.',
  },
  {
    formReferenceId: ASSET_ASSESSMENT_REFERENCE_ID,
    key: 'calc_calculation_rule_version',
    label: 'Calculation Rule Version',
    outputKey: 'calculation_rule_version',
    executeOn: 'field-change',
    watchKey: 'asset_value_score',
    query: updateCurrentRecord('calculation_rule_version', `'${ASSET_SCORING_RULE_VERSION}'`),
    tooltip: 'Records which scoring rule produced Asset Value Score. Change the text when the CASE points change.',
  },
];

const assetCopies: Array<[outputKey: string, assessmentKey: string, label: string]> = [
  ['asset_value_score', 'asset_value_score', 'Asset Value Score from Approved Assessment'],
  ['asset_criticality', 'asset_criticality', 'Asset Criticality from Approved Assessment'],
  ['suggested_rto', 'suggested_rto', 'Suggested RTO from Approved Assessment'],
  ['suggested_rpo', 'suggested_rpo', 'Suggested RPO from Approved Assessment'],
  ['calculation_timestamp', 'calculation_timestamp', 'Calculation Timestamp from Approved Assessment'],
  ['calculation_rule_version', 'calculation_rule_version', 'Calculation Rule Version from Approved Assessment'],
  ['last_assessment_date', 'assessment_date', 'Last Assessment Date from Approved Assessment'],
];

const assetRegisterCalculations: FoundationCalculation[] = assetCopies.map(([outputKey, assessmentKey, label]) => ({
  formReferenceId: ASSET_REGISTER_REFERENCE_ID,
  key: `calc_${outputKey}`,
  label,
  outputKey,
  executeOn: 'field-change',
  watchKey: 'latest_approved_assessment',
  query: updateCurrentRecord(outputKey, copyFromLatestApprovedAssessment(assessmentKey)),
  tooltip: 'Copies this value from the record selected in Latest Approved Assessment whenever that selection changes.',
}));

export const GRC_FOUNDATION_CALCULATIONS: readonly FoundationCalculation[] = [
  ...assessmentCalculations,
  ...assetRegisterCalculations,
];

export const CALCULATION_TEMPLATE_TOKEN = /\{\{(form|field)(?::([^}]+))?\}\}/g;

/**
 * Replaces template tokens with ids. Returns null when any id is missing,
 * so a half-resolved query is never saved.
 */
export function resolveCalculationQuery(
  template: string,
  lookup: {
    formId: (referenceId?: string) => string | undefined;
    fieldId: (key: string, referenceId?: string) => string | undefined;
  },
): string | null {
  let missing = false;
  const resolved = template.replace(CALCULATION_TEMPLATE_TOKEN, (_token, kind: string, body?: string) => {
    const parts = (body || '').split(':');
    const id = kind === 'form'
      ? lookup.formId(body)
      : parts.length > 1 ? lookup.fieldId(parts[1], parts[0]) : lookup.fieldId(parts[0]);
    if (!id) missing = true;
    return id || '';
  });
  return missing ? null : resolved;
}

export function calculationFieldConfig(calc: FoundationCalculation, query: string, watchFieldId: string) {
  return {
    libraryKey: calc.key,
    query,
    executeOn: calc.executeOn,
    targetFieldId: watchFieldId,
    displayMode: 'data',
    showResults: true,
    maxResults: 10,
    refreshInterval: 0,
    enableValidation: true,
  };
}
