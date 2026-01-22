-- Create LDAP configurations table for storing LDAP server settings per organization
CREATE TABLE public.ldap_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Primary LDAP',
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Connection settings
    server_url TEXT NOT NULL,
    base_dn TEXT NOT NULL,
    bind_dn TEXT, -- Service account DN for searching
    bind_password_encrypted TEXT, -- Encrypted bind password (stored securely)
    
    -- Search settings
    user_search_base TEXT, -- OU where users are located
    user_search_filter TEXT DEFAULT '(sAMAccountName={username})',
    group_search_base TEXT, -- OU where groups are located
    group_search_filter TEXT DEFAULT '(objectClass=group)',
    
    -- Attribute mappings
    username_attribute TEXT DEFAULT 'sAMAccountName',
    email_attribute TEXT DEFAULT 'mail',
    first_name_attribute TEXT DEFAULT 'givenName',
    last_name_attribute TEXT DEFAULT 'sn',
    display_name_attribute TEXT DEFAULT 'displayName',
    member_of_attribute TEXT DEFAULT 'memberOf',
    
    -- Security settings
    use_ssl BOOLEAN DEFAULT true,
    use_starttls BOOLEAN DEFAULT false,
    allow_self_signed_certs BOOLEAN DEFAULT false,
    connection_timeout_seconds INTEGER DEFAULT 10,
    
    -- Behavior settings
    auto_provision_users BOOLEAN DEFAULT true,
    sync_user_status BOOLEAN DEFAULT true,
    fallback_to_local_auth BOOLEAN DEFAULT true,
    
    -- Sync settings
    sync_enabled BOOLEAN DEFAULT false,
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    last_sync_error TEXT,
    
    -- Metadata
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(organization_id, name)
);

-- Create LDAP group mappings table
CREATE TABLE public.ldap_group_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ldap_config_id UUID NOT NULL REFERENCES public.ldap_configurations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- LDAP group info
    ldap_group_dn TEXT NOT NULL, -- Full DN of the LDAP group
    ldap_group_name TEXT NOT NULL, -- Display name
    
    -- Mapping targets (one of these should be set)
    mapped_role TEXT, -- Maps to user_profiles.role
    mapped_security_template_id UUID REFERENCES public.security_templates(id) ON DELETE SET NULL,
    mapped_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    
    -- Priority (lower = higher priority when user is in multiple groups)
    priority INTEGER DEFAULT 100,
    
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(ldap_config_id, ldap_group_dn)
);

-- Create LDAP sync logs table for tracking sync operations
CREATE TABLE public.ldap_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ldap_config_id UUID NOT NULL REFERENCES public.ldap_configurations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running', -- running, success, failed, partial
    
    -- Statistics
    users_found INTEGER DEFAULT 0,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    users_disabled INTEGER DEFAULT 0,
    groups_synced INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Details
    error_details JSONB,
    sync_log JSONB,
    
    triggered_by UUID
);

-- Create LDAP user links table to track which users came from LDAP
CREATE TABLE public.ldap_user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ldap_config_id UUID NOT NULL REFERENCES public.ldap_configurations(id) ON DELETE CASCADE,
    
    ldap_dn TEXT NOT NULL, -- User's Distinguished Name in LDAP
    ldap_uid TEXT, -- Unique identifier (objectGUID, entryUUID, etc.)
    ldap_username TEXT NOT NULL, -- sAMAccountName or uid
    
    -- Cached group memberships
    ldap_groups JSONB DEFAULT '[]',
    
    -- Sync tracking
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    last_ldap_login_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(user_id),
    UNIQUE(ldap_config_id, ldap_dn)
);

-- Enable RLS on all tables
ALTER TABLE public.ldap_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ldap_group_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ldap_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ldap_user_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ldap_configurations (only org admins can manage)
CREATE POLICY "Org admins can view LDAP configs" ON public.ldap_configurations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_configurations.organization_id
            AND up.role = 'admin'
        )
    );

CREATE POLICY "Org admins can insert LDAP configs" ON public.ldap_configurations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_configurations.organization_id
            AND up.role = 'admin'
        )
    );

CREATE POLICY "Org admins can update LDAP configs" ON public.ldap_configurations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_configurations.organization_id
            AND up.role = 'admin'
        )
    );

CREATE POLICY "Org admins can delete LDAP configs" ON public.ldap_configurations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_configurations.organization_id
            AND up.role = 'admin'
        )
    );

-- RLS Policies for ldap_group_mappings
CREATE POLICY "Org admins can manage group mappings" ON public.ldap_group_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_group_mappings.organization_id
            AND up.role = 'admin'
        )
    );

-- RLS Policies for ldap_sync_logs
CREATE POLICY "Org admins can view sync logs" ON public.ldap_sync_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND up.organization_id = ldap_sync_logs.organization_id
            AND up.role = 'admin'
        )
    );

-- RLS Policies for ldap_user_links
CREATE POLICY "Users can view their own LDAP link" ON public.ldap_user_links
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Org admins can view all LDAP links" ON public.ldap_user_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.ldap_configurations lc ON lc.id = ldap_user_links.ldap_config_id
            WHERE up.id = auth.uid()
            AND up.organization_id = lc.organization_id
            AND up.role = 'admin'
        )
    );

-- Create indexes for performance
CREATE INDEX idx_ldap_configs_org ON public.ldap_configurations(organization_id);
CREATE INDEX idx_ldap_group_mappings_config ON public.ldap_group_mappings(ldap_config_id);
CREATE INDEX idx_ldap_sync_logs_config ON public.ldap_sync_logs(ldap_config_id);
CREATE INDEX idx_ldap_user_links_user ON public.ldap_user_links(user_id);
CREATE INDEX idx_ldap_user_links_config ON public.ldap_user_links(ldap_config_id);

-- Function to get active LDAP config for an organization
CREATE OR REPLACE FUNCTION public.get_org_ldap_config(org_id UUID)
RETURNS public.ldap_configurations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.ldap_configurations
    WHERE organization_id = org_id
    AND is_enabled = true
    ORDER BY created_at ASC
    LIMIT 1;
$$;

-- Function to check if user is LDAP-authenticated
CREATE OR REPLACE FUNCTION public.is_ldap_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.ldap_user_links
        WHERE user_id = target_user_id
    );
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_ldap_configurations_updated_at
    BEFORE UPDATE ON public.ldap_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ldap_group_mappings_updated_at
    BEFORE UPDATE ON public.ldap_group_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ldap_user_links_updated_at
    BEFORE UPDATE ON public.ldap_user_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();