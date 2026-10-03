/** Generic connector contracts — vendor-agnostic. */

export interface ConnectorAuthConfig {
  type: string;
  /** Opaque credential reference id — never embed secrets here. */
  credentialRefId?: string;
  extra?: Record<string, unknown>;
}

export interface ConnectorContext {
  correlationId: string;
  executionId?: string;
  integrationId?: string;
  timeoutMs?: number;
}

export interface ReadOptions {
  path?: string;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  pagination?: { page?: number; pageSize?: number; cursor?: string };
  incremental?: { since?: string; cursorField?: string };
}

export interface WritePayload {
  path?: string;
  body?: unknown;
  headers?: Record<string, string>;
  recordId?: string;
}

export interface ConnectorResult<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
  headers?: Record<string, string>;
}

export interface IConnector {
  readonly kind: string;
  connect(ctx: ConnectorContext): Promise<void>;
  authenticate(auth: ConnectorAuthConfig, ctx: ConnectorContext): Promise<void>;
  testConnection(ctx: ConnectorContext): Promise<ConnectorResult>;
  read(options: ReadOptions, ctx: ConnectorContext): Promise<ConnectorResult>;
  create(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult>;
  update(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult>;
  delete(payload: WritePayload, ctx: ConnectorContext): Promise<ConnectorResult>;
  disconnect(ctx: ConnectorContext): Promise<void>;
}

export interface RestConnectorConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  pagination?: {
    style: 'PAGE' | 'CURSOR' | 'OFFSET' | 'LINK_HEADER' | 'NONE';
    pageParam?: string;
    sizeParam?: string;
    cursorParam?: string;
  };
}

export interface IRestConnector extends IConnector {
  readonly kind: 'REST_API';
  request(
    method: string,
    path: string,
    options: {
      query?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
      body?: unknown;
    },
    ctx: ConnectorContext,
  ): Promise<ConnectorResult>;
}

export interface IDatabaseConnector extends IConnector {
  readonly kind: 'DATABASE';
  listTables(ctx: ConnectorContext): Promise<ConnectorResult<string[]>>;
  describeTable(table: string, ctx: ConnectorContext): Promise<ConnectorResult>;
  query(sql: string, params: unknown[], ctx: ConnectorContext): Promise<ConnectorResult>;
}

export interface InternalAppEndpointPaths {
  formsPath: string;
  formFieldsPath: string; // may include {formId}
  recordsPath: string;
  recordByIdPath: string; // may include {formId} {recordId}
  searchPath?: string;
}

export interface InternalAppConnectorConfig {
  baseUrl: string;
  apiVersion?: string;
  paths: InternalAppEndpointPaths;
  timeoutMs?: number;
}

export interface IInternalApplicationConnector extends IConnector {
  readonly kind: 'INTERNAL_APPLICATION_API';
  discoverApplications(ctx: ConnectorContext): Promise<ConnectorResult>;
  discoverForms(ctx: ConnectorContext): Promise<ConnectorResult>;
  getFormSchema(formId: string, ctx: ConnectorContext): Promise<ConnectorResult>;
  getFieldMetadata(formId: string, ctx: ConnectorContext): Promise<ConnectorResult>;
  searchRecords(
    formId: string,
    query: Record<string, unknown>,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult>;
  getRecord(formId: string, recordId: string, ctx: ConnectorContext): Promise<ConnectorResult>;
  createRecord(formId: string, body: unknown, ctx: ConnectorContext): Promise<ConnectorResult>;
  updateRecord(
    formId: string,
    recordId: string,
    body: unknown,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult>;
  deleteRecord(formId: string, recordId: string, ctx: ConnectorContext): Promise<ConnectorResult>;
}

/** OpenAPI / manual discovery abstraction (MVP stub). */
export interface IApiDiscovery {
  fromOpenApi(document: unknown): Promise<{
    endpoints: Array<{
      path: string;
      method: string;
      summary?: string;
      parameters?: unknown[];
      requestSchema?: unknown;
      responseSchema?: unknown;
    }>;
    auth?: unknown;
  }>;
  fromManual(definition: unknown): Promise<unknown>;
}

export * from './capabilities';
