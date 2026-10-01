/**
 * Stage 10D — Controlled self-healing.
 * Only explicitly approved safe action types may auto-execute.
 */
import type { AutomatedRecoveryAction, SafeRecoveryAction } from '../enterprise/types';
import { SAFE_RECOVERY_ACTIONS } from '../enterprise/types';
import type { VisStore, VisRecord } from '../store/vis.store';

const UNSAFE_ACTIONS = new Set([
  'CHANGE_MAPPING',
  'CHANGE_CREDENTIAL',
  'DELETE_RECORDS',
  'CHANGE_LOGIC',
  'DEPLOY_AI_CODE',
  'CHANGE_SECURITY_POLICY',
  'BYPASS_APPROVAL',
  'DISABLE_AUDIT',
  'DISABLE_AUTH',
]);

export class SelfHealingService {
  private actions: Map<string, AutomatedRecoveryAction> = new Map();
  private attempts = new Map<string, { count: number; lastAt: number }>();

  constructor(private readonly store: VisStore) {
    for (const a of defaultSafeActions()) {
      this.actions.set(a.actionType, a);
    }
  }

  listActions() {
    return [...this.actions.values()];
  }

  registerAction(action: AutomatedRecoveryAction) {
    if (!(SAFE_RECOVERY_ACTIONS as readonly string[]).includes(action.actionType)) {
      throw Object.assign(new Error(`Action type not in safe allowlist: ${action.actionType}`), { status: 400 });
    }
    this.actions.set(action.actionType, action);
    return action;
  }

  isSafe(actionType: string): boolean {
    return (SAFE_RECOVERY_ACTIONS as readonly string[]).includes(actionType) && !UNSAFE_ACTIONS.has(actionType);
  }

  /**
   * Attempt recovery. Dangerous / unapproved types are rejected.
   * Runtime adaptation uses deterministic bounded algorithms — not LLM.
   */
  async execute(opts: {
    actionType: string;
    trigger: string;
    integrationId?: string;
    executionId?: string;
    context?: Record<string, unknown>;
    forceApprove?: boolean;
  }): Promise<{
    ok: boolean;
    status: 'EXECUTED' | 'REJECTED' | 'COOLDOWN' | 'MAX_ATTEMPTS' | 'NEEDS_APPROVAL';
    detail: string;
    auditId?: string;
  }> {
    if (UNSAFE_ACTIONS.has(opts.actionType) || !this.isSafe(opts.actionType)) {
      const audit = this.audit(opts, 'REJECTED', 'Unsafe or unknown action rejected');
      return { ok: false, status: 'REJECTED', detail: 'Unsafe action rejected by self-healing policy', auditId: audit.id };
    }

    const def = this.actions.get(opts.actionType as SafeRecoveryAction);
    if (!def) {
      return { ok: false, status: 'REJECTED', detail: 'Action not registered' };
    }

    if (!def.autoApproved && !opts.forceApprove) {
      const audit = this.audit(opts, 'NEEDS_APPROVAL', 'Action requires human approval');
      return { ok: false, status: 'NEEDS_APPROVAL', detail: 'Human approval required', auditId: audit.id };
    }

    const key = `${opts.actionType}:${opts.integrationId || opts.executionId || 'global'}`;
    const prev = this.attempts.get(key) || { count: 0, lastAt: 0 };
    const now = Date.now();
    if (now - prev.lastAt < def.cooldownMs) {
      return { ok: false, status: 'COOLDOWN', detail: `Cooldown ${def.cooldownMs}ms active` };
    }
    if (prev.count >= def.maximumAttempts) {
      return { ok: false, status: 'MAX_ATTEMPTS', detail: `Max attempts ${def.maximumAttempts} reached` };
    }

    const effect = applyDeterministicEffect(opts.actionType as SafeRecoveryAction, opts.context || {}, def.constraints);
    this.attempts.set(key, { count: prev.count + 1, lastAt: now });

    const audit = this.audit(opts, 'EXECUTED', effect.detail, effect.result);
    return { ok: true, status: 'EXECUTED', detail: effect.detail, auditId: audit.id };
  }

  /** Bounded adaptive concurrency — deterministic, not AI-driven. */
  adaptConcurrency(opts: {
    current: number;
    min: number;
    max: number;
    healthy: boolean;
    rate429: boolean;
  }): number {
    let next = opts.current;
    if (opts.rate429) next = Math.max(opts.min, Math.floor(opts.current * 0.5));
    else if (opts.healthy) next = Math.min(opts.max, opts.current + 1);
    return Math.max(opts.min, Math.min(opts.max, next));
  }

