/**
 * PostgreSQL persistence for ITAM Network Discovery.
 * Production write-through / hydrate for DiscoveryStore.
 * Memory-only mode remains for unit tests.
 */
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { DiscoveryStore } from './store';
import type { DiscoveryJob, NetworkScope } from './types';

let pool: Pool | null = null;

export function getItamDiscoveryDatabaseUrl(): string | undefined {
  return (
    process.env.ITAM_DISCOVERY_DATABASE_URL
    || process.env.ITAM_DATABASE_URL
    || undefined
  );
}

export function isPostgresPersistenceRequired(): boolean {
  if (process.env.ITAM_DISCOVERY_PERSISTENCE === 'memory') return false;
  if (process.env.ITAM_DISCOVERY_PERSISTENCE === 'postgres') return true;
  if (process.env.NODE_ENV === 'production') return true;
  return Boolean(getItamDiscoveryDatabaseUrl());
}

export function getDiscoveryPool(): Pool {
  const url = getItamDiscoveryDatabaseUrl();
  if (!url) {
    throw new Error(
      'ITAM_DISCOVERY_DATABASE_URL is required for PostgreSQL discovery persistence',
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

export async function closeDiscoveryPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function applyDiscoverySchema(client?: PoolClient | Pool): Promise<void> {
  const db = client || getDiscoveryPool();
  const basePath = resolve(__dirname, 'sql/itam_discovery_pg.sql');
  const extPath = resolve(__dirname, 'sql/itam_phases_b_d.sql');
  const syncPath = resolve(__dirname, 'sql/itam_form_sync.sql');
  await db.query(readFileSync(basePath, 'utf8'));
  try {
    await db.query(readFileSync(extPath, 'utf8'));
  } catch (e: any) {
    if (!/already exists|duplicate/i.test(String(e?.message || e))) {
      console.warn('ITAM phases B-D schema apply warning:', e?.message || e);
    }
  }
  try {
    await db.query(readFileSync(syncPath, 'utf8'));
  } catch (e: any) {
    if (!/already exists|duplicate/i.test(String(e?.message || e))) {
      console.warn('ITAM form-sync schema apply warning:', e?.message || e);
    }
  }
}

export async function hydrateDiscoveryStore(store: DiscoveryStore): Promise<void> {
  const db = getDiscoveryPool();
  const scopes = await db.query(`SELECT * FROM itam_network_scopes`);
  store.scopes = scopes.rows.map(mapScope);

  const jobs = await db.query(`SELECT * FROM itam_discovery_jobs`);
  store.jobs = jobs.rows.map(mapJob);

  const runs = await db.query(`SELECT * FROM itam_discovery_runs`);
  store.runs = runs.rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    organizationId: r.organization_id,
    status: r.status,
    startedAt: iso(r.started_at),
    finishedAt: r.finished_at ? iso(r.finished_at) : undefined,
    hostsTargeted: r.hosts_targeted || 0,
    hostsScanned: r.hosts_scanned || 0,
    hostsDiscovered: r.hosts_discovered || 0,
    assetsCreated: r.assets_created || 0,
    assetsUpdated: r.assets_updated || 0,
    assetsUnmanaged: r.assets_unmanaged || 0,
    softwareDiscovered: r.software_discovered || 0,
    errors: r.errors || 0,
    metrics: r.metrics || {},
  }));

  const assets = await db.query(`SELECT * FROM it_assets`);
  store.assets = assets.rows.map((a) => ({
    id: a.id,
    organizationId: a.organization_id,
    assetTag: a.asset_tag || undefined,
    displayName: a.display_name,
    hostname: a.hostname || undefined,
    assetType: a.asset_type,
    manufacturer: a.manufacturer || undefined,
    model: a.model || undefined,
    serialNumber: a.serial_number || undefined,
    ipAddress: a.ip_address || undefined,
    macAddress: a.mac_address || undefined,
    biosUuid: a.bios_uuid || undefined,
    machineGuid: a.machine_guid || undefined,
    cloudInstanceId: a.cloud_instance_id || undefined,
    status: a.status,
    discoveryLifecycle: a.discovery_lifecycle || 'MANAGED',
    discoveryConfidence: a.discovery_confidence || undefined,
    primaryDiscoverySource: a.primary_discovery_source || undefined,
    firstSeenAt: a.first_seen_at ? iso(a.first_seen_at) : undefined,
    lastSeenAt: a.last_seen_at ? iso(a.last_seen_at) : undefined,
    customFields: a.custom_fields || {},
    tags: a.tags || {},
  }));

  const hosts = await db.query(`SELECT * FROM itam_discovered_hosts`);
  store.hosts = hosts.rows.map((h) => ({
    id: h.id,
    organizationId: h.organization_id,
    jobId: h.job_id || undefined,
    runId: h.run_id || undefined,
    assetId: h.asset_id || undefined,
    status: h.status,
    confidence: h.confidence,
    ipAddress: h.ip_address || undefined,
    macAddress: h.mac_address || undefined,
    hostname: h.hostname || undefined,
    dnsName: h.dns_name || undefined,
    deviceType: h.device_type || 'UNKNOWN',
    osName: h.os_name || undefined,
    osFamily: h.os_family || undefined,
    osVersion: h.os_version || undefined,
    manufacturer: h.manufacturer || undefined,
    model: h.model || undefined,
    serialNumber: h.serial_number || undefined,
    biosUuid: h.bios_uuid || undefined,
    machineGuid: h.machine_guid || undefined,
    responseTimeMs: h.response_time_ms != null ? Number(h.response_time_ms) : undefined,
    discoveryMethods: h.discovery_methods || [],
    services: h.services || [],
    software: h.software || [],
    fieldProvenance: h.field_provenance || {},
    rawEvidence: h.raw_evidence || {},
    firstSeenAt: iso(h.first_seen_at),
    lastSeenAt: iso(h.last_seen_at),
  }));

  const software = await db.query(`SELECT * FROM asset_software`);
  store.software = software.rows.map((s) => ({
    id: s.id,
    assetId: s.asset_id,
    softwareName: s.software_name,
    version: s.version || undefined,
    publisher: s.publisher || undefined,
    source: s.source || 'NETWORK_DISCOVERY',
    rawName: s.raw_name || undefined,
    rawVersion: s.raw_version || undefined,
    firstSeenAt: iso(s.first_seen_at),
    lastSeenAt: iso(s.last_seen_at),
  }));

  const identities = await db.query(`SELECT * FROM itam_asset_identities`);
  store.identities = identities.rows.map((i) => ({
    id: i.id,
    organizationId: i.organization_id,
    assetId: i.asset_id,
    identityType: i.identity_type,
    identityValue: i.identity_value,
    source: i.source,
    confidence: i.confidence,
  }));

  const diffs = await db.query(`SELECT * FROM itam_discovery_diffs`);
  store.diffs = diffs.rows.map((d) => ({
    id: d.id,
    organizationId: d.organization_id,
    runId: d.run_id || undefined,
    assetId: d.asset_id || undefined,
    changeType: d.change_type,
    detail: d.detail || {},
  }));

  const audits = await db.query(`SELECT * FROM itam_discovery_audit`);
  store.audits = audits.rows.map((a) => ({
    id: a.id,
    organizationId: a.organization_id,
    actorId: a.actor_id || undefined,
    action: a.action,
    entityType: a.entity_type || undefined,
    entityId: a.entity_id || undefined,
    detail: a.detail || {},
    createdAt: iso(a.created_at),
  }));

  const services = await db.query(`SELECT * FROM itam_asset_services`);
  store.services = services.rows.map((s) => ({
    id: s.id,
    organizationId: s.organization_id,
    assetId: s.asset_id,
    port: s.port,
    protocol: s.protocol,
    service: s.service || undefined,
    banner: s.banner || undefined,
    source: s.source,
  }));

  const provenance = await db.query(`SELECT * FROM itam_field_provenance`);
  store.provenance = provenance.rows.map((p) => ({
    id: p.id,
    organizationId: p.organization_id,
    assetId: p.asset_id,
    fieldName: p.field_name,
    fieldValue: p.field_value || undefined,
    source: p.source,
  }));

  const catalog = await db.query(`SELECT * FROM itam_software_catalog`);
  store.catalog = catalog.rows.map((c) => ({
    id: c.id,
    organizationId: c.organization_id || undefined,
    canonicalName: c.canonical_name,
    publisher: c.publisher || undefined,
  }));

  const aliases = await db.query(`SELECT * FROM itam_software_aliases`);
  store.aliases = aliases.rows.map((a) => ({
    id: a.id,
    productId: a.product_id,
    aliasName: a.alias_name,
  }));
}

