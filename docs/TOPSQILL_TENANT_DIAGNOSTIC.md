# TopSqill Form API — Tenant Diagnostic (Pilot Enablement)

**Date:** 2026-09-29  
**Environment classification:** **READ_ONLY_TEST**  
**Evidence:** `docs/evidence/topsqill-tenant-diagnostic.json`

## Root cause (verified)

| Check | Result |
|-------|--------|
| `SUPABASE_URL` host | `fnmkczsvwpzpxyklztkt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` JWT `role` claim | **`anon`** (expected **`service_role`**) |
| `SUPABASE_ANON_KEY` same as service env var | **Yes** (identical fingerprint) |
| `auth.getUser()` | No user session (expected for key-only client) |
| `GET forms` | HTTP 200, **0 forms** |
| `GET organizations` | HTTP 200, orgs visible (e.g. Demo_Organization, TopSqill Org) |
| `INSERT forms` | **RLS denied** (`42501` — new row violates row-level security policy) |
| RLS bypassed? | **No** — and must not be disabled for testing |

**Conclusion:** The environment variable named `SUPABASE_SERVICE_ROLE_KEY` currently holds the **anon** publishable key. Anon clients without `auth.uid()` cannot satisfy `forms_insert` policies. This is a **credential misconfiguration**, not an application bug and not an invitation to disable RLS.

## Authentication identity

- Key env var used: `SUPABASE_SERVICE_ROLE_KEY`
- JWT role: `anon`
- Expected role for platform Form API writes: `service_role`
- Authenticated user: none

## Tenant / application / environment

- Pilot env: `TEST` (`VIS_PILOT_ENV`)
- Organizations visible: yes (count ≥ 1)
- Forms visible / exact count: **0**
- Configured form id: unset (`VIS_PILOT_TOPSQILL_FORM_ID`)

## Required permissions / roles / scopes

| Requirement | Detail |
|-------------|--------|
| JWT role | `service_role` for Nest `FormApiService` (bypasses RLS by design) |
| OR user JWT | Org admin / project member satisfying `forms_insert` + submission policies |
| API scopes (logical) | `forms:read`, `forms:write`, `submissions:read`, `submissions:write` |
| RLS | Keep enabled; do not disable for pilot |

## Endpoints probed

| Name | Method | Target | Result |
|------|--------|--------|--------|
| list_organizations | GET | `organizations` | OK |
| list_forms | GET | `forms` | OK, 0 rows |
| count_forms | HEAD | `forms` | 0 |
| probe_form_insert | POST | `forms` | **RLS blocked** |

## Prerequisites to unlock WRITABLE pilot tenant

1. From Supabase Dashboard → Project Settings → API, copy the **`service_role`** secret into `SUPABASE_SERVICE_ROLE_KEY` (never commit).
2. Keep `SUPABASE_ANON_KEY` as the anon/publishable key.
3. Create a dedicated **TEST/UAT** form: **VIS Integration Test Form** with fields:
   `externalId`, `title`, `description`, `severity`, `owner`, `sourceSystem`, `sourceEnvironment`, `lastSyncedAt`.
4. Set `VIS_PILOT_ENV=TEST|UAT`, `VIS_PILOT_TOPSQILL_ORG_ID`, `VIS_PILOT_TOPSQILL_FORM_ID`.
5. Re-run: `cd backend && npm run test:vis:pilot`

Until then, treat live TopSqill as **READ_ONLY_TEST**. Contract HTTP E2E (PG-backed facade) remains the internal validation path.
