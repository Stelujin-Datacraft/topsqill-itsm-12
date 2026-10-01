/**
 * Phase D — Topology relationship engine with bounded traversal.
 */
import { randomUUID } from 'crypto';
import type { DiscoveryStore } from '../discovery/store';
import type {
  TopologyConfidence,
  TopologyEdge,
  TopologyHistoryRow,
  TopologyNode,
  TopologyNodeKind,
  TopologyRelationshipType,
  TopologyStoreSlice,
} from './types';

export class TopologyEngine {
  constructor(private readonly store: DiscoveryStore & TopologyStoreSlice) {}

  upsertNode(input: {
    organizationId: string;
    logicalKey: string;
    nodeKind: TopologyNodeKind;
    displayName?: string;
    assetId?: string;
    metadata?: Record<string, unknown>;
  }): TopologyNode {
    const now = new Date().toISOString();
    const existing = this.store.topologyNodes.find(
      (n) => n.organizationId === input.organizationId && n.logicalKey === input.logicalKey,
    );
    if (existing) {
      existing.lastSeenAt = now;
      existing.displayName = input.displayName || existing.displayName;
      existing.assetId = input.assetId || existing.assetId;
      existing.metadata = { ...existing.metadata, ...(input.metadata || {}) };
      return existing;
    }
    const row: TopologyNode = {
      id: randomUUID(),
      organizationId: input.organizationId,
      logicalKey: input.logicalKey,
      nodeKind: input.nodeKind,
      displayName: input.displayName,
      assetId: input.assetId,
      metadata: input.metadata || {},
      firstSeenAt: now,
      lastSeenAt: now,
    };
    this.store.topologyNodes.push(row);
    return row;
  }

  upsertEdge(input: {
    organizationId: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: TopologyRelationshipType;
    source: string;
    confidence: TopologyConfidence;
    metadata?: Record<string, unknown>;
  }): TopologyEdge {
    // Never invent — caller must supply evidence source + confidence
    if (!input.source) throw new Error('Topology edge requires evidence source');
    if (input.confidence === 'LOW' && /infer|guess|subnet.?only/i.test(input.source)) {
      // Allowed but marked LOW — UI must not treat as authoritative
    }
    const now = new Date().toISOString();
    const existing = this.store.topologyEdges.find(
      (e) =>
        e.organizationId === input.organizationId
        && e.sourceNodeId === input.sourceNodeId
        && e.targetNodeId === input.targetNodeId
        && e.relationshipType === input.relationshipType,
    );
    if (existing) {
      existing.lastSeenAt = now;
      existing.confidence = input.confidence;
      existing.source = input.source;
      existing.metadata = { ...existing.metadata, ...(input.metadata || {}) };
      return existing;
    }
    const row: TopologyEdge = {
      id: randomUUID(),
      organizationId: input.organizationId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relationshipType: input.relationshipType,
      source: input.source,
      confidence: input.confidence,
      metadata: input.metadata || {},
      firstSeenAt: now,
      lastSeenAt: now,
    };
    this.store.topologyEdges.push(row);
    this.history(input.organizationId, row.id, 'LINK_ADDED', {
      relationshipType: row.relationshipType,
      source: row.source,
      confidence: row.confidence,
    });
    this.store.audit(input.organizationId, 'topology_relationship_created', {
      entityType: 'topology_edge',
      entityId: row.id,
      detail: { relationshipType: row.relationshipType, confidence: row.confidence, source: row.source },
    });
    return row;
  }

  removeEdge(organizationId: string, edgeId: string): boolean {
    const idx = this.store.topologyEdges.findIndex((e) => e.id === edgeId && e.organizationId === organizationId);
    if (idx < 0) return false;
    const [edge] = this.store.topologyEdges.splice(idx, 1);
    this.history(organizationId, edgeId, 'LINK_REMOVED', { relationshipType: edge.relationshipType });
    this.store.audit(organizationId, 'topology_relationship_removed', {
      entityType: 'topology_edge',
      entityId: edgeId,
      detail: { relationshipType: edge.relationshipType },
    });
    return true;
  }

