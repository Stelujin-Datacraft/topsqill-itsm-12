-- =============================================================================
-- DEV REPAIR 04 — Safe form deletion FK behavior
-- Confirmed failure: form_fields_form_id_fkey blocks DELETE of forms with fields.
--
-- Retention decisions (reviewed):
--   form_fields              → ON DELETE CASCADE  (schema rows; required for delete)
--   form_user_access         → ON DELETE CASCADE  (ACL for deleted form)
--   form_access_requests     → ON DELETE CASCADE  (requests for deleted form)
--   form_audit_logs          → ON DELETE SET NULL (PRESERVE audit history; form_name kept)
--   form_submissions         → NO automatic CASCADE in this migration
--                              (business records — require explicit purge / Prod check)
--
-- Review corrections:
--   - Single transaction
--   - Refuse SET NULL if form_audit_logs.form_id is NOT NULL
--   - Temporary helper always dropped (EXCEPTION handler)
--   - form_submissions FK deliberately untouched
-- =============================================================================

BEGIN;

-- Refuse SET NULL rebind if form_id is NOT NULL (would break form delete).
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

CREATE OR REPLACE FUNCTION public.__dev_repair_rebind_forms_fk(
  _child_table text,
  _constraint_name text,
  _on_delete text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = _child_table
  ) THEN
    RAISE NOTICE 'Dev repair 04: skip % — table missing', _child_table;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _child_table AND column_name = 'form_id'
  ) THEN
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
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', _child_table, r.conname);
  END LOOP;

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
  PERFORM public.__dev_repair_rebind_forms_fk('form_fields', 'form_fields_form_id_fkey', 'CASCADE');
  PERFORM public.__dev_repair_rebind_forms_fk('form_user_access', 'form_user_access_form_id_fkey', 'CASCADE');
  PERFORM public.__dev_repair_rebind_forms_fk('form_access_requests', 'form_access_requests_form_id_fkey', 'CASCADE');
  PERFORM public.__dev_repair_rebind_forms_fk('form_audit_logs', 'form_audit_logs_form_id_fkey', 'SET NULL');
EXCEPTION
  WHEN OTHERS THEN
    DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text);
    RAISE;
END $$;

DROP FUNCTION IF EXISTS public.__dev_repair_rebind_forms_fk(text, text, text);

-- form_submissions: intentionally NOT altered — capture Dev+Prod confdeltype before any change.
--   SELECT c.conname, c.confdeltype, pg_get_constraintdef(c.oid)
--   FROM pg_constraint c
--   JOIN pg_class rel ON rel.oid = c.conrelid
--   WHERE rel.relname = 'form_submissions' AND c.contype = 'f'
--     AND c.confrelid = 'public.forms'::regclass;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_fields_form_id_fkey'
      AND conrelid = 'public.form_fields'::regclass
  ) THEN
    COMMENT ON CONSTRAINT form_fields_form_id_fkey ON public.form_fields IS
      'Dev repair: CASCADE so form delete removes field definitions; applied 20261019120300';
  END IF;
END $$;

COMMIT;
