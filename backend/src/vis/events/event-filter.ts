/**
 * Deterministic event filter evaluation — no AI at runtime.
 */
import type { EventEnvelope, EventFilterGroup, EventFilterCondition } from '../core/types/index';

function getField(envelope: EventEnvelope, field: string): unknown {
  if (field.startsWith('payload.')) {
    return envelope.payload?.[field.slice(8)];
  }
  if (field in envelope) return (envelope as any)[field];
  return envelope.payload?.[field];
}

function evalCondition(envelope: EventEnvelope, c: EventFilterCondition): boolean {
  const left = getField(envelope, c.field);
  const right = c.value;
  switch (c.op) {
    case 'equals':
      return String(left ?? '') === String(right ?? '');
    case 'notEquals':
      return String(left ?? '') !== String(right ?? '');
    case 'contains':
      return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'startsWith':
      return String(left ?? '').startsWith(String(right ?? ''));
    case 'endsWith':
      return String(left ?? '').endsWith(String(right ?? ''));
    case 'greaterThan':
      return Number(left) > Number(right);
    case 'lessThan':
      return Number(left) < Number(right);
    case 'in':
      return Array.isArray(right) && right.map(String).includes(String(left ?? ''));
    default:
      return false;
  }
}

export function evaluateEventFilter(
  envelope: EventEnvelope,
  filter?: EventFilterGroup | null,
): boolean {
  if (!filter || !filter.conditions?.length) return true;
  const results = filter.conditions.map((c) => evalCondition(envelope, c));
  let matched = filter.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  if (filter.not) matched = !matched;
  return matched;
}
