/**
 * EventRouter — match envelope to approved/active realtime integrations.
 */
import type {
  EventEnvelope,
  EventTriggerType,
  RealtimeEventConfig,
} from '../core/types/index';
import { evaluateEventFilter } from './event-filter';

export interface RoutableIntegration {
  id: string;
  status: string;
  name?: string;
  eventConfig?: RealtimeEventConfig | null;
  sourceEnvironment?: string | null;
  entityType?: string | null;
  tenantId?: string | null;
}

export interface RouteMatch {
  integration: RoutableIntegration;
  reason: string;
}

export class EventRouter {
  route(envelope: EventEnvelope, candidates: RoutableIntegration[]): RouteMatch[] {
    const matches: RouteMatch[] = [];
    for (const integ of candidates) {
      if (!['ACTIVE', 'APPROVED', 'PAUSED'].includes(String(integ.status))) continue;
      const cfg = integ.eventConfig;
      if (!cfg?.eventEnabled) continue;
      if (integ.tenantId && envelope.tenantId && integ.tenantId !== envelope.tenantId) continue;
      if (
        cfg.sourceEnvironmentId
        && envelope.sourceEnvironment
        && cfg.sourceEnvironmentId !== envelope.sourceEnvironment
        && integ.sourceEnvironment
        && integ.sourceEnvironment !== envelope.sourceEnvironment
      ) {
        // soft match — allow if either matches
      }
      if (integ.sourceEnvironment && integ.sourceEnvironment !== envelope.sourceEnvironment) {
        continue;
      }
      const types = cfg.eventTriggerTypes || [];
      if (types.length && !typesIncludes(types, envelope.eventType)) continue;
      if (integ.entityType && integ.entityType !== envelope.entityType) continue;
      if (cfg.filters && !evaluateEventFilter(envelope, cfg.filters)) continue;
      matches.push({ integration: integ, reason: 'event type + source + filter matched' });
    }
    return matches;
  }
}

function typesIncludes(types: Array<EventTriggerType | string>, eventType: string): boolean {
  if (types.includes(eventType)) return true;
  if (types.includes('RECORD_CHANGED')) return true;
  if (
    types.includes('RECORD_CREATED_OR_UPDATED')
    && (eventType === 'RECORD_CREATED' || eventType === 'RECORD_UPDATED')
  ) {
    return true;
  }
  return false;
}
