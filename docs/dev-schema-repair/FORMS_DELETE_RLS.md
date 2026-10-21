# Forms delete blocked by security policy (Dev + Prod)

## Cause

`forms_delete` used `can_modify_forms_row(organization_id, created_by, auth.uid())`,
which only allowed:

- `user_profiles.role = 'admin'` for the org, or
- `created_by = auth.uid()::text`

It did **not** allow:

- Creator when `created_by` stores **email**
- Project **admin/editor** (unless the separate project-admin policy applied and role was exactly `admin`)

PostgREST then returned `[]` (no error) → UI: “Delete blocked by security policy”.

## Fix

Migration: `supabase/migrations/20261021120000_forms_delete_align_can_modify_form.sql`

- Broadens `can_modify_forms_row` (email + uuid creator)
- Points `forms_update` / `forms_delete` at `can_modify_form(id, auth.uid())`
- Extends project policies to `admin` **and** `editor`

## Apply (SQL Editor — Dev and Prod)

1. Open the correct Supabase project (Dev vs Prod).
2. Paste the migration file contents → Run.
3. Retry form delete as creator, org admin, or project admin/editor.

No Nest rebuild required for this SQL-only fix.
