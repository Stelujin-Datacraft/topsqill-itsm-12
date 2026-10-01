# ITAM Phases B–D Readiness

**Branch:** `cursor/itam-phases-b-d-e654`  
**Date:** 2026-09-30  
**Overall: PARTIALLY VALIDATED**

Evidence: `docs/evidence/itam-phases-b-d.json`

> **Vulnerability Management is intentionally excluded from this phase and will be implemented as a separate module.**

---

## 1. Architecture

Extends Phase A (Network Discovery) without rewriting it:

```
Network Discovery (A) + Cloud/VMware (B) + Passive (C) + Topology (D)
                         ↓
                 Asset Correlation (shared)
                         ↓
                   ITAM Asset SoR (it_assets)
                         ↓
                 Relationships / Topology Edges
```

- Reuses: DiscoveryStore, correlation, SecretProvider refs, RBAC, audit, metrics, Nest `/api/itam` patterns, PostgreSQL persistence.
- Does **not** create a second asset inventory.
- Does **not** implement vulnerability scanning/CVE.

---

## 2. Database migrations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260930130000_itam_phases_b_d.sql` | Supabase |
| `backend/src/itam/discovery/sql/itam_phases_b_d.sql` | Nest dedicated PG |

Tables: cloud providers/accounts/resources/jobs/changes; telemetry sources; network observations; IP/MAC history; passive events; topology nodes/edges/history.

Applied and verified on local `itam_discovery` database. Restart hydrate **PASS**.

---

## 3–6. Cloud / VMware status

| Provider | Implemented | Unit Tested | Integration Tested | Real Environment Tested | Production Ready |
|----------|-------------|-------------|--------------------|-------------------------|------------------|
| AWS | YES | YES (mock) | YES (mock pipeline) | **NO** | **NO** |
| Azure | YES | YES (mock) | YES (mock pipeline) | **NO** | **NO** |
| GCP | YES | YES (mock) | YES (mock pipeline) | **NO** | **NO** |
| VMware | YES | YES (mock) | YES (mock pipeline) | **NO** | **NO** |

Mock suite verified: auth failure classification, pagination-ready drafts, normalization, correlation with agent (single asset by serial), duplicate prevention, change detection (`NEW_RESOURCE`), tags, tenant isolation, credentialReferenceId-only hygiene.

Live SDK paths exist (`AwsSdkDiscoveryProvider`, etc.) but refuse live calls without `ITAM_*_LIVE=1` + credentials → **NOT TESTED**.

---

## 7–11. Passive status

| Provider | Implemented | Unit / Integration | Real Environment | Production Ready |
|----------|-------------|--------------------|------------------|------------------|
| DHCP | YES | PASS (mock) | **NOT TESTED** | NO |
| ARP | YES | PASS (mock) | **NOT TESTED** | NO |
| DNS | YES | PASS (mock) | **NOT TESTED** | NO |
| Switch MAC | YES | PASS (mock) | **NOT TESTED** | NO |
| Wireless | YES (abstraction) | PASS (mock) | **NOT TESTED** | NO |

Verified: out-of-scope rejection, IP change events + history, duplicate observation handling, tenant isolation.

---

## 12. Topology status

| Capability | Status |
|------------|--------|
| TopologyNode / TopologyEdge model | Implemented |
| Switch→host, switch→switch (LLDP), cloud hierarchy, VMware hierarchy | PASS (mock) |
| Confidence HIGH/MEDIUM/LOW | Implemented |
| History LINK_ADDED / LINK_REMOVED | PASS |
| Bounded neighbors / path APIs | Implemented |
| Real LLDP/CDP/SNMP | **NOT TESTED** |

---

## 13. Asset correlation

- Extended signals: `cloudInstanceId` (weight 75)
- AWS EC2 + agent serial → **one** ITAM asset
- Passive MAC/hostname correlates into existing assets
- IP-only remains LOW / unmanaged

---

## 14. Persistence

PostgreSQL write-through + hydrate for Phase A and B–D tables. Production memory store remains forbidden. Suite `phases_bd_persistence=PASS`.

---

## 15–17. Security / RBAC / Tenancy

| Control | Result |
|---------|--------|
| Secrets in jobs/providers/audit | Reference IDs only — PASS |
| Cross-tenant cloud/passive/topology | Isolated — PASS |
| Admin RBAC for configure/run | Enforced (same Phase A roles) |
| Unauthorized CIDR / out-of-scope telemetry | Rejected |

---

## 18. Test results

```bash
cd backend
npm run test:itam:discovery          # Phase A — 22 PASS
npm run test:itam:phases-bd          # B–D mock — PASS
npm run test:itam:phases-bd:persist  # B–D + Postgres — PASS
```

---

## 19. Performance

Mock observation ingest measured in suite only. **Not** real cloud API or network telemetry throughput. Do not cite as production capacity.

---

## 20–21. Real provider / NOT TESTED

- Real AWS / Azure / GCP / VMware APIs: **NOT TESTED**
- Real DHCP/ARP/DNS/switch feeds: **NOT TESTED**
- Real LLDP/CDP: **NOT TESTED**

---

## 22. Known limitations

1. Cloud SDKs not bundled; live providers gated and empty without sandbox flags.
2. Flush remains full-snapshot (LAB/TEST scale).
3. Topology UI is list/bounded graph (not a full canvas renderer).
4. Wireless is abstraction-level only.
5. No vulnerability management (by design).

---

## 23. Future work

- Authorized sandbox live AWS/Azure/GCP/VMware runs
- Production DHCP/ARP/DNS/NMS connectors
- Incremental upsert persistence
- Richer topology visualization with lazy subgraphs
- Separate Vulnerability Management module consuming ITAM SoR

---

## Status summary

| Phase | Status |
|-------|--------|
| **PHASE B** | IMPLEMENTED — MOCK VALIDATED; REAL PROVIDERS NOT TESTED |
| **PHASE C** | IMPLEMENTED — MOCK VALIDATED; REAL TELEMETRY NOT TESTED |
| **PHASE D** | IMPLEMENTED — MOCK VALIDATED; REAL LLDP/CDP NOT TESTED |
| **OVERALL ITAM** | **PARTIALLY VALIDATED** (Phase A + B–D architecture; production cloud/passive/topology require authorized lab) |

Vulnerability Management is intentionally excluded from this phase and will be implemented as a separate module.
