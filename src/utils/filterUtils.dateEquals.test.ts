/**
 * Unit tests for date-aware valueEquals used by report drilldown filters.
 * Run: npx tsx src/utils/filterUtils.dateEquals.test.ts
 */
import { valueEquals, evaluateFilterCondition } from './filterUtils.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Date field type: YYYY-MM-DD equals same calendar day
assert(
  valueEquals('2026-09-01', '2026-09-01', 'date'),
  'same date-only strings should match',
);
assert(
  valueEquals('2026-09-01T00:00:00.000Z', '2026-09-01', 'date'),
  'ISO timestamp should match date-only drilldown label',
);
assert(
  valueEquals('2026-09-01', '2026-09-02', 'date') === false,
  'different calendar days should not match',
);

// Without fieldType: still match parseable same-day dates
assert(
  valueEquals('2026-09-01T12:00:00.000Z', '2026-09-01'),
  'same-day match without fieldType',
);

// evaluateFilterCondition equals path
assert(
  evaluateFilterCondition('2026-09-01T00:00:00.000Z', 'equals', '2026-09-01', 'date'),
  'evaluateFilterCondition equals should honor date day match',
);
assert(
  evaluateFilterCondition('2026-09-01', 'equals', '2026-09-01', 'date'),
  'evaluateFilterCondition date-only equals',
);

console.log('All date-equals drilldown filter tests passed.');
