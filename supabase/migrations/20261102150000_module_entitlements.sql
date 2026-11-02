-- Paid modules per organisation (entitlements).
--
-- platform_modules       catalogue of sellable built-in modules
-- platform_plans         plans and the modules / limits they include
-- org_subscriptions      each organisation's plan and billing period
-- org_entitlements       the single answer to "may this organisation use module X?"
-- module_usage_counters  metered usage per organisation, module, metric and month
-- entitlement_audit_log  append-only history of every subscription / entitlement change
-- platform_admins        the vendor team that manages subscriptions (not customer admins)
--
-- Access levels returned by module_access_level():
--   full       entitled and within the paid period
--   grace      period ended, still inside the grace days: full use, admins are warned
--   read_only  expired or suspended: existing data stays visible, nothing new can run
--   none       never entitled
--
-- Every existing organisation is seeded on the "all-modules" plan so nobody loses access
-- when this is applied. New organisations get the plan marked is_default.
-- Safe to run more than once. Apply in the Supabase SQL Editor for each environment.

CREATE TABLE IF NOT EXISTS public.platform_modules (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{1,48}$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_modules (key, name, description, metrics, sort_order) VALUES
  ('ai-builder', 'AI Builder', 'Build forms, workflows and reports by describing them, plus the AI assistant.',
   '{"ai_requests": "AI requests per month"}', 10),
  ('asset-discovery', 'Asset Discovery', 'Network, cloud and VMware discovery, discovery agents and topology.',
   '{"discovery_jobs": "Discovery jobs started per month"}', 20),
  ('integration-studio', 'Integration Studio', 'Connectors and integrations with external systems.', '{}', 30),
  ('promotional-transfer', 'Promotional Transfer', 'Promote configuration from Dev to Prod.', '{}', 40),
  ('real-estate', 'Real Estate Network', 'Real estate lead generation and network.', '{}', 50)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, metrics = EXCLUDED.metrics, sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.platform_plans (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{1,48}$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  modules text[] NOT NULL DEFAULT '{}',
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_plans_single_default
  ON public.platform_plans (is_default) WHERE is_default;

INSERT INTO public.platform_plans (key, name, description, modules, limits, is_default, sort_order) VALUES
  ('all-modules', 'All modules', 'Every module, no limits. Existing organisations start here.',
   ARRAY['ai-builder', 'asset-discovery', 'integration-studio', 'promotional-transfer', 'real-estate'], '{}', true, 0),
  ('starter', 'Starter', 'Forms, workflows, reports and solutions.', ARRAY[]::text[], '{}', false, 10),
  ('professional', 'Professional', 'Starter plus AI Builder and Integration Studio.',
   ARRAY['ai-builder', 'integration-studio'], '{"ai-builder": {"ai_requests": 2000}}', false, 20),
  ('enterprise', 'Enterprise', 'Professional plus Promotional Transfer.',
   ARRAY['ai-builder', 'integration-studio', 'promotional-transfer'], '{"ai-builder": {"ai_requests": 10000}}', false, 30)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES public.platform_plans(key),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'past_due', 'expired', 'cancelled')),
  current_period_end timestamptz,
  grace_days int NOT NULL DEFAULT 14 CHECK (grace_days BETWEEN 0 AND 365),
  seats int CHECK (seats IS NULL OR seats > 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(key),
  source text NOT NULL CHECK (source IN ('plan', 'add_on', 'trial', 'manual', 'legacy')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  grace_days int NOT NULL DEFAULT 14 CHECK (grace_days BETWEEN 0 AND 365),
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_entitlements_org_module_key UNIQUE (organization_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.module_usage_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(key),
  metric text NOT NULL,
  period_start date NOT NULL,
  used bigint NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key, metric, period_start)
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid,
  actor_id uuid,
  actor_source text NOT NULL DEFAULT 'sql',
  action text NOT NULL,
  module_key text,
  reason text NOT NULL DEFAULT '',
  before_state jsonb,
  after_state jsonb
);

CREATE INDEX IF NOT EXISTS entitlement_audit_log_org_idx ON public.entitlement_audit_log (organization_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Access level
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.entitlement_level(
  _status text, _starts_at timestamptz, _ends_at timestamptz, _grace_days int, _at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _status IS NULL THEN 'none'
    WHEN _status <> 'active' THEN 'read_only'
    WHEN _starts_at > _at THEN 'none'
    WHEN _ends_at IS NULL OR _at <= _ends_at THEN 'full'
    WHEN _at <= _ends_at + make_interval(days => _grace_days) THEN 'grace'
    ELSE 'read_only'
  END;
$$;

CREATE OR REPLACE FUNCTION public.module_access_level(_org_id uuid, _module text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.entitlement_level(e.status, e.starts_at, e.ends_at, e.grace_days)
       FROM public.org_entitlements e
      WHERE e.organization_id = _org_id AND e.module_key = _module),
    'none');
$$;

CREATE OR REPLACE FUNCTION public.has_module(_org_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.module_access_level(_org_id, _module) IN ('full', 'grace');
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

-- ---------------------------------------------------------------------------
-- Metered usage: atomically adds _amount unless that would pass _limit (NULL = unlimited).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_module_usage(
  _org_id uuid, _module text, _metric text, _amount int, _limit bigint
)
RETURNS TABLE (allowed boolean, used bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period date := date_trunc('month', now())::date;
  _used bigint;
BEGIN
  IF _amount < 0 THEN
    RAISE EXCEPTION 'amount must not be negative';
  END IF;

  INSERT INTO public.module_usage_counters (organization_id, module_key, metric, period_start, used)
  VALUES (_org_id, _module, _metric, _period, 0)
  ON CONFLICT DO NOTHING;

  UPDATE public.module_usage_counters c
     SET used = c.used + _amount, updated_at = now()
   WHERE c.organization_id = _org_id AND c.module_key = _module AND c.metric = _metric AND c.period_start = _period
     AND (_limit IS NULL OR c.used + _amount <= _limit)
  RETURNING c.used INTO _used;

  IF FOUND THEN
    RETURN QUERY SELECT true, _used;
  ELSE
    RETURN QUERY
      SELECT false, c.used FROM public.module_usage_counters c
       WHERE c.organization_id = _org_id AND c.module_key = _module AND c.metric = _metric AND c.period_start = _period;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit: every change to subscriptions and entitlements is recorded by trigger,
-- including edits made directly in the SQL editor. The platform API sets
-- app.actor_id / app.actor_source / app.reason for the transaction.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_entitlement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := COALESCE(NULLIF(current_setting('app.actor_id', true), '')::uuid, auth.uid());
  _source text := COALESCE(NULLIF(current_setting('app.actor_source', true), ''), CASE WHEN auth.uid() IS NULL THEN 'sql' ELSE 'user' END);
  _reason text := COALESCE(current_setting('app.reason', true), '');
  _row jsonb := to_jsonb(COALESCE(NEW, OLD));
BEGIN
  INSERT INTO public.entitlement_audit_log (organization_id, actor_id, actor_source, action, module_key, reason, before_state, after_state)
  VALUES (
    (_row ->> 'organization_id')::uuid,
    _actor,
    _source,
    lower(TG_TABLE_NAME || '.' || TG_OP),
    _row ->> 'module_key',
    _reason,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS org_subscriptions_audit ON public.org_subscriptions;
CREATE TRIGGER org_subscriptions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_entitlement_change();

DROP TRIGGER IF EXISTS org_entitlements_audit ON public.org_entitlements;
CREATE TRIGGER org_entitlements_audit
AFTER INSERT OR UPDATE OR DELETE ON public.org_entitlements
FOR EACH ROW EXECUTE FUNCTION public.audit_entitlement_change();

DROP TRIGGER IF EXISTS platform_plans_audit ON public.platform_plans;
CREATE TRIGGER platform_plans_audit
AFTER INSERT OR UPDATE OR DELETE ON public.platform_plans
FOR EACH ROW EXECUTE FUNCTION public.audit_entitlement_change();

CREATE OR REPLACE FUNCTION public.entitlement_audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'entitlement_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS entitlement_audit_log_append_only ON public.entitlement_audit_log;
CREATE TRIGGER entitlement_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.entitlement_audit_log
FOR EACH ROW EXECUTE FUNCTION public.entitlement_audit_log_is_append_only();

CREATE OR REPLACE FUNCTION public.touch_entitlements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_subscriptions_touch ON public.org_subscriptions;
CREATE TRIGGER org_subscriptions_touch BEFORE UPDATE ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_entitlements_updated_at();
DROP TRIGGER IF EXISTS org_entitlements_touch ON public.org_entitlements;
CREATE TRIGGER org_entitlements_touch BEFORE UPDATE ON public.org_entitlements
FOR EACH ROW EXECUTE FUNCTION public.touch_entitlements_updated_at();
DROP TRIGGER IF EXISTS platform_plans_touch ON public.platform_plans;
CREATE TRIGGER platform_plans_touch BEFORE UPDATE ON public.platform_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_entitlements_updated_at();

-- ---------------------------------------------------------------------------
-- Platform operations (called by the backend with the service role)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_entitlement_actor(_actor uuid, _source text, _reason text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('app.actor_id', COALESCE(_actor::text, ''), true),
         set_config('app.actor_source', COALESCE(_source, ''), true),
         set_config('app.reason', COALESCE(_reason, ''), true);
$$;

-- Puts an organisation on a plan. Plan-sourced entitlements follow the plan;
-- add-ons, trials and manual grants are left alone.
CREATE OR REPLACE FUNCTION public.platform_apply_plan(
  _org_id uuid,
  _plan_key text,
  _status text DEFAULT 'active',
  _period_end timestamptz DEFAULT NULL,
  _grace_days int DEFAULT 14,
  _actor uuid DEFAULT NULL,
  _source text DEFAULT 'console',
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.platform_plans%ROWTYPE;
  _module text;
  _entitlement_status text := CASE WHEN _status IN ('expired', 'cancelled') THEN 'suspended' ELSE 'active' END;
BEGIN
  SELECT * INTO _plan FROM public.platform_plans WHERE key = _plan_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown plan %', _plan_key;
  END IF;
  PERFORM public.set_entitlement_actor(_actor, _source, _reason);

  INSERT INTO public.org_subscriptions (organization_id, plan_key, status, current_period_end, grace_days)
  VALUES (_org_id, _plan_key, _status, _period_end, _grace_days)
  ON CONFLICT (organization_id) DO UPDATE
    SET plan_key = EXCLUDED.plan_key, status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end, grace_days = EXCLUDED.grace_days;

  DELETE FROM public.org_entitlements
   WHERE organization_id = _org_id AND source IN ('plan', 'legacy') AND NOT (module_key = ANY (_plan.modules));

  FOREACH _module IN ARRAY _plan.modules LOOP
    INSERT INTO public.org_entitlements (organization_id, module_key, source, status, ends_at, grace_days, limits)
    VALUES (_org_id, _module, 'plan', _entitlement_status, _period_end, _grace_days, COALESCE(_plan.limits -> _module, '{}'::jsonb))
    ON CONFLICT (organization_id, module_key) DO UPDATE
      SET source = CASE WHEN org_entitlements.source IN ('plan', 'legacy') THEN 'plan' ELSE org_entitlements.source END,
          status = CASE WHEN org_entitlements.source IN ('plan', 'legacy') THEN EXCLUDED.status ELSE org_entitlements.status END,
          ends_at = CASE WHEN org_entitlements.source IN ('plan', 'legacy') THEN EXCLUDED.ends_at ELSE org_entitlements.ends_at END,
          grace_days = CASE WHEN org_entitlements.source IN ('plan', 'legacy') THEN EXCLUDED.grace_days ELSE org_entitlements.grace_days END,
          limits = CASE WHEN org_entitlements.source IN ('plan', 'legacy') THEN EXCLUDED.limits ELSE org_entitlements.limits END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_entitlement(
  _org_id uuid,
  _module text,
  _source text,
  _status text,
  _ends_at timestamptz,
  _grace_days int,
  _limits jsonb,
  _actor uuid DEFAULT NULL,
  _actor_source text DEFAULT 'console',
  _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_entitlement_actor(_actor, _actor_source, _reason);
  INSERT INTO public.org_entitlements (organization_id, module_key, source, status, ends_at, grace_days, limits)
  VALUES (_org_id, _module, _source, _status, _ends_at, COALESCE(_grace_days, 14), COALESCE(_limits, '{}'::jsonb))
  ON CONFLICT (organization_id, module_key) DO UPDATE
    SET source = EXCLUDED.source, status = EXCLUDED.status, ends_at = EXCLUDED.ends_at,
        grace_days = EXCLUDED.grace_days, limits = EXCLUDED.limits;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_entitlement(
  _org_id uuid, _module text, _actor uuid DEFAULT NULL, _actor_source text DEFAULT 'console', _reason text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_entitlement_actor(_actor, _actor_source, _reason);
  DELETE FROM public.org_entitlements WHERE organization_id = _org_id AND module_key = _module;
END;
$$;

-- Creates or edits a plan. With _apply_to_subscribers every organisation on the plan
-- is re-applied, so plan-sourced entitlements match the new module list and limits.
CREATE OR REPLACE FUNCTION public.platform_upsert_plan(
  _key text,
  _name text,
  _description text,
  _modules text[],
  _limits jsonb,
  _active boolean,
  _apply_to_subscribers boolean,
  _actor uuid DEFAULT NULL,
  _actor_source text DEFAULT 'console',
  _reason text DEFAULT ''
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _applied int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(_modules) m WHERE m NOT IN (SELECT key FROM public.platform_modules)) THEN
    RAISE EXCEPTION 'Plan % lists an unknown module', _key;
  END IF;
  PERFORM public.set_entitlement_actor(_actor, _actor_source, _reason);

  INSERT INTO public.platform_plans (key, name, description, modules, limits, active)
  VALUES (_key, _name, COALESCE(_description, ''), _modules, COALESCE(_limits, '{}'::jsonb), COALESCE(_active, true))
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description, modules = EXCLUDED.modules,
        limits = EXCLUDED.limits, active = EXCLUDED.active;

  IF _apply_to_subscribers THEN
    FOR _sub IN SELECT * FROM public.org_subscriptions WHERE plan_key = _key LOOP
      PERFORM public.platform_apply_plan(_sub.organization_id, _key, _sub.status, _sub.current_period_end,
                                         _sub.grace_days, _actor, _actor_source, _reason);
      _applied := _applied + 1;
    END LOOP;
  END IF;
  RETURN _applied;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_log_entitlement_event(
  _org_id uuid, _module text, _action text, _actor uuid, _actor_source text, _detail jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.entitlement_audit_log (organization_id, actor_id, actor_source, action, module_key, after_state)
  VALUES (_org_id, _actor, COALESCE(_actor_source, 'api'), _action, _module, _detail);
$$;

-- New organisations start on the default plan.
CREATE OR REPLACE FUNCTION public.assign_default_plan_to_new_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default text;
BEGIN
  SELECT key INTO _default FROM public.platform_plans WHERE is_default AND active LIMIT 1;
  IF _default IS NOT NULL THEN
    PERFORM public.platform_apply_plan(NEW.id, _default, 'active', NULL, 14, NULL, 'signup', 'default plan for new organisation');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_assign_default_plan ON public.organizations;
CREATE TRIGGER organizations_assign_default_plan
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.assign_default_plan_to_new_org();

-- Seed existing organisations: everything stays enabled.
DO $$
DECLARE
  _org record;
BEGIN
  PERFORM public.set_entitlement_actor(NULL, 'migration', 'existing organisation keeps every module');
  FOR _org IN
    SELECT o.id FROM public.organizations o
     WHERE NOT EXISTS (SELECT 1 FROM public.org_subscriptions s WHERE s.organization_id = o.id)
  LOOP
    INSERT INTO public.org_subscriptions (organization_id, plan_key, status) VALUES (_org.id, 'all-modules', 'active');
    INSERT INTO public.org_entitlements (organization_id, module_key, source)
    SELECT _org.id, m.key, 'legacy' FROM public.platform_modules m
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: members read their own organisation, platform admins read all,
-- only the backend (service role) writes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_modules_read ON public.platform_modules;
CREATE POLICY platform_modules_read ON public.platform_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS platform_plans_read ON public.platform_plans;
CREATE POLICY platform_plans_read ON public.platform_plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS org_subscriptions_read ON public.org_subscriptions;
CREATE POLICY org_subscriptions_read ON public.org_subscriptions FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS org_entitlements_read ON public.org_entitlements;
CREATE POLICY org_entitlements_read ON public.org_entitlements FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS module_usage_counters_read ON public.module_usage_counters;
CREATE POLICY module_usage_counters_read ON public.module_usage_counters FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS platform_admins_read ON public.platform_admins;
CREATE POLICY platform_admins_read ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS entitlement_audit_log_read ON public.entitlement_audit_log;
CREATE POLICY entitlement_audit_log_read ON public.entitlement_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR (organization_id = public.get_current_user_org_id() AND public.is_org_admin_of(organization_id)));

REVOKE ALL ON public.platform_modules, public.platform_plans, public.org_subscriptions, public.org_entitlements,
  public.module_usage_counters, public.platform_admins, public.entitlement_audit_log FROM anon, authenticated;
GRANT SELECT ON public.platform_modules, public.platform_plans, public.org_subscriptions, public.org_entitlements,
  public.module_usage_counters, public.platform_admins, public.entitlement_audit_log TO authenticated;
GRANT ALL ON public.platform_modules, public.platform_plans, public.org_subscriptions, public.org_entitlements,
  public.module_usage_counters, public.platform_admins, public.entitlement_audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.entitlement_audit_log_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.consume_module_usage(uuid, text, text, int, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_apply_plan(uuid, text, text, timestamptz, int, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_set_entitlement(uuid, text, text, text, timestamptz, int, jsonb, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_remove_entitlement(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_log_entitlement_event(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_upsert_plan(text, text, text, text[], jsonb, boolean, boolean, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_upsert_plan(text, text, text, text[], jsonb, boolean, boolean, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.set_entitlement_actor(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_module_usage(uuid, text, text, int, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_apply_plan(uuid, text, text, timestamptz, int, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_entitlement(uuid, text, text, text, timestamptz, int, jsonb, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_remove_entitlement(uuid, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_log_entitlement_event(uuid, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_entitlement_actor(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.module_access_level(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_module(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Database-level lock for Asset Discovery: even direct API writes cannot create
-- scopes or jobs for an organisation that does not have the module.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['itam_network_scopes', 'itam_discovery_jobs'] LOOP
    IF to_regclass('public.' || _table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _table || '_requires_module_insert', _table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_module(organization_id, %L))',
        _table || '_requires_module_insert', _table, 'asset-discovery');
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _table || '_requires_module_update', _table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_module(organization_id, %L))',
        _table || '_requires_module_update', _table, 'asset-discovery');
    END IF;
  END LOOP;
END;
$$;
