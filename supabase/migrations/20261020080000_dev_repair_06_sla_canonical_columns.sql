-- =============================================================================
-- DEV REPAIR 06 — Align SLA schema with repo canonical (hours/stage/chain model)
--
-- Context: Live Dev SLA tables exist but use a response/resolution-minutes shape
-- that diverges from supabase/migrations/20260205052304 + Nest/UI/AI code.
-- Dev tables are empty today; Dev-only columns are PRESERVED (no DROP/TRUNCATE).
--
-- Also hardens historical permissive RLS:
--   "Manage SLA instances" USING (true)  → scoped to project membership / org admin
--   "Insert escalation events" WITH CHECK (true) → scoped similarly
--
-- Dev inventory (2026-10-20 SQL Editor) also has temporary RESTRICTIVE deny policies:
--   business_holidays_migration_deny
--   form_field_sla_config_migration_deny
--   sla_instances_migration_deny
--   escalation_events_migration_deny
-- Each is USING (false) / WITH CHECK (false) for authenticated. RESTRICTIVE policies
-- AND with permissive ones, so they must be dropped or authenticated stays blocked
-- even after scoped replacements exist. Drop by exact known names only.
--
-- Additive only. Do NOT apply to Production without separate review.
-- Do NOT run from application startup.
-- =============================================================================

BEGIN;

-- Preflight: core SLA tables must already exist (do not CREATE TABLE for them).
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sla_templates', 'sla_instances', 'escalation_chains',
    'escalation_levels', 'escalation_events'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Dev repair 06 preflight failed — missing SLA tables: %. Apply base SLA migration 20260205052304 first (or restore tables).',
      array_to_string(missing, ', ');
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE public.escalation_level AS ENUM ('L1', 'L2', 'L3', 'L4');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sla_status AS ENUM ('on_track', 'warning', 'breached', 'completed', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- sla_templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.sla_templates
  ADD COLUMN IF NOT EXISTS warning_hours INTEGER,
  ADD COLUMN IF NOT EXISTS breach_hours INTEGER,
  ADD COLUMN IF NOT EXISTS use_business_hours BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_start_time TIME DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS business_end_time TIME DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS business_days TEXT[] DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  ADD COLUMN IF NOT EXISTS exclude_holidays BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_multipliers JSONB DEFAULT '{"high":0.5,"medium":1,"low":2}'::jsonb;

UPDATE public.sla_templates
SET
  warning_hours = COALESCE(warning_hours, 4),
  breach_hours = COALESCE(breach_hours, 8);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_templates'
      AND column_name = 'response_time_minutes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_templates'
      AND column_name = 'resolution_time_minutes'
  ) THEN
    EXECUTE $u$
      UPDATE public.sla_templates
      SET
        warning_hours = GREATEST(
          1,
          CEIL(COALESCE(response_time_minutes, warning_hours * 60, 240)::numeric / 60.0)::int
        ),
        breach_hours = GREATEST(
          1,
          CEIL(COALESCE(resolution_time_minutes, breach_hours * 60, 480)::numeric / 60.0)::int
        )
      WHERE response_time_minutes IS NOT NULL OR resolution_time_minutes IS NOT NULL
    $u$;
  END IF;
END $$;

ALTER TABLE public.sla_templates
  ALTER COLUMN warning_hours SET DEFAULT 4,
  ALTER COLUMN breach_hours SET DEFAULT 8;

-- ---------------------------------------------------------------------------
-- sla_instances
-- ---------------------------------------------------------------------------
ALTER TABLE public.sla_instances
  ADD COLUMN IF NOT EXISTS field_id TEXT,
  ADD COLUMN IF NOT EXISTS form_id UUID,
  ADD COLUMN IF NOT EXISTS chain_id UUID,
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warning_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS breach_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_escalation_level public.escalation_level,
  ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.sla_instances
