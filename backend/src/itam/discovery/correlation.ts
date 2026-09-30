/**
 * Deterministic asset correlation — multi-signal, no AI for identity.
 */
import type {
  AssetIdentitySignal,
  CorrelationResult,
  DiscoveredHostEvidence,
  DiscoveryConfidence,
  InventorySource,
} from './types';

export interface ExistingAssetIdentity {
  assetId: string;
  serialNumber?: string | null;
  macAddress?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  biosUuid?: string | null;
  machineGuid?: string | null;
  agentKey?: string | null;
  discoveryLifecycle?: string | null;
}

const WEIGHTS: Record<AssetIdentitySignal['type'], number> = {
  agentId: 100,
  machineGuid: 90,
  biosUuid: 85,
  serialNumber: 80,
  cloudInstanceId: 75,
  sshHostKey: 70,
  macAddress: 50,
  hostname: 30,
  ipAddress: 10,
};

export function extractSignals(
  evidence: DiscoveredHostEvidence,
  source: InventorySource = 'NETWORK_DISCOVERY',
): AssetIdentitySignal[] {
  const out: AssetIdentitySignal[] = [];
  const add = (type: AssetIdentitySignal['type'], value?: string | null) => {
    const v = String(value || '').trim();
    if (!v) return;
    out.push({ type, value: v.toLowerCase(), source, weight: WEIGHTS[type] });
  };
  add('serialNumber', evidence.serialNumber);
  add('biosUuid', evidence.biosUuid);
  add('machineGuid', evidence.machineGuid);
  add('macAddress', evidence.macAddress);
  add('hostname', evidence.hostname || evidence.dnsName);
  add('ipAddress', evidence.ipAddress);
  return out;
}

export function confidenceFromScore(score: number, matchedTypes: string[]): DiscoveryConfidence {
  if (matchedTypes.includes('serialNumber') && (matchedTypes.includes('biosUuid') || matchedTypes.includes('machineGuid'))) {
    return 'HIGH';
  }
  if (matchedTypes.includes('serialNumber') || matchedTypes.includes('biosUuid') || matchedTypes.includes('machineGuid')) {
    return 'HIGH';
  }
  if (matchedTypes.includes('macAddress') && matchedTypes.includes('hostname')) return 'MEDIUM';
  if (matchedTypes.includes('macAddress') || (matchedTypes.includes('hostname') && score >= 30)) return 'MEDIUM';
  if (matchedTypes.includes('ipAddress') && matchedTypes.length === 1) return 'LOW';
  if (score >= 80) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function correlateDiscoveredHost(
  evidence: DiscoveredHostEvidence,
  existing: ExistingAssetIdentity[],
  source: InventorySource = 'NETWORK_DISCOVERY',
): CorrelationResult {
  const signals = extractSignals(evidence, source);
  let best: { assetId: string; score: number; types: string[] } | null = null;

  for (const asset of existing) {
    let score = 0;
    const types: string[] = [];
    const check = (type: AssetIdentitySignal['type'], assetVal?: string | null) => {
      const av = String(assetVal || '').trim().toLowerCase();
      if (!av) return;
      const sig = signals.find((s) => s.type === type && s.value === av);
      if (sig) {
        score += sig.weight;
        types.push(type);
      }
    };
    check('serialNumber', asset.serialNumber);
    check('biosUuid', asset.biosUuid);
    check('machineGuid', asset.machineGuid);
    check('macAddress', asset.macAddress);
    check('hostname', asset.hostname);
    check('ipAddress', asset.ipAddress);
    check('agentId', asset.agentKey);

    if (!best || score > best.score) best = { assetId: asset.assetId, score, types };
  }

  if (!best || best.score < 30) {
    return {
      matchedAssetId: null,
      confidence: confidenceFromScore(0, []),
      signals,
      action: 'CREATE_UNMANAGED',
    };
  }

  // IP-only match is too weak to update — treat as unmanaged unless stronger signal exists
  if (best.types.length === 1 && best.types[0] === 'ipAddress') {
    return {
      matchedAssetId: null,
      confidence: 'LOW',
      signals,
      action: 'CREATE_UNMANAGED',
    };
  }

  const confidence = confidenceFromScore(best.score, best.types);
  const existingAsset = existing.find((e) => e.assetId === best!.assetId);
  const action =
    existingAsset?.discoveryLifecycle === 'DISCOVERED' || existingAsset?.discoveryLifecycle === 'UNVERIFIED'
      ? 'MERGE'
      : 'UPDATE';

  return {
    matchedAssetId: best.assetId,
    confidence,
    signals,
    action,
  };
}

export function classifyDeviceType(evidence: DiscoveredHostEvidence): string {
  if (evidence.deviceType && evidence.deviceType !== 'UNKNOWN') return evidence.deviceType;
  const ports = new Set((evidence.services || []).map((s) => s.port));
  const os = `${evidence.osFamily || ''} ${evidence.osName || ''}`.toLowerCase();
  if (ports.has(161) && !ports.has(3389) && !ports.has(22)) return 'NETWORK_DEVICE';
  if (ports.has(9100) || /printer/i.test(evidence.hostname || '')) return 'PRINTER';
  if (/router|firewall|switch|ap-|access.?point/i.test(evidence.hostname || '')) return 'NETWORK_DEVICE';
  if (/server|srv/i.test(evidence.hostname || '') || os.includes('server')) return 'SERVER';
  if (os.includes('windows') || os.includes('macos') || os.includes('darwin')) return 'WORKSTATION';
  if (os.includes('linux')) return ports.has(22) && !ports.has(3389) ? 'SERVER' : 'WORKSTATION';
  return 'UNKNOWN';
}
