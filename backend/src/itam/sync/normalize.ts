/**
 * Normalize ITAM discovery store assets into flat mapping-ready records.
 */
import { createHash } from 'crypto';
import type { StoredAsset } from '../discovery/store';
import type { NormalizedAsset } from './types';

export function normalizeStoredAsset(
  asset: StoredAsset,
  opts?: { discoverySource?: string; softwareNames?: string[] },
): NormalizedAsset {
  const ipAddresses = asset.ipAddress ? [asset.ipAddress] : [];
  const macAddresses = asset.macAddress ? [asset.macAddress.toLowerCase()] : [];
  const externalId =
    asset.cloudInstanceId
    || asset.machineGuid
    || asset.biosUuid
    || asset.serialNumber
    || asset.id;

  const fields: Record<string, unknown> = {
    externalId,
    assetType: asset.assetType,
    hostname: asset.hostname,
    displayName: asset.displayName,
    primaryIp: asset.ipAddress,
    ipAddress: asset.ipAddress,
    macAddress: asset.macAddress?.toLowerCase(),
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    biosUuid: asset.biosUuid,
    machineGuid: asset.machineGuid,
    cloudInstanceId: asset.cloudInstanceId,
    deviceType: asset.assetType,
    discoveryLifecycle: asset.discoveryLifecycle,
    discoveryConfidence: asset.discoveryConfidence,
    primaryDiscoverySource: asset.primaryDiscoverySource || opts?.discoverySource,
    tagsJson: JSON.stringify(asset.tags || {}),
  };

  // Promote tags as optional flat fields (Environment, Application, Owner)
  for (const [k, v] of Object.entries(asset.tags || {})) {
    fields[`tag_${k}`] = v;
    if (/environment/i.test(k)) fields.environment = v;
    if (/application|app/i.test(k)) fields.application = v;
    if (/owner/i.test(k)) fields.owner = v;
  }

  if (opts?.softwareNames?.length) {
    fields.installedSoftware = opts.softwareNames.join(', ');
  }

  return {
    tenantId: asset.organizationId,
    discoverySource: String(asset.primaryDiscoverySource || opts?.discoverySource || 'NETWORK_DISCOVERY'),
    externalId: String(externalId),
    assetType: asset.assetType,
    hostname: asset.hostname,
    fqdn: asset.hostname,
    ipAddresses,
    macAddresses,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    biosUuid: asset.biosUuid,
    machineGuid: asset.machineGuid,
    cloudInstanceId: asset.cloudInstanceId,
    deviceType: asset.assetType,
    tags: asset.tags || {},
    firstSeen: asset.firstSeenAt,
    lastSeen: asset.lastSeenAt,
    confidence: asset.discoveryConfidence,
    provenance: {
      ...(asset.customFields?.provenance as Record<string, string> || {}),
      assetId: asset.id,
    },
    fields,
  };
}

export function schemaHash(fields: Array<{ name: string; type?: string; required?: boolean }>): string {
  const canonical = fields
    .map((f) => `${f.name}|${f.type || ''}|${f.required ? 1 : 0}`)
    .sort()
    .join(';');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function idempotencyKey(parts: {
  tenantId: string;
  formId: string;
  externalId: string;
  mappingVersion: number;
}): string {
  return `${parts.tenantId}::${parts.formId}::${parts.externalId}::v${parts.mappingVersion}`;
}
