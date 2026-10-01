# Platform Environment Strategy

**CURRENT ENVIRONMENT: DEV ONLY**

**FUTURE TARGET (not provisioned in this phase):**

```
DEV → QA → PROD
```

Do **not** create QA or PROD infrastructure in this phase.  
Do **not** clone the DEV database to future environments.  
Do **not** copy DEV users or secrets into future PROD.

---

## Principles

1. **Same application code** from Git for every environment.
2. **Same schema** via ordered Supabase/Prisma migrations (never DB dump copy).
3. **Configuration packages** move platform config (forms, workflows, roles, …).
4. **Environment configuration** is mapped per env (URLs, credential refs, buckets).
5. **Transactional data** stays local (submissions, assets, runs, audits).
6. **Secrets** resolve only through a secret provider / `credentialReferenceId`.

---

## Environment model (future)

| Key | Purpose | Status |
|---|---|---|
| `DEV` | Active development + promotion foundation testing | **Exists** |
| `QA` | Pre-production validation | **Not created** |
| `PROD` | Production | **Not created** |

Optional future labels used inside VIS governance (`TEST`, `UAT`) are **VIS integration environment tags**, not platform QA/PROD tenants.

---

## What belongs where

### Platform configuration (promotable via package)

- Projects, forms, fields, rules
- Workflows definitions
- Roles / permission *definitions* (logical resource keys)
- Group *definitions* (not membership)
- Reports / dashboards definitions
- Notification / email *templates*
- Integration *definitions* + mappings + transformations
- Reference data keyed by stable keys
- ITAM sync mapping definitions (not credentials)

### Environment configuration (per env map)

| Slot | Example DEV | Future QA/PROD |
|---|---|---|
| `DATABASE_URL` / Supabase URL | DEV project | Separate projects |
| `REDIS_URL` / BullMQ | DEV Redis | Separate |
| `API_PUBLIC_URL` | DEV app URL | Per env |
| `FORM_API_BASE_URL` | DEV functions URL | Per env |
| `EXISTING_APP_API_URL` (ITAM sync) | Lab/dev target | Per env |
| `STORAGE_BUCKET` | DEV bucket | Per env |
| `SMTP_*` | DEV mail | Per env |
| `LDAP_*` | DEV directory | Per env (often different) |
| OAuth redirect URIs | DEV callbacks | Per env |
| Webhook callback URLs | DEV | Per env |
| Connector `base_url` | DEV endpoints | Per env |
| `credentialReferenceId` bindings | `secret://dev/...` | `secret://qa/...`, `secret://prod/...` |

Application code must read these from env/config — not hardcode production URLs.

### Transactional data (never auto-promoted)

- Form submissions / records
- ITAM discovered assets, jobs, topology observations
- Workflow execution / queue state
- User notifications inbox
- Audit log history
- SLA instances / evidence locker case data
- VIS execution history

### Reference / seed data (promotable by key)

- Severity/status/category lists with stable keys (`financial`, `critical`, …)
- Choice options exported as `{ key, label }`

### Secrets (never in packages / git / logs / queues)

- Passwords, API keys, OAuth client secrets, private keys, bearer tokens
- `outbound_connectors.credentials` values
- SMTP passwords, LDAP bind passwords
- Supabase service role keys

Use: `credential_reference_id` / `credentialReferenceId` + SecretProvider.

---

## Users and groups

| Object | Promotion rule |
|---|---|
| User accounts | **Do not promote.** Create/link per environment. |
| Role definitions | Promote by logical key (`grc.manager`). |
| Group definitions | May promote definition. |
| Group membership / user↔role assignment | Environment-specific unless explicitly mapped. |

Future mapping example:

```
logical role: GRC_MANAGER
DEV  → dev-groups/grc-managers
QA   → qa-groups/grc-managers
PROD → prod-groups/grc-managers
```

---

## Schema & migrations

Path:

```
Git → supabase/migrations (+ Prisma where used) → apply on each env
```

Logical key migration for promotion readiness:

- `supabase/migrations/20261001080000_platform_logical_keys.sql`

Adds nullable `logical_key` (and connector `credential_reference_id`) without breaking existing UUID URLs.

---

## Package promotion flow (when QA exists later)

```
DEV export (no secrets, no transactional)
  → validate
  → dry-run on QA
  → human approval
  → import apply on QA
  → bind env credentials/URLs
  → repeat toward PROD
```

This phase only tests:

```
DEV config snapshot
  → package
  → isolated DEV namespace (promotion-test-*)
  → dry-run / import / verify
```

---

## Security controls

- Scrub secrets on export (`backend/src/promotion/secrets.ts`)
- VIS promote already strips credential material from env config
- ITAM sync requires `credentialReferenceId` (no inline secrets in target config)
- RLS retained for tenant isolation
- Promotion APIs require authenticated Nest access

---

## Audit expectations for future env deployments

Record at minimum:

- package key/version
- source/target environment
- initiator/approver
- timestamp/result
- per-component diff + failures

Foundation type: `PromotionAuditRecord` in `backend/src/promotion/types.ts`.

---

## Explicit non-goals this phase

- Provisioning QA or PROD Supabase/projects/infra
- Building full GitHub Actions deploy-to-QA/PROD pipelines
- Database cloning / anonymized DB copy tooling
- Automatic user copy to PROD
