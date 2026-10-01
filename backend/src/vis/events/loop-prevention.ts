/**
 * Loop prevention for environment-to-environment sync.
 */
import type { EventEnvelope } from '../core/types/index';

export interface LoopCheckResult {
  allow: boolean;
  reason?: string;
}

export class EventLoopPreventionService {
  /**
   * Reject when hopCount exceeds max, or when the event's originIntegrationId
   * matches the current integration (same chain bouncing back), or when
   * sourceEnvironment === targetEnvironment incorrectly echoes.
   */
  check(
    envelope: EventEnvelope,
    opts: {
      integrationId: string;
      maxHopCount: number;
      sourceEnvironment?: string | null;
      targetEnvironment?: string | null;
      enabled?: boolean;
    },
  ): LoopCheckResult {
    if (opts.enabled === false) return { allow: true };
    const hops = Number(envelope.hopCount || 0);
    if (hops >= (opts.maxHopCount ?? 1)) {
      return { allow: false, reason: `hopCount ${hops} exceeds max ${opts.maxHopCount}` };
    }
    if (envelope.originIntegrationId && envelope.originIntegrationId === opts.integrationId) {
      return { allow: false, reason: 'originIntegrationId matches current integration (loop)' };
    }
    // If event already carries target env as source and origin points back
    if (
      opts.sourceEnvironment
      && opts.targetEnvironment
      && envelope.sourceEnvironment === opts.targetEnvironment
      && envelope.metadata?.syncedFrom === opts.sourceEnvironment
    ) {
      return { allow: false, reason: 'event originated from reverse sync path' };
    }
    return { allow: true };
  }

  /** Stamp outbound payload so remote side can detect loops. */
  stampOutbound(
    payload: Record<string, unknown>,
    opts: {
      integrationId: string;
      eventId: string;
      sourceEnvironment?: string | null;
      hopCount: number;
    },
  ): Record<string, unknown> {
    return {
      ...payload,
      _vis: {
        originIntegrationId: opts.integrationId,
        originEventId: opts.eventId,
        hopCount: opts.hopCount + 1,
        syncedFrom: opts.sourceEnvironment || null,
      },
    };
  }
}
