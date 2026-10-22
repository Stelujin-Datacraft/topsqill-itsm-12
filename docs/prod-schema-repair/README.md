# Production VIS + ITAM schema repair (review only)

This directory is a **manual review package** for repairing missing VIS / ITAM Phase A schema in the Topsqill **Production** Supabase project.

## Do not

- Connect agents to Production or execute these scripts from CI/Nest
- Run `supabase db push` or migration-history repair automatically
- Modify Dev
- Copy Dev data into Production

## Contents

| Path | Purpose |
|---|---|
| [AUDIT_REPORT.md](./AUDIT_REPORT.md) | Object inventory, risks, approval gates |
| [sql/01_preflight_read_only.sql](./sql/01_preflight_read_only.sql) | Preflight inventory |
| [sql/02_vis_apply.sql](./sql/02_vis_apply.sql) | VIS apply (sourced migrations) |
| [sql/03_itam_phase_a_apply.sql](./sql/03_itam_phase_a_apply.sql) | ITAM Phase A apply |
| [sql/04_postcheck_verification.sql](./sql/04_postcheck_verification.sql) | Post-apply verification |
| [sql/OPTIONAL_itam_phases_b_d_and_form_sync.txt](./sql/OPTIONAL_itam_phases_b_d_and_form_sync.txt) | Deferred scope |

## Suggested review order

1. Read `AUDIT_REPORT.md`
2. Run **only** `01_preflight_read_only.sql` in Production SQL Editor; share results
3. Approve scope
4. Apply `02_vis_apply.sql` then `03_itam_phase_a_apply.sql` (or only the sections still MISSING)
5. Run `04_postcheck_verification.sql`
6. Keep `ITAM_DISCOVERY_APPLY_SCHEMA=0` on Nest Production
