/**
 * Unit tests for multi-level grouping aggregation used by Report Grouping mode.
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

function applyAggregation(values: number[], aggregationType: string): number {
  if (values.length === 0) return 0;
  switch (aggregationType) {
    case 'count': return values.length;
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

/** Mirrors ChartPreview groupingMode path for 2+ levels */
function processMultiLevelGrouping(
  submissions: Array<{ submission_data: Record<string, unknown> }>,
  dimensions: string[],
  metricField: string,
  aggregation: string,
) {
  if (dimensions.length === 0) return [];
  if (dimensions.length === 1) {
    const raw: Record<string, number[]> = {};
    submissions.forEach(s => {
      const key = getDimensionValue(s.submission_data, dimensions[0]);
      if (!raw[key]) raw[key] = [];
      raw[key].push(Number(s.submission_data[metricField]) || 0);
    });
    return Object.entries(raw).map(([name, values]) => ({
      name,
      value: applyAggregation(values, aggregation),
    }));
  }

  const primaryDims = dimensions.slice(0, -1);
  const seriesField = dimensions[dimensions.length - 1];
  const rawGrouped: Record<string, Record<string, number[]>> = {};
  const allSeries = new Set<string>();

  submissions.forEach(s => {
    const data = s.submission_data;
    const dimKey = getDimensionKey(data, primaryDims);
    const series = getDimensionValue(data, seriesField);
    allSeries.add(series);
    if (!rawGrouped[dimKey]) rawGrouped[dimKey] = {};
    if (!rawGrouped[dimKey][series]) rawGrouped[dimKey][series] = [];
    rawGrouped[dimKey][series].push(Number(data[metricField]) || 0);
  });

  return Object.entries(rawGrouped).map(([name, groups]) => {
    const point: Record<string, string | number> = { name };
    allSeries.forEach(series => {
      point[series] = applyAggregation(groups[series] || [], aggregation);
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

// 1 level
const one = processMultiLevelGrouping(rows, ['region'], 'amount', 'sum');
assertEq(one.find(r => r.name === 'APAC')?.value, 60, 'APAC sum');
assertEq(one.find(r => r.name === 'EMEA')?.value, 40, 'EMEA sum');

// 3 levels: X = region - country, series = city
const three = processMultiLevelGrouping(rows, ['region', 'country', 'city'], 'amount', 'sum');
const apacIn = three.find(r => r.name === 'APAC - IN') as Record<string, number | string> | undefined;
assert(apacIn, 'APAC - IN row exists');
assertEq(apacIn!.Mumbai, 10, 'Mumbai series');
assertEq(apacIn!.Delhi, 20, 'Delhi series');
assertEq(apacIn!.Singapore, 0, 'missing series fills 0');

const apacSg = three.find(r => r.name === 'APAC - SG') as Record<string, number | string> | undefined;
assertEq(apacSg!.Singapore, 30, 'Singapore under APAC-SG');

console.log('All multi-level grouping tests passed.');
