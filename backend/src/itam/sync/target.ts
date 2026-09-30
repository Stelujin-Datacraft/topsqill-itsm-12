/**
 * Target adapters for existing application Form API.
 * Writes ONLY through API — never direct DB.
 */
import { randomUUID } from 'crypto';
import { InternalApplicationConnector } from '../../vis/connectors/internal-app.connector';
import type { ConnectorContext } from '../../vis/core/connectors/index';
import type { FormFieldSchema, FormSchemaSnapshot, SyncTargetConfig } from './types';
import { schemaHash } from './normalize';

export interface ExistingAppTarget {
  discoverForms(): Promise<Array<{ id: string; name: string; description?: string }>>;
  getFormSchema(formId: string): Promise<FormSchemaSnapshot>;
  searchRecords(formId: string, query: Record<string, unknown>): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  getRecord(formId: string, recordId: string): Promise<{ id: string; data: Record<string, unknown> } | null>;
  createRecord(formId: string, body: Record<string, unknown>): Promise<{ id: string; data: Record<string, unknown> }>;
  updateRecord(formId: string, recordId: string, body: Record<string, unknown>): Promise<{ id: string; data: Record<string, unknown> }>;
}

/** In-memory existing-app simulator for unit tests — still models API semantics. */
export class MockExistingAppTarget implements ExistingAppTarget {
  forms = new Map<string, { id: string; name: string; fields: FormFieldSchema[] }>();
  records = new Map<string, { id: string; formId: string; data: Record<string, unknown> }>();
  writeCount = 0;
  dryRunGuard = false;

  seedItamAssetForm(formId = 'form-itam-asset') {
    this.forms.set(formId, {
      id: formId,
      name: 'ITAM Asset',
      fields: [
        { name: 'device_name', label: 'Device Name', type: 'text', required: true },
        { name: 'primary_ip', label: 'Primary IP', type: 'text', required: false },
        { name: 'mac_address', label: 'MAC Address', type: 'text', required: false },
        { name: 'serial_number', label: 'Serial Number', type: 'text', required: false },
        { name: 'machine_guid', label: 'Device Unique Identifier', type: 'text', required: false },
        { name: 'operating_system', label: 'Operating System', type: 'text', required: false },
        { name: 'os_version', label: 'OS Version', type: 'text', required: false },
        { name: 'manufacturer', label: 'Manufacturer', type: 'text', required: false },
        { name: 'model', label: 'Model', type: 'text', required: false },
        { name: 'asset_type', label: 'Asset Type', type: 'text', required: false },
        { name: 'external_id', label: 'External ID', type: 'text', required: true, unique: true },
        { name: 'cloud_instance_id', label: 'Cloud Instance ID', type: 'text', required: false },
        { name: 'environment', label: 'Environment', type: 'text', required: false },
      ],
    });
    return formId;
  }

  /** Simulate schema evolution: rename device_name → asset_name */
  evolveRenameDeviceName() {
    const form = this.forms.get('form-itam-asset');
    if (!form) return;
    form.fields = form.fields.map((f) =>
      f.name === 'device_name' ? { ...f, name: 'asset_name', label: 'Asset Name' } : f,
    );
  }

  async discoverForms() {
    return [...this.forms.values()].map((f) => ({ id: f.id, name: f.name }));
  }

  async getFormSchema(formId: string): Promise<FormSchemaSnapshot> {
    const form = this.forms.get(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);
    const hash = schemaHash(form.fields);
    return {
      formId: form.id,
      formName: form.name,
      version: hash,
      fields: form.fields,
      fetchedAt: new Date().toISOString(),
      hash,
    };
  }

  async searchRecords(formId: string, query: Record<string, unknown>) {
    return [...this.records.values()]
      .filter((r) => r.formId === formId)
      .filter((r) => Object.entries(query).every(([k, v]) => v == null || String(r.data[k] ?? '') === String(v)))
      .map((r) => ({ id: r.id, data: { ...r.data } }));
  }

  async getRecord(formId: string, recordId: string) {
    const r = this.records.get(recordId);
    if (!r || r.formId !== formId) return null;
    return { id: r.id, data: { ...r.data } };
  }

  async createRecord(formId: string, body: Record<string, unknown>) {
    if (this.dryRunGuard) throw new Error('DRY_RUN_WRITE_FORBIDDEN');
    this.writeCount += 1;
    const id = randomUUID();
    const row = { id, formId, data: { ...body } };
    this.records.set(id, row);
    return { id, data: { ...body } };
  }

  async updateRecord(formId: string, recordId: string, body: Record<string, unknown>) {
    if (this.dryRunGuard) throw new Error('DRY_RUN_WRITE_FORBIDDEN');
    const existing = this.records.get(recordId);
    if (!existing || existing.formId !== formId) throw new Error('Record not found');
    this.writeCount += 1;
    existing.data = { ...existing.data, ...body };
    return { id: recordId, data: { ...existing.data } };
  }
}

