/**
 * Phase C — Passive network intelligence types & providers.
 */
import type { InventorySource } from '../discovery/types';

export type TelemetrySourceType = 'DHCP' | 'ARP' | 'DNS' | 'SWITCH_MAC' | 'WIRELESS' | 'NMS';

export type PassiveEventType =
  | 'NEW_NETWORK_OBSERVATION'
  | 'IP_CHANGED'
  | 'MAC_CHANGED'
  | 'HOSTNAME_CHANGED'
  | 'ASSET_SEEN'
  | 'ASSET_NOT_SEEN';

export interface TelemetrySource {
  id: string;
  organizationId: string;
  sourceType: TelemetrySourceType;
  name: string;
  credentialReferenceId?: string;
  authorizedScopes: string[];
  enabled: boolean;
  config: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkObservation {
  id: string;
  organizationId: string;
  sourceId?: string;
  sourceType: TelemetrySourceType;
  assetId?: string;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  vlan?: string;
  interfaceName?: string;
  switchId?: string;
  ssid?: string;
  recordType?: string;
  leaseStart?: string;
  leaseEnd?: string;
  observedAt: string;
  raw: Record<string, unknown>;
  createdAt: string;
}

export interface IpHistoryRow {
  id: string;
  organizationId: string;
  assetId: string;
  ipAddress: string;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MacHistoryRow {
  id: string;
  organizationId: string;
  assetId: string;
  macAddress: string;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PassiveEvent {
  id: string;
  organizationId: string;
  assetId?: string;
  eventType: PassiveEventType;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface PassiveObservationInput {
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  vlan?: string;
  interfaceName?: string;
  switchId?: string;
  ssid?: string;
  recordType?: string;
  leaseStart?: string;
  leaseEnd?: string;
  observedAt?: string;
  raw?: Record<string, unknown>;
}

export interface IDhcpTelemetryProvider {
  readonly name: string;
  fetchLeases?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export interface IArpTelemetryProvider {
  readonly name: string;
  fetchArpTable?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export interface IDnsTelemetryProvider {
  readonly name: string;
  fetchRecords?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export interface ISwitchMacProvider {
  readonly name: string;
  fetchMacTable?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export interface IWirelessControllerProvider {
  readonly name: string;
  fetchClients?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export interface INetworkManagementProvider {
  readonly name: string;
  fetchInventory?(ctx: { organizationId: string }): Promise<PassiveObservationInput[]>;
}

export class MockDhcpTelemetryProvider implements IDhcpTelemetryProvider {
  readonly name = 'MockDhcpTelemetryProvider';
  constructor(private leases: PassiveObservationInput[] = []) {}
  seed(rows: PassiveObservationInput[]) { this.leases = rows; }
  async fetchLeases() { return this.leases; }
}

export class MockArpTelemetryProvider implements IArpTelemetryProvider {
  readonly name = 'MockArpTelemetryProvider';
  constructor(private rows: PassiveObservationInput[] = []) {}
  seed(rows: PassiveObservationInput[]) { this.rows = rows; }
  async fetchArpTable() { return this.rows; }
}

export class MockDnsTelemetryProvider implements IDnsTelemetryProvider {
  readonly name = 'MockDnsTelemetryProvider';
  constructor(private rows: PassiveObservationInput[] = []) {}
  seed(rows: PassiveObservationInput[]) { this.rows = rows; }
  async fetchRecords() { return this.rows; }
}

export class MockSwitchMacProvider implements ISwitchMacProvider {
  readonly name = 'MockSwitchMacProvider';
  constructor(private rows: PassiveObservationInput[] = []) {}
  seed(rows: PassiveObservationInput[]) { this.rows = rows; }
  async fetchMacTable() { return this.rows; }
}

export class MockWirelessControllerProvider implements IWirelessControllerProvider {
  readonly name = 'MockWirelessControllerProvider';
  constructor(private rows: PassiveObservationInput[] = []) {}
  seed(rows: PassiveObservationInput[]) { this.rows = rows; }
  async fetchClients() { return this.rows; }
}

export function telemetryToInventorySource(t: TelemetrySourceType): InventorySource {
  if (t === 'DHCP') return 'DHCP';
  if (t === 'ARP') return 'ARP';
  if (t === 'DNS') return 'DNS';
  if (t === 'SWITCH_MAC') return 'SWITCH_MAC';
  if (t === 'WIRELESS') return 'WIRELESS';
  return 'MANAGEMENT_API';
}
