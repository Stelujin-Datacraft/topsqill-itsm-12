/**
 * Execution lifecycle + pause/resume interfaces.
 * Phase 3 implements: Start, Cancel, Retry Failed.
 * Pause/Resume are designed but deferred.
 */
import type { ExecutionStatus } from '../core/types/index';

export const TERMINAL_STATUSES: ExecutionStatus[] = [
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
];

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as ExecutionStatus);
}

export function canStart(status: string): boolean {
  return status === 'QUEUED' || status === 'FAILED' || status === 'CANCELLED';
}

export function canCancel(status: string): boolean {
  return (
    status === 'QUEUED'
    || status === 'STARTING'
    || status === 'RUNNING'
    || status === 'PAUSING'
    || status === 'PAUSED'
    || status === 'COMPLETING'
  );
}

/** Designed for a later phase — not wired in Phase 3 UI. */
export interface PauseResumeController {
  pause(executionId: string): Promise<void>;
  resume(executionId: string): Promise<void>;
}

export class UnsupportedPauseResume implements PauseResumeController {
  async pause(_executionId: string): Promise<void> {
    throw new Error('Pause is designed but not implemented in Phase 3');
  }
  async resume(_executionId: string): Promise<void> {
    throw new Error('Resume is designed but not implemented in Phase 3');
  }
}