SET
  started_at = COALESCE(started_at, created_at, now()),
  current_stage = COALESCE(NULLIF(current_stage, ''), 'unknown'),
  field_id = COALESCE(NULLIF(field_id, ''), 'legacy'),
  escalation_count = COALESCE(escalation_count, 0),
  priority = COALESCE(priority, 'medium'),
  metadata = COALESCE(metadata, '{}'::jsonb);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_instances'
      AND column_name = 'resolution_due_at'
  ) THEN
    EXECUTE 'UPDATE public.sla_instances SET breach_at = COALESCE(breach_at, resolution_due_at)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_instances'
      AND column_name = 'response_due_at'
  ) THEN
    EXECUTE 'UPDATE public.sla_instances SET warning_at = COALESCE(warning_at, response_due_at)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_instances'
      AND column_name = 'resolved_at'
  ) THEN
    EXECUTE 'UPDATE public.sla_instances SET completed_at = COALESCE(completed_at, resolved_at)';
  END IF;
END $$;

-- FKs only after orphan check (empty Dev is fine; non-empty with bad refs must fail clearly)
DO $$
DECLARE
  orphan_forms bigint := 0;
  orphan_chains bigint := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forms') THEN
    SELECT COUNT(*) INTO orphan_forms
    FROM public.sla_instances si
    WHERE si.form_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.forms f WHERE f.id = si.form_id);

    IF orphan_forms > 0 THEN
      RAISE EXCEPTION
        'Dev repair 06 blocked: % sla_instances.form_id values do not exist in forms. Fix orphans before adding FK.',
        orphan_forms;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sla_instances_form_id_fkey') THEN
      ALTER TABLE public.sla_instances
        ADD CONSTRAINT sla_instances_form_id_fkey
        FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'escalation_chains') THEN
    SELECT COUNT(*) INTO orphan_chains
    FROM public.sla_instances si
    WHERE si.chain_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.escalation_chains c WHERE c.id = si.chain_id);

    IF orphan_chains > 0 THEN
      RAISE EXCEPTION
        'Dev repair 06 blocked: % sla_instances.chain_id values do not exist in escalation_chains. Fix orphans before adding FK.',
        orphan_chains;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sla_instances_chain_id_fkey') THEN
      ALTER TABLE public.sla_instances
        ADD CONSTRAINT sla_instances_chain_id_fkey
        FOREIGN KEY (chain_id) REFERENCES public.escalation_chains(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- escalation_levels
-- ---------------------------------------------------------------------------
ALTER TABLE public.escalation_levels
  ADD COLUMN IF NOT EXISTS level public.escalation_level,
  ADD COLUMN IF NOT EXISTS level_order INTEGER,
  ADD COLUMN IF NOT EXISTS escalate_to_user_id UUID,
  ADD COLUMN IF NOT EXISTS escalate_to_group_id UUID,
  ADD COLUMN IF NOT EXISTS escalate_to_role TEXT,
  ADD COLUMN IF NOT EXISTS hours_after_breach INTEGER,
  ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_notification BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_message TEXT,
  ADD COLUMN IF NOT EXISTS auto_reassign BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS change_priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_priority TEXT;

UPDATE public.escalation_levels
SET
  level_order = COALESCE(level_order, 1),
  hours_after_breach = COALESCE(hours_after_breach, 0),
  level = COALESCE(level, 'L1'::public.escalation_level),
  send_email = COALESCE(send_email, true),
  send_notification = COALESCE(send_notification, true),
  send_sms = COALESCE(send_sms, false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escalation_levels'
      AND column_name = 'level_number'
  ) THEN
    EXECUTE $u$
      UPDATE public.escalation_levels
      SET
        level_order = COALESCE(level_order, level_number, 1),
        level = COALESCE(
          level,
          CASE level_number
            WHEN 1 THEN 'L1'::public.escalation_level
            WHEN 2 THEN 'L2'::public.escalation_level
            WHEN 3 THEN 'L3'::public.escalation_level
            WHEN 4 THEN 'L4'::public.escalation_level
            ELSE 'L1'::public.escalation_level
          END
        )
    $u$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escalation_levels'
      AND column_name = 'trigger_after_minutes'
  ) THEN
    EXECUTE $u$
      UPDATE public.escalation_levels
      SET hours_after_breach = COALESCE(
        hours_after_breach,
        GREATEST(0, CEIL(COALESCE(trigger_after_minutes, 0)::numeric / 60.0)::int)
      )
    $u$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
    IF EXISTS (
      SELECT 1 FROM public.escalation_levels el
      WHERE el.escalate_to_group_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = el.escalate_to_group_id)
    ) THEN
      RAISE EXCEPTION
        'Dev repair 06 blocked: escalation_levels.escalate_to_group_id has orphan group refs';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalation_levels_escalate_to_group_id_fkey') THEN
      ALTER TABLE public.escalation_levels
        ADD CONSTRAINT escalation_levels_escalate_to_group_id_fkey
        FOREIGN KEY (escalate_to_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- escalation_events
-- ---------------------------------------------------------------------------
ALTER TABLE public.escalation_events
  ADD COLUMN IF NOT EXISTS escalation_level public.escalation_level,
  ADD COLUMN IF NOT EXISTS notified_users UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notified_groups UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS actions_taken JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE public.escalation_events
SET
  escalation_level = COALESCE(escalation_level, 'L1'::public.escalation_level),
  notified_users = COALESCE(notified_users, '{}'),
  notified_groups = COALESCE(notified_groups, '{}'),
  actions_taken = COALESCE(actions_taken, '[]'::jsonb),
  triggered_by = COALESCE(triggered_by, 'system'),
  created_at = COALESCE(created_at, now());

-- ---------------------------------------------------------------------------
-- Supporting tables + scoped RLS (no USING(true))
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS public.form_field_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  field_id TEXT NOT NULL,
  template_id UUID REFERENCES public.sla_templates(id) ON DELETE CASCADE NOT NULL,
  chain_id UUID REFERENCES public.escalation_chains(id) ON DELETE SET NULL,
  stage_overrides JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(form_id, field_id)
);

ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_sla_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Drop known Dev temporary RESTRICTIVE deny-all policies (exact names only).
-- Must run before relying on scoped replacements: RESTRICTIVE AND permissive.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "business_holidays_migration_deny" ON public.business_holidays;
DROP POLICY IF EXISTS "form_field_sla_config_migration_deny" ON public.form_field_sla_config;
DROP POLICY IF EXISTS "sla_instances_migration_deny" ON public.sla_instances;
DROP POLICY IF EXISTS "escalation_events_migration_deny" ON public.escalation_events;