  private audit(
    opts: { actionType: string; trigger: string; integrationId?: string; executionId?: string },
    status: string,
    detail: string,
    result?: unknown,
  ): VisRecord {
    return this.store.create('healingActions', {
      actionType: opts.actionType,
      trigger: opts.trigger,
      integrationId: opts.integrationId || null,
      executionId: opts.executionId || null,
      status,
      detail,
      result: result || null,
      createdAt: new Date().toISOString(),
    });
  }
}

function defaultSafeActions(): AutomatedRecoveryAction[] {
  return [
    { actionType: 'RETRY_TRANSIENT', trigger: 'transient_error', constraints: { maxBackoffMs: 30000 }, maximumAttempts: 5, cooldownMs: 1000, auditRequired: true, autoApproved: true },
    { actionType: 'REFRESH_OAUTH', trigger: '401_oauth', constraints: {}, maximumAttempts: 3, cooldownMs: 5000, auditRequired: true, autoApproved: true },
    { actionType: 'RECONNECT_CONNECTOR', trigger: 'connection_lost', constraints: {}, maximumAttempts: 3, cooldownMs: 10000, auditRequired: true, autoApproved: true },
    { actionType: 'RESTART_WORKER', trigger: 'worker_dead', constraints: {}, maximumAttempts: 2, cooldownMs: 15000, auditRequired: true, autoApproved: true },
    { actionType: 'REQUEUE_JOB', trigger: 'interrupted_job', constraints: {}, maximumAttempts: 3, cooldownMs: 2000, auditRequired: true, autoApproved: true },
    { actionType: 'RESPECT_RETRY_AFTER', trigger: '429', constraints: { maxWaitMs: 120000 }, maximumAttempts: 10, cooldownMs: 0, auditRequired: true, autoApproved: true },
    { actionType: 'OPEN_CIRCUIT', trigger: 'error_threshold', constraints: {}, maximumAttempts: 1, cooldownMs: 0, auditRequired: true, autoApproved: true },
    { actionType: 'CLOSE_CIRCUIT', trigger: 'recovery', constraints: {}, maximumAttempts: 1, cooldownMs: 30000, auditRequired: true, autoApproved: true },
    { actionType: 'REDUCE_CONCURRENCY', trigger: '429_or_overload', constraints: { minConcurrency: 1 }, maximumAttempts: 5, cooldownMs: 2000, auditRequired: true, autoApproved: true },
    { actionType: 'REPLAY_SAFE_EVENT', trigger: 'safe_replay', constraints: {}, maximumAttempts: 3, cooldownMs: 5000, auditRequired: true, autoApproved: false },
    { actionType: 'RESUME_CHECKPOINT', trigger: 'worker_recovery', constraints: {}, maximumAttempts: 3, cooldownMs: 5000, auditRequired: true, autoApproved: true },
  ];
}

function applyDeterministicEffect(
  actionType: SafeRecoveryAction,
  context: Record<string, unknown>,
  constraints: Record<string, unknown>,
) {
  switch (actionType) {
    case 'REDUCE_CONCURRENCY': {
      const current = Number(context.concurrency || 4);
      const min = Number(constraints.minConcurrency || 1);
      const next = Math.max(min, Math.floor(current / 2));
      return { detail: `Concurrency reduced ${current} → ${next}`, result: { concurrency: next } };
    }
    case 'RESPECT_RETRY_AFTER': {
      const wait = Math.min(Number(context.retryAfterSec || 5) * 1000, Number(constraints.maxWaitMs || 120000));
      return { detail: `Honor Retry-After wait ${wait}ms`, result: { waitMs: wait } };
    }
    case 'REFRESH_OAUTH':
      return { detail: 'OAuth refresh requested via TokenManager', result: { refresh: true } };
    case 'OPEN_CIRCUIT':
      return { detail: 'Circuit opened', result: { circuit: 'OPEN' } };
    case 'CLOSE_CIRCUIT':
      return { detail: 'Circuit closed after recovery', result: { circuit: 'CLOSED' } };
    case 'RESUME_CHECKPOINT':
      return { detail: 'Resume from checkpoint', result: { checkpoint: context.checkpointId || null } };
    default:
      return { detail: `Executed safe action ${actionType}`, result: { actionType } };
  }
}
