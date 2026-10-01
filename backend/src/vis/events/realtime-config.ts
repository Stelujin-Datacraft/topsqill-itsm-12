/**
 * Default realtime config + helpers.
 */
import type { RealtimeEventConfig } from '../core/types/index';

export function defaultRealtimeConfig(
  partial?: Partial<RealtimeEventConfig>,
): RealtimeEventConfig {
  return {
    eventEnabled: true,
    eventSourceType: 'WEBHOOK',
    eventTriggerTypes: ['RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED'],
    eventDeliveryMode: 'WEBHOOK',
    payloadStrategy: 'HYBRID',
    orderingStrategy: 'PER_ENTITY',
    deduplicationStrategy: 'PROVIDER_EVENT_ID',
    deduplicationTtlSeconds: 86_400,
    loopPreventionEnabled: true,
    maxHopCount: 1,
    pauseBehavior: 'QUEUE',
    eventBatchingEnabled: false,
    eventBatchWindowMs: 100,
    maxEventConcurrency: 20,
    eventTimeoutMs: 60_000,
    eventReplayEnabled: true,
    eventRetentionDays: 30,
    webhookAuthType: 'HMAC',
    webhookCredentialRefId: null,
    webhookSignatureHeader: 'x-signature',
    webhookTimestampHeader: 'x-timestamp',
    webhookMaxSkewSeconds: 300,
    sourceEnvironmentId: null,
    targetEnvironmentId: null,
    filters: null,
    supportedEventVersions: ['1'],
    pollingIntervalSeconds: null,
    reconciliationEnabled: false,
    reconciliationCron: null,
    ...partial,
  };
}
