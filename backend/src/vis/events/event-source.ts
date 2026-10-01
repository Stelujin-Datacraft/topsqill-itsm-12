/**
 * Event source abstraction — vendor-neutral.
 * Concrete adapters implement this; Phase 4 ships Webhook + Polling + Mock MQ.
 */
import type { EventEnvelope, EventSourceType } from '../core/types/index';

export interface EventSourceConfig {
  type: EventSourceType;
  endpointId?: string;
  credentialRefId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IEventSource {
  readonly type: EventSourceType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  validateConfiguration(): Promise<{ ok: boolean; errors: string[] }>;
  subscribe?(topics: string[]): Promise<void>;
  unsubscribe?(topics: string[]): Promise<void>;
  receive?(): Promise<EventEnvelope | null>;
  acknowledge?(eventId: string): Promise<void>;
  reject?(eventId: string, reason: string): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; detail?: string }>;
}

export class WebhookEventSourceStub implements IEventSource {
  readonly type = 'WEBHOOK' as const;
  constructor(private readonly config: EventSourceConfig) {}
  async connect() {}
  async disconnect() {}
  async validateConfiguration() {
    return { ok: Boolean(this.config.endpointId), errors: this.config.endpointId ? [] : ['endpointId required'] };
  }
  async healthCheck() {
    return { healthy: true };
  }
}

export class PollingEventSourceStub implements IEventSource {
  readonly type = 'POLLING' as const;
  constructor(private readonly config: EventSourceConfig) {}
  async connect() {}
  async disconnect() {}
  async validateConfiguration() {
    return { ok: true, errors: [] };
  }
  async healthCheck() {
    return { healthy: true, detail: 'polling fallback' };
  }
}

/** Placeholder for Kafka/Rabbit/SQS/Azure — interfaces only until infra is present. */
export class MessageQueueEventSourceStub implements IEventSource {
  readonly type: EventSourceType;
  constructor(type: EventSourceType, private readonly config: EventSourceConfig) {
    this.type = type;
  }
  async connect() {
    throw new Error(`${this.type} adapter not wired — configure infrastructure in a later phase`);
  }
  async disconnect() {}
  async validateConfiguration() {
    return { ok: false, errors: [`${this.type} requires infrastructure`] };
  }
  async healthCheck() {
    return { healthy: false, detail: 'not configured' };
  }
}

export function createEventSource(config: EventSourceConfig): IEventSource {
  switch (config.type) {
    case 'WEBHOOK':
    case 'HTTP':
    case 'EVENT_API':
      return new WebhookEventSourceStub(config);
    case 'POLLING':
      return new PollingEventSourceStub(config);
    case 'KAFKA':
    case 'RABBITMQ':
    case 'SQS_SNS':
    case 'AZURE_SERVICE_BUS':
    case 'MESSAGE_QUEUE':
      return new MessageQueueEventSourceStub(config.type, config);
    default:
      return new WebhookEventSourceStub(config);
  }
}
