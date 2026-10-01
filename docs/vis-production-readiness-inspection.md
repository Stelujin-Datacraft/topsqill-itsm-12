# Production readiness inspection — Versatile Integration Studio (pre-hardening)

| Component | Current implementation | Production ready? | Reason | Required action |
|-----------|------------------------|-------------------|--------|-----------------|
| VisStore (core + enterprise collections) | File-backed JSON / in-memory | NO | All Phase 1–10 state in `.vis-data/store.json` | Migrate to Prisma/PostgreSQL |
| VIS Prisma schema | Models for Phase 1 only; client unused | NO | Schema exists but no runtime wiring | Extend models; wire repository |
| Codegen TS/Python | Real generators + validation | FUNCTIONAL_BUT_NEEDS_HARDENING | No compile gate in CI | Add build validation |
| Codegen Java/C#/Go | stubGenerator single file | STUB | Explicit stubs | Real MVG generators + build |
| EncryptedSecretProvider | In-process AES-GCM Map | FUNCTIONAL_BUT_NEEDS_HARDENING | Lost on restart; no Vault | Add VaultSecretProvider + config select |
| SSO | LocalSsoProvider only | STUB | No OIDC/SAML IdP | OIDC provider + test IdP config |
| Mock DEV/UAT APIs | VisMocksController + VisStore arrays | NO for persistence | In-memory mock records | PostgreSQL-backed mock envs |
| Event engine | In-process + VisStore | FUNCTIONAL_BUT_NEEDS_HARDENING | Works; not multi-instance proven | PG + Redis HA tests |
| Execution engine | In-memory queue option | FUNCTIONAL_BUT_NEEDS_HARDENING | Phase 3 measured samples exist | Multi-instance + 100k measured |
| Policy/RBAC | In-code ROLE_PERMISSIONS | FUNCTIONAL_BUT_NEEDS_HARDENING | Not HTTP-enforced on all routes | Auth middleware + HTTP tests |
| Enterprise UI | Ops summary page | FUNCTIONAL_BUT_NEEDS_HARDENING | Not full admin | Expand admin sections |
| K8s | None | NOT_IMPLEMENTED | Missing | Manifests |
| DR restore | Documented only | STUB | No drill executed | Backup/restore drill |
| SCA/secret scan | Deferred to CI | NOT_IMPLEMENTED | No scripts | Add scripts |
| BullMQ/Redis | Dependency present; not always required | EXPERIMENTAL | Local often in-memory | Wire Redis for hardening tests |

Generated: production-hardening kickoff.