/** Full replace snapshot flush — safe for LAB/TEST volumes. Serialized to avoid races. */
let flushChain: Promise<void> = Promise.resolve();

export async function flushDiscoveryStore(store: DiscoveryStore): Promise<void> {
  const run = async () => {
    const db = getDiscoveryPool();
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Order matters for FKs
      await client.query('DELETE FROM itam_field_provenance');
      await client.query('DELETE FROM itam_asset_services');
      await client.query('DELETE FROM itam_discovery_diffs');
      await client.query('DELETE FROM itam_discovery_audit');
      await client.query('DELETE FROM itam_software_aliases');
      await client.query('DELETE FROM itam_software_catalog');
      await client.query('DELETE FROM itam_asset_identities');
      await client.query('DELETE FROM asset_software');
      await client.query('DELETE FROM itam_discovered_hosts');
      await client.query('DELETE FROM itam_discovery_runs');
      await client.query('DELETE FROM itam_discovery_jobs');
      await client.query('DELETE FROM itam_network_scopes');
      await client.query('DELETE FROM it_assets');

      for (const s of store.scopes) {
        await client.query(
          `INSERT INTO itam_network_scopes
            (id, organization_id, environment, name, description, cidr, scope_kind,
             authorization_status, enabled, created_by, approved_by, approved_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (organization_id, cidr, scope_kind) DO UPDATE SET
             name = EXCLUDED.name,
             authorization_status = EXCLUDED.authorization_status,
             approved_by = EXCLUDED.approved_by,
             approved_at = EXCLUDED.approved_at,
             updated_at = EXCLUDED.updated_at`,
          [
            s.id, s.organizationId, s.environment, s.name, s.description || null, s.cidr, s.scopeKind,
            s.authorizationStatus, s.enabled, s.createdBy || null, s.approvedBy || null,
            s.approvedAt || null, s.createdAt, s.updatedAt,
          ],
        );
      }

      for (const j of store.jobs) {
        await client.query(
          `INSERT INTO itam_discovery_jobs
            (id, organization_id, environment_id, name, description, status, discovery_mode,
             network_ranges, excluded_ranges, schedule, schedule_cron, max_concurrency, max_hosts,
             timeout_ms, host_timeout_ms, job_timeout_ms, rate_limit_per_sec, credential_reference_id,
             tcp_ports, enable_icmp, enable_tcp, enable_snmp, enable_credentialed, created_by,
             created_at, updated_at, last_run_at, next_run_at, last_error, progress, metrics)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                   $19::jsonb,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30::jsonb,$31::jsonb)`,
          [
            j.id, j.organizationId, j.environmentId, j.name, j.description || null, j.status, j.discoveryMode,
            JSON.stringify(j.networkRanges), JSON.stringify(j.excludedRanges), j.schedule, j.scheduleCron || null,
            j.maxConcurrency, j.maxHosts, j.timeoutMs, j.hostTimeoutMs, j.jobTimeoutMs, j.rateLimitPerSec,
            j.credentialReferenceId || null, JSON.stringify(j.tcpPorts), j.enableIcmp, j.enableTcp,
            j.enableSnmp, j.enableCredentialed, j.createdBy || null, j.createdAt, j.updatedAt,
            j.lastRunAt || null, j.nextRunAt || null, j.lastError || null,
            JSON.stringify(j.progress || {}), JSON.stringify(j.metrics || {}),
          ],
        );
      }

      for (const a of store.assets) {
        await client.query(
          `INSERT INTO it_assets
            (id, organization_id, asset_tag, hostname, display_name, asset_type, manufacturer, model,
             serial_number, status, ip_address, mac_address, bios_uuid, machine_guid, cloud_instance_id,
             discovery_lifecycle, discovery_confidence, primary_discovery_source,
             first_seen_at, last_seen_at, custom_fields, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [
            a.id, a.organizationId, a.assetTag || null, a.hostname || null, a.displayName, a.assetType,
            a.manufacturer || null, a.model || null, a.serialNumber || null, a.status,
            a.ipAddress || null, a.macAddress || null, a.biosUuid || null, a.machineGuid || null,
            a.cloudInstanceId || null,
            a.discoveryLifecycle, a.discoveryConfidence || null, a.primaryDiscoverySource || null,
            a.firstSeenAt || null, a.lastSeenAt || null, JSON.stringify(a.customFields || {}),
            JSON.stringify(a.tags || {}),
          ],
        );
      }

      for (const r of store.runs) {
        await client.query(
          `INSERT INTO itam_discovery_runs
            (id, job_id, organization_id, status, started_at, finished_at, hosts_targeted, hosts_scanned,
             hosts_discovered, assets_created, assets_updated, assets_unmanaged, software_discovered,
             errors, metrics)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
          [
            r.id, r.jobId, r.organizationId, r.status, r.startedAt, r.finishedAt || null,
            r.hostsTargeted, r.hostsScanned, r.hostsDiscovered, r.assetsCreated, r.assetsUpdated,
            r.assetsUnmanaged, r.softwareDiscovered, r.errors, JSON.stringify(r.metrics || {}),
          ],
        );
      }

      for (const h of store.hosts) {
        await client.query(
          `INSERT INTO itam_discovered_hosts
            (id, organization_id, job_id, run_id, asset_id, status, confidence, ip_address, mac_address,
             hostname, dns_name, device_type, os_name, os_family, os_version, manufacturer, model,
             serial_number, bios_uuid, machine_guid, response_time_ms, discovery_methods, services,
             software, field_provenance, raw_evidence, first_seen_at, last_seen_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                   $23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27,$28)`,
          [
            h.id, h.organizationId, h.jobId || null, h.runId || null, h.assetId || null, h.status,
            h.confidence, h.ipAddress || null, h.macAddress || null, h.hostname || null, h.dnsName || null,
            h.deviceType, h.osName || null, h.osFamily || null, h.osVersion || null, h.manufacturer || null,
            h.model || null, h.serialNumber || null, h.biosUuid || null, h.machineGuid || null,
            h.responseTimeMs ?? null, h.discoveryMethods || [], JSON.stringify(h.services || []),
            JSON.stringify(h.software || []), JSON.stringify(h.fieldProvenance || {}),
            JSON.stringify(h.rawEvidence || {}), h.firstSeenAt, h.lastSeenAt,
          ],
        );
      }

      for (const s of store.software) {
        await client.query(
          `INSERT INTO asset_software
            (id, asset_id, software_name, version, publisher, source, raw_name, raw_version, first_seen_at, last_seen_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (asset_id, software_name, version) DO UPDATE
             SET last_seen_at = EXCLUDED.last_seen_at, source = EXCLUDED.source`,
          [
            s.id, s.assetId, s.softwareName, s.version || null, s.publisher || null, s.source,
            s.rawName || null, s.rawVersion || null, s.firstSeenAt, s.lastSeenAt,
          ],
        );
      }

      for (const i of store.identities) {
        await client.query(
          `INSERT INTO itam_asset_identities
            (id, organization_id, asset_id, identity_type, identity_value, source, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (organization_id, identity_type, identity_value) DO UPDATE
             SET asset_id = EXCLUDED.asset_id, last_seen_at = now()`,
          [i.id, i.organizationId, i.assetId, i.identityType, i.identityValue, i.source, i.confidence],
        );
      }

      for (const d of store.diffs) {
        await client.query(
          `INSERT INTO itam_discovery_diffs (id, organization_id, run_id, asset_id, change_type, detail)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
          [d.id, d.organizationId, d.runId || null, d.assetId || null, d.changeType, JSON.stringify(d.detail || {})],
        );
      }

      for (const a of store.audits) {
        await client.query(
          `INSERT INTO itam_discovery_audit
            (id, organization_id, actor_id, action, entity_type, entity_id, detail, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
           ON CONFLICT (id) DO NOTHING`,
          [
            a.id, a.organizationId, a.actorId || null, a.action, a.entityType || null,
            a.entityId || null, JSON.stringify(a.detail || {}), a.createdAt,
          ],
        );
      }

      for (const s of store.services) {
        await client.query(
          `INSERT INTO itam_asset_services
            (id, organization_id, asset_id, port, protocol, service, banner, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (asset_id, port, protocol) DO UPDATE SET last_seen_at = now()`,
          [s.id, s.organizationId, s.assetId, s.port, s.protocol, s.service || null, s.banner || null, s.source],
        );
      }

      for (const p of store.provenance) {
        await client.query(
          `INSERT INTO itam_field_provenance
            (id, organization_id, asset_id, field_name, field_value, source)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (asset_id, field_name) DO UPDATE
             SET field_value = EXCLUDED.field_value, source = EXCLUDED.source, observed_at = now()`,
          [p.id, p.organizationId, p.assetId, p.fieldName, p.fieldValue || null, p.source],
        );
      }

      for (const c of store.catalog) {
        await client.query(
          `INSERT INTO itam_software_catalog (id, organization_id, canonical_name, publisher)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (organization_id, canonical_name) DO NOTHING`,
          [c.id, c.organizationId || null, c.canonicalName, c.publisher || null],
        );
      }

      for (const a of store.aliases) {
        await client.query(
          `INSERT INTO itam_software_aliases (id, product_id, alias_name)
           VALUES ($1,$2,$3)
           ON CONFLICT (product_id, alias_name) DO NOTHING`,
          [a.id, a.productId, a.aliasName],
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const next = flushChain.then(run, run);
  flushChain = next.then(() => undefined, () => undefined);
  return next;
}

function iso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function mapScope(r: any): NetworkScope {
  return {
    id: r.id,
    organizationId: r.organization_id,
    environment: r.environment,
    name: r.name,
    description: r.description || undefined,
    cidr: r.cidr,
    scopeKind: r.scope_kind,
    authorizationStatus: r.authorization_status,
    enabled: r.enabled,
    createdBy: r.created_by || undefined,
    approvedBy: r.approved_by || undefined,
    approvedAt: r.approved_at ? iso(r.approved_at) : undefined,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function mapJob(r: any): DiscoveryJob {
  return {
    id: r.id,
    organizationId: r.organization_id,
    environmentId: r.environment_id,
    name: r.name,
    description: r.description || undefined,
    status: r.status,
    discoveryMode: r.discovery_mode,
    networkRanges: r.network_ranges || [],
    excludedRanges: r.excluded_ranges || [],
    schedule: r.schedule || 'ON_DEMAND',
    scheduleCron: r.schedule_cron || undefined,
    maxConcurrency: r.max_concurrency,
    maxHosts: r.max_hosts,
    timeoutMs: r.timeout_ms,
    hostTimeoutMs: r.host_timeout_ms,
    jobTimeoutMs: r.job_timeout_ms,
    rateLimitPerSec: Number(r.rate_limit_per_sec),
    credentialReferenceId: r.credential_reference_id || undefined,
    tcpPorts: r.tcp_ports || [22, 80, 443],
    enableIcmp: r.enable_icmp,
    enableTcp: r.enable_tcp,
    enableSnmp: r.enable_snmp,
    enableCredentialed: r.enable_credentialed,
    createdBy: r.created_by || undefined,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    lastRunAt: r.last_run_at ? iso(r.last_run_at) : undefined,
    nextRunAt: r.next_run_at ? iso(r.next_run_at) : undefined,
    lastError: r.last_error || undefined,
    progress: r.progress || {},
    metrics: r.metrics || {},
  };
}
