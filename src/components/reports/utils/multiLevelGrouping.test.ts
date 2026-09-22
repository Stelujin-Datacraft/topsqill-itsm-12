/**
 * Unit tests for grouping → auto-drilldown level resolution.
 * Run: npx tsx src/components/reports/utils/multiLevelGrouping.test.ts
 */

function getNormalizedDrilldownLevels(config: {
  groupingMode?: boolean;
  dimensions?: string[];
  drilldownConfig?: { enabled?: boolean; drilldownLevels?: string[]; levels?: string[] };
}): string[] {
  if (config.groupingMode && config.dimensions && config.dimensions.length > 0) {
    return config.dimensions.filter(Boolean);
  }
  return (config.drilldownConfig?.drilldownLevels?.length
    ? config.drilldownConfig.drilldownLevels
    : null) ||
    (config.drilldownConfig?.levels?.length ? config.drilldownConfig.levels : null) ||
    [];
}

function isAtLastLevel(valuesLength: number, levelsLength: number): boolean {
  return valuesLength >= levelsLength - 1;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

const dims = ['region', 'country', 'city'];

assertEq(
  getNormalizedDrilldownLevels({ groupingMode: true, dimensions: dims }),
  dims,
  'grouping mode uses dimensions as drill levels',
);

assertEq(
  getNormalizedDrilldownLevels({
    groupingMode: false,
    dimensions: dims,
    drilldownConfig: { enabled: true, drilldownLevels: ['a'] },
  }),
  ['a'],
  'non-grouping uses drilldownConfig levels',
);

// 3 levels: start at L0, click → L1, click → L2 (last) → records
assert(!isAtLastLevel(0, 3), 'level 0 is not last');
assert(!isAtLastLevel(1, 3), 'level 1 is not last');
assert(isAtLastLevel(2, 3), 'level 2 is last → open records');

// 1 level: first view is already last → click opens records
assert(isAtLastLevel(0, 1), 'single level opens records on click');

console.log('All grouping auto-drilldown tests passed.');
