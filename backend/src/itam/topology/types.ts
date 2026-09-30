/**
 * Phase D — Topology relationship model.
 * Topology is NOT a second asset inventory.
 */
export type TopologyRelationshipType =
  | 'CONNECTED_TO'
  | 'CONNECTED_VIA'
  | 'HOSTED_ON'
  | 'RUNS_ON'
  | 'MEMBER_OF'
  | 'ATTACHED_TO'
  | 'DEPENDS_ON'
  | 'LOCATED_IN'
  | 'ROUTES_THROUGH'
  | 'BELONGS_TO';

export type TopologyNodeKind =
  | 'ASSET'
  | 'SWITCH'
  | 'SWITCH_PORT'
  | 'VLAN'
  | 'SUBNET'
  | 'VPC'
  | 'VNET'
  | 'NIC'
  | 'CLOUD_ACCOUNT'
  | 'REGION'
  | 'VCENTER'
  | 'DATACENTER'
  | 'CLUSTER'
  | 'ESXI_HOST'
  | 'DATASTORE'
  | 'LOGICAL';

export type TopologyConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TopologyNode {
  id: string;
  organizationId: string;
  assetId?: string;
  logicalKey: string;
  nodeKind: TopologyNodeKind;
  displayName?: string;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface TopologyEdge {
  id: string;
  organizationId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: TopologyRelationshipType;
  source: string;
  confidence: TopologyConfidence;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface TopologyHistoryRow {
  id: string;
  organizationId: string;
  edgeId?: string;
  changeType: 'LINK_ADDED' | 'LINK_REMOVED' | 'PORT_CHANGED' | 'VLAN_CHANGED' | 'HOST_MOVED';
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface TopologyStoreSlice {
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  topologyHistory: TopologyHistoryRow[];
}
