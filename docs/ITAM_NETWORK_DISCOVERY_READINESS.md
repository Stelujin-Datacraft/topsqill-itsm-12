# ITAM Network Discovery — Persistence & Lab Readiness

**Branch:** `cursor/itam-discovery-persistence-e654`  
**Date:** 2026-09-30  
**Classification: PARTIALLY VALIDATED**

Evidence:

- `docs/evidence/itam-discovery-persistence.json`
- Unit suite: `npm run test:itam:discovery` (22 PASS)
- Persistence suite: `npm run test:itam:discovery:persist`

---

## Verdict

| Status | Meaning |
|--------|---------|
| **PARTIALLY VALIDATED** | PostgreSQL persistence is real and restart-hydrate passes. ICMP/TCP validated on authorized loopback only. SSH/WinRM/SNMP enterprise lab devices were **not available** — reported as NOT TESTED. |

**Not PRODUCTION READY.** Do not enable unrestricted production scanning until an authorized enterprise lab validates credentialed providers and multi-host LAN discovery.

**INTERNAL TEST READY** for: Nest + PostgreSQL persistence, scope enforcement, correlation (mock+PG), tenant isolation, cancel persistence, loopback ICMP/TCP.

---

## 1. Database migration result

| Item | Result |
|------|--------|
| Supabase migrations (manual) | `20260930120000_itam_network_discovery.sql`, `20260930130000_itam_phases_b_d.sql`, `20260930140000_itam_form_sync.sql` (verified present; extends core `it_assets` / `asset_software`) |
| Nest dedicated schema | `backend/src/itam/discovery/sql/*.sql` (local/lab DB only; not auto-applied on deployed boots) |
| Applied to | Operator-chosen DB via `ITAM_DISCOVERY_DATABASE_URL` (Dev or Prod Supabase; never auto from this agent) |
| Tables verified | `itam_network_scopes`, `itam_discovery_jobs`, `itam_discovery_runs`, `itam_discovered_hosts`, `itam_asset_identities`, `itam_asset_services`, `itam_software_catalog`, `itam_software_aliases`, `itam_discovery_diffs`, `itam_discovery_audit`, `itam_field_provenance`, `it_assets`, `asset_software` |

**PASS** — schema applied; row counts written and re-read after hydrate.

### Constraints verified

- Primary keys on all discovery tables
- Foreign keys: runs→jobs, hosts→jobs/runs/assets, identities/services/software/provenance→assets, aliases→catalog
- Unique: `(organization_id, identity_type, identity_value)`, `(asset_id, software_name, version)`, `(organization_id, cidr, scope_kind)`, `(asset_id, port, protocol)`, `(asset_id, field_name)`

---

## 2. Persistence result

| Check | Result |
|-------|--------|
| Deployed in-memory store | **Forbidden** on Dev/Prod even if `ITAM_ALLOW_MEMORY_STORE=1` |
| Boot path | `ItamModule.onModuleInit` → postgres when deployed; requires `ITAM_DISCOVERY_DATABASE_URL` |
| Write-through | Serialized `flushDiscoveryStore` after mutations |
| Memory store allowed | Only with `ITAM_DISCOVERY_UNIT_TEST=1` outside deployed environments |

After discovery run, DB contained (example from suite): scopes≥1, jobs≥1, runs≥1, hosts≥1, assets≥1, software≥1, identities, services, audits, diffs, provenance.

---

## 3. Restart recovery result

| Step | Result |
|------|--------|
| Create scope → job → discover → flush | PASS |
| `resetDiscoveryStore` + new service + hydrate | PASS |
| Job / assets / hosts available after “restart” | PASS |
| Cancel status survives flush | PASS (`CANCELLED` in `itam_discovery_jobs`) |
| Redis | Process available (`PONG`); discovery state is **PostgreSQL-backed**, not Redis-dependent for SoR |

---

## 4. Real lab topology

| Component | Availability |
|-----------|--------------|
| Enterprise Windows host | **Unavailable** |
| Enterprise Linux host | **Unavailable** |
| SNMP device | **Unavailable** |
| Authorized loopback | `127.0.0.1/32` (this CI/dev VM only) |
| Lab env vars | `ITAM_LAB_SSH_*`, `ITAM_LAB_WINRM_*`, `ITAM_LAB_SNMP_*`, `ITAM_LAB_CIDR` — **not set** |

**No arbitrary external networks were scanned.**

---

## 5–9. Provider results

| Provider | Result | Notes |
|----------|--------|-------|
| **ICMP** | PASS (loopback) | `127.0.0.1` reachable; ~4 ms latency in suite |
| **TCP** | PASS (loopback) | Open ports observed: 5432, 6379 on localhost |
| **SSH** | **NOT TESTED** — prerequisite unavailable | Need `ITAM_LAB_SSH_HOST` + credential ref |
| **WinRM** | **NOT TESTED** — prerequisite unavailable | Need `ITAM_LAB_WINRM_HOST` + credential ref |
| **SNMP** | **NOT TESTED** — prerequisite unavailable | Need `ITAM_LAB_SNMP_HOST` + credential ref |