  /**
   * Bounded BFS neighbor expansion — never loads entire enterprise graph.
   */
  neighbors(
    organizationId: string,
    nodeId: string,
    opts?: {
      depth?: number;
      maxNodes?: number;
      relationshipTypes?: TopologyRelationshipType[];
      minConfidence?: TopologyConfidence;
      includeLowConfidence?: boolean;
    },
  ): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
    const depth = Math.min(opts?.depth ?? 1, 5);
    const maxNodes = Math.min(opts?.maxNodes ?? 200, 500);
    const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const minConf = confRank[opts?.minConfidence || (opts?.includeLowConfidence ? 'LOW' : 'MEDIUM')];

    const start = this.store.topologyNodes.find((n) => n.id === nodeId && n.organizationId === organizationId);
    if (!start) return { nodes: [], edges: [] };

    const nodeMap = new Map<string, TopologyNode>();
    const edgeMap = new Map<string, TopologyEdge>();
    nodeMap.set(start.id, start);
    let frontier = [start.id];

    for (let d = 0; d < depth && nodeMap.size < maxNodes; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        const edges = this.store.topologyEdges.filter((e) => {
          if (e.organizationId !== organizationId) return false;
          if (e.sourceNodeId !== id && e.targetNodeId !== id) return false;
          if (opts?.relationshipTypes?.length && !opts.relationshipTypes.includes(e.relationshipType)) return false;
          if (confRank[e.confidence] < minConf) return false;
          return true;
        });
        for (const e of edges) {
          edgeMap.set(e.id, e);
          const otherId = e.sourceNodeId === id ? e.targetNodeId : e.sourceNodeId;
          if (!nodeMap.has(otherId) && nodeMap.size < maxNodes) {
            const n = this.store.topologyNodes.find((x) => x.id === otherId && x.organizationId === organizationId);
            if (n) {
              nodeMap.set(n.id, n);
              next.push(n.id);
            }
          }
        }
      }
      frontier = next;
    }

    return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
  }

  /** Simple bidirectional BFS path — bounded. */
  path(
    organizationId: string,
    fromNodeId: string,
    toNodeId: string,
    opts?: { maxDepth?: number; includeLowConfidence?: boolean },
  ): { path: string[]; edges: TopologyEdge[] } | null {
    const maxDepth = Math.min(opts?.maxDepth ?? 8, 12);
    const confOk = (c: TopologyConfidence) => opts?.includeLowConfidence || c !== 'LOW';
    const parent = new Map<string, { via: string; edgeId: string }>();
    const q = [fromNodeId];
    const seen = new Set([fromNodeId]);
    let found = false;

    while (q.length && !found) {
      const id = q.shift()!;
      const depth = pathDepth(parent, id);
      if (depth >= maxDepth) continue;
      for (const e of this.store.topologyEdges) {
        if (e.organizationId !== organizationId) continue;
        if (!confOk(e.confidence)) continue;
        if (e.sourceNodeId !== id && e.targetNodeId !== id) continue;
        const other = e.sourceNodeId === id ? e.targetNodeId : e.sourceNodeId;
        if (seen.has(other)) continue;
        seen.add(other);
        parent.set(other, { via: id, edgeId: e.id });
        if (other === toNodeId) {
          found = true;
          break;
        }
        q.push(other);
      }
    }

    if (!found && fromNodeId !== toNodeId) return null;
    if (fromNodeId === toNodeId) return { path: [fromNodeId], edges: [] };

    const pathIds: string[] = [toNodeId];
    const edgeIds: string[] = [];
    let cur = toNodeId;
    while (cur !== fromNodeId) {
      const p = parent.get(cur);
      if (!p) return null;
      edgeIds.push(p.edgeId);
      pathIds.push(p.via);
      cur = p.via;
    }
    pathIds.reverse();
    edgeIds.reverse();
    const edges = edgeIds
      .map((id) => this.store.topologyEdges.find((e) => e.id === id)!)
      .filter(Boolean);
    return { path: pathIds, edges };
  }

  /** Build switch→host from MAC table observation evidence. */
  linkSwitchHost(input: {
    organizationId: string;
    switchId: string;
    switchName?: string;
    port: string;
    vlan?: string;
    macAddress: string;
    assetId?: string;
    source?: string;
  }): TopologyEdge {
    const sw = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `switch:${input.switchId}`,
      nodeKind: 'SWITCH',
      displayName: input.switchName || input.switchId,
      metadata: { switchId: input.switchId },
    });
    const port = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `switch:${input.switchId}:port:${input.port}`,
      nodeKind: 'SWITCH_PORT',
      displayName: `${input.switchId}:${input.port}`,
      metadata: { port: input.port, vlan: input.vlan, mac: input.macAddress },
    });
    this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: sw.id,
      targetNodeId: port.id,
      relationshipType: 'ATTACHED_TO',
      source: input.source || 'SWITCH_MAC',
      confidence: 'HIGH',
      metadata: { vlan: input.vlan },
    });
    const hostKey = input.assetId ? `asset:${input.assetId}` : `mac:${input.macAddress.toLowerCase()}`;
    const host = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: hostKey,
      nodeKind: 'ASSET',
      assetId: input.assetId,
      displayName: input.macAddress,
      metadata: { macAddress: input.macAddress },
    });
    return this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: port.id,
      targetNodeId: host.id,
      relationshipType: 'CONNECTED_TO',
      source: input.source || 'SWITCH_MAC',
      confidence: 'HIGH',
      metadata: { macAddress: input.macAddress, vlan: input.vlan },
    });
  }

  /** Cloud VPC → subnet → NIC → compute */
  linkCloudHierarchy(input: {
    organizationId: string;
    provider: string;
    accountKey: string;
    vpcId: string;
    subnetId: string;
    nicId?: string;
    computeResourceId: string;
    assetId?: string;
    source: string;
  }) {
    const account = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `cloud:${input.provider}:account:${input.accountKey}`,
      nodeKind: 'CLOUD_ACCOUNT',
      displayName: input.accountKey,
    });
    const vpc = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `cloud:${input.provider}:vpc:${input.vpcId}`,
      nodeKind: input.provider === 'AZURE' ? 'VNET' : 'VPC',
      displayName: input.vpcId,
    });
    const subnet = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `cloud:${input.provider}:subnet:${input.subnetId}`,
      nodeKind: 'SUBNET',
      displayName: input.subnetId,
    });
    this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: account.id,
      targetNodeId: vpc.id,
      relationshipType: 'BELONGS_TO',
      source: input.source,
      confidence: 'HIGH',
    });
    // Invert BELONGS_TO direction for readability: VPC belongs to account already;
    // also LOCATED_IN subnet in VPC
    this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: subnet.id,
      targetNodeId: vpc.id,
      relationshipType: 'LOCATED_IN',
      source: input.source,
      confidence: 'HIGH',
    });
    let attachTo = subnet.id;
    if (input.nicId) {
      const nic = this.upsertNode({
        organizationId: input.organizationId,
        logicalKey: `cloud:${input.provider}:nic:${input.nicId}`,
        nodeKind: 'NIC',
        displayName: input.nicId,
      });
      this.upsertEdge({
        organizationId: input.organizationId,
        sourceNodeId: nic.id,
        targetNodeId: subnet.id,
        relationshipType: 'ATTACHED_TO',
        source: input.source,
        confidence: 'HIGH',
      });
      attachTo = nic.id;
    }
    const compute = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `cloud:${input.provider}:compute:${input.computeResourceId}`,
      nodeKind: 'ASSET',
      assetId: input.assetId,
      displayName: input.computeResourceId,
    });
    return this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: compute.id,
      targetNodeId: attachTo,
      relationshipType: 'ATTACHED_TO',
      source: input.source,
      confidence: 'HIGH',
    });
  }

  /** VMware: vCenter → DC → Cluster → ESXi → VM */
  linkVmwareHierarchy(input: {
    organizationId: string;
    vcenter: string;
    datacenter: string;
    cluster: string;
    esxiHost: string;
    vmId: string;
    assetId?: string;
    networkId?: string;
    source?: string;
  }) {
    const source = input.source || 'VMWARE';
    const vc = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `vmware:vcenter:${input.vcenter}`,
      nodeKind: 'VCENTER',
      displayName: input.vcenter,
    });
    const dc = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `vmware:dc:${input.datacenter}`,
      nodeKind: 'DATACENTER',
      displayName: input.datacenter,
    });
    const cluster = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `vmware:cluster:${input.cluster}`,
      nodeKind: 'CLUSTER',
      displayName: input.cluster,
    });
    const host = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `vmware:esxi:${input.esxiHost}`,
      nodeKind: 'ESXI_HOST',
      displayName: input.esxiHost,
    });
    const vm = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `vmware:vm:${input.vmId}`,
      nodeKind: 'ASSET',
      assetId: input.assetId,
      displayName: input.vmId,
    });
    this.upsertEdge({ organizationId: input.organizationId, sourceNodeId: dc.id, targetNodeId: vc.id, relationshipType: 'BELONGS_TO', source, confidence: 'HIGH' });
    this.upsertEdge({ organizationId: input.organizationId, sourceNodeId: cluster.id, targetNodeId: dc.id, relationshipType: 'MEMBER_OF', source, confidence: 'HIGH' });
    this.upsertEdge({ organizationId: input.organizationId, sourceNodeId: host.id, targetNodeId: cluster.id, relationshipType: 'MEMBER_OF', source, confidence: 'HIGH' });
    this.upsertEdge({ organizationId: input.organizationId, sourceNodeId: vm.id, targetNodeId: host.id, relationshipType: 'HOSTED_ON', source, confidence: 'HIGH' });
    if (input.networkId) {
      const net = this.upsertNode({
        organizationId: input.organizationId,
        logicalKey: `vmware:network:${input.networkId}`,
        nodeKind: 'LOGICAL',
        displayName: input.networkId,
      });
      this.upsertEdge({
        organizationId: input.organizationId,
        sourceNodeId: vm.id,
        targetNodeId: net.id,
        relationshipType: 'CONNECTED_TO',
        source,
        confidence: 'HIGH',
      });
    }
    return vm;
  }

  /** LLDP/CDP neighbor — HIGH confidence only when evidence provided. */
  linkLldpNeighbor(input: {
    organizationId: string;
    localSwitchId: string;
    localPort: string;
    remoteSwitchId: string;
    remotePort: string;
    protocol: 'LLDP' | 'CDP';
  }) {
    const a = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `switch:${input.localSwitchId}:port:${input.localPort}`,
      nodeKind: 'SWITCH_PORT',
      displayName: `${input.localSwitchId}:${input.localPort}`,
    });
    const b = this.upsertNode({
      organizationId: input.organizationId,
      logicalKey: `switch:${input.remoteSwitchId}:port:${input.remotePort}`,
      nodeKind: 'SWITCH_PORT',
      displayName: `${input.remoteSwitchId}:${input.remotePort}`,
    });
    return this.upsertEdge({
      organizationId: input.organizationId,
      sourceNodeId: a.id,
      targetNodeId: b.id,
      relationshipType: 'CONNECTED_TO',
      source: input.protocol,
      confidence: 'HIGH',
      metadata: { protocol: input.protocol },
    });
  }

  private history(
    organizationId: string,
    edgeId: string | undefined,
    changeType: TopologyHistoryRow['changeType'],
    detail: Record<string, unknown>,
  ) {
    this.store.topologyHistory.push({
      id: randomUUID(),
      organizationId,
      edgeId,
      changeType,
      detail,
      createdAt: new Date().toISOString(),
    });
  }
}

function pathDepth(parent: Map<string, { via: string; edgeId: string }>, id: string): number {
  let d = 0;
  let cur = id;
  while (parent.has(cur)) {
    cur = parent.get(cur)!.via;
    d += 1;
    if (d > 100) break;
  }
  return d;
}
