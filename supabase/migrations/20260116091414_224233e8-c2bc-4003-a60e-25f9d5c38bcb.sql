-- Create security_templates table for reusable security profiles
CREATE TABLE public.security_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Password Policy
    password_min_length INTEGER DEFAULT 9,
    password_require_uppercase BOOLEAN DEFAULT true,
    password_require_lowercase BOOLEAN DEFAULT true,
    password_require_numbers BOOLEAN DEFAULT true,
    password_require_special BOOLEAN DEFAULT true,
    password_expiry_days INTEGER DEFAULT 90,
    password_expiry_warning_days INTEGER DEFAULT 14,
    password_history_count INTEGER DEFAULT 20,
    password_change_min_hours INTEGER DEFAULT 24,
    
    -- Account Lockout
    max_failed_login_attempts INTEGER DEFAULT 3,
    lockout_duration_minutes INTEGER DEFAULT 30,
    
    -- Session Management
    session_timeout_minutes INTEGER DEFAULT 30,
    session_timeout_warning_seconds INTEGER DEFAULT 60,
    max_concurrent_sessions INTEGER DEFAULT 3,
    static_session_timeout BOOLEAN DEFAULT false,
    
    -- Access Restrictions
    access_start_time TIME,
    access_end_time TIME,
    allowed_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    
    -- MFA Settings
    mfa_required BOOLEAN DEFAULT false,
    mfa_method TEXT DEFAULT 'email',
    mfa_pin_expiry_minutes INTEGER DEFAULT 5,
    mfa_max_attempts INTEGER DEFAULT 3,
    
    -- Metadata
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    
    -- Unique name per organization
    CONSTRAINT unique_template_name_per_org UNIQUE (organization_id, name)
);

-- Add template reference to user_security_parameters
ALTER TABLE public.user_security_parameters 
ADD COLUMN security_template_id UUID REFERENCES public.security_templates(id) ON DELETE SET NULL;

-- Add use_template_settings flag to control override behavior
ALTER TABLE public.user_security_parameters 
ADD COLUMN use_template_settings BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.security_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_templates
CREATE POLICY "Members can view org security templates" 
ON public.security_templates 
FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Admins can manage security templates" 
ON public.security_templates 
FOR ALL 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_security_templates_updated_at
BEFORE UPDATE ON public.security_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_security_params_updated_at();

