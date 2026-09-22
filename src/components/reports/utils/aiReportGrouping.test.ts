/**
 * Unit tests for AI Report Builder grouping finalize helpers.
 * Run: npx tsx src/components/reports/utils/aiReportGrouping.test.ts
 */

import {
  finalizeAiChartConfig,
  groupingDrilldownConfig,
  MAX_GROUPING_LEVELS,
} from './aiReportGrouping';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

const dims = ['priority', 'age', 'severity'];

assertEq(
  groupingDrilldownConfig(dims),
  { enabled: true, levels: dims, drilldownLevels: dims },
  'drilldown mirrors dimensions',
);

assertEq(
  groupingDrilldownConfig([...dims, 'extra1', 'extra2', 'extra3']).levels.length,
  MAX_GROUPING_LEVELS,
  'caps at max grouping levels',
);

const grouping = finalizeAiChartConfig(
  {
    title: 'Tickets by Priority → Age → Severity',
    chartType: 'bar',
    groupingMode: true,
    compareMode: false,
    aggregationEnabled: true,
    dimensions: dims,
    metrics: ['should-be-cleared'],
    aggregationType: 'sum',
  },
  'form-1',
);

assert(grouping.groupingMode === true, 'grouping mode set');
assert(grouping.compareMode === false, 'compare off');
assert(grouping.aggregationEnabled === true, 'aggregation on');
assertEq(grouping.aggregationType, 'count', 'force count');
assertEq(grouping.metrics, [], 'no metric fields');
assertEq(grouping.metricAggregations, [{ field: 'count', aggregation: 'count' }], 'count agg');
assertEq(grouping.dimensions, dims, 'keeps levels');
assertEq(grouping.drilldownLevels, dims, 'drilldown = dimensions');
assert(grouping.drilldownEnabled === true, 'drilldown enabled');
assertEq(grouping.formId, 'form-1', 'form id');

const compare = finalizeAiChartConfig(
  {
    chartType: 'scatter',
    compareMode: true,
    metrics: ['a', 'b'],
    dimensions: ['ignored'],
  },
  'form-2',
);
assert(compare.compareMode === true, 'compare mode');
assert(compare.groupingMode === false, 'not grouping');
assertEq(compare.dimensions, [], 'compare clears dimensions');
assertEq(compare.metricAggregations, [], 'compare clears aggs');

const calculate = finalizeAiChartConfig(
  {
    chartType: 'bar',
    compareMode: false,
    aggregationEnabled: true,
    aggregationType: 'sum',
    dimensions: ['status'],
    metrics: ['amount'],
  },
  'form-3',
);
assert(calculate.groupingMode === false, 'calculate is not grouping');
assertEq(calculate.metricAggregations, [{ field: 'amount', aggregation: 'sum' }], 'keeps sum');

console.log('All AI report grouping tests passed.');
