/**
 * Real PostgreSQL persistence for promotion export/import.
 * Uses PROMOTION_DATABASE_URL (or PLATFORM_DATABASE_URL).
 * Dry-run never writes. Approved import is transactional.
 */
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fingerprintDefinition, newAuditId, validatePackage } from './package';
import { rewriteUuidRefs } from './logical-keys';
import { scrubSecrets } from './secrets';
import { planFieldKeyBackfill } from './field-keys';
import type {
  ComponentKind,
  DiffAction,
  DiffItem,
  DryRunResult,
  ImportResult,
  PlatformPackage,
  PromotionAuditRecord,
} from './types';

let pool: Pool | null = null;

export function getPromotionDatabaseUrl(): string | undefined {
  return (
    process.env.PROMOTION_DATABASE_URL
    || process.env.PLATFORM_DATABASE_URL
    || undefined
  );
}

export function getPromotionPool(): Pool {
  const url = getPromotionDatabaseUrl();
  if (!url) throw new Error('PROMOTION_DATABASE_URL required for real promotion persistence');
  if (!pool) pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

export async function closePromotionPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function applyPromotionSchema(client?: Pool | PoolClient): Promise<void> {
  const db = client || getPromotionPool();
  const sql = readFileSync(resolve(__dirname, 'sql/platform_promotion_pg.sql'), 'utf8');
  await db.query(sql);
}

const EMPTY_SUMMARY = (): Record<DiffAction, number> => ({
  CREATE: 0,
  UPDATE: 0,
  NO_CHANGE: 0,
  CONFLICT: 0,
  MISSING_DEPENDENCY: 0,
  INVALID_REFERENCE: 0,
  BLOCKED: 0,
});

export interface PgTargetContext {
  organizationId: string;
  projectId: string;
  organizationLogicalKey: string;
  projectLogicalKey: string;
  namespace: string;
  actorUserId: string;
}

export async function ensureIsolatedTarget(
  opts: {
    organizationLogicalKey: string;
    projectLogicalKey: string;
    namespace: string;
    actorUserId?: string;
  },
): Promise<PgTargetContext> {
  if (!opts.namespace.startsWith('promotion-test-')) {
    throw new Error('Live promotion writes require namespace prefix promotion-test-');
  }
  const db = getPromotionPool();
  const actor = opts.actorUserId || '00000000-0000-4000-8000-000000000001';

  let org = await db.query(`SELECT id FROM organizations WHERE logical_key = $1`, [opts.organizationLogicalKey]);
  if (!org.rows[0]) {
    org = await db.query(
      `INSERT INTO organizations (name, domain, admin_email, logical_key)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [opts.organizationLogicalKey, `${opts.organizationLogicalKey}.test`, 'promotion@test.local', opts.organizationLogicalKey],
    );
  }
  const organizationId = org.rows[0].id as string;

  let project = await db.query(
    `SELECT id FROM projects WHERE organization_id = $1 AND logical_key = $2`,
    [organizationId, opts.projectLogicalKey],
  );
  if (!project.rows[0]) {
    project = await db.query(
      `INSERT INTO projects (name, description, organization_id, created_by, logical_key, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [opts.projectLogicalKey, `Isolated namespace ${opts.namespace}`, organizationId, actor, opts.projectLogicalKey],
    );
  }

  return {
    organizationId,
    projectId: project.rows[0].id,
    organizationLogicalKey: opts.organizationLogicalKey,
    projectLogicalKey: opts.projectLogicalKey,
    namespace: opts.namespace,
    actorUserId: actor,
  };
}

async function resolveKey(
  client: Pool | PoolClient,
  organizationId: string,
  kind: ComponentKind,
  logicalKey: string,
): Promise<{ id: string; fingerprint: string | null } | null> {
  const mapped = await client.query(
    `SELECT resource_id::text AS id, fingerprint FROM promotion_key_map
     WHERE organization_id = $1 AND component_kind = $2 AND logical_key = $3`,
    [organizationId, kind, logicalKey],
  );
  if (mapped.rows[0]) return { id: mapped.rows[0].id, fingerprint: mapped.rows[0].fingerprint };

  if (kind === 'form_field') {
    const r = await client.query(
      `SELECT ff.id::text AS id
       FROM form_fields ff
       JOIN forms f ON f.id = ff.form_id
       WHERE ff.logical_key = $1 AND f.organization_id = $2
       LIMIT 1`,
      [logicalKey, organizationId],
    );
    if (!r.rows[0]) return null;
    return { id: r.rows[0].id, fingerprint: null };
  }

  if (kind === 'project') {
    const r = await client.query(
      `SELECT id::text AS id FROM projects WHERE logical_key = $1 AND organization_id = $2 LIMIT 1`,
      [logicalKey, organizationId],
    );
    if (!r.rows[0]) return null;
    return { id: r.rows[0].id, fingerprint: null };
  }

  const table = tableForKind(kind);
  if (!table) return null;

  // Prefer organization-scoped lookup when the table has organization_id
  if (['forms', 'workflows', 'roles', 'reports', 'dashboards', 'data_source_connections', 'organizations'].includes(table)) {
    const r = await client.query(
      `SELECT id::text AS id FROM ${table} WHERE logical_key = $1 AND organization_id = $2 LIMIT 1`,
      [logicalKey, organizationId],
    );
    if (!r.rows[0]) return null;
    return { id: r.rows[0].id, fingerprint: null };
  }

  const r = await client.query(
    `SELECT id::text AS id FROM ${table} WHERE logical_key = $1 LIMIT 1`,
    [logicalKey],
  );
  if (!r.rows[0]) return null;
  return { id: r.rows[0].id, fingerprint: null };
}

function tableForKind(kind: ComponentKind): string | null {
  switch (kind) {
    case 'organization': return 'organizations';
    case 'project': return 'projects';
    case 'form': return 'forms';
    case 'form_field': return 'form_fields';
    case 'workflow': return 'workflows';
    case 'role': return 'roles';
    case 'report': return 'reports';
    case 'dashboard': return 'dashboards';
    case 'integration': return 'data_source_connections';
    default: return null;
  }
}

function compatible(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aType = a.fieldType ?? a.provider ?? a.channel ?? a.field_type;
  const bType = b.fieldType ?? b.provider ?? b.channel ?? b.field_type;
  if (aType != null && bType != null && String(aType) !== String(bType)) return false;
  return true;
}

async function loadExistingDefinition(
  client: Pool | PoolClient,
  kind: ComponentKind,
  id: string,
): Promise<Record<string, unknown> | null> {
  const table = tableForKind(kind);
  if (!table) return null;
  const r = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return r.rows[0] ? (r.rows[0] as Record<string, unknown>) : null;
}

export async function planPgImport(
  pkg: PlatformPackage,
  ctx: PgTargetContext,
): Promise<DryRunResult> {
  const validation = validatePackage(pkg);
  const db = getPromotionPool();
  const items: DiffItem[] = [];
  const summary = EMPTY_SUMMARY();

  if (!validation.ok) {
    for (const err of validation.errors) {
      items.push({ kind: 'project', key: pkg.manifest.package.key, action: 'BLOCKED', detail: err });
      summary.BLOCKED += 1;
    }
  }

  for (const c of pkg.components) {
    for (const dep of c.dependsOn || []) {
      const inPkg = pkg.components.some((x) => x.kind === dep.kind && x.key === dep.key);
      const inDb = await resolveKey(db, ctx.organizationId, dep.kind, dep.key);
      if (!inPkg && !inDb) {
        items.push({
          kind: c.kind,
          key: c.key,
          action: 'MISSING_DEPENDENCY',
          detail: `Missing dependency ${dep.kind}:${dep.key}`,
        });
        summary.MISSING_DEPENDENCY += 1;
      }
    }

    const existing = await resolveKey(db, ctx.organizationId, c.kind, c.key);
    const fp = fingerprintDefinition(c.definition);
    if (!existing) {
      items.push({ kind: c.kind, key: c.key, action: 'CREATE', sourceFingerprint: fp });
      summary.CREATE += 1;
      continue;
    }
    if (existing.fingerprint === fp) {
      items.push({
        kind: c.kind,
        key: c.key,
        action: 'NO_CHANGE',
        sourceFingerprint: fp,
        targetFingerprint: existing.fingerprint || undefined,
      });
      summary.NO_CHANGE += 1;
      continue;
    }
    const def = await loadExistingDefinition(db, c.kind, existing.id);
    if (def && !compatible(def, c.definition)) {
      items.push({
        kind: c.kind,
        key: c.key,
        action: 'CONFLICT',
        detail: 'Incompatible definition for same logical key',
        sourceFingerprint: fp,
        targetFingerprint: existing.fingerprint || undefined,
      });
      summary.CONFLICT += 1;
      continue;
    }
    items.push({
      kind: c.kind,
      key: c.key,
      action: existing.fingerprint ? 'UPDATE' : 'UPDATE',
      sourceFingerprint: fp,
      targetFingerprint: existing.fingerprint || undefined,
    });
    summary.UPDATE += 1;
  }

  return {
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    targetNamespace: ctx.namespace,
    environment: 'DEV',
    summary,
    items,
    wouldWrite: false,
  };
}

async function upsertKeyMap(
  client: PoolClient,
  organizationId: string,
  kind: ComponentKind,
  logicalKey: string,
  resourceId: string,
  fingerprint: string,
) {
  await client.query(
    `INSERT INTO promotion_key_map (organization_id, component_kind, logical_key, resource_id, fingerprint, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (organization_id, component_kind, logical_key)
     DO UPDATE SET resource_id = EXCLUDED.resource_id, fingerprint = EXCLUDED.fingerprint, updated_at = now()`,
    [organizationId, kind, logicalKey, resourceId, fingerprint],
  );
}

async function applyComponent(
  client: PoolClient,
  ctx: PgTargetContext,
  kind: ComponentKind,
  key: string,
  definition: Record<string, unknown>,
  idToKey: Map<string, string>,
): Promise<string> {
  const fp = fingerprintDefinition(definition);
  const existing = await resolveKey(client, ctx.organizationId, kind, key);

  if (kind === 'project') {
    const id = existing?.id || ctx.projectId;
    await client.query(
      `UPDATE projects SET name = $2, description = $3, logical_key = $4, updated_at = now() WHERE id = $1`,
      [id, definition.name || key, definition.description || null, key],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, id, fp);
    return id;
  }

  if (kind === 'form') {
    if (existing?.id) {
      await client.query(
        `UPDATE forms SET name=$2, description=$3, status=$4, pages=$5, layout=$6, form_rules=$7, field_rules=$8,
         logical_key=$9, reference_id=COALESCE(reference_id,$9), updated_at=now() WHERE id=$1`,
        [
          existing.id,
          definition.name,
          definition.description || null,
          definition.status || 'draft',
          JSON.stringify(definition.pages ?? null),
          JSON.stringify(definition.layout ?? null),
          JSON.stringify(definition.formRules ?? null),
          JSON.stringify(definition.fieldRules ?? null),
          key,
        ],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO forms (name, description, project_id, organization_id, created_by, status, logical_key, reference_id, pages, layout, form_rules, field_rules)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11) RETURNING id`,
      [
        definition.name,
        definition.description || null,
        ctx.projectId,
        ctx.organizationId,
        ctx.actorUserId,
        definition.status || 'draft',
        key,
        JSON.stringify(definition.pages ?? null),
        JSON.stringify(definition.layout ?? null),
        JSON.stringify(definition.formRules ?? null),
        JSON.stringify(definition.fieldRules ?? null),
      ],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  if (kind === 'form_field') {
    const formKey = String(definition.formKey || '');
    const form = formKey
      ? await resolveKey(client, ctx.organizationId, 'form', formKey)
      : null;
    if (!form) throw Object.assign(new Error(`MISSING_DEPENDENCY form ${formKey}`), { code: 'MISSING_DEPENDENCY' });
    if (existing?.id) {
      await client.query(
        `UPDATE form_fields SET label=$2, field_type=$3, required=$4, options=$5, validation=$6, custom_config=$7,
         field_order=$8, logical_key=$9, updated_at=now() WHERE id=$1`,
        [
          existing.id,
          definition.label,
          definition.fieldType || definition.field_type,
          !!definition.required,
          JSON.stringify(definition.options ?? null),
          JSON.stringify(definition.validation ?? null),
          JSON.stringify(definition.customConfig ?? definition.custom_config ?? null),
          definition.fieldOrder ?? definition.field_order ?? null,
          key,
        ],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO form_fields (form_id, label, field_type, required, options, validation, custom_config, field_order, logical_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        form.id,
        definition.label,
        definition.fieldType || definition.field_type,
        !!definition.required,
        JSON.stringify(definition.options ?? null),
        JSON.stringify(definition.validation ?? null),
        JSON.stringify(definition.customConfig ?? definition.custom_config ?? null),
        definition.fieldOrder ?? definition.field_order ?? null,
        key,
      ],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  if (kind === 'workflow') {
    const { rewritten } = rewriteUuidRefs(definition, idToKey);
    const defJson = rewritten.definition || rewritten;
    if (existing?.id) {
      await client.query(
        `UPDATE workflows SET name=$2, description=$3, status=$4, definition=$5, logical_key=$6, reference_id=COALESCE(reference_id,$6), updated_at=now() WHERE id=$1`,
        [existing.id, definition.name, definition.description || null, definition.status || 'draft', JSON.stringify(defJson), key],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO workflows (name, description, project_id, organization_id, created_by, status, logical_key, reference_id, definition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8) RETURNING id`,
      [definition.name, definition.description || null, ctx.projectId, ctx.organizationId, ctx.actorUserId, definition.status || 'draft', key, JSON.stringify(defJson)],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  if (kind === 'role') {
    let roleId = existing?.id;
    if (roleId) {
      await client.query(
        `UPDATE roles SET name=$2, description=$3, top_level_access=$4, logical_key=$5, updated_at=now() WHERE id=$1`,
        [roleId, definition.name, definition.description || null, definition.topLevelAccess || 'no_access', key],
      );
    } else {
      const r = await client.query(
        `INSERT INTO roles (name, description, organization_id, created_by, top_level_access, logical_key)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [definition.name, definition.description || null, ctx.organizationId, ctx.actorUserId, definition.topLevelAccess || 'no_access', key],
      );
      roleId = r.rows[0].id;
    }
    // Replace permissions using logical keys; resolve resource_id in-target
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    for (const p of (definition.permissions as any[]) || []) {
      let resourceId: string | null = null;
      const resourceKey = p.resourceKey || p.resource_logical_key || null;
      if (resourceKey) {
        const kindMap: Record<string, ComponentKind> = {
          form: 'form',
          workflow: 'workflow',
          report: 'report',
          project: 'project',
        };
        const rk = kindMap[String(p.resourceType || p.resource_type)] || 'form';
        const resolved = await resolveKey(client, ctx.organizationId, rk, resourceKey);
        resourceId = resolved?.id || null;
      }
      await client.query(
        `INSERT INTO role_permissions (role_id, resource_type, resource_id, resource_logical_key, permission_type)
         VALUES ($1,$2,$3,$4,$5)`,
        [roleId, p.resourceType || p.resource_type, resourceId, resourceKey, p.permissionType || p.permission_type],
      );
    }
    await upsertKeyMap(client, ctx.organizationId, kind, key, roleId!, fp);
    return roleId!;
  }

  if (kind === 'report') {
    const { rewritten } = rewriteUuidRefs(definition, idToKey);
    if (existing?.id) {
      await client.query(
        `UPDATE reports SET name=$2, description=$3, config=$4, form_key=$5, logical_key=$6, reference_id=COALESCE(reference_id,$6), updated_at=now() WHERE id=$1`,
        [existing.id, definition.name, definition.description || null, JSON.stringify(rewritten.config || {}), definition.formKey || null, key],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO reports (name, description, project_id, organization_id, created_by, logical_key, reference_id, config, form_key)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING id`,
      [definition.name, definition.description || null, ctx.projectId, ctx.organizationId, ctx.actorUserId, key, JSON.stringify(rewritten.config || {}), definition.formKey || null],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  if (kind === 'dashboard') {
    const { rewritten } = rewriteUuidRefs(definition, idToKey);
    if (existing?.id) {
      await client.query(
        `UPDATE dashboards SET name=$2, description=$3, layout=$4, logical_key=$5, reference_id=COALESCE(reference_id,$5), updated_at=now() WHERE id=$1`,
        [existing.id, definition.name, definition.description || null, JSON.stringify(rewritten.layout ?? rewritten.reportKeys ?? null), key],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO dashboards (name, description, project_id, organization_id, created_by, logical_key, reference_id, layout)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING id`,
      [definition.name, definition.description || null, ctx.projectId, ctx.organizationId, ctx.actorUserId, key, JSON.stringify(rewritten.layout ?? rewritten.reportKeys ?? null)],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  if (kind === 'integration') {
    const scrubbed = scrubSecrets(definition) as Record<string, unknown>;
    if (existing?.id) {
      await client.query(
        `UPDATE data_source_connections SET name=$2, http_url=$3, http_auth_type=$4, http_auth_config=$5,
         credential_reference_id=$6, logical_key=$7, updated_at=now() WHERE id=$1`,
        [
          existing.id,
          scrubbed.name,
          null, // base URL is env slot — not copied as secret host necessarily; store null or slot marker
          scrubbed.authType || 'api_key',
          JSON.stringify({}),
          scrubbed.credentialReferenceId || null,
          key,
        ],
      );
      await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
      return existing.id;
    }
    const r = await client.query(
      `INSERT INTO data_source_connections
       (name, organization_id, project_id, connection_type, http_auth_type, http_auth_config, http_headers, logical_key, credential_reference_id, created_by)
       VALUES ($1,$2,$3,'http',$4,'{}'::jsonb,'{"x-tsq-connector":"1"}'::jsonb,$5,$6,$7) RETURNING id`,
      [
        scrubbed.name,
        ctx.organizationId,
        ctx.projectId,
        scrubbed.authType || 'api_key',
        key,
        scrubbed.credentialReferenceId || null,
        ctx.actorUserId,
      ],
    );
    await upsertKeyMap(client, ctx.organizationId, kind, key, r.rows[0].id, fp);
    return r.rows[0].id;
  }

  // reference_data / notification_template stored in key map only for this phase
  if (existing?.id) {
    await upsertKeyMap(client, ctx.organizationId, kind, key, existing.id, fp);
    return existing.id;
  }
  const synthetic = newAuditId();
  await upsertKeyMap(client, ctx.organizationId, kind, key, synthetic, fp);
  return synthetic;
}

const APPLY_ORDER: ComponentKind[] = [
  'project',
  'form',
  'form_field',
  'role',
  'workflow',
  'notification_template',
  'integration',
  'reference_data',
  'report',
  'dashboard',
];

export async function applyPgImport(
  pkg: PlatformPackage,
  ctx: PgTargetContext,
  opts: { dryRun: boolean; initiatedBy: string; approvedBy?: string | null; failOnConflict?: boolean },
): Promise<ImportResult> {
  const plan = await planPgImport(pkg, ctx);
  const blocked = plan.items.filter((i) =>
    ['CONFLICT', 'MISSING_DEPENDENCY', 'BLOCKED', 'INVALID_REFERENCE'].includes(i.action),
  );

  if (opts.dryRun) {
    const audit = await writeAudit(pkg, ctx, opts, 'DRY_RUN', plan, [], true);
    return {
      dryRun: true,
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      targetNamespace: ctx.namespace,
      applied: [],
      blocked,
      audit,
    };
  }

  if ((opts.failOnConflict !== false) && blocked.length) {
    const audit = await writeAudit(pkg, ctx, opts, 'FAILED', plan, blocked.map((b) => `${b.key}:${b.action}`), false);
    return {
      dryRun: false,
      packageKey: pkg.manifest.package.key,
      packageVersion: pkg.manifest.package.version,
      targetNamespace: ctx.namespace,
      applied: [],
      blocked,
      audit,
    };
  }

  const db = getPromotionPool();
  const client = await db.connect();
  const applied: DiffItem[] = [];
  const idToKey = new Map<string, string>();
  try {
    await client.query('BEGIN');
    const sorted = [...pkg.components].sort(
      (a, b) => APPLY_ORDER.indexOf(a.kind) - APPLY_ORDER.indexOf(b.kind),
    );
    for (const c of sorted) {
      const item = plan.items.find((i) => i.kind === c.kind && i.key === c.key);
      if (!item || (item.action !== 'CREATE' && item.action !== 'UPDATE')) continue;
      const id = await applyComponent(client, ctx, c.kind, c.key, c.definition, idToKey);
      idToKey.set(id, c.key);
      applied.push(item);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const audit = await writeAudit(
    pkg,
    ctx,
    opts,
    blocked.length ? 'PARTIAL' : 'SUCCESS',
    plan,
    blocked.map((b) => `${b.key}:${b.action}`),
    false,
  );
  return {
    dryRun: false,
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    targetNamespace: ctx.namespace,
    applied,
    blocked,
    audit,
  };
}

async function writeAudit(
  pkg: PlatformPackage,
  ctx: PgTargetContext,
  opts: { initiatedBy: string; approvedBy?: string | null },
  result: PromotionAuditRecord['result'],
  plan: DryRunResult,
  failures: string[],
  dryRun: boolean,
): Promise<PromotionAuditRecord> {
  const audit: PromotionAuditRecord = {
    id: newAuditId(),
    packageKey: pkg.manifest.package.key,
    packageVersion: pkg.manifest.package.version,
    sourceEnvironment: 'DEV',
    targetEnvironment: 'DEV',
    targetNamespace: ctx.namespace,
    initiatedBy: opts.initiatedBy,
    approvedBy: opts.approvedBy ?? null,
    timestamp: new Date().toISOString(),
    result,
    components: plan.items,
    failures,
  };
  const db = getPromotionPool();
  await db.query(
    `INSERT INTO promotion_import_audits
     (id, package_key, package_version, source_environment, target_environment, target_organization_id, target_project_id,
      target_namespace, initiated_by, approved_by, dry_run, result, summary, components, failures)
     VALUES ($1,$2,$3,'DEV','DEV',$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)`,
    [
      audit.id,
      audit.packageKey,
      audit.packageVersion,
      ctx.organizationId,
      ctx.projectId,
      ctx.namespace,
      audit.initiatedBy,
      audit.approvedBy,
      dryRun,
      result,
      JSON.stringify(plan.summary),
      JSON.stringify(plan.items),
      JSON.stringify(failures),
    ],
  );
  return audit;
}

export async function verifyPgRoundTrip(
  pkg: PlatformPackage,
  ctx: PgTargetContext,
): Promise<{ ok: boolean; mismatches: string[]; keyMap: Array<{ kind: string; key: string; resourceId: string }> }> {
  const db = getPromotionPool();
  const mismatches: string[] = [];
  const keyMap: Array<{ kind: string; key: string; resourceId: string }> = [];
  for (const c of pkg.components) {
    const resolved = await resolveKey(db, ctx.organizationId, c.kind, c.key);
    if (!resolved) {
      mismatches.push(`missing ${c.kind}:${c.key}`);
      continue;
    }
    keyMap.push({ kind: c.kind, key: c.key, resourceId: resolved.id });
    const fp = fingerprintDefinition(c.definition);
    if (resolved.fingerprint && resolved.fingerprint !== fp) {
      mismatches.push(`fingerprint mismatch ${c.kind}:${c.key}`);
    }
  }
  return { ok: mismatches.length === 0, mismatches, keyMap };
}

export async function countPromotionRows(ctx: PgTargetContext): Promise<Record<string, number>> {
  const db = getPromotionPool();
  const q = async (sql: string, params: any[]) => (await db.query(sql, params)).rows[0].n as number;
  return {
    forms: await q(`SELECT count(*)::int AS n FROM forms WHERE project_id=$1`, [ctx.projectId]),
    form_fields: await q(
      `SELECT count(*)::int AS n FROM form_fields WHERE form_id IN (SELECT id FROM forms WHERE project_id=$1)`,
      [ctx.projectId],
    ),
    workflows: await q(`SELECT count(*)::int AS n FROM workflows WHERE project_id=$1`, [ctx.projectId]),
    roles: await q(`SELECT count(*)::int AS n FROM roles WHERE organization_id=$1`, [ctx.organizationId]),
    reports: await q(`SELECT count(*)::int AS n FROM reports WHERE project_id=$1`, [ctx.projectId]),
    dashboards: await q(`SELECT count(*)::int AS n FROM dashboards WHERE project_id=$1`, [ctx.projectId]),
    key_map: await q(`SELECT count(*)::int AS n FROM promotion_key_map WHERE organization_id=$1`, [ctx.organizationId]),
  };
}

export async function backfillFormFieldKeysPg(): Promise<ReturnType<typeof planFieldKeyBackfill> & { applied: number }> {
  const db = getPromotionPool();
  const r = await db.query(
    `SELECT ff.id, ff.form_id, ff.label, ff.logical_key, ff.custom_config,
            f.logical_key AS form_logical_key, f.reference_id AS form_reference_id
     FROM form_fields ff
     LEFT JOIN forms f ON f.id = ff.form_id`,
  );
  const plan = planFieldKeyBackfill(
    r.rows.map((row) => ({
      id: row.id,
      formId: row.form_id,
      label: row.label,
      logicalKey: row.logical_key,
      customConfig: row.custom_config,
      formLogicalKey: row.form_logical_key,
      formReferenceId: row.form_reference_id,
    })),
  );
  let applied = 0;
  for (const u of plan.updated) {
    await db.query(`UPDATE form_fields SET logical_key = $2, updated_at = now() WHERE id = $1 AND logical_key IS NULL`, [
      u.id,
      u.logicalKey,
    ]);
    applied += 1;
  }
  return { ...plan, applied };
}

/** Prove dry-run did not mutate by comparing row counts + max(updated_at). */
export async function snapshotDbState(ctx: PgTargetContext): Promise<string> {
  const counts = await countPromotionRows(ctx);
  const db = getPromotionPool();
  const max = await db.query(
    `SELECT COALESCE(max(updated_at), '1970-01-01')::text AS m FROM forms WHERE project_id=$1`,
    [ctx.projectId],
  );
  return JSON.stringify({ counts, formsUpdated: max.rows[0].m });
}