-- Ensure scoped policies exist for supporting tables (idempotent by name)
DROP POLICY IF EXISTS "View holidays in org" ON public.business_holidays;
CREATE POLICY "View holidays in org" ON public.business_holidays
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Admins manage holidays" ON public.business_holidays;
CREATE POLICY "Admins manage holidays" ON public.business_holidays
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    AND organization_id = business_holidays.organization_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    AND organization_id = business_holidays.organization_id)
);

DROP POLICY IF EXISTS "View field SLA config" ON public.form_field_sla_config;
CREATE POLICY "View field SLA config" ON public.form_field_sla_config
FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT f.id FROM public.forms f
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE pu.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Admins manage field SLA config" ON public.form_field_sla_config;
CREATE POLICY "Admins manage field SLA config" ON public.form_field_sla_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_field_sla_config.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE f.id = form_field_sla_config.form_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
);

-- Ensure project-scoped SELECT remains after deny removal (canonical from 20260205)
DROP POLICY IF EXISTS "View SLA instances" ON public.sla_instances;
CREATE POLICY "View SLA instances" ON public.sla_instances
FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT f.id FROM public.forms f
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE pu.user_id = auth.uid()
  )
);

-- Harden historical permissive SLA policies (confirmed USING(true) / WITH CHECK(true))
-- Leave unrelated policies (e.g. "Project members can manage SLA instances" from
-- 20260608) in place — they are already project-scoped, not USING(true).
DROP POLICY IF EXISTS "Manage SLA instances" ON public.sla_instances;
CREATE POLICY "Manage SLA instances" ON public.sla_instances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
      AND (
        sla_instances.form_id IS NULL
        OR up.organization_id IN (
          SELECT f.organization_id FROM public.forms f WHERE f.id = sla_instances.form_id
        )
      )
  )
  OR (
    sla_instances.form_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.forms f
      JOIN public.project_users pu ON pu.project_id = f.project_id
      WHERE f.id = sla_instances.form_id
        AND pu.user_id = auth.uid()
        AND pu.role IN ('admin', 'editor')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
      AND (
        sla_instances.form_id IS NULL
        OR up.organization_id IN (
          SELECT f.organization_id FROM public.forms f WHERE f.id = sla_instances.form_id
        )
      )
  )
  OR (
    sla_instances.form_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.forms f
      JOIN public.project_users pu ON pu.project_id = f.project_id
      WHERE f.id = sla_instances.form_id
        AND pu.user_id = auth.uid()
        AND pu.role IN ('admin', 'editor')
    )
  )
);

