/**
 * Phase B–D PostgreSQL hydrate/flush — extends DiscoveryStore slices.
 */
import type { DiscoveryStore } from './discovery/store';
import { getDiscoveryPool } from './discovery/pg-persistence';

export async function hydratePhasesBD(store: DiscoveryStore): Promise<void> {
  const db = getDiscoveryPool();

  const providers = await db.query(`SELECT * FROM itam_cloud_providers`);
  store.cloudProviders = providers.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    providerType: r.provider_type,
    name: r.name,
    environment: r.environment,
    credentialReferenceId: r.credential_reference_id,
    config: r.config || {},
    status: r.status,
    lastError: r.last_error || undefined,
    lastTestedAt: r.last_tested_at ? new Date(r.last_tested_at).toISOString() : undefined,
    enabled: r.enabled,
    createdBy: r.created_by || undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));

  const accounts = await db.query(`SELECT * FROM itam_cloud_accounts`);
  store.cloudAccounts = accounts.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    providerId: r.provider_id,
    accountKey: r.account_key,
    displayName: r.display_name || undefined,
    regionScope: r.region_scope || [],
    metadata: r.metadata || {},
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const resources = await db.query(`SELECT * FROM itam_cloud_resources`);
  store.cloudResources = resources.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    providerId: r.provider_id,
    accountId: r.account_id || undefined,
    assetId: r.asset_id || undefined,
    providerType: r.provider_type,
    resourceId: r.resource_id,
    resourceArn: r.resource_arn || undefined,
    resourceType: r.resource_type,
    name: r.name || undefined,
    region: r.region || undefined,
    zone: r.zone || undefined,
    status: r.status || undefined,
    tags: r.tags || {},
    networkInfo: r.network_info || {},
    raw: r.raw || {},
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const jobs = await db.query(`SELECT * FROM itam_cloud_discovery_jobs`);
  store.cloudJobs = jobs.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    providerId: r.provider_id,
    name: r.name,
    status: r.status,
    schedule: r.schedule || 'ON_DEMAND',
    scheduleCron: r.schedule_cron || undefined,
    credentialReferenceId: r.credential_reference_id || undefined,
    progress: r.progress || {},
    metrics: r.metrics || {},
    lastError: r.last_error || undefined,
    createdBy: r.created_by || undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : undefined,
  }));

  const changes = await db.query(`SELECT * FROM itam_cloud_changes`);
  store.cloudChanges = changes.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    providerId: r.provider_id || undefined,
    resourceId: r.resource_id || undefined,
    changeType: r.change_type,
    detail: r.detail || {},
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const sources = await db.query(`SELECT * FROM itam_telemetry_sources`);
  store.telemetrySources = sources.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    sourceType: r.source_type,
    name: r.name,
    credentialReferenceId: r.credential_reference_id || undefined,
    authorizedScopes: r.authorized_scopes || [],
    enabled: r.enabled,
    config: r.config || {},
    createdBy: r.created_by || undefined,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));

  const obs = await db.query(`SELECT * FROM itam_network_observations`);
  store.networkObservations = obs.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    sourceId: r.source_id || undefined,
    sourceType: r.source_type,
    assetId: r.asset_id || undefined,
    ipAddress: r.ip_address || undefined,
    macAddress: r.mac_address || undefined,
    hostname: r.hostname || undefined,
    vlan: r.vlan || undefined,
    interfaceName: r.interface_name || undefined,
    switchId: r.switch_id || undefined,
    ssid: r.ssid || undefined,
    recordType: r.record_type || undefined,
    leaseStart: r.lease_start ? new Date(r.lease_start).toISOString() : undefined,
    leaseEnd: r.lease_end ? new Date(r.lease_end).toISOString() : undefined,
    observedAt: new Date(r.observed_at).toISOString(),
    raw: r.raw || {},
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const iph = await db.query(`SELECT * FROM itam_ip_history`);
  store.ipHistory = iph.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    assetId: r.asset_id,
    ipAddress: r.ip_address,
    source: r.source,
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const mach = await db.query(`SELECT * FROM itam_mac_history`);
  store.macHistory = mach.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    assetId: r.asset_id,
    macAddress: r.mac_address,
    source: r.source,
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const pev = await db.query(`SELECT * FROM itam_passive_events`);
  store.passiveEvents = pev.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    assetId: r.asset_id || undefined,
    eventType: r.event_type,
    detail: r.detail || {},
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const nodes = await db.query(`SELECT * FROM itam_topology_nodes`);
  store.topologyNodes = nodes.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    assetId: r.asset_id || undefined,
    logicalKey: r.logical_key,
    nodeKind: r.node_kind,
    displayName: r.display_name || undefined,
    metadata: r.metadata || {},
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const edges = await db.query(`SELECT * FROM itam_topology_edges`);
  store.topologyEdges = edges.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    relationshipType: r.relationship_type,
    source: r.source,
    confidence: r.confidence,
    metadata: r.metadata || {},
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
  }));

  const th = await db.query(`SELECT * FROM itam_topology_history`);
  store.topologyHistory = th.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    edgeId: r.edge_id || undefined,
    changeType: r.change_type,
    detail: r.detail || {},
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function flushPhasesBD(store: DiscoveryStore): Promise<void> {
  const db = getDiscoveryPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM itam_topology_history');
    await client.query('DELETE FROM itam_topology_edges');
    await client.query('DELETE FROM itam_topology_nodes');
    await client.query('DELETE FROM itam_passive_events');
    await client.query('DELETE FROM itam_mac_history');
    await client.query('DELETE FROM itam_ip_history');
    await client.query('DELETE FROM itam_network_observations');
    await client.query('DELETE FROM itam_telemetry_sources');
    await client.query('DELETE FROM itam_cloud_changes');
    await client.query('DELETE FROM itam_cloud_discovery_jobs');
    await client.query('DELETE FROM itam_cloud_resources');
    await client.query('DELETE FROM itam_cloud_accounts');
    await client.query('DELETE FROM itam_cloud_providers');

    for (const p of store.cloudProviders) {
      await client.query(
        `INSERT INTO itam_cloud_providers
          (id, organization_id, provider_type, name, environment, credential_reference_id, config,
           status, last_error, last_tested_at, enabled, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)`,
        [
          p.id, p.organizationId, p.providerType, p.name, p.environment, p.credentialReferenceId,
          JSON.stringify(p.config || {}), p.status, p.lastError || null, p.lastTestedAt || null,
          p.enabled, p.createdBy || null, p.createdAt, p.updatedAt,
        ],
      );
    }
    for (const a of store.cloudAccounts) {
      await client.query(
        `INSERT INTO itam_cloud_accounts
          (id, organization_id, provider_id, account_key, display_name, region_scope, metadata, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
        [
          a.id, a.organizationId, a.providerId, a.accountKey, a.displayName || null,
          JSON.stringify(a.regionScope || []), JSON.stringify(a.metadata || {}), a.firstSeenAt, a.lastSeenAt,
        ],
      );
    }
    for (const r of store.cloudResources) {
      await client.query(
        `INSERT INTO itam_cloud_resources
          (id, organization_id, provider_id, account_id, asset_id, provider_type, resource_id, resource_arn,
           resource_type, name, region, zone, status, tags, network_info, raw, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18)`,
        [
          r.id, r.organizationId, r.providerId, r.accountId || null, r.assetId || null, r.providerType,
          r.resourceId, r.resourceArn || null, r.resourceType, r.name || null, r.region || null, r.zone || null,
          r.status || null, JSON.stringify(r.tags || {}), JSON.stringify(r.networkInfo || {}),
          JSON.stringify(r.raw || {}), r.firstSeenAt, r.lastSeenAt,
        ],
      );
    }
    for (const j of store.cloudJobs) {
      await client.query(
        `INSERT INTO itam_cloud_discovery_jobs
          (id, organization_id, provider_id, name, status, schedule, schedule_cron, credential_reference_id,
           progress, metrics, last_error, created_by, created_at, updated_at, last_run_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)`,
        [
          j.id, j.organizationId, j.providerId, j.name, j.status, j.schedule, j.scheduleCron || null,
          j.credentialReferenceId || null, JSON.stringify(j.progress || {}), JSON.stringify(j.metrics || {}),
          j.lastError || null, j.createdBy || null, j.createdAt, j.updatedAt, j.lastRunAt || null,
        ],
      );
    }
    for (const c of store.cloudChanges) {
      await client.query(
        `INSERT INTO itam_cloud_changes (id, organization_id, provider_id, resource_id, change_type, detail, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [c.id, c.organizationId, c.providerId || null, c.resourceId || null, c.changeType, JSON.stringify(c.detail || {}), c.createdAt],
      );
    }
    for (const s of store.telemetrySources) {
      await client.query(
        `INSERT INTO itam_telemetry_sources
          (id, organization_id, source_type, name, credential_reference_id, authorized_scopes, enabled, config, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11)`,
        [
          s.id, s.organizationId, s.sourceType, s.name, s.credentialReferenceId || null,
          JSON.stringify(s.authorizedScopes || []), s.enabled, JSON.stringify(s.config || {}),
          s.createdBy || null, s.createdAt, s.updatedAt,
        ],
      );
    }
    for (const o of store.networkObservations) {
      await client.query(
        `INSERT INTO itam_network_observations
          (id, organization_id, source_id, source_type, asset_id, ip_address, mac_address, hostname, vlan,
           interface_name, switch_id, ssid, record_type, lease_start, lease_end, observed_at, raw, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)`,
        [
          o.id, o.organizationId, o.sourceId || null, o.sourceType, o.assetId || null, o.ipAddress || null,
          o.macAddress || null, o.hostname || null, o.vlan || null, o.interfaceName || null, o.switchId || null,
          o.ssid || null, o.recordType || null, o.leaseStart || null, o.leaseEnd || null, o.observedAt,
          JSON.stringify(o.raw || {}), o.createdAt,
        ],
      );
    }
    for (const h of store.ipHistory) {
      await client.query(
        `INSERT INTO itam_ip_history (id, organization_id, asset_id, ip_address, source, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (organization_id, asset_id, ip_address, source) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
        [h.id, h.organizationId, h.assetId, h.ipAddress, h.source, h.firstSeenAt, h.lastSeenAt],
      );
    }
    for (const h of store.macHistory) {
      await client.query(
        `INSERT INTO itam_mac_history (id, organization_id, asset_id, mac_address, source, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (organization_id, asset_id, mac_address, source) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
        [h.id, h.organizationId, h.assetId, h.macAddress, h.source, h.firstSeenAt, h.lastSeenAt],
      );
    }
    for (const e of store.passiveEvents) {
      await client.query(
        `INSERT INTO itam_passive_events (id, organization_id, asset_id, event_type, detail, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [e.id, e.organizationId, e.assetId || null, e.eventType, JSON.stringify(e.detail || {}), e.createdAt],
      );
    }
    for (const n of store.topologyNodes) {
      await client.query(
        `INSERT INTO itam_topology_nodes
          (id, organization_id, asset_id, logical_key, node_kind, display_name, metadata, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [
          n.id, n.organizationId, n.assetId || null, n.logicalKey, n.nodeKind, n.displayName || null,
          JSON.stringify(n.metadata || {}), n.firstSeenAt, n.lastSeenAt,
        ],
      );
    }
    for (const e of store.topologyEdges) {
      await client.query(
        `INSERT INTO itam_topology_edges
          (id, organization_id, source_node_id, target_node_id, relationship_type, source, confidence, metadata, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [
          e.id, e.organizationId, e.sourceNodeId, e.targetNodeId, e.relationshipType, e.source, e.confidence,
          JSON.stringify(e.metadata || {}), e.firstSeenAt, e.lastSeenAt,
        ],
      );
    }
    for (const h of store.topologyHistory) {
      const edgeStillExists = h.edgeId
        ? store.topologyEdges.some((e) => e.id === h.edgeId)
        : false;
      await client.query(
        `INSERT INTO itam_topology_history (id, organization_id, edge_id, change_type, detail, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [
          h.id,
          h.organizationId,
          edgeStillExists ? h.edgeId : null,
          h.changeType,
          JSON.stringify(h.detail || {}),
          h.createdAt,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
