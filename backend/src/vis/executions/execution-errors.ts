/**
 * Execution error classification + retryability.
 */
import type { ExecutionError, ExecutionErrorCode } from '../core/types/index';

export function classifyHttpError(
  status: number | undefined,
  message: string,
  correlationId?: string,
): ExecutionError {
  if (status === 401) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message,
      retryable: true, // after token refresh, once
      httpStatus: status,
      correlationId,
    };
  }
  if (status === 403) {
    return {
      code: 'AUTHORIZATION_ERROR',
      message,
      retryable: false,
      httpStatus: status,
      correlationId,
    };
  }
  if (status === 429) {
    return {
      code: 'RATE_LIMIT_ERROR',
      message,
      retryable: true,
      httpStatus: status,
      correlationId,
    };
  }
  if (status === 404) {
    return {
      code: 'TARGET_ERROR',
      message,
      retryable: false,
      httpStatus: status,
      correlationId,
    };
  }
  if (status === 400) {
    return {
      code: 'VALIDATION_ERROR',
      message,
      retryable: false,
      httpStatus: status,
      correlationId,
    };
  }
  if (status && status >= 500) {
    return {
      code: 'TARGET_ERROR',
      message,
      retryable: true,
      httpStatus: status,
      correlationId,
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message,
    retryable: false,
    httpStatus: status,
    correlationId,
  };
}

export function classifyThrown(err: unknown, correlationId?: string): ExecutionError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let code: ExecutionErrorCode = 'UNKNOWN_ERROR';
  let retryable = false;
  if (/abort|timeout|timed out/.test(lower)) {
    code = 'TIMEOUT_ERROR';
    retryable = true;
  } else if (/network|econnrefused|fetch failed|socket/.test(lower)) {
    code = 'NETWORK_ERROR';
    retryable = true;
  } else if (/auth|token|unauthorized/.test(lower)) {
    code = 'AUTHENTICATION_ERROR';
    retryable = true;
  } else if (/rate.?limit|429/.test(lower)) {
    code = 'RATE_LIMIT_ERROR';
    retryable = true;
  } else if (/map|transform/.test(lower)) {
    code = 'MAPPING_ERROR';
    retryable = false;
  } else if (/valid/.test(lower)) {
    code = 'VALIDATION_ERROR';
    retryable = false;
  } else if (/config/.test(lower)) {
    code = 'CONFIGURATION_ERROR';
    retryable = false;
  }
  return { code, message, retryable, correlationId };
}

export function isRetryableStatus(status?: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
