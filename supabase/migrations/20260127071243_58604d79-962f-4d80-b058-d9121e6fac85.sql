-- =============================================
-- API INTEGRATION MODULE - Database Schema
-- =============================================

-- 1. API Keys table for managing external access
CREATE TABLE public.api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit_per_minute INTEGER DEFAULT 60,
    allowed_ips TEXT[],
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. API Request Logs for audit trail
CREATE TABLE public.api_request_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    request_body JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX idx_api_keys_org ON public.api_keys(organization_id);
CREATE INDEX idx_api_keys_project ON public.api_keys(project_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_request_logs_key ON public.api_request_logs(api_key_id);
CREATE INDEX idx_api_request_logs_created ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_org ON public.api_request_logs(organization_id);

-- 4. Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for api_keys
CREATE POLICY "Users can view API keys in their organization"
ON public.api_keys FOR SELECT
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can create API keys"
ON public.api_keys FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can update API keys"
ON public.api_keys FOR UPDATE
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

CREATE POLICY "Admins can delete API keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

-- 6. RLS Policies for api_request_logs
CREATE POLICY "Admins can view API request logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_current_user_admin()
);

-- 7. Function to validate API key (for edge functions)
CREATE OR REPLACE FUNCTION public.validate_api_key(key_hash_param TEXT)
RETURNS TABLE(
    api_key_id UUID,
    organization_id UUID,
    project_id UUID,
    permissions JSONB,
    rate_limit INTEGER,
    allowed_ips TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ak.id,
        ak.organization_id,
        ak.project_id,
        ak.permissions,
        ak.rate_limit_per_minute,
        ak.allowed_ips
    FROM public.api_keys ak
    WHERE ak.key_hash = key_hash_param
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
END;
$$;

-- 8. Function to log API request
CREATE OR REPLACE FUNCTION public.log_api_request(
    p_api_key_id UUID,
    p_organization_id UUID,
    p_endpoint TEXT,
    p_method TEXT,
    p_request_body JSONB,
    p_response_status INTEGER,
    p_response_time_ms INTEGER,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.api_request_logs (
        api_key_id, organization_id, endpoint, method, 
        request_body, response_status, response_time_ms,
        ip_address, user_agent, error_message
    ) VALUES (
        p_api_key_id, p_organization_id, p_endpoint, p_method,
        p_request_body, p_response_status, p_response_time_ms,
        p_ip_address, p_user_agent, p_error_message
    ) RETURNING id INTO log_id;
    
    -- Update last_used_at on the API key
    IF p_api_key_id IS NOT NULL THEN
        UPDATE public.api_keys 
        SET last_used_at = now() 
        WHERE id = p_api_key_id;
    END IF;
    
    RETURN log_id;
END;
$$;

-- 9. Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();