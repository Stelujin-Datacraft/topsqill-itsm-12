-- Create user_security_parameters table for per-user security settings
CREATE TABLE public.user_security_parameters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    
    -- Password Policy Settings
    password_min_length INTEGER DEFAULT 9,
    password_require_uppercase BOOLEAN DEFAULT true,
    password_require_lowercase BOOLEAN DEFAULT true,
    password_require_numbers BOOLEAN DEFAULT true,
    password_require_special BOOLEAN DEFAULT true,
    password_expiry_days INTEGER DEFAULT 90,
    password_expiry_warning_days INTEGER DEFAULT 14,
    password_history_count INTEGER DEFAULT 20,
    password_change_min_hours INTEGER DEFAULT 24,
    
    -- Account Lockout Settings
    max_failed_login_attempts INTEGER DEFAULT 3,
    lockout_duration_minutes INTEGER DEFAULT 30,
    account_locked_until TIMESTAMP WITH TIME ZONE,
    failed_login_count INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    
    -- Session Management
    session_timeout_minutes INTEGER DEFAULT 30,
    session_timeout_warning_seconds INTEGER DEFAULT 60,
    max_concurrent_sessions INTEGER DEFAULT 3,
    static_session_timeout BOOLEAN DEFAULT false,
    
    -- Access Restrictions
    access_start_time TIME,
    access_end_time TIME,
    allowed_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    ip_whitelist TEXT[],
    ip_blacklist TEXT[],
    
    -- MFA Settings
    mfa_required BOOLEAN DEFAULT false,
    mfa_method TEXT DEFAULT 'email',
    mfa_pin_expiry_minutes INTEGER DEFAULT 5,
    mfa_max_attempts INTEGER DEFAULT 3,
    
    -- Metadata
    last_password_change TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    
    -- Ensure one security parameter per user
    CONSTRAINT unique_user_security_params UNIQUE (user_id)
);

-- Create organization_security_defaults table for org-wide default settings
CREATE TABLE public.organization_security_defaults (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE,
    
    -- Password Policy Defaults
    password_min_length INTEGER DEFAULT 9,
    password_require_uppercase BOOLEAN DEFAULT true,
    password_require_lowercase BOOLEAN DEFAULT true,
    password_require_numbers BOOLEAN DEFAULT true,
    password_require_special BOOLEAN DEFAULT true,
    password_expiry_days INTEGER DEFAULT 90,
    password_expiry_warning_days INTEGER DEFAULT 14,
    password_history_count INTEGER DEFAULT 20,
    password_change_min_hours INTEGER DEFAULT 24,
    
    -- Account Lockout Defaults
    max_failed_login_attempts INTEGER DEFAULT 3,
    lockout_duration_minutes INTEGER DEFAULT 30,
    
    -- Session Management Defaults
    session_timeout_minutes INTEGER DEFAULT 30,
    session_timeout_warning_seconds INTEGER DEFAULT 60,
    max_concurrent_sessions INTEGER DEFAULT 3,
    static_session_timeout BOOLEAN DEFAULT false,
    
    -- Access Restrictions Defaults
    access_start_time TIME,
    access_end_time TIME,
    allowed_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    
    -- MFA Defaults
    mfa_required BOOLEAN DEFAULT false,
    mfa_method TEXT DEFAULT 'email',
    mfa_pin_expiry_minutes INTEGER DEFAULT 5,
    mfa_max_attempts INTEGER DEFAULT 3,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

-- Enable RLS
ALTER TABLE public.user_security_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_security_defaults ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_security_parameters
CREATE POLICY "Admins can view all security parameters in their org" 
ON public.user_security_parameters 
FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can insert security parameters in their org" 
ON public.user_security_parameters 
FOR INSERT 
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update security parameters in their org" 
ON public.user_security_parameters 
FOR UPDATE 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can delete security parameters in their org" 
ON public.user_security_parameters 
FOR DELETE 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Users can view their own security parameters" 
ON public.user_security_parameters 
FOR SELECT 
USING (user_id = auth.uid());

-- RLS Policies for organization_security_defaults
CREATE POLICY "Members can view org security defaults" 
ON public.organization_security_defaults 
FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Admins can manage org security defaults" 
ON public.organization_security_defaults 
FOR ALL 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_security_params_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_user_security_parameters_updated_at
BEFORE UPDATE ON public.user_security_parameters
FOR EACH ROW
EXECUTE FUNCTION public.update_security_params_updated_at();

CREATE TRIGGER update_org_security_defaults_updated_at
BEFORE UPDATE ON public.organization_security_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_security_params_updated_at();

-- Create function to get effective security parameters for a user
CREATE OR REPLACE FUNCTION public.get_user_effective_security_params(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_params RECORD;
    org_defaults RECORD;
    user_org_id UUID;
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
    
    -- Get organization defaults
    SELECT * INTO org_defaults 
    FROM organization_security_defaults 
    WHERE organization_id = user_org_id;
    
    -- Return merged parameters (user overrides org defaults)
    result := json_build_object(
        'password_min_length', COALESCE(user_params.password_min_length, org_defaults.password_min_length, 9),
        'password_require_uppercase', COALESCE(user_params.password_require_uppercase, org_defaults.password_require_uppercase, true),
        'password_require_lowercase', COALESCE(user_params.password_require_lowercase, org_defaults.password_require_lowercase, true),
        'password_require_numbers', COALESCE(user_params.password_require_numbers, org_defaults.password_require_numbers, true),
        'password_require_special', COALESCE(user_params.password_require_special, org_defaults.password_require_special, true),
        'password_expiry_days', COALESCE(user_params.password_expiry_days, org_defaults.password_expiry_days, 90),
        'password_expiry_warning_days', COALESCE(user_params.password_expiry_warning_days, org_defaults.password_expiry_warning_days, 14),
        'max_failed_login_attempts', COALESCE(user_params.max_failed_login_attempts, org_defaults.max_failed_login_attempts, 3),
        'lockout_duration_minutes', COALESCE(user_params.lockout_duration_minutes, org_defaults.lockout_duration_minutes, 30),
        'session_timeout_minutes', COALESCE(user_params.session_timeout_minutes, org_defaults.session_timeout_minutes, 30),
        'max_concurrent_sessions', COALESCE(user_params.max_concurrent_sessions, org_defaults.max_concurrent_sessions, 3),
        'mfa_required', COALESCE(user_params.mfa_required, org_defaults.mfa_required, false),
        'mfa_method', COALESCE(user_params.mfa_method, org_defaults.mfa_method, 'email'),
        'access_start_time', user_params.access_start_time,
        'access_end_time', user_params.access_end_time,
        'allowed_days', COALESCE(user_params.allowed_days, org_defaults.allowed_days),
        'ip_whitelist', user_params.ip_whitelist,
        'account_locked_until', user_params.account_locked_until,
        'failed_login_count', COALESCE(user_params.failed_login_count, 0),
        'last_password_change', user_params.last_password_change,
        'last_login', user_params.last_login
    );
    
    RETURN result;
END;
$$;