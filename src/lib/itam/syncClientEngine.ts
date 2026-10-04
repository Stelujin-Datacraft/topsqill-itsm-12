/**
 * Browser fallback for ITAM Form Sync when Nest `/api/itam/sync` is unreachable
 * (published app / preview / backend down) — same resilience pattern as VIS clientEngine.
 *
 * Lab mode can still hydrate schema from a seeded form catalog when Nest is offline.
 * Secrets are never stored; only credentialReferenceId.
 */

const STORAGE_KEY = 'itam.form-sync.store.v2';
const LEGACY_STORAGE_KEYS = ['itam.form-sync.store.v1'];

type Row = Record<string, unknown> & { id: string };

interface SyncStore {
  targets: Row[];
  mappings: Row[];
  schemas: Row[];
  runs: Row[];
  history: Row[];
  provenance: Row[];
  mockRecords: Row[];
}

/** In-memory mirror so Node/tests and private-mode browsers still work. */
let memoryStore: SyncStore | null = null;

function emptyStore(): SyncStore {
  return {
    targets: [],
    mappings: [],
    schemas: [],
    runs: [],
    history: [],
    provenance: [],
    mockRecords: [],
  };
}

function loadStore(): SyncStore {
  if (memoryStore) return memoryStore;
  try {
    if (typeof localStorage !== 'undefined') {
      for (const legacy of LEGACY_STORAGE_KEYS) {
        try {
          localStorage.removeItem(legacy);
        } catch {
          /* ignore */
        }
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memoryStore = { ...emptyStore(), ...JSON.parse(raw) };
        return memoryStore;
      }
    }
  } catch {
    /* ignore */
  }
  memoryStore = emptyStore();
  return memoryStore;
}

function save(store: SyncStore) {
  memoryStore = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    /* ignore quota */
  }
}

const ITAM_FORM_FIELDS = [
  { id: 'fld-device_name', name: 'device_name', label: 'Device Name', type: 'text', required: true },
  { id: 'fld-primary_ip', name: 'primary_ip', label: 'Primary IP', type: 'text', required: false },
  { id: 'fld-mac_address', name: 'mac_address', label: 'MAC Address', type: 'text', required: false },
  { id: 'fld-serial_number', name: 'serial_number', label: 'Serial Number', type: 'text', required: false },
  { id: 'fld-machine_guid', name: 'machine_guid', label: 'Device Unique Identifier', type: 'text', required: false },
  { id: 'fld-operating_system', name: 'operating_system', label: 'Operating System', type: 'text', required: false },
  { id: 'fld-os_version', name: 'os_version', label: 'OS Version', type: 'text', required: false },
  { id: 'fld-manufacturer', name: 'manufacturer', label: 'Manufacturer', type: 'text', required: false },
  { id: 'fld-model', name: 'model', label: 'Model', type: 'text', required: false },
  { id: 'fld-asset_type', name: 'asset_type', label: 'Asset Type', type: 'text', required: false },
  { id: 'fld-external_id', name: 'external_id', label: 'External ID', type: 'text', required: true, unique: true },
  { id: 'fld-cloud_instance_id', name: 'cloud_instance_id', label: 'Cloud Instance ID', type: 'text', required: false },
  { id: 'fld-environment', name: 'environment', label: 'Environment', type: 'text', required: false },
];

const SOURCE_TO_TARGET: Array<[string, string]> = [
  ['hostname', 'device_name'],
  ['primaryIp', 'primary_ip'],
  ['ipAddress', 'primary_ip'],
  ['macAddress', 'mac_address'],
  ['serialNumber', 'serial_number'],
  ['machineGuid', 'machine_guid'],
  ['operatingSystem', 'operating_system'],
  ['osVersion', 'os_version'],
  ['manufacturer', 'manufacturer'],
  ['model', 'model'],
  ['assetType', 'asset_type'],
  ['externalId', 'external_id'],
  ['cloudInstanceId', 'cloud_instance_id'],
  ['environment', 'environment'],
];

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `itam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function orgFilter(rows: Row[], organizationId: string) {
  return rows.filter((r) => String(r.organizationId) === String(organizationId));
}

function hashFields(fields: typeof ITAM_FORM_FIELDS): string {
  return `schema_${fields.map((f) => f.name).join('_')}`.slice(0, 48);
}

function mockSchema(formId: string) {
  const hash = hashFields(ITAM_FORM_FIELDS);
  return {
    formId,
    formName: 'ITAM Asset',
    version: hash,
    fields: ITAM_FORM_FIELDS,
    fetchedAt: new Date().toISOString(),
    hash,
  };
}

function proposeMappings(formId: string) {
  return SOURCE_TO_TARGET.map(([sourceField, targetField]) => ({
    sourceField,
    targetField,
    confidence: 'HIGH',
    transformation: 'direct',
    reasoning: `ITAM semantic match (${sourceField} ↔ ${targetField})`,
  }));
}

function sampleAssets(organizationId: string) {
  return [
    {
      id: uid(),
      organizationId,
      externalId: 'lab-asset-001',
      hostname: 'lab-laptop-01',
      primaryIp: '10.0.0.21',
      macAddress: 'aa:bb:cc:dd:ee:01',
      serialNumber: 'SN-LAB-001',
      manufacturer: 'MockOEM',
      model: 'LabBook',
      assetType: 'laptop',
      operatingSystem: 'Windows 11',
      osVersion: '23H2',
      environment: 'DEV',
    },
    {
      id: uid(),
      organizationId,
      externalId: 'lab-asset-002',
      hostname: 'lab-server-01',
      primaryIp: '10.0.0.55',
      serialNumber: 'SN-LAB-002',
      manufacturer: 'MockOEM',
      model: 'LabServer',
      assetType: 'server',
      operatingSystem: 'Ubuntu',
      osVersion: '22.04',
      environment: 'DEV',
    },
  ];
}

function runSync(opts: {
  organizationId: string;
  targetId: string;
  mappingId: string;
  mode: 'DRY_RUN' | 'EXECUTE';
}) {
  const store = loadStore();
  const mapping = store.mappings.find(
    (m) => m.id === opts.mappingId && m.organizationId === opts.organizationId,
  );
  if (!mapping) throw new Error('Mapping not found');
  if (mapping.status !== 'APPROVED' && opts.mode === 'EXECUTE') {
    throw new Error('Mapping must be APPROVED before execute');
  }

  const assets = sampleAssets(opts.organizationId);
  const items = assets.map((asset) => {
    const existing = store.mockRecords.find(
      (r) => r.organizationId === opts.organizationId && r.externalId === asset.externalId,
    );
    const operation =
      opts.mode === 'DRY_RUN'
        ? existing
          ? 'WOULD_UPDATE'
          : 'WOULD_CREATE'
        : existing
          ? 'UPDATE'
          : 'CREATE';

    if (opts.mode === 'EXECUTE') {
      if (existing) {
        existing.data = { ...((existing.data as object) || {}), ...asset, updatedAt: new Date().toISOString() };
      } else {
        store.mockRecords.push({
          id: uid(),
          organizationId: opts.organizationId,
          formId: String(mapping.targetFormId),
          externalId: asset.externalId,
          data: { ...asset },
          createdAt: new Date().toISOString(),
        });
      }
      store.history.push({
        id: uid(),
        organizationId: opts.organizationId,
        externalId: asset.externalId,
        operation,
        status: 'SUCCESS',
        at: new Date().toISOString(),
        mode: opts.mode,
      });
      store.provenance.push({
        id: uid(),
        organizationId: opts.organizationId,
        externalId: asset.externalId,
        field: 'device_name',
        source: 'lab-discovery',
        value: asset.hostname,
        at: new Date().toISOString(),
      });
    }

    return {
      assetId: asset.id,
      externalId: asset.externalId,
      operation,
      status: opts.mode === 'DRY_RUN' ? 'DRY_RUN' : 'SUCCESS',
      targetRecordId: existing?.id || null,
    };
  });

  const run: Row = {
    id: uid(),
    organizationId: opts.organizationId,
    targetConfigId: opts.targetId,
    mappingId: opts.mappingId,
    mode: opts.mode,
    status: opts.mode === 'DRY_RUN' ? 'DRY_RUN' : 'SUCCESS',
    items,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    __clientMode: true,
  };
  store.runs.push(run);
  save(store);
  return run;
}

export const itamSyncClientEngine = {
  __clientMode: true as const,

  listTargets(organizationId: string) {
    return orgFilter(loadStore().targets, organizationId);
  },

  createTarget(
    organizationId: string,
    body: {
      name: string;
      baseUrl: string;
      credentialReferenceId: string;
      targetFormId?: string;
      formsPath?: string;
      formFieldsPath?: string;
      recordsPath?: string;
      recordByIdPath?: string;
    },
  ) {
    if (!body.credentialReferenceId?.trim()) throw new Error('credentialReferenceId required');
    if (!body.baseUrl?.trim()) throw new Error('baseUrl required');
    if (/password|secret|token|apikey/i.test(JSON.stringify(body))) {
      throw new Error('Do not embed secrets — use credentialReferenceId');
    }
    const store = loadStore();
    const row: Row = {
      id: uid(),
      organizationId,
      name: body.name,
      baseUrl: body.baseUrl,
      credentialReferenceId: body.credentialReferenceId,
      targetFormId: body.targetFormId || 'form-itam-asset',
      formsPath: body.formsPath || '/forms',
      formFieldsPath: body.formFieldsPath || '/forms/{formId}/fields',
      recordsPath: body.recordsPath || '/forms/{formId}/records',
      recordByIdPath: body.recordByIdPath || '/forms/{formId}/records/{recordId}',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __clientMode: true,
    };
    store.targets.push(row);
    save(store);
    return row;
  },

  listMappings(organizationId: string) {
    return orgFilter(loadStore().mappings, organizationId);
  },

  previewMappings(
    organizationId: string,
    body: { targetId: string; formId: string; name?: string },
  ) {
    const store = loadStore();
    const target = store.targets.find(
      (t) => t.id === body.targetId && t.organizationId === organizationId,
    );
    if (!target) throw new Error('Target not found');
    const schema = mockSchema(body.formId);
    store.schemas = store.schemas.filter(
      (s) => !(s.organizationId === organizationId && s.formId === body.formId),
    );
    store.schemas.push({ id: uid(), organizationId, ...schema });

    const mappings = proposeMappings(body.formId);
    const row: Row = {
      id: uid(),
      organizationId,
      name: body.name || `Mapping ${body.formId}`,
      targetFormId: body.formId,
      version: 1,
      status: 'DRAFT',
      mappings,
      matchingSourceFields: ['externalId', 'serialNumber', 'macAddress'],
      matchingTargetFields: ['external_id', 'serial_number', 'mac_address'],
      mappingSource: 'DETERMINISTIC',
      confidence: 'HIGH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __clientMode: true,
    };
    store.mappings.push(row);
    save(store);
    return { schema, mapping: row, requiresApproval: true, __clientMode: true };
  },

  approveMapping(organizationId: string, mappingId: string) {
    const store = loadStore();
    const row = store.mappings.find((m) => m.id === mappingId && m.organizationId === organizationId);
    if (!row) throw new Error('Mapping not found');
    row.status = 'APPROVED';
    row.approvedAt = new Date().toISOString();
    row.updatedAt = new Date().toISOString();
    save(store);
    return row;
  },

  getSchema(organizationId: string, formId: string, targetId?: string) {
    const store = loadStore();
    if (targetId) {
      const target = store.targets.find((t) => t.id === targetId && t.organizationId === organizationId);
      if (!target) throw new Error('Target not found');
    }
    const schema = mockSchema(formId);
    return { ...schema, __clientMode: true };
  },

  previewSync(organizationId: string, body: { targetId: string; mappingId: string }) {
    return runSync({
      organizationId,
      targetId: body.targetId,
      mappingId: body.mappingId,
      mode: 'DRY_RUN',
    });
  },

  executeSync(organizationId: string, body: { targetId: string; mappingId: string }) {
    return runSync({
      organizationId,
      targetId: body.targetId,
      mappingId: body.mappingId,
      mode: 'EXECUTE',
    });
  },

  listRuns(organizationId: string) {
    return orgFilter(loadStore().runs, organizationId).slice().reverse();
  },

  getRun(organizationId: string, id: string) {
    const row = loadStore().runs.find((r) => r.id === id && r.organizationId === organizationId);
    if (!row) throw new Error('Sync run not found');
    return row;
  },

  history(organizationId: string, assetExternalId: string) {
    return loadStore().history.filter(
      (h) => h.organizationId === organizationId && h.externalId === assetExternalId,
    );
  },

  provenance(organizationId: string, assetExternalId: string) {
    return loadStore().provenance.filter(
      (p) => p.organizationId === organizationId && p.externalId === assetExternalId,
    );
  },

  metrics(organizationId: string) {
    const runs = orgFilter(loadStore().runs, organizationId);
    const items = runs.flatMap((r) => (Array.isArray(r.items) ? (r.items as any[]) : []));
    return {
      sync_success_total: items.filter((i) => i.status === 'SUCCESS').length,
      sync_failure_total: items.filter((i) =>
        ['API_ERROR', 'VALIDATION_FAILED', 'AUTHENTICATION_FAILED'].includes(i.status),
      ).length,
      sync_create_total: items.filter((i) => i.operation === 'CREATE').length,
      sync_update_total: items.filter((i) => i.operation === 'UPDATE').length,
      sync_no_change_total: items.filter((i) => i.operation === 'NO_CHANGE').length,
      sync_validation_failure_total: items.filter((i) => i.status === 'VALIDATION_FAILED').length,
      sync_ambiguous_total: items.filter((i) => i.status === 'AMBIGUOUS_MATCH').length,
      sync_api_error_total: items.filter((i) => i.status === 'API_ERROR').length,
      sync_runs_total: runs.length,
      __clientMode: true,
    };
  },
};