-- Insert default templates for organizations
CREATE OR REPLACE FUNCTION public.create_default_security_templates(org_id UUID, creator_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Standard User template
    INSERT INTO security_templates (organization_id, name, description, created_by, is_default)
    VALUES (
        org_id, 
        'Standard User', 
        'Default security settings for regular employees',
        creator_id,
        true
    )
    ON CONFLICT (organization_id, name) DO NOTHING;
    
    -- Contractor template - more restrictive
    INSERT INTO security_templates (
        organization_id, name, description, created_by,
        password_expiry_days, session_timeout_minutes, max_concurrent_sessions,
        mfa_required
    )
    VALUES (
        org_id, 
        'Contractor', 
        'Restrictive settings for external contractors',
        creator_id,
        30, 15, 1, true
    )
    ON CONFLICT (organization_id, name) DO NOTHING;
    
    -- Executive template - more lenient
    INSERT INTO security_templates (
        organization_id, name, description, created_by,
        session_timeout_minutes, max_concurrent_sessions
    )
    VALUES (
        org_id, 
        'Executive', 
        'Settings for executive users',
        creator_id,
        60, 5
    )
    ON CONFLICT (organization_id, name) DO NOTHING;
    
    -- High Security template
    INSERT INTO security_templates (
        organization_id, name, description, created_by,
        password_min_length, password_expiry_days, max_failed_login_attempts,
        session_timeout_minutes, mfa_required, static_session_timeout
    )
    VALUES (
        org_id, 
        'High Security', 
        'Maximum security for sensitive access',
        creator_id,
        12, 30, 2, 15, true, true
    )
    ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- Update the get_user_effective_security_params function to include template
CREATE OR REPLACE FUNCTION public.get_user_effective_security_params(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_params RECORD;
    template_params RECORD;
    org_defaults RECORD;
    user_org_id UUID;
    use_template BOOLEAN;
    result JSON;
BEGIN
    -- Get user's organization
    SELECT organization_id INTO user_org_id 
    FROM user_profiles 
    WHERE id = target_user_id;
    
    -- Get user-specific parameters
    SELECT * INTO user_params 
    FROM user_security_parameters 
    WHERE user_id = target_user_id;
    
    use_template := COALESCE(user_params.use_template_settings, true);
    
    -- Get template parameters if assigned
    IF user_params.security_template_id IS NOT NULL THEN
        SELECT * INTO template_params 
        FROM security_templates 
        WHERE id = user_params.security_template_id;
    END IF;
    
    -- Get organization defaults
    SELECT * INTO org_defaults 
    FROM organization_security_defaults 
    WHERE organization_id = user_org_id;
    
    -- Return merged parameters (user > template > org defaults)
    -- If use_template_settings is true, template values are used; otherwise user values override
    result := json_build_object(
        'password_min_length', CASE 
            WHEN NOT use_template AND user_params.password_min_length IS NOT NULL THEN user_params.password_min_length
            WHEN template_params.password_min_length IS NOT NULL THEN template_params.password_min_length
            ELSE COALESCE(org_defaults.password_min_length, 9)
        END,
        'password_require_uppercase', CASE 
            WHEN NOT use_template AND user_params.password_require_uppercase IS NOT NULL THEN user_params.password_require_uppercase
            WHEN template_params.password_require_uppercase IS NOT NULL THEN template_params.password_require_uppercase
            ELSE COALESCE(org_defaults.password_require_uppercase, true)
        END,
        'password_require_lowercase', CASE 
            WHEN NOT use_template AND user_params.password_require_lowercase IS NOT NULL THEN user_params.password_require_lowercase
            WHEN template_params.password_require_lowercase IS NOT NULL THEN template_params.password_require_lowercase
            ELSE COALESCE(org_defaults.password_require_lowercase, true)
        END,
        'password_require_numbers', CASE 
            WHEN NOT use_template AND user_params.password_require_numbers IS NOT NULL THEN user_params.password_require_numbers
            WHEN template_params.password_require_numbers IS NOT NULL THEN template_params.password_require_numbers
            ELSE COALESCE(org_defaults.password_require_numbers, true)
        END,
        'password_require_special', CASE 
            WHEN NOT use_template AND user_params.password_require_special IS NOT NULL THEN user_params.password_require_special
            WHEN template_params.password_require_special IS NOT NULL THEN template_params.password_require_special
            ELSE COALESCE(org_defaults.password_require_special, true)
        END,
        'password_expiry_days', CASE 
            WHEN NOT use_template AND user_params.password_expiry_days IS NOT NULL THEN user_params.password_expiry_days
            WHEN template_params.password_expiry_days IS NOT NULL THEN template_params.password_expiry_days
            ELSE COALESCE(org_defaults.password_expiry_days, 90)
        END,
        'max_failed_login_attempts', CASE 
            WHEN NOT use_template AND user_params.max_failed_login_attempts IS NOT NULL THEN user_params.max_failed_login_attempts
            WHEN template_params.max_failed_login_attempts IS NOT NULL THEN template_params.max_failed_login_attempts
            ELSE COALESCE(org_defaults.max_failed_login_attempts, 3)
        END,
        'lockout_duration_minutes', CASE 
            WHEN NOT use_template AND user_params.lockout_duration_minutes IS NOT NULL THEN user_params.lockout_duration_minutes
            WHEN template_params.lockout_duration_minutes IS NOT NULL THEN template_params.lockout_duration_minutes
            ELSE COALESCE(org_defaults.lockout_duration_minutes, 30)
        END,
        'session_timeout_minutes', CASE 
            WHEN NOT use_template AND user_params.session_timeout_minutes IS NOT NULL THEN user_params.session_timeout_minutes
            WHEN template_params.session_timeout_minutes IS NOT NULL THEN template_params.session_timeout_minutes
            ELSE COALESCE(org_defaults.session_timeout_minutes, 30)
        END,
        'max_concurrent_sessions', CASE 
            WHEN NOT use_template AND user_params.max_concurrent_sessions IS NOT NULL THEN user_params.max_concurrent_sessions
            WHEN template_params.max_concurrent_sessions IS NOT NULL THEN template_params.max_concurrent_sessions
            ELSE COALESCE(org_defaults.max_concurrent_sessions, 3)
        END,
        'mfa_required', CASE 
            WHEN NOT use_template AND user_params.mfa_required IS NOT NULL THEN user_params.mfa_required
            WHEN template_params.mfa_required IS NOT NULL THEN template_params.mfa_required
            ELSE COALESCE(org_defaults.mfa_required, false)
        END,
        'mfa_method', CASE 
            WHEN NOT use_template AND user_params.mfa_method IS NOT NULL THEN user_params.mfa_method
            WHEN template_params.mfa_method IS NOT NULL THEN template_params.mfa_method
            ELSE COALESCE(org_defaults.mfa_method, 'email')
        END,
        'security_template_id', user_params.security_template_id,
        'security_template_name', template_params.name,
        'use_template_settings', use_template,
        'access_start_time', COALESCE(user_params.access_start_time, template_params.access_start_time),
        'access_end_time', COALESCE(user_params.access_end_time, template_params.access_end_time),
        'allowed_days', COALESCE(user_params.allowed_days, template_params.allowed_days, org_defaults.allowed_days),
        'ip_whitelist', user_params.ip_whitelist,
        'account_locked_until', user_params.account_locked_until,
        'failed_login_count', COALESCE(user_params.failed_login_count, 0),
        'last_password_change', user_params.last_password_change,
        'last_login', user_params.last_login
    );
    
    RETURN result;
END;
$$;