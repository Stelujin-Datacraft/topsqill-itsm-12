/**
 * Regression: grouping with multiple levels must stay single-series.
 * Run: npx tsx src/components/reports/utils/groupingBarRender.test.ts
 */

function resolveIsMultiDimensional(opts: {
  groupingMode?: boolean;
  compareMode?: boolean;
  dimensionsLength: number;
  metricsLength: number;
  groupByField?: string;
  dimensionKeysLength: number;
}): boolean {
  const isGroupingDrillMode = !!opts.groupingMode;
  const isCalculateMode =
    !opts.compareMode &&
    !isGroupingDrillMode &&
    opts.metricsLength === 1 &&
    !opts.groupByField;
  const isCrossRefDrilldown = false;
  return (
    !isCalculateMode &&
    !isCrossRefDrilldown &&
    !isGroupingDrillMode &&
    ((opts.dimensionsLength > 1) ||
      (!!opts.groupByField && opts.dimensionKeysLength > 1) ||
      opts.dimensionKeysLength > 1)
  );
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// The bug: 3 grouping levels + empty series keys → was multi-dimensional → zero <Bar/>s
assert(
  !resolveIsMultiDimensional({
    groupingMode: true,
    dimensionsLength: 3,
    metricsLength: 0,
    dimensionKeysLength: 0,
  }),
  'grouping mode must NOT be multi-dimensional',
);

assert(
  resolveIsMultiDimensional({
    groupingMode: false,
    dimensionsLength: 2,
    metricsLength: 0,
    dimensionKeysLength: 3,
  }),
  'non-grouping multi dims with series keys stays multi-dimensional',
);

assert(
  !resolveIsMultiDimensional({
    groupingMode: false,
    dimensionsLength: 1,
    metricsLength: 1,
    dimensionKeysLength: 0,
  }),
  'calculate single metric stays single-dimensional',
);

console.log('All grouping bar-render regression tests passed.');
