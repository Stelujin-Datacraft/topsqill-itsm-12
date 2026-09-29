/**
 * Event envelope normalization + schema validation.
 */
import { createHash, randomUUID } from 'crypto';
import type { EventEnvelope, EventTriggerType } from '../core/types/index';
import { buildCorrelationId } from '../executions/execution-plan';

const MAX_PAYLOAD_BYTES = 256 * 1024;

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

export function normalizeEvent(input: {
  body: Record<string, unknown>;
  sourceSystem?: string;
  sourceEnvironment?: string;
  correlationId?: string;
  receivedAt?: string;
}): EventEnvelope {
  const b = input.body || {};
  const nested = (b.payload && typeof b.payload === 'object' ? b.payload : b) as Record<string, unknown>;
  const eventId = String(b.eventId || b.id || nested.eventId || `evt-${randomUUID()}`);
  const eventType = String(
    b.eventType || b.type || nested.eventType || 'RECORD_CHANGED',
  ) as EventTriggerType;
  const entityId = String(
    b.entityId || b.recordId || nested.entityId || nested.id || nested.vulnerability_id || '',
  );
  const entityType = String(b.entityType || b.form || nested.entityType || 'Vulnerability');
  const occurredAt = String(b.occurredAt || b.timestamp || new Date().toISOString());
  const envelope: EventEnvelope = {
    eventId,
    eventType,
    eventVersion: String(b.eventVersion || b.version || '1'),
    sourceSystem: String(b.sourceSystem || input.sourceSystem || 'Unknown'),
    sourceEnvironment: String(b.sourceEnvironment || input.sourceEnvironment || 'DEV'),
    entityType,
    entityId,
    occurredAt,
    receivedAt: input.receivedAt || new Date().toISOString(),
    correlationId: input.correlationId || String(b.correlationId || buildCorrelationId('EVT')),
    causationId: (b.causationId as string) || (b.originEventId as string) || null,
    originIntegrationId: (b.originIntegrationId as string) || null,
    originEventId: (b.originEventId as string) || null,
    hopCount: Number(b.hopCount || 0),
    payload: nested,
    payloadHash: hashPayload(nested),
    metadata: (b.metadata as Record<string, unknown>) || {},
    schemaVersion: String(b.schemaVersion || b.eventVersion || '1'),
    tenantId: (b.tenantId as string) || null,
  };
  return envelope;
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateEventSchema(
  envelope: EventEnvelope,
  opts?: {
    allowedTypes?: string[];
    allowedVersions?: string[];
    requiredPayloadFields?: string[];
    maxBytes?: number;
  },
): SchemaValidationResult {
  const errors: string[] = [];
  if (!envelope.eventId) errors.push('eventId is required');
  if (!envelope.eventType) errors.push('eventType is required');
  if (!envelope.entityId) errors.push('entityId is required');
  if (opts?.allowedTypes?.length && !opts.allowedTypes.includes(String(envelope.eventType))) {
    errors.push(`eventType ${envelope.eventType} not allowed`);
  }
  if (opts?.allowedVersions?.length && !opts.allowedVersions.includes(envelope.eventVersion)) {
    errors.push(`eventVersion ${envelope.eventVersion} not supported`);
  }
  const size = Buffer.byteLength(JSON.stringify(envelope.payload || {}), 'utf8');
  if (size > (opts?.maxBytes ?? MAX_PAYLOAD_BYTES)) {
    errors.push(`payload exceeds max size (${size} bytes)`);
  }
  for (const f of opts?.requiredPayloadFields || []) {
    if (!(f in (envelope.payload || {}))) errors.push(`payload missing required field '${f}'`);
  }
  return { ok: errors.length === 0, errors };
}

export { MAX_PAYLOAD_BYTES };
