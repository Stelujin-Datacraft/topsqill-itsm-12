/**
 * Unit tests for multi-level grouping (count-of-records) used by Report Grouping mode.
 * Run: npx tsx src/components/reports/utils/multiLevelGrouping.test.ts
 */

function getDimensionValue(submissionData: Record<string, unknown>, dim: string): string {
  const val = submissionData[dim];
  if (val === null || val === undefined || val === '') return 'Not Specified';
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.status) return String(obj.status);
    if (obj.label) return String(obj.label);
    return JSON.stringify(val);
  }
  return String(val);
}

function getDimensionKey(submissionData: Record<string, unknown>, dimensionFields: string[]): string {
  return dimensionFields.map(dim => getDimensionValue(submissionData, dim)).join(' - ') || 'Not Specified';
}

/** Mirrors ChartPreview groupingMode path — always count of records */
function processMultiLevelGroupingCount(
  submissions: Array<{ submission_data: Record<string, unknown> }>,
  dimensions: string[],
) {
  if (dimensions.length === 0) return [];
  if (dimensions.length === 1) {
    const raw: Record<string, number> = {};
    submissions.forEach(s => {
      const key = getDimensionValue(s.submission_data, dimensions[0]);
      raw[key] = (raw[key] || 0) + 1;
    });
    return Object.entries(raw).map(([name, value]) => ({ name, value }));
  }

  const primaryDims = dimensions.slice(0, -1);
  const seriesField = dimensions[dimensions.length - 1];
  const rawGrouped: Record<string, Record<string, number>> = {};
  const allSeries = new Set<string>();

  submissions.forEach(s => {
    const data = s.submission_data;
    const dimKey = getDimensionKey(data, primaryDims);
    const series = getDimensionValue(data, seriesField);
    allSeries.add(series);
    if (!rawGrouped[dimKey]) rawGrouped[dimKey] = {};
    rawGrouped[dimKey][series] = (rawGrouped[dimKey][series] || 0) + 1;
  });

  return Object.entries(rawGrouped).map(([name, groups]) => {
    const point: Record<string, string | number> = { name };
    allSeries.forEach(series => {
      point[series] = groups[series] || 0;
    });
    return point;
  });
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const rows = [
  { submission_data: { region: 'APAC', country: 'IN', city: 'Mumbai', amount: 10 } },
  { submission_data: { region: 'APAC', country: 'IN', city: 'Delhi', amount: 20 } },
  { submission_data: { region: 'APAC', country: 'SG', city: 'Singapore', amount: 30 } },
  { submission_data: { region: 'EMEA', country: 'DE', city: 'Berlin', amount: 40 } },
];

// 1 level — count records
const one = processMultiLevelGroupingCount(rows, ['region']);
assertEq(one.find(r => r.name === 'APAC')?.value, 3, 'APAC count');
assertEq(one.find(r => r.name === 'EMEA')?.value, 1, 'EMEA count');

// 3 levels: X = region - country, series = city
const three = processMultiLevelGroupingCount(rows, ['region', 'country', 'city']);
const apacIn = three.find(r => r.name === 'APAC - IN') as Record<string, number | string> | undefined;
assert(apacIn, 'APAC - IN row exists');
assertEq(apacIn!.Mumbai, 1, 'Mumbai series count');
assertEq(apacIn!.Delhi, 1, 'Delhi series count');
assertEq(apacIn!.Singapore, 0, 'missing series fills 0');

const apacSg = three.find(r => r.name === 'APAC - SG') as Record<string, number | string> | undefined;
assertEq(apacSg!.Singapore, 1, 'Singapore under APAC-SG');

// Numeric / any field can be a grouping level
const byAmount = processMultiLevelGroupingCount(rows, ['amount']);
assertEq(byAmount.length, 4, 'numeric field used as grouping level');

console.log('All multi-level grouping count tests passed.');
