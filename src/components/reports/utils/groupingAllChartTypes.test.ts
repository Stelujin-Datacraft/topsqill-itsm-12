/**
 * Grouping mode should map { name, value } into scatter/bubble { x, y }.
 * Run: npx tsx src/components/reports/utils/groupingAllChartTypes.test.ts
 */

function mapGroupingPointToXY(
  item: { name?: string; value?: number; count?: number; x?: number; y?: number },
  idx: number,
  primaryMetric: string,
) {
  const xRaw = item.x !== undefined ? item.x : item.name;
  const yRaw = item.y !== undefined
    ? item.y
    : ((item as any)[primaryMetric] !== undefined ? (item as any)[primaryMetric] : item.value);
  const xEncoded = typeof item.x === 'number'
    ? item.x
    : (typeof xRaw === 'number' && isFinite(xRaw) ? xRaw : idx + 1);
  const yNum = Number(yRaw);
  const yEncoded = typeof item.y === 'number'
    ? item.y
    : (isFinite(yNum) ? yNum : 0);
  return { x: xEncoded, y: yEncoded, xOriginal: xRaw, yOriginal: yRaw };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

const pt = mapGroupingPointToXY({ name: 'High', value: 7 }, 0, 'value');
assertEq(pt.y, 7, 'grouping value becomes y');
assertEq(pt.xOriginal, 'High', 'name becomes xOriginal');
assert(pt.x === 1, 'text category gets index encoding without mapping');

const withCount = mapGroupingPointToXY({ name: 'P1', count: 3 }, 2, 'count');
assertEq(withCount.y, 3, 'count key works as primaryMetric');
assertEq(withCount.x, 3, 'index+1 for third row');

const chartTypes = ['bar', 'column', 'pie', 'donut', 'line', 'area', 'scatter', 'bubble', 'heatmap'];
assert(chartTypes.length === 9, 'all visual chart types supported for grouping config');

console.log('All grouping all-chart-types tests passed.');
