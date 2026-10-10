# VIS Production Hardening — Final Report

## A. Production readiness matrix

| Feature | Status | Evidence | Remaining work |
|---------|--------|----------|----------------|
| Supabase persistence | FUNCTIONAL_BUT_NEEDS_HARDENING | `vis.supabase-persistence` mocked client; dual-write VisStore | Apply `supabase/migrations/20261010120000_vis_supabase_persistence.sql` before production writes |
| Codegen TypeScript | PRODUCTION_READY | tsc + node:test PASS | — |
| Codegen Python | PRODUCTION_READY | py_compile + unittest PASS | — |
| Codegen Java | PRODUCTION_READY | `mvn test` PASS | — |
| Codegen C# | PRODUCTION_READY | `dotnet test` PASS | — |
| Codegen Go | PRODUCTION_READY | `go test` PASS | — |
| LocalEncryptedSecretProvider | PRODUCTION_READY (dev/stage) | create/get/rotate + Prisma blob | Prod should prefer Vault |
| VaultSecretProvider | FUNCTIONAL_BUT_NEEDS_HARDENING | MockVaultServer tests PASS; live Vault not in this env | Wire against real Vault in staging |
| OIDC SSO | FUNCTIONAL_BUT_NEEDS_HARDENING | LocalTestIdp code exchange + claims mapping PASS | Real IdP (Okta/Azure AD) integration test |
| SAML | STUB | Interface only | Implement SAML provider |
| PG mock DEV/UAT apps | PRODUCTION_READY (test harness) | createDevUatMockPair E2E | — |
| E2E DEV→UAT sync | FUNCTIONAL_BUT_NEEDS_HARDENING | Exactly-one target verified | Full webhook→BullMQ path multi-process |
| Duplicate event (100) | PRODUCTION_READY (constraint) | unique → 1 target | — |
| OAuth concurrent refresh | PRODUCTION_READY (algorithm) | 100 jobs / 1 refresh via single-flight | — |
| Reconciliation 100/97 | PRODUCTION_READY | 3 missing → repair → 0 missing | — |
| Schema drift | PRODUCTION_READY | severity→riskLevel detected; no auto prod change | — |
| RBAC checks | FUNCTIONAL_BUT_NEEDS_HARDENING | Assert 403/200 matrix | Nest guards on all enterprise routes |
| Self-healing allowlist | PRODUCTION_READY | safe EXECUTED / dangerous REJECTED | — |
| AI safety | PRODUCTION_READY | injection boundary + redaction | — |
| Load 1k / 10k / 100k | MEASURED | See load artifacts | Redis queue depth under multi-worker |
| Multi-instance | FUNCTIONAL_BUT_NEEDS_HARDENING | 8 concurrent writers, 1 row | 2 real API processes not launched (no Docker) |
| K8s manifests | FUNCTIONAL_BUT_NEEDS_HARDENING | `deploy/k8s/vis-platform.yaml` | Apply/verify in cluster |
| DR restore drill | PRODUCTION_READY (logical) | Verified restore; RTO ~2s local | Prod managed-PG PITR drill |
| Security scan hooks | FUNCTIONAL_BUT_NEEDS_HARDENING | scripts/security/scan.sh | Trivy in CI image; npm critical baseline |
| Enterprise admin UI | FUNCTIONAL_BUT_NEEDS_HARDENING | Tabbed admin console | Live mutate actions in UI |

## B. Database migration

- Schema: `supabase/migrations/20261010120000_vis_supabase_persistence.sql` (review only; not applied by the app)
- Historical Prisma schema: `backend/src/vis/prisma/schema.prisma` (unused at runtime)

## C–O. Measured results

See artifacts:

- `/opt/cursor/artifacts/vis-hardening-results.json`
- `/opt/cursor/artifacts/vis-load-100k.json`
- `/opt/cursor/artifacts/vis-dr-report.json`

### Load (actual)

| N | events/sec | elapsed | batch p95 |
|---|------------|---------|-----------|
| 1,000 | 5917.2 | 169ms | 169ms |
| 10,000 | 4446.4 | 2249ms | 316ms |
| 100,000 | 940.9 | 106278ms | 1818ms |

### DR (actual)

- RPO target 15m / RTO target 60m
- Actual total ~2s; restore verified on `vis_platform_restore`

### OAuth

- 100 concurrent jobs, refreshCount=1 (single-flight)

### Duplicates

- 100 concurrent creates → targetCount=1

## Q. Commands

```bash
export VIS_PERSISTENCE=supabase
export PATH="$HOME/.dotnet:$PATH"
cd backend
npm i

# Apply supabase/migrations/20261010120000_vis_supabase_persistence.sql
# to the Dev Supabase project before durable writes. Do not apply it to Prod from this change.

# Regression (file/memory) and mocked Supabase persistence
VIS_STORE_MEMORY=1 VIS_PERSISTENCE=memory npm run test:vis
npm run test:vis:persistence

# Hardening (Supabase client; ENV-DEV/UAT mock apps still use VIS_MOCK_PG_BASE)
VIS_PERSISTENCE=supabase npm run test:vis:hardening
VIS_PERSISTENCE=supabase VIS_LOAD_100K=1 npm run test:vis:hardening:100k

# Security + DR
npm run security:scan
npm run dr:drill
```
