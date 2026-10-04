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

/** Unwrap Form API `{ success, data }` envelopes (and nested data) into the payload. */
function unwrapFormApiBody(body: unknown): unknown {
  let cur: any = body;
  for (let i = 0; i < 3; i++) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && 'data' in cur && cur.data !== undefined) {
      cur = cur.data;
      continue;
    }
    break;
  }
  return cur;
}

function normalizeChoices(raw: unknown): Array<{ label: string; value: string }> | undefined {
  if (raw == null) return undefined;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.choices)
      ? (raw as any).choices
      : Array.isArray((raw as any)?.options)
        ? (raw as any).options
        : null;
  if (!list) return undefined;
  return list.map((c: any) => {
    if (c == null) return { label: '', value: '' };
    if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
      return { label: String(c), value: String(c) };
    }
    return {
      label: String(c.label ?? c.name ?? c.value ?? ''),
      value: String(c.value ?? c.id ?? c.label ?? c.name ?? ''),
    };
  }).filter((c: { label: string; value: string }) => c.label || c.value);
}

function normalizeDiscoveredField(f: any) {
  return {
    id: f?.id,
    name: String(f?.name || f?.label || f?.key || f?.id || ''),
    label: String(f?.label || f?.name || f?.key || f?.id || ''),
    type: String(f?.type || f?.field_type || f?.dataType || 'text'),
    required: Boolean(f?.required),
    unique: Boolean(f?.unique),
    choices: normalizeChoices(f?.choices ?? f?.options),
    reference: f?.reference || undefined,
  };
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
    const res = await this.rest.request('GET', this.config.paths.formsPath || '/forms', {}, ctx);
    if (!res.ok) return res;
    // Normalize Form API { success, data: [...] } and plain arrays into { items }
    const body = res.data as any;
    const list = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body?.forms)
            ? body.forms
            : [];
    return {
      ok: true,
      status: res.status,
      data: {
        items: list.map((f: any) => ({
          id: String(f.id || f.formId || f.reference_id || f.name || ''),
          name: String(f.name || f.title || f.reference_id || f.id || 'Form'),
          description: f.description || null,
        })).filter((f: any) => f.id),
      },
    };
  }

  async getFormSchema(formId: string, ctx: ConnectorContext): Promise<ConnectorResult> {
    const formRes = await this.rest.request(
      'GET',
      fillPath(this.config.paths.formsPath.replace(/\/?$/, '') + '/{formId}', { formId }),
      {},
      ctx,
    );
    const fields = await this.getFieldMetadata(formId, ctx);
    const formBody = unwrapFormApiBody(formRes.data);
    const formObj =
      formBody && typeof formBody === 'object' && !Array.isArray(formBody)
        ? formBody
        : { id: formId };
    const fieldPayload = fields.data as any;
    const normalizedFields = Array.isArray(fieldPayload?.fields)
      ? fieldPayload.fields
      : Array.isArray(fieldPayload)
        ? fieldPayload
        : [];
    return {
      ok: formRes.ok && fields.ok,
      data: {
        ...formObj,
        id: (formObj as any).id || formId,
        name: (formObj as any).name || formId,
        fields: normalizedFields,
      },
      error: formRes.error || fields.error,
    };
  }

  async getFieldMetadata(formId: string, ctx: ConnectorContext): Promise<ConnectorResult> {
    const res = await this.rest.request(
      'GET',
      fillPath(this.config.paths.formFieldsPath, { formId }),
      {},
      ctx,
    );
    if (!res.ok) return res;
    const raw = unwrapFormApiBody(res.data);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.fields)
        ? (raw as any).fields
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : [];
    return {
      ok: true,
      status: res.status,
      data: {
        fields: list.map(normalizeDiscoveredField).filter((f: any) => f.name),
      },
    };
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
