import type {
  ConnectorAuthConfig,
  ConnectorContext,
  ConnectorResult,
  IInternalApplicationConnector,
  InternalAppConnectorConfig,
  ReadOptions,
  WritePayload,
} from '../core/connectors/index';
import { RestConnector } from './rest.connector';

function fillPath(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(vars[key] || ''));
}

/**
 * Configurable Internal Application connector.
 * Paths are never hardcoded — provided via config.
 */
export class InternalApplicationConnector implements IInternalApplicationConnector {
  readonly kind = 'INTERNAL_APPLICATION_API' as const;
  private readonly rest: RestConnector;

  constructor(
    private readonly config: InternalAppConnectorConfig,
    opts?: { allowPrivateNetwork?: boolean; fetchImpl?: typeof fetch },
  ) {
    this.rest = new RestConnector(
      { baseUrl: config.baseUrl, timeoutMs: config.timeoutMs },
      opts,
    );
  }

  connect(ctx: ConnectorContext) {
    return this.rest.connect(ctx);
  }
  authenticate(auth: ConnectorAuthConfig, ctx: ConnectorContext) {
    return this.rest.authenticate(auth, ctx);
  }
  testConnection(ctx: ConnectorContext) {
    // Probe health first (no DB). Fall back to forms list for older deployments.
    return this.rest
      .request('GET', (this.config.paths as any)?.healthPath || '/health', {}, ctx)
      .then(async (res) => {
        if (res.ok || (res.status !== undefined && res.status < 500)) return res;
        return this.rest.request('GET', this.config.paths.formsPath || '/forms', {}, ctx);
      });
  }
  read(options: ReadOptions, ctx: ConnectorContext) {
    return this.rest.read(options, ctx);
  }
  create(payload: WritePayload, ctx: ConnectorContext) {
    return this.rest.create(payload, ctx);
  }
  update(payload: WritePayload, ctx: ConnectorContext) {
    return this.rest.update(payload, ctx);
  }
  delete(payload: WritePayload, ctx: ConnectorContext) {
    return this.rest.delete(payload, ctx);
  }
  disconnect(ctx: ConnectorContext) {
    return this.rest.disconnect(ctx);
  }

  async discoverApplications(ctx: ConnectorContext): Promise<ConnectorResult> {
    return {
      ok: true,
      data: [{ id: 'default', name: 'Internal Application', apiVersion: this.config.apiVersion || 'v1' }],
    };
  }

  async discoverForms(ctx: ConnectorContext): Promise<ConnectorResult> {
    return this.rest.request('GET', this.config.paths.formsPath, {}, ctx);
  }

  async getFormSchema(formId: string, ctx: ConnectorContext): Promise<ConnectorResult> {
    const formRes = await this.rest.request(
      'GET',
      fillPath(this.config.paths.formsPath.replace(/\/?$/, '') + '/{formId}', { formId }),
      {},
      ctx,
    );
    const fields = await this.getFieldMetadata(formId, ctx);
    return {
      ok: formRes.ok && fields.ok,
      data: {
        ...(typeof formRes.data === 'object' && formRes.data ? formRes.data : { id: formId }),
        fields: (fields.data as any)?.fields || fields.data || [],
      },
      error: formRes.error || fields.error,
    };
  }

  async getFieldMetadata(formId: string, ctx: ConnectorContext): Promise<ConnectorResult> {
    return this.rest.request(
      'GET',
      fillPath(this.config.paths.formFieldsPath, { formId }),
      {},
      ctx,
    );
  }

  async searchRecords(formId: string, query: Record<string, unknown>, ctx: ConnectorContext) {
    const path = this.config.paths.searchPath
      ? fillPath(this.config.paths.searchPath, { formId })
      : fillPath(this.config.paths.recordsPath, { formId });
    return this.rest.request('GET', path, { query: query as any }, ctx);
  }

  async getRecord(formId: string, recordId: string, ctx: ConnectorContext) {
    return this.rest.request(
      'GET',
      fillPath(this.config.paths.recordByIdPath, { formId, recordId }),
      {},
      ctx,
    );
  }

  async createRecord(formId: string, body: unknown, ctx: ConnectorContext) {
    return this.rest.request('POST', fillPath(this.config.paths.recordsPath, { formId }), { body }, ctx);
  }

  async updateRecord(formId: string, recordId: string, body: unknown, ctx: ConnectorContext) {
    return this.rest.request(
      'PUT',
      fillPath(this.config.paths.recordByIdPath, { formId, recordId }),
      { body },
      ctx,
    );
  }

  async deleteRecord(formId: string, recordId: string, ctx: ConnectorContext) {
    return this.rest.request(
      'DELETE',
      fillPath(this.config.paths.recordByIdPath, { formId, recordId }),
      {},
      ctx,
    );
  }
}

/** Stub DB connector — config model + interface only for Phase 1. */
export class DatabaseConnectorStub {
  readonly kind = 'DATABASE' as const;
  async connect() {
    throw new Error('Database connector not implemented in Phase 1');
  }
  async testConnection(): Promise<ConnectorResult> {
    return { ok: false, error: 'Database connector stub — configure provider in a later phase' };
  }
}