/** HTTP adapter using InternalApplicationConnector against existing app API. */
export class HttpExistingAppTarget implements ExistingAppTarget {
  private readonly connector: InternalApplicationConnector;
  private readonly ctx: ConnectorContext;

  constructor(
    private readonly config: SyncTargetConfig,
    opts?: { resolveSecret?: (ref: string) => Promise<string | null>; fetchImpl?: typeof fetch },
  ) {
    this.connector = new InternalApplicationConnector(
      {
        baseUrl: config.baseUrl,
        paths: {
          formsPath: config.formsPath,
          formFieldsPath: config.formFieldsPath,
          recordsPath: config.recordsPath,
          recordByIdPath: config.recordByIdPath,
          searchPath: config.searchPath,
        },
        timeoutMs: 15000,
      },
      { allowPrivateNetwork: true, fetchImpl: opts?.fetchImpl },
    );
    this.ctx = {
      correlationId: randomUUID(),
      tenantId: config.organizationId,
      resolveSecret: opts?.resolveSecret,
    };
  }

  async connect() {
    await this.connector.connect(this.ctx);
    if (this.config.credentialReferenceId) {
      await this.connector.authenticate(
        { type: 'bearer', credentialRefId: this.config.credentialReferenceId },
        this.ctx,
      );
    }
  }

  async discoverForms() {
    const res = await this.connector.discoverForms(this.ctx);
    if (!res.ok) throw new Error(res.error?.message || 'discoverForms failed');
    const items = (res.data as any)?.items || (res.data as any)?.data || res.data || [];
    return (Array.isArray(items) ? items : []).map((f: any) => ({
      id: String(f.id),
      name: String(f.name || f.id),
      description: f.description,
    }));
  }

  async getFormSchema(formId: string): Promise<FormSchemaSnapshot> {
    const res = await this.connector.getFormSchema(formId, this.ctx);
    if (!res.ok) throw new Error(res.error?.message || 'getFormSchema failed');
    const rawFields = (res.data as any)?.fields || [];
    const fields: FormFieldSchema[] = (Array.isArray(rawFields) ? rawFields : []).map((f: any) => ({
      id: f.id,
      name: String(f.name || f.field_name || f.id),
      label: f.label,
      type: String(f.type || f.field_type || 'text'),
      required: Boolean(f.required),
      nullable: f.nullable,
      readOnly: Boolean(f.readOnly || f.read_only),
      editable: f.editable !== false,
      allowedValues: f.allowedValues || f.options,
      maxLength: f.maxLength || f.max_length,
      unique: Boolean(f.unique),
    }));
    const hash = schemaHash(fields);
    return {
      formId,
      formName: String((res.data as any)?.name || formId),
      version: hash,
      fields,
      fetchedAt: new Date().toISOString(),
      hash,
    };
  }

  async searchRecords(formId: string, query: Record<string, unknown>) {
    const res = await this.connector.searchRecords(formId, query, this.ctx);
    if (!res.ok) throw new Error(res.error?.message || 'searchRecords failed');
    const items = (res.data as any)?.items || (res.data as any)?.data || [];
    return (Array.isArray(items) ? items : []).map((r: any) => ({
      id: String(r.id),
      data: (r.data || r) as Record<string, unknown>,
    }));
  }

  async getRecord(formId: string, recordId: string) {
    const res = await this.connector.getRecord(formId, recordId, this.ctx);
    if (!res.ok) return null;
    const d = res.data as any;
    return { id: String(d.id || recordId), data: (d.data || d) as Record<string, unknown> };
  }

  async createRecord(formId: string, body: Record<string, unknown>) {
    const res = await this.connector.createRecord(formId, body, this.ctx);
    if (!res.ok) {
      const code = res.error?.code || '';
      if (/401|auth/i.test(code + (res.error?.message || ''))) {
        throw Object.assign(new Error(res.error?.message || 'auth failed'), { category: 'AUTHENTICATION_FAILED' });
      }
      if (/429|rate/i.test(code + (res.error?.message || ''))) {
        throw Object.assign(new Error(res.error?.message || 'rate limited'), { category: 'RATE_LIMITED' });
      }
      throw Object.assign(new Error(res.error?.message || 'create failed'), { category: 'API_ERROR' });
    }
    const d = res.data as any;
    return { id: String(d.id || d.data?.id), data: (d.data || d) as Record<string, unknown> };
  }

  async updateRecord(formId: string, recordId: string, body: Record<string, unknown>) {
    const res = await this.connector.updateRecord(formId, recordId, body, this.ctx);
    if (!res.ok) {
      throw Object.assign(new Error(res.error?.message || 'update failed'), { category: 'API_ERROR' });
    }
    const d = res.data as any;
    return { id: String(d.id || recordId), data: (d.data || d) as Record<string, unknown> };
  }
}
