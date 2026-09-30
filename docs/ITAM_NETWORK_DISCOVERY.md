# ITAM Network Discovery

**Branch:** `cursor/itam-network-discovery-e654`  
**Date:** 2026-09-30

Enterprise network discovery for authorized ranges. Extends existing IT Asset Management — **does not replace or rewrite the agent/script**.

Evidence: `docs/evidence/itam-network-discovery.json`

---

## 1. Architecture

```
Approved NetworkScope (CIDR)
        ↓
DiscoveryJob (mode, limits, credentialReferenceId)
        ↓
DiscoveryEngine (bounded worker pool)
        ↓
Providers: MOCK | ICMP | TCP | SNMP | WinRM | SSH
        ↓
Normalization + Device classification
        ↓
Deterministic Asset Correlation (multi-signal)
        ↓
Existing it_assets (SoR) + asset_software + identities
        ↓
Optional explicit agent onboarding approval
```

No second asset database. Agent ingest (`POST /api/itam/agent-report`) unchanged.

## 2. Database changes

Migration: `supabase/migrations/20260930120000_itam_network_discovery.sql`

- Extends `it_assets` / `asset_software` with discovery lifecycle & multi-source fields
- Adds: `itam_network_scopes`, `itam_discovery_jobs`, `itam_discovery_runs`,
  `itam_discovered_hosts`, `itam_asset_identities`, `itam_software_catalog`,
  `itam_software_aliases`, `itam_discovery_diffs`, `itam_discovery_audit`,
  `itam_asset_services`, `itam_field_provenance`
- RLS org-scoped on all new tables

## 3. Discovery providers

| Provider | Kind | Notes |
|----------|------|-------|
| MockNetworkDiscoveryProvider | MOCK | Lab/tests |
| IcmpDiscoveryProvider | ICMP | Controlled ping; scope-enforced |
| TcpDiscoveryProvider | TCP | Connect + short banner; no exploit payloads |
| SnmpDiscoveryProvider | SNMP | Credential ref only |
| WindowsInventoryProvider | WINRM | Credential ref only |
| LinuxInventoryProvider | SSH | Credential ref only |
| CloudAssetDiscoveryStub | AWS/Azure/GCP | Interface for future |

## 4. Network discovery flow

Validate approved scopes → expand CIDRs (maxHosts) → exclude ranges → private-network policy → concurrent host discovery → service checks → optional credentialed inventory → correlate → upsert `it_assets` → software/services/provenance/diffs/audit.

## 5. Asset correlation

Signals (weights): agentId 100, machineGuid 90, biosUuid 85, serial 80, MAC 50, hostname 30, IP 10.

- Serial / GUID → HIGH → UPDATE existing
- MAC + hostname → MEDIUM
- IP only → LOW → CREATE unmanaged (`discovery_lifecycle=DISCOVERED`)
- Never create duplicate when serial matches

## 6. Software inventory flow

Credentialed/agent/SNMP sources → keep `rawName`/`rawVersion` → map via `itam_software_catalog` + aliases → store on `asset_software` with `source`. Detect `SOFTWARE_VERSION_CHANGED` diffs.

## 7. Credentialed discovery

`credentialReferenceId` on jobs only. Secrets via `__ITAM_SECRET_MAP` / SecretProvider — never in job JSON, logs, or AI prompts. Auth failures are not aggressively retried.

## 8. Agent integration

Existing Agents tab + `agent-report` unchanged. Network-discovered assets can receive **explicit** `approve-agent-onboarding` (no silent install). `mergeAgentEvidence` merges AGENT + NETWORK sources into one asset.

## 9. UI changes

`/it-assets` → new **Network Discovery** tab (`NetworkDiscoveryPanel`): dashboard, scopes, jobs, discovered assets, unmanaged guidance.

## 10. API changes

Under `/api/itam`:

- `POST/GET /network-scopes`, `POST .../approve`
- `POST/GET /discovery/jobs`, `.../validate|estimate|start|pause|resume|cancel`
- `GET /discovered-assets`, `/unmanaged-assets`, `/software`, `/assets/:id/software`
- `POST /assets/:id/verify|ignore|approve-agent-onboarding`
- `GET /discovery/dashboard`, `/discovery/metrics`

Agent route `POST /api/itam/agent-report` preserved.

## 11. Security controls

- APPROVED scope required per CIDR
- Exclude ranges honored
- Private IPv4 policy (fail-closed for public)
- maxHosts / concurrency / rate limits
- RBAC: ITAM admin for scope/job/start/onboarding
- Tenant isolation by `organizationId`
- No credential embedding

## 12. Audit controls

`scope_created/approved`, `discovery_started/paused/stopped/completed`, `asset_discovered/verified/ignored/merged`, `agent_deployment_approved`.

## 13. Metrics

`discovery_jobs_*`, `hosts_scanned/discovered_total`, `assets_created/updated/unmanaged_total`, `software_discovered_total`, `discovery_errors_total`, plus per-run latency.

## 14. Tests

`npm run test:itam:discovery` — 22 PASS (scope, fail-closed, correlation, software, agent merge, RBAC, cancel, perf mock /24, secrets).

## 15. Actual performance results (mock lab)

| Metric | Value |
|--------|-------|
| `/24` mock scan duration | **2 ms** (measured) |
| Hosts scanned | **254** |
| Hosts discovered (seeded) | **20** |
| hosts/sec | **127000** (mock — not a real network) |

**Do not treat mock hosts/sec as production capacity.** Real ICMP/TCP rates depend on network and configured `rateLimitPerSec`.

## 16. Known limitations

- Live ICMP/WinRM/SSH/SNMP against customer networks not run in CI (LAB mock only)
- In-process DiscoveryStore used by Nest service today; apply SQL migration for durable multi-instance SoR sync
- Cloud/VMware providers are stubs
- Full topology mapping deferred
- Agent offline cron not part of this change

## 17. Future providers

AWS / Azure / GCP inventory, VMware/Hyper-V, DHCP/ARP/DNS passive feeds, SNMP walk for MAC tables.

## 18. Commands

```bash
# Apply schema (Supabase)
# supabase db push   # or run migration 20260930120000_itam_network_discovery.sql

cd backend
npm run test:itam:discovery

# Optional: start API and open /it-assets → Network Discovery
```
