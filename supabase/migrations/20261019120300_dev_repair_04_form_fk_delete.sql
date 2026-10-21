-- =============================================================================
-- DEV REPAIR 04 — Align form-child FK ON DELETE behavior for form deletion
--
-- Operator read-only capture (2026-10-20):
--   Production form_submissions_form_id_fkey → ON DELETE CASCADE
--   Dev        form_submissions_form_id_fkey → ON DELETE NO ACTION
--
-- Retention / parity decisions (reviewed):
--   form_fields              → ON DELETE CASCADE  (required; Dev delete blocked)
--   form_user_access         → ON DELETE CASCADE  (ACL for deleted form; optional table)
--   form_access_requests     → ON DELETE CASCADE  (optional table)
--   form_submissions         → ON DELETE CASCADE  (MATCH PRODUCTION)
--   form_audit_logs          → ON DELETE SET NULL (PRESERVE audit history; form_name kept)
--     Intentional vs Prod: repo migration 20260212 set audit → CASCADE; this repair
--     keeps SET NULL for retention (original 20260117 create). Documented difference.
--
-- Rerunnable: drop matching form_id→forms FKs then recreate named constraints.
-- Required tables (form_fields, form_submissions, form_audit_logs) RAISE if missing.
-- Optional tables (form_user_access, form_access_requests) skip with NOTICE.
-- =============================================================================

BEGIN;

-- Refuse SET NULL rebind if form_audit_logs.form_id is NOT NULL (would break form delete).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'form_audit_logs'
      AND column_name = 'form_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 04 blocked: form_audit_logs.form_id is NOT NULL; cannot use ON DELETE SET NULL. Alter nullability first or keep CASCADE with explicit retention decision.';
  END IF;
END $$;

-- Required children must exist with form_id before we change delete semantics.
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['form_fields', 'form_submissions', 'form_audit_logs']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      missing := array_append(missing, t || ' (table)');
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'form_id'
    ) THEN
      missing := array_append(missing, t || '.form_id');
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'forms' AND column_name = 'id'
  ) THEN
    missing := array_append(missing, 'forms.id');
  END IF;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Dev repair 04 preflight failed — missing required objects: %.',
      array_to_string(missing, ', ');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.__dev_repair_rebind_forms_fk(
  _child_table text,
  _constraint_name text,
  _on_delete text,
  _required boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  found_existing boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = _child_table
  ) THEN
    IF _required THEN
      RAISE EXCEPTION
        'Dev repair 04: required table public.% is missing', _child_table;
    END IF;
    RAISE NOTICE 'Dev repair 04: skip % — table missing', _child_table;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _child_table AND column_name = 'form_id'
  ) THEN
    IF _required THEN
      RAISE EXCEPTION
        'Dev repair 04: required column public.%.form_id is missing', _child_table;
    END IF;
    RAISE NOTICE 'Dev repair 04: skip % — form_id column missing', _child_table;
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = _child_table
      AND c.contype = 'f'
      AND c.confrelid = 'public.forms'::regclass
      AND pg_get_constraintdef(c.oid) ILIKE '%(form_id)%'
  LOOP
    found_existing := true;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', _child_table, r.conname);
  END LOOP;

  -- Required children should already have had a form_id→forms FK (NO ACTION on Dev for submissions).
  IF _required AND NOT found_existing THEN
    RAISE NOTICE
      'Dev repair 04: no existing form_id→forms FK on %; creating %',
      _child_table, _constraint_name;
  END IF;

  IF _on_delete = 'CASCADE' THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE',
      _child_table, _constraint_name
    );
  ELSIF _on_delete = 'SET NULL' THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE SET NULL',
      _child_table, _constraint_name
    );
  ELSE
    RAISE EXCEPTION 'Unsupported ON DELETE action: %', _on_delete;
  END IF;
END;
$$;

DO $$
BEGIN
  PERFORM public.__dev_repair_rebind_forms_fk('form_fields', 'form_fields_form_id_fkey', 'CASCADE', true);
  PERFORM public.__dev_repair_rebind_forms_fk('form_user_access', 'form_user_access_form_id_fkey', 'CASCADE', false);
  PERFORM public.__dev_repair_rebind_forms_fk('form_access_requests', 'form_access_requests_form_id_fkey', 'CASCADE', false);
  -- Match Production: deleting a form cascades related submissions.
  PERFORM public.__dev_repair_rebind_forms_fk('form_submissions', 'form_submissions_form_id_fkey', 'CASCADE', true);
  PERFORM public.__dev_repair_rebind_forms_fk('form_audit_logs', 'form_audit_logs_form_id_fkey', 'SET NULL', true);
EXCEPTION
  WHEN OTHERS THEN
    DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text, boolean);
    DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text);
    RAISE;
END $$;

DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text, boolean);
DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text);

-- Post-check: form_submissions must be CASCADE (confdeltype 'c'); form_fields CASCADE; audit SET NULL ('n').
DO $$
DECLARE
  sub_del text;
  fields_del text;
  audit_del text;
BEGIN
  SELECT c.confdeltype::text INTO sub_del
  FROM pg_constraint c
  WHERE c.conname = 'form_submissions_form_id_fkey'
    AND c.conrelid = 'public.form_submissions'::regclass
    AND c.contype = 'f';

  IF sub_del IS NULL THEN
    RAISE EXCEPTION
      'Dev repair 04 post-check failed: form_submissions_form_id_fkey missing after rebind';
  END IF;
  IF sub_del <> 'c' THEN
    RAISE EXCEPTION
      'Dev repair 04 post-check failed: form_submissions_form_id_fkey confdeltype=% (expected c/CASCADE)',
      sub_del;
  END IF;

  SELECT c.confdeltype::text INTO fields_del
  FROM pg_constraint c
  WHERE c.conname = 'form_fields_form_id_fkey'
    AND c.conrelid = 'public.form_fields'::regclass
    AND c.contype = 'f';

  IF fields_del IS DISTINCT FROM 'c' THEN
    RAISE EXCEPTION
      'Dev repair 04 post-check failed: form_fields_form_id_fkey confdeltype=% (expected c/CASCADE)',
      fields_del;
  END IF;

  SELECT c.confdeltype::text INTO audit_del
  FROM pg_constraint c
  WHERE c.conname = 'form_audit_logs_form_id_fkey'
    AND c.conrelid = 'public.form_audit_logs'::regclass
    AND c.contype = 'f';

  IF audit_del IS DISTINCT FROM 'n' THEN
    RAISE EXCEPTION
      'Dev repair 04 post-check failed: form_audit_logs_form_id_fkey confdeltype=% (expected n/SET NULL)',
      audit_del;
  END IF;

  COMMENT ON CONSTRAINT form_fields_form_id_fkey ON public.form_fields IS
    'Dev repair: CASCADE so form delete removes field definitions; applied 20261019120300';
  COMMENT ON CONSTRAINT form_submissions_form_id_fkey ON public.form_submissions IS
    'Dev repair: CASCADE to match Production; form delete removes related submissions; applied 20261019120300';
  COMMENT ON CONSTRAINT form_audit_logs_form_id_fkey ON public.form_audit_logs IS
    'Dev repair: SET NULL to preserve audit rows (intentional vs Prod CASCADE); applied 20261019120300';
END $$;

COMMIT;
