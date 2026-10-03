/** Connector capability metadata — used by AI designer recommendations. */
export interface ConnectorCapabilities {
  supportsWebhooks: boolean;
  supportsEvents: boolean;
  supportsEventSubscription: boolean;
  supportsEventSchemas: boolean;
  supportsPolling: boolean;
  supportsBulkOperations: boolean;
  supportsCursorPagination: boolean;
  supportsIncrementalSync: boolean;
  supportsOAuth: boolean;
  supportsRateLimits: boolean;
}

export function capabilitiesForKind(kind: string): ConnectorCapabilities {
  if (kind === 'INTERNAL_APPLICATION_API') {
    return {
      supportsWebhooks: true,
      supportsEvents: true,
      supportsEventSubscription: true,
      supportsEventSchemas: true,
      supportsPolling: true,
      supportsBulkOperations: true,
      supportsCursorPagination: true,
      supportsIncrementalSync: true,
      supportsOAuth: true,
      supportsRateLimits: true,
    };
  }
  if (kind === 'REST_API') {
    return {
      supportsWebhooks: false,
      supportsEvents: false,
      supportsEventSubscription: false,
      supportsEventSchemas: false,
      supportsPolling: true,
      supportsBulkOperations: false,
      supportsCursorPagination: true,
      supportsIncrementalSync: true,
      supportsOAuth: true,
      supportsRateLimits: true,
    };
  }
  return {
    supportsWebhooks: false,
    supportsEvents: false,
    supportsEventSubscription: false,
    supportsEventSchemas: false,
    supportsPolling: true,
    supportsBulkOperations: false,
    supportsCursorPagination: false,
    supportsIncrementalSync: false,
    supportsOAuth: false,
    supportsRateLimits: false,
  };
}