---

## 10. Software inventory comparison

| Check | Result |
|-------|--------|
| Mock/credentialed path → `asset_software` + catalog | PASS (unit + PG suite) |
| Windows/Linux real package list vs OS | **NOT TESTED** — no lab VMs |
| Diffs SOFTWARE_ADDED / VERSION_CHANGED / REMOVED | PASS in unit suite; VERSION_CHANGED exercised with PG flush |

---

## 11. Agent / network merge

| Check | Result |
|-------|--------|
| Same serial → one `it_assets` row after agent merge | PASS (DB unique count = 1) |
| Provenance model (AGENT vs NETWORK_DISCOVERY) | Implemented; real dual-source lab **NOT TESTED** |

---

## 12. IP change

| Check | Result |
|-------|--------|
| Same serial after IP change → single asset | PASS |
| Second asset created | No |

---

## 13. Software change

| Check | Result |
|-------|--------|
| Unit: ADDED / VERSION_CHANGED / REMOVED + history | PASS |
| Real package install/upgrade/remove on lab host | **NOT TESTED** |

---

## 14. Unmanaged asset

| Check | Result |
|-------|--------|
| IP-only / weak identity → DISCOVERED / UNMANAGED / LOW | PASS (unit) |
| Silent agent install | Never — explicit `approve-agent-onboarding` only |

---

## 15. Agent onboarding UI

| Check | Result |
|-------|--------|
| Unmanaged tab shows “Agent not installed” | Yes |
| Explicit “Authorize agent install” | Calls `POST /assets/:id/approve-agent-onboarding` |
| Automatic install | `automaticInstall: false` |

---

## 16. Correlation

| Signal | Behavior (unit-tested) |
|--------|------------------------|
| Serial / GUID / agentId | Strong → update existing |
| MAC + hostname | Medium |
| IP only | LOW / unmanaged |
| Reused IP without strong ID | Does not merge distinct assets |

Real multi-host LAN correlation: **NOT TESTED**.

---

## 17. Tenant isolation

| Check | Result |
|-------|--------|
| Tenant B cannot list Tenant A assets via service | PASS |
| Credentials cross-tenant | Fail-closed via org filter + credentialReferenceId only |

---

## 18. Scope enforcement

| Check | Result |
|-------|--------|
| Job CIDR outside approved scopes | Rejected |
| Exclude `10.10.10.100/32` from `10.10.10.0/24` | Host absent from targets |
| Unauthorized range submit | Rejected |

---

## 19. Large-scope safety

| Control | Enforced |
|---------|----------|
| `maxHosts` | Yes |
| `maxConcurrency` | Yes |
| Timeouts / rate limit fields | Yes |
| Large CIDR without confirm | Guarded (`ITAM_DISCOVERY_CONFIRM_LARGE`) |

Unrestricted scan: not launched.

---

## 20. Pause / resume / cancel

| Check | Result |
|-------|--------|
| Cancel → job `CANCELLED` in memory + PostgreSQL | PASS |
| Pause/resume flags + status | Implemented (unit/engine) |
| Long-running multi-host lab pause | **NOT TESTED** (no large lab range) |

---

## 21. Failure recovery

| Scenario | Status |
|----------|--------|
| Missing credential ref | Safe fail (unit) |
| Host timeout / refused | Classified by provider; bounded |
| SSH/WinRM/SNMP real failure | **NOT TESTED** (no lab) |
| DB flush failure | Transaction rollback |
| Worker crash / Redis interrupt | SoR remains in PostgreSQL after hydrate |

Secret leakage: no plaintext passwords in job DB payloads (suite check PASS).

---

## 22. Production database verification

Post-suite query of `itam_discovery` showed durable rows for jobs, runs, hosts, assets, identities, services, software, diffs, audits, provenance. Hydrate after store reset recovered job + assets.

---

## 23. Performance

| Measurement | Value |
|-------------|-------|
| Mock /24 (prior unit) | ~127k hosts/sec — **MOCK ONLY; not real-world** |
| Real enterprise LAN hosts/sec | **NOT TESTED** |
| Loopback ICMP latency (suite) | ~4 ms |
| Credentialed inventory/sec | **NOT TESTED** |

Do **not** cite mock throughput as production performance.

---

## 24. Security

| Control | Result |
|---------|--------|
| Credentials in logs / queue / audit / AI | Reference IDs only; suite found no plaintext secrets in job rows |
| Unauthorized CIDR | Rejected |
| Cross-tenant | Isolated |
| Agent onboarding | Explicit admin action; no silent deploy |
| Fail closed | Default for scopes / production memory / admin role |

---

## 25. Provider readiness matrix

