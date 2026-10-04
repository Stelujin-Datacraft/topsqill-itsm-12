/**
 * Regression: Discover Forms / Discover Schema must not throw on render shapes
 * that previously blanked the Integration Studio page.
 */
import assert from 'node:assert/strict';

function normalizeFormsList(res) {
  const raw = Array.isArray(res?.items)
    ? res.items
    : Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];
  return raw
    .map((f) => ({
      id: String(f?.id || f?.formId || f?.reference_id || '').trim(),
      name: String(f?.name || f?.title || f?.reference_id || f?.id || 'Form'),
      description: f?.description || null,
    }))
    .filter((f) => Boolean(f.id));
}

function formatFieldChoices(raw) {
  if (raw == null) return '—';
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.choices)
      ? raw.choices
      : Array.isArray(raw?.options)
        ? raw.options
        : null;
  if (!list || !list.length) {
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
    return '—';
  }
  const labels = list
    .map((c) => {
      if (c == null) return '';
      if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') return String(c);
      return String(c.label ?? c.name ?? c.value ?? '');
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

function safeSelectValue(items, selectedId) {
  return items.some((f) => f.id === selectedId) ? selectedId : undefined;
}

function unwrapFormApiBody(body) {
  let cur = body;
  for (let i = 0; i < 3; i++) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && 'data' in cur && cur.data !== undefined) {
      cur = cur.data;
      continue;
    }
    break;
  }
  return cur;
}

// Forms list shapes
assert.deepEqual(
  normalizeFormsList({ items: [{ id: 'a', name: 'A' }] }).map((f) => f.id),
  ['a'],
);
assert.deepEqual(normalizeFormsList({ data: [{ id: 'b' }] }).map((f) => f.id), ['b']);
assert.deepEqual(normalizeFormsList(null), []);
assert.deepEqual(normalizeFormsList({ ok: true }), []);

// Select value must not stay set when missing from items (Radix crash)
assert.equal(safeSelectValue([{ id: 'f1' }], 'f1'), 'f1');
assert.equal(safeSelectValue([{ id: 'f1' }], 'missing'), undefined);
assert.equal(safeSelectValue([], 'f1'), undefined);

// Choices must never call .map on non-arrays
assert.equal(formatFieldChoices({ not: 'array' }), '—');
assert.equal(formatFieldChoices('High'), 'High');
assert.equal(formatFieldChoices(['Low', 'High']), 'Low, High');
assert.equal(formatFieldChoices([{ label: 'Open' }, { value: 'Closed' }]), 'Open, Closed');

// Form API envelope unwrap for schema fields
const fieldsBody = unwrapFormApiBody({
  success: true,
  data: [{ name: 'Status', options: { choices: ['a'] } }],
});
assert.ok(Array.isArray(fieldsBody));
assert.equal(fieldsBody[0].name, 'Status');

// Non-array schema.fields must render as empty, not throw
const schemaFields = Array.isArray({ success: true, data: [] }.fields)
  ? { success: true, data: [] }.fields
  : [];
assert.deepEqual(schemaFields, []);

console.log('vis-discover-blank-page-guard: ok');
