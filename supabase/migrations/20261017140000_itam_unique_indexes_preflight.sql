-- FORWARD-ONLY: unique indexes required by Nest flushDiscoveryStore ON CONFLICT.
-- REVIEWABLE ONLY — do not auto-apply from CI/agents. Manual Dev apply first.
-- Runs after 20261017130500_vis_revoke_client_table_grants.sql.
--
-- Non-destructive preflight: if duplicate key groups exist, RAISE EXCEPTION with
-- the exact conflicting rows (ids + natural keys). Does NOT delete, merge, or
-- rewrite duplicates. Resolve manually, then re-run this migration.
-- CREATE UNIQUE INDEX IF NOT EXISTS is idempotent once the index exists.

-- ── Preflight: asset_software (asset_id, software_name, version) ───────────
DO $$
DECLARE
  dup_report text;
BEGIN
  IF to_regclass('public.asset_software') IS NULL THEN
    RAISE EXCEPTION
      'public.asset_software is missing; apply ITAM Phase A DDL before this forward migration';
  END IF;

  SELECT string_agg(line, E'\n' ORDER BY line)
  INTO dup_report
  FROM (
    SELECT format(
      'asset_software duplicate: asset_id=%s software_name=%L version=%L row_count=%s ids=%s',
      asset_id,
      software_name,
      version,
      count(*),
      array_agg(id::text ORDER BY id)
    ) AS line
    FROM public.asset_software
    GROUP BY asset_id, software_name, version
    HAVING count(*) > 1
  ) d;

  IF dup_report IS NOT NULL AND length(btrim(dup_report)) > 0 THEN
    RAISE EXCEPTION
      'Refusing to create uq_asset_software_asset_name_ver: duplicate rows found. '
      'Do not auto-delete. Resolve manually, then re-apply. Details:%s%s',
      E'\n',
      dup_report;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_software_asset_name_ver
  ON public.asset_software(asset_id, software_name, version);

-- ── Preflight: itam_network_scopes (organization_id, cidr, scope_kind) ─────
DO $$
DECLARE
  dup_report text;
BEGIN
  IF to_regclass('public.itam_network_scopes') IS NULL THEN
    RAISE EXCEPTION
      'public.itam_network_scopes is missing; apply ITAM Phase A DDL before this forward migration';
  END IF;

  SELECT string_agg(line, E'\n' ORDER BY line)
  INTO dup_report
  FROM (
    SELECT format(
      'itam_network_scopes duplicate: organization_id=%s cidr=%L scope_kind=%L row_count=%s ids=%s',
      organization_id,
      cidr,
      scope_kind,
      count(*),
      array_agg(id::text ORDER BY id)
    ) AS line
    FROM public.itam_network_scopes
    GROUP BY organization_id, cidr, scope_kind
    HAVING count(*) > 1
  ) d;

  IF dup_report IS NOT NULL AND length(btrim(dup_report)) > 0 THEN
    RAISE EXCEPTION
      'Refusing to create uq_itam_network_scopes_org_cidr_kind: duplicate rows found. '
      'Do not auto-delete. Resolve manually, then re-apply. Details:%s%s',
      E'\n',
      dup_report;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_itam_network_scopes_org_cidr_kind
  ON public.itam_network_scopes(organization_id, cidr, scope_kind);
