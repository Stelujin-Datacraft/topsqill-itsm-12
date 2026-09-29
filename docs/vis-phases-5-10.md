# Versatile Integration Studio — Phases 5–10

Enterprise AI integration platform layers built on Phase 1–4 (design, execution, realtime).

## Modules

| Stage | Path | Notes |
|-------|------|-------|
| 5A Codegen | `backend/src/vis/codegen/` | TS/Python generators + Java/C#/Go stubs; secret scan; no auto-exec |
| 5B Security | `backend/src/vis/security/` | RBAC, EncryptedSecretProvider, SSO abstraction, AiContextSanitizer |
| 5C Governance | `backend/src/vis/governance/` | Promote DEV→TEST→UAT→PROD, rollback, PolicyEngine |
| 6 HA/DR | `backend/src/vis/enterprise/ha.ts` | Topology, autoscaling hints, RPO/RTO, restore procedure |
| 7 Observability | `backend/src/vis/observability/` | Metrics, traces, alert rules, HEALTHY/DEGRADED/FAILING |
| 8 Reconciliation | `backend/src/vis/reconciliation/` | Diff + repair plans; mass delete gated |
| 9 Drift/SDK/Market | `backend/src/vis/drift/`, `marketplace/` | Drift severity, impact, connector lifecycle |
| 10 AI Ops/Healing | `backend/src/vis/aiops/`, `healing/` | Evidence-based analysis; safe allowlisted recovery |

API: `/api/vis/enterprise/*`  
UI: `/vis/enterprise`

## Principles enforced

- Reuses ExecutionEngine / EventEngine — no duplicate runtimes
- AI recommends; deterministic runtime executes
- Secrets never in logs, AI prompts, generated code, or audit payloads
- External record data is never treated as AI instructions
- Production changes require governance / approval
