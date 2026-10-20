# Dev create/delete failures — root cause and fixes

**Branch:** `cursor/fix-dev-crud-create-delete-e654` (off `develop`)  
**Prod:** untouched. **Live SQL apply:** not run from this agent.

## Root causes (verified from code + prior Dev inventory)

| # | Cause | Evidence | Fix type |
|---|--------|----------|----------|
| 1 | Dev form tables have deny-all RLS; helpers missing | Operator inventory + PR #229 review | **Dev migration** (01–03) — must be applied manually on Dev |
| 2 | `form_fields_form_id_fkey` blocks form delete | Confirmed FK error; create always adds Status field | **Code:** ordered child delete + **Dev migration 04** CASCADE |
| 3 | Mutations return `[]` with no error under RLS | Nest/`databaseClient` treated empty as success | **Code:** Nest + client `requireAffectedRows` |
| 4 | `get_user_project_invitations` / `get_organization_users` missing | PGRST202 / no repo CREATE for org users | Migration 03 + Migration 05 (Prod-captured body + grants) |

## Module → persistence path

| Module | Create/Delete path | Covered by |
|--------|-------------------|------------|
| Forms | Nest `/database/*` → Supabase user JWT | Child cleanup + zero-row + RLS SQL |
| Workflows | Nest DB proxy | Zero-row delete check |
| IT Assets | Nest DB proxy | Zero-row delete check |
| Dashboards/Reports | Nest DB proxy | Zero-row + Nest guard |
| Policies / KB / Compliance / Evidence | Nest DB proxy | Nest + client zero-row guard |
| VIS / ITAM discovery / Promotion | Dedicated Nest APIs | Schema islands — separate apply docs |
| Blog | Nest blog + storage | Unchanged here |

## Code changes (this branch)

- `src/lib/formDeleteCleanup.ts` — delete `form_fields` / access children before `forms`
- `useFormMutations` / `FormContext` — use cleanup; refuse empty delete; clearer errors
- `backend/.../database.service.ts` — reject insert/update/delete with zero returned rows
- `src/services/api/databaseClient.ts` — same for Nest + PostgREST fallback
- Workflows / IT assets / dashboards — explicit empty-delete errors
- Cherry-picked PR #229 repair SQL + docs (Dev apply still manual)

## Still requires live Dev validation

1. Apply migrations 01–05 on **Dev only** after approval (`VALIDATION.md`).
2. Confirm Dev `get_organization_users` def + grants match Prod capture (post-flight in `VALIDATION.md`).
3. Confirm `form_submissions` FK before cascading submissions (Dev has 0 submissions today).
4. Smoke: create/delete forms, workflows, assets, dashboards; org-users / AI RPC after Nest deploy + SQL apply.