DROP POLICY IF EXISTS "View escalation events" ON public.escalation_events;
CREATE POLICY "View escalation events" ON public.escalation_events
FOR SELECT
TO authenticated
USING (
  sla_instance_id IN (
    SELECT si.id
    FROM public.sla_instances si
    JOIN public.forms f ON f.id = si.form_id
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Insert escalation events" ON public.escalation_events;
CREATE POLICY "Insert escalation events" ON public.escalation_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sla_instances si
    JOIN public.forms f ON f.id = si.form_id
    JOIN public.project_users pu ON pu.project_id = f.project_id
    WHERE si.id = escalation_events.sla_instance_id
      AND pu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.sla_instances si
    JOIN public.forms f ON f.id = si.form_id
    JOIN public.user_profiles up ON up.organization_id = f.organization_id
    WHERE si.id = escalation_events.sla_instance_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
  )
);

-- Note: Nest/Edge SLA processors use the service_role key (bypasses RLS).

CREATE INDEX IF NOT EXISTS idx_sla_templates_org ON public.sla_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_sla_templates_project ON public.sla_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chains_org ON public.escalation_chains(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_levels_chain ON public.escalation_levels(chain_id);
CREATE INDEX IF NOT EXISTS idx_sla_instances_submission ON public.sla_instances(submission_id);
CREATE INDEX IF NOT EXISTS idx_sla_instances_status ON public.sla_instances(status);
CREATE INDEX IF NOT EXISTS idx_sla_instances_breach
  ON public.sla_instances(breach_at)
  WHERE status::text IN ('on_track', 'warning');
CREATE INDEX IF NOT EXISTS idx_escalation_events_instance ON public.escalation_events(sla_instance_id);
CREATE INDEX IF NOT EXISTS idx_form_field_sla_form ON public.form_field_sla_config(form_id);

-- Same signature as 20260205052304 (CREATE OR REPLACE — no overload)
CREATE OR REPLACE FUNCTION public.calculate_business_hours(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  business_start TIME DEFAULT '09:00:00',
  business_end TIME DEFAULT '17:00:00',
  business_days TEXT[] DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  org_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_hours NUMERIC := 0;
  curr_date DATE;
  day_start TIMESTAMPTZ;
  day_end TIMESTAMPTZ;
  work_start TIMESTAMPTZ;
  work_end TIMESTAMPTZ;
  day_name TEXT;
  is_holiday BOOLEAN;
BEGIN
  IF end_time <= start_time THEN
    RETURN 0;
  END IF;

  curr_date := start_time::DATE;
  WHILE curr_date <= end_time::DATE LOOP
    day_name := TRIM(TO_CHAR(curr_date, 'Day'));
    IF day_name = ANY (business_days) THEN
      is_holiday := FALSE;
      IF org_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.business_holidays
          WHERE organization_id = org_id AND holiday_date = curr_date
        ) INTO is_holiday;
      END IF;
      IF NOT is_holiday THEN
        day_start := curr_date + business_start;
        day_end := curr_date + business_end;
        work_start := GREATEST(start_time, day_start);
        work_end := LEAST(end_time, day_end);
        IF work_end > work_start THEN
          total_hours := total_hours + EXTRACT(EPOCH FROM (work_end - work_start)) / 3600;
        END IF;
      END IF;
    END IF;
    curr_date := curr_date + INTERVAL '1 day';
  END LOOP;

  RETURN ROUND(total_hours, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_business_hours(TIMESTAMPTZ, TIMESTAMPTZ, TIME, TIME, TEXT[], UUID)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