| Provider | Implemented | Unit Tested | Real Lab Tested | Production Ready |
|----------|-------------|-------------|-----------------|------------------|
| MOCK | YES | YES | N/A | TEST-ONLY |
| ICMP | YES | YES | PARTIAL (127.0.0.1) | **NO** |
| TCP | YES | YES | PARTIAL (127.0.0.1 ports) | **NO** |
| SNMP | YES | YES (mock/raw) | **NO** | **NO** |
| SSH | YES | YES (mock/raw) | **NO** | **NO** |
| WinRM | YES | YES (mock/raw) | **NO** | **NO** |

---

## 26. Remaining limitations

1. No Windows / Linux / SNMP lab hosts or credential refs in this environment.
2. Cloud / topology / DHCP / ARP / DNS passive discovery — deferred (by design).
3. Flush is full-snapshot (LAB/TEST volumes); high-churn incremental upsert not yet optimized.
4. Shared Supabase schema must be applied manually (never auto from Nest boot):
   `20260930120000_itam_network_discovery.sql`,
   `20260930130000_itam_phases_b_d.sql`,
   `20260930140000_itam_form_sync.sql`
   (extends existing `it_assets` / `asset_software`). Nest uses `ITAM_DISCOVERY_DATABASE_URL`.
5. Real-world performance and credentialed inventory accuracy remain unproven.

### Deployed Dev / Prod env contract

| Variable | Dev VM | Prod |
|----------|--------|------|
| `NODE_ENV` | `production` (container) | `production` |
| `ENVIRONMENT` | `development` | `production` |
| `ITAM_DISCOVERY_DATABASE_URL` | **Dev** Supabase Postgres URI | **Prod** Supabase Postgres URI |
| `ITAM_DISCOVERY_PERSISTENCE` | `postgres` | `postgres` |
| `ITAM_DISCOVERY_APPLY_SCHEMA` | `0` (default) | `0` (default) |
| `ITAM_DISCOVERY_UNIT_TEST` | unset | unset |

Set the URI from Supabase → Project Settings → Database → Connection string. Never commit secrets; never put Prod credentials on Dev (or the reverse).

### Dev-only migration procedure (manual — agents must not auto-apply)

Symptom if missing: Nest boot fails with a clear schema-incomplete error naming `itam_network_scopes` (etc.), not a silent memory fallback.

1. Confirm core tables already exist on **Dev**: `public.it_assets`, `public.asset_software`, `public.organizations`, and function `public.get_current_user_org_id()`.
2. In Supabase Dashboard (Dev project) → **SQL Editor**, or via CLI linked to Dev only:
   - Apply in order:
     1. `supabase/migrations/20260930120000_itam_network_discovery.sql`
     2. `supabase/migrations/20260930130000_itam_phases_b_d.sql`
     3. `supabase/migrations/20260930140000_itam_form_sync.sql`
3. Prefer `supabase db push` / migration history against the **Dev** project so versions are recorded in `supabase_migrations.schema_migrations`. If you paste SQL manually in the SQL Editor, also record the versions (or re-run through CLI repair) so history stays consistent.
4. Before `uq_asset_software_asset_name_ver` is created, ensure no duplicate `(asset_id, software_name, version)` rows exist (unique index creation will fail otherwise — inspect and dedupe on Dev first).
5. Verify: `\dt public.itam_network_scopes` (or Dashboard table list) shows the new ITAM tables.
6. Restart the Nest backend with `ITAM_DISCOVERY_DATABASE_URL` pointing at Dev. Keep `ITAM_DISCOVERY_APPLY_SCHEMA=0`.
7. Do **not** apply these to Prod from this change set until Dev validation succeeds.

**Known non-blocker / do-not-guess:** core `it_assets.tags` is `TEXT[]`. Migrations must not convert it to `JSONB` without inspecting live values. Nest hydrate coerces `TEXT[]`/`object`; flush skips writing `tags` unless the column is actually `jsonb` (lab schema).

### Enable real lab later

```bash
export ITAM_DISCOVERY_DATABASE_URL=postgresql://...
export ITAM_LAB_CIDR=10.x.y.0/24
export ITAM_LAB_SSH_HOST=...
export ITAM_LAB_SSH_CREDENTIAL_REF=...
export ITAM_LAB_WINRM_HOST=...
export ITAM_LAB_WINRM_CREDENTIAL_REF=...
export ITAM_LAB_SNMP_HOST=...
export ITAM_LAB_SNMP_CREDENTIAL_REF=...
cd backend && npm run test:itam:discovery:persist
```

---

## How to run

```bash
# Unit (memory — ITAM_DISCOVERY_UNIT_TEST=1)
cd backend && npm run test:itam:discovery:config
cd backend && npm run test:itam:discovery

# Persistence + loopback ICMP/TCP
export ITAM_DISCOVERY_DATABASE_URL=postgresql://vis:***@127.0.0.1:5432/itam_discovery
cd backend && npm run test:itam:discovery:persist
```

**Classification: PARTIALLY VALIDATED** — persistent and safe for controlled internal testing; not production-ready for enterprise LAN discovery.
