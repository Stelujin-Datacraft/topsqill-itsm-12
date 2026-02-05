
-- Create enum for escalation levels
CREATE TYPE public.escalation_level AS ENUM ('L1', 'L2', 'L3', 'L4');

-- Create enum for SLA status
CREATE TYPE public.sla_status AS ENUM ('on_track', 'warning', 'breached', 'completed', 'paused');

-- SLA Templates - Reusable SLA rule definitions
CREATE TABLE public.sla_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    warning_hours INTEGER NOT NULL DEFAULT 4,
    breach_hours INTEGER NOT NULL DEFAULT 8,
    use_business_hours BOOLEAN DEFAULT false,
    business_start_time TIME DEFAULT '09:00:00',
    business_end_time TIME DEFAULT '17:00:00',
    business_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    exclude_holidays BOOLEAN DEFAULT false,
    priority_multipliers JSONB DEFAULT '{"high": 0.5, "medium": 1, "low": 2}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Escalation Chains
CREATE TABLE public.escalation_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Escalation Levels
CREATE TABLE public.escalation_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID REFERENCES public.escalation_chains(id) ON DELETE CASCADE NOT NULL,
    level public.escalation_level NOT NULL,
    level_order INTEGER NOT NULL DEFAULT 1,
    escalate_to_user_id UUID,
    escalate_to_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    escalate_to_role TEXT,
    hours_after_breach INTEGER NOT NULL DEFAULT 0,
    send_email BOOLEAN DEFAULT true,
    send_notification BOOLEAN DEFAULT true,
    send_sms BOOLEAN DEFAULT false,
    custom_message TEXT,
    auto_reassign BOOLEAN DEFAULT false,
    change_priority BOOLEAN DEFAULT false,
    new_priority TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- SLA Instances
CREATE TABLE public.sla_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.form_submissions(id) ON DELETE CASCADE NOT NULL,
    field_id TEXT NOT NULL,
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.sla_templates(id) ON DELETE SET NULL,
    chain_id UUID REFERENCES public.escalation_chains(id) ON DELETE SET NULL,
    current_stage TEXT NOT NULL,
    status public.sla_status DEFAULT 'on_track',
    priority TEXT DEFAULT 'medium',
    started_at TIMESTAMPTZ DEFAULT now(),
    warning_at TIMESTAMPTZ,
    breach_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    total_paused_minutes INTEGER DEFAULT 0,
    current_escalation_level public.escalation_level,
    last_escalation_at TIMESTAMPTZ,
    escalation_count INTEGER DEFAULT 0,
    assigned_to UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(submission_id, field_id)
);

-- Escalation Events
CREATE TABLE public.escalation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_instance_id UUID REFERENCES public.sla_instances(id) ON DELETE CASCADE NOT NULL,
    escalation_level public.escalation_level NOT NULL,
    event_type TEXT NOT NULL,
    notified_users UUID[] DEFAULT '{}',
    notified_groups UUID[] DEFAULT '{}',
    actions_taken JSONB DEFAULT '[]'::jsonb,
    message TEXT,
    triggered_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Business Holidays
CREATE TABLE public.business_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, holiday_date)
);

-- Form Field SLA Config
CREATE TABLE public.form_field_sla_config (
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

-- Indexes
CREATE INDEX idx_sla_templates_org ON public.sla_templates(organization_id);
CREATE INDEX idx_sla_templates_project ON public.sla_templates(project_id);
CREATE INDEX idx_escalation_chains_org ON public.escalation_chains(organization_id);
CREATE INDEX idx_escalation_levels_chain ON public.escalation_levels(chain_id);
CREATE INDEX idx_sla_instances_submission ON public.sla_instances(submission_id);
CREATE INDEX idx_sla_instances_status ON public.sla_instances(status);
CREATE INDEX idx_sla_instances_breach ON public.sla_instances(breach_at) WHERE status IN ('on_track', 'warning');
CREATE INDEX idx_escalation_events_instance ON public.escalation_events(sla_instance_id);
CREATE INDEX idx_escalation_events_created ON public.escalation_events(created_at DESC);
CREATE INDEX idx_form_field_sla_form ON public.form_field_sla_config(form_id);

-- Enable RLS
ALTER TABLE public.sla_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_sla_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "View SLA templates in org" ON public.sla_templates FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins manage SLA templates" ON public.sla_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View escalation chains in org" ON public.escalation_chains FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins manage escalation chains" ON public.escalation_chains FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View escalation levels" ON public.escalation_levels FOR SELECT USING (
    chain_id IN (SELECT id FROM public.escalation_chains WHERE organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
);
CREATE POLICY "Admins manage escalation levels" ON public.escalation_levels FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View SLA instances" ON public.sla_instances FOR SELECT USING (
    form_id IN (SELECT f.id FROM public.forms f JOIN public.project_users pu ON pu.project_id = f.project_id WHERE pu.user_id = auth.uid())
);
CREATE POLICY "Manage SLA instances" ON public.sla_instances FOR ALL USING (true);

CREATE POLICY "View escalation events" ON public.escalation_events FOR SELECT USING (
    sla_instance_id IN (SELECT si.id FROM public.sla_instances si JOIN public.forms f ON f.id = si.form_id JOIN public.project_users pu ON pu.project_id = f.project_id WHERE pu.user_id = auth.uid())
);
CREATE POLICY "Insert escalation events" ON public.escalation_events FOR INSERT WITH CHECK (true);

CREATE POLICY "View holidays in org" ON public.business_holidays FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins manage holidays" ON public.business_holidays FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "View field SLA config" ON public.form_field_sla_config FOR SELECT USING (
    form_id IN (SELECT f.id FROM public.forms f JOIN public.project_users pu ON pu.project_id = f.project_id WHERE pu.user_id = auth.uid())
);
CREATE POLICY "Admins manage field SLA config" ON public.form_field_sla_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Business hours calculation function
CREATE OR REPLACE FUNCTION public.calculate_business_hours(
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    business_start TIME DEFAULT '09:00:00',
    business_end TIME DEFAULT '17:00:00',
    business_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    org_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    IF end_time <= start_time THEN RETURN 0; END IF;
    curr_date := start_time::DATE;
    WHILE curr_date <= end_time::DATE LOOP
        day_name := TRIM(TO_CHAR(curr_date, 'Day'));
        IF day_name = ANY(business_days) THEN
            is_holiday := FALSE;
            IF org_id IS NOT NULL THEN
                SELECT EXISTS(SELECT 1 FROM public.business_holidays WHERE organization_id = org_id AND holiday_date = curr_date) INTO is_holiday;
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

-- Triggers for updated_at
CREATE TRIGGER update_sla_templates_ts BEFORE UPDATE ON public.sla_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_escalation_chains_ts BEFORE UPDATE ON public.escalation_chains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sla_instances_ts BEFORE UPDATE ON public.sla_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_form_field_sla_ts BEFORE UPDATE ON public.form_field_sla_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
