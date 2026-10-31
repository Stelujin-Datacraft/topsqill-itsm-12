/**
 * Asset scoring rule used by the calculation query fields. The SQL in each query field is built
 * from these tables when the field is created; after that the SQL in the form builder is the rule.
 */
export const ASSET_SCORING_RULE_VERSION = 'Asset scoring v1';

export const SCORED_IMPACT_KEYS = [
  'financial_impact_of_loss',
  'operational_impact_of_loss',
  'regulatory_impact_of_loss',
  'customer_impact_of_loss',
  'reputational_impact_of_loss',
  'confidentiality_impact',
  'integrity_impact',
  'availability_impact',
] as const;

export const IMPACT_POINTS: ReadonlyArray<readonly [string, number]> = [
  ['Very Low', 2],
  ['Low', 4],
  ['Moderate', 6],
  ['High', 8],
  ['Critical', 10],
];

export const DATA_CLASSIFICATION_POINTS: ReadonlyArray<readonly [string, number]> = [
  ['Internal', 2],
  ['Confidential', 4],
  ['Restricted', 6],
];

export const BUSINESS_VALUE_POINTS: ReadonlyArray<readonly [string, number]> = [
  ['Medium', 2],
  ['High', 4],
  ['Critical', 6],
];

export const EXPOSURE_FLAG_KEYS = [
  'contains_personal_data',
  'internet_accessible',
  'supports_critical_business_service',
  'single_point_of_failure',
] as const;

export const EXPOSURE_FLAG_POINTS = 2;

/** Highest band first. A score below the last band is Assessment Required. */
export const CRITICALITY_BANDS: ReadonlyArray<readonly [number, string]> = [
  [75, 'Critical'],
  [50, 'High'],
  [25, 'Medium'],
  [1, 'Low'],
];

export const UNSCORED_CRITICALITY = 'Assessment Required';

export const RECOVERY_TARGETS: ReadonlyArray<{ criticality: string; rto: string; rpo: string }> = [
  { criticality: 'Critical', rto: '4 hours', rpo: '1 hour' },
  { criticality: 'High', rto: '24 hours', rpo: '4 hours' },
  { criticality: 'Medium', rto: '72 hours', rpo: '24 hours' },
  { criticality: 'Low', rto: '7 days', rpo: '72 hours' },
];

export const MAX_ASSET_VALUE_SCORE =
  SCORED_IMPACT_KEYS.length * Math.max(...IMPACT_POINTS.map(([, points]) => points))
  + Math.max(...DATA_CLASSIFICATION_POINTS.map(([, points]) => points))
  + Math.max(...BUSINESS_VALUE_POINTS.map(([, points]) => points))
  + EXPOSURE_FLAG_KEYS.length * EXPOSURE_FLAG_POINTS;

/** Tooltip on Asset Value Score, Asset Criticality, and the other calculated fields before scoring was wired. */
export const LEGACY_SCORING_PENDING_TOOLTIP = 'No approved scoring rule is configured. This value stays blank until scoring weights are approved. It is not entered by hand and is not a SQL result.';

const pointList = (rows: ReadonlyArray<readonly [string, number]>) => rows.map(([label, points]) => `${label} ${points}`).join(', ');

const bandList = () => {
  const parts = CRITICALITY_BANDS.map(([min, label], index) => {
    const upper = index === 0 ? null : CRITICALITY_BANDS[index - 1][0] - 1;
    return upper === null ? `${min} and above ${label}` : `${min} to ${upper} ${label}`;
  });
  return `${parts.join(', ')}, otherwise ${UNSCORED_CRITICALITY}`;
};

export const ASSESSMENT_OUTPUT_TOOLTIPS: Readonly<Record<string, string>> = {
  asset_value_score: `Calculated by a SQL query field when this page opens (${ASSET_SCORING_RULE_VERSION}, maximum ${MAX_ASSET_VALUE_SCORE}). Each of the eight impact ratings adds ${pointList(IMPACT_POINTS)}. Data Classification adds ${pointList(DATA_CLASSIFICATION_POINTS)}. Business Value Rating adds ${pointList(BUSINESS_VALUE_POINTS)}. Each Yes for personal data, internet access, critical business service, or single point of failure adds ${EXPOSURE_FLAG_POINTS}.`,
  asset_criticality: `Calculated from Asset Value Score whenever the score changes: ${bandList()}.`,
  suggested_rto: `Calculated from Asset Criticality: ${RECOVERY_TARGETS.map((row) => `${row.criticality} ${row.rto}`).join(', ')}.`,
  suggested_rpo: `Calculated from Asset Criticality: ${RECOVERY_TARGETS.map((row) => `${row.criticality} ${row.rpo}`).join(', ')}.`,
  calculation_timestamp: 'Set by a SQL query field whenever Asset Value Score is recalculated.',
  calculation_rule_version: 'Set by a SQL query field whenever Asset Value Score is recalculated.',
};

export const ASSET_REGISTER_OUTPUT_TOOLTIPS: Readonly<Record<string, string>> = {
  asset_value_score: 'Copied from the Latest Approved Assessment by a SQL query field.',
  asset_criticality: 'Copied from the Latest Approved Assessment by a SQL query field.',
  suggested_rto: 'Copied from the Latest Approved Assessment by a SQL query field.',
  suggested_rpo: 'Copied from the Latest Approved Assessment by a SQL query field.',
  calculation_timestamp: 'Copied from the Latest Approved Assessment by a SQL query field.',
  calculation_rule_version: 'Copied from the Latest Approved Assessment by a SQL query field.',
  last_assessment_date: 'Copied from the Assessment Date of the Latest Approved Assessment by a SQL query field.',
};
