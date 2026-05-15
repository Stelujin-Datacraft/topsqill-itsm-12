import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LdapAuthRequest {
  username?: string;
  password?: string;
  organizationId?: string;
  configId?: string;
  // Used by OIDC providers — when present, returns an authorization URL.
  mode?: 'authorize' | 'password' | 'lookup';
  redirectUri?: string;
  state?: string;
  email?: string;
  domain?: string;
  loginHint?: string;
}

interface LdapAuthResponse {
  success: boolean;
  message: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
    ldapDn: string;
    ldapGroups: string[];
  };
  fallbackToLocal?: boolean;
}

function getOidcIssuerUrl(config: { provider_type?: string | null; oidc_issuer_url?: string | null; oidc_tenant_id?: string | null }) {
  if (config.provider_type === 'azure_entra') {
    const tenant = (config.oidc_tenant_id || '').trim().toLowerCase();
    const tenantSegment = ['common', 'organizations', 'consumers'].includes(tenant) ? tenant : 'common';
    return `https://login.microsoftonline.com/${tenantSegment}/v2.0`;
  }

  return config.oidc_issuer_url || '';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LdapAuthRequest = await req.json();
    const { username, password, organizationId, configId, mode, redirectUri, state, email, domain, loginHint } = body;

    if (mode !== 'lookup' && !organizationId) {
      return new Response(
        JSON.stringify({ success: false, message: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔐 IdP auth attempt — org=${organizationId} mode=${mode || 'password'}`);

    if (mode === 'lookup') {
      const resolvedDomain = (domain || email?.split('@')[1] || '').trim().toLowerCase();

      if (!resolvedDomain) {
        return new Response(
          JSON.stringify({ success: true, hasProvider: false, message: 'No domain available for lookup' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: organization, error: organizationError } = await supabase
        .from('organizations')
        .select('id, domain, name')
        .ilike('domain', resolvedDomain)
        .maybeSingle();

      if (organizationError || !organization) {
        return new Response(
          JSON.stringify({ success: true, hasProvider: false, message: 'No organization found for this domain' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: config, error: lookupError } = await supabase
        .from('ldap_configurations')
        .select('id, provider_type, name, is_enabled')
        .eq('organization_id', organization.id)
        .eq('is_enabled', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (lookupError || !config) {
        return new Response(
          JSON.stringify({ success: true, hasProvider: false, organizationId: organization.id, organizationDomain: organization.domain }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          hasProvider: true,
          organizationId: organization.id,
          organizationDomain: organization.domain,
          organizationName: organization.name,
          configId: config.id,
          providerType: config.provider_type || 'ldap',
          providerName: config.name || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active IdP configuration for the organization (or specific one if configId given)
    let configQuery = supabase
      .from('ldap_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_enabled', true);
    if (configId) configQuery = configQuery.eq('id', configId);
    const { data: config, error: configError } = await configQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.log('📌 No active identity provider configuration found');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No active identity provider is configured for this organization',
          fallbackToLocal: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providerType: string = config.provider_type || 'ldap';
    console.log(`🔍 Using ${providerType} config: ${config.name}`);

    // ====== OIDC providers: return an authorization URL ======
    const oidcProviders = ['azure_entra', 'google_workspace', 'okta'];
    if (oidcProviders.includes(providerType)) {
      if (!config.oidc_issuer_url || !config.oidc_client_id) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `${providerType} provider is missing issuer URL or client ID`,
            fallbackToLocal: config.fallback_to_local_auth ?? true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Discover the authorization endpoint via OIDC well-known doc
        const issuerUrl = getOidcIssuerUrl(config);
        const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
        const discoveryRes = await fetch(discoveryUrl);
        if (!discoveryRes.ok) {
          throw new Error(`OIDC discovery failed: ${discoveryRes.status}`);
        }
        const discovery = await discoveryRes.json();
        const authEndpoint: string = discovery.authorization_endpoint;
        if (!authEndpoint) throw new Error('No authorization_endpoint in discovery doc');

        const scopes: string[] = config.oidc_scopes || ['openid', 'email', 'profile'];
        const finalRedirect = redirectUri || config.oidc_redirect_uri;
        if (!finalRedirect) throw new Error('No redirect URI configured');

        // Encode the user-supplied email in `state` so the callback can verify
        // the provider returned the same identity that the user typed in.
        const hintEmail = (loginHint || '').trim().toLowerCase();
        const stateValue = state || `${organizationId}:${config.id}${hintEmail ? `:${encodeURIComponent(hintEmail)}` : ''}`;

        const params = new URLSearchParams({
          response_type: 'code',
          client_id: config.oidc_client_id,
          redirect_uri: finalRedirect,
          scope: scopes.join(' '),
          state: stateValue,
        });
        if (hintEmail) {
          params.set('login_hint', hintEmail);
        } else {
          // Force account chooser so an existing browser session for a
          // different account doesn't silently sign the user in.
          params.set('prompt', 'select_account');
        }

        const authorizationUrl = `${authEndpoint}?${params.toString()}`;
        return new Response(
          JSON.stringify({
            success: true,
            mode: 'oidc-redirect',
            providerType,
            authorizationUrl,
            configId: config.id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('OIDC discovery error:', err);
        return new Response(
          JSON.stringify({
            success: false,
            message: `Could not initialize ${providerType}: ${err.message}`,
            fallbackToLocal: config.fallback_to_local_auth ?? true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====== LDAP-style providers (ldap, active_directory, aws_directory) ======
    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Username and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // In a production environment, you would:
    // 1. Connect to the LDAP server using the bind credentials
    // 2. Search for the user using the user_search_filter
    // 3. Attempt to bind as the found user with their password
    // 4. If successful, retrieve user attributes
    
    // Since Deno doesn't have native LDAP support, we simulate the process
    // For production, you would need:
    // - An LDAP proxy service
    // - A WebSocket-based LDAP bridge
    // - Or use a cloud LDAP service API
    
    // Simulate LDAP authentication (REPLACE WITH ACTUAL LDAP LOGIC)
    // This is a placeholder that demonstrates the expected flow
    
    const simulatedLdapResponse = await simulateLdapAuth(config, username, password);
    
    if (!simulatedLdapResponse.success) {
      // Log failed attempt
      await supabase.from('audit_logs').insert({
        event_type: 'ldap_auth_failed',
        event_category: 'authentication',
        description: `LDAP authentication failed for ${username}`,
        metadata: {
          username,
          organization_id: organizationId,
          config_id: config.id,
          error: simulatedLdapResponse.message
        }
      });

      // Check if we should fallback to local auth
      if (config.fallback_to_local_auth) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: simulatedLdapResponse.message,
            fallbackToLocal: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: simulatedLdapResponse.message 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ldapUser = simulatedLdapResponse.user!;
    console.log(`✅ LDAP authentication successful for: ${ldapUser.email}`);

    // Check if user already exists in our system
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', ldapUser.email.toLowerCase())
      .eq('organization_id', organizationId)
      .single();

    let userId = existingProfile?.id;

    // Auto-provision user if enabled and user doesn't exist
    if (!userId && config.auto_provision_users) {
      console.log(`👤 Auto-provisioning new user: ${ldapUser.email}`);
      
      // Create user in Supabase Auth
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: ldapUser.email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: ldapUser.firstName,
          last_name: ldapUser.lastName,
          ldap_dn: ldapUser.ldapDn,
          organization_id: organizationId,
        }
      });

      if (authError) {
        console.error('❌ Error creating auth user:', authError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to provision user account' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authUser.user.id;

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: ldapUser.email.toLowerCase(),
          first_name: ldapUser.firstName,
          last_name: ldapUser.lastName,
          organization_id: organizationId,
          role: 'user',
          status: 'active',
        });

      if (profileError) {
        console.error('❌ Error creating user profile:', profileError);
      }

      // Create LDAP user link
      await supabase.from('ldap_user_links').insert({
        user_id: userId,
        ldap_config_id: config.id,
        ldap_dn: ldapUser.ldapDn,
        ldap_username: username,
        ldap_groups: ldapUser.ldapGroups,
        last_ldap_login_at: new Date().toISOString(),
      });

      // Apply group mappings
      await applyGroupMappings(supabase, config.id, userId, ldapUser.ldapGroups, organizationId);
    } else if (userId) {
      // Update existing LDAP link
      await supabase
        .from('ldap_user_links')
        .upsert({
          user_id: userId,
          ldap_config_id: config.id,
          ldap_dn: ldapUser.ldapDn,
          ldap_username: username,
          ldap_groups: ldapUser.ldapGroups,
          last_ldap_login_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        }, { 
          onConflict: 'user_id' 
        });

      // Re-apply group mappings
      await applyGroupMappings(supabase, config.id, userId, ldapUser.ldapGroups, organizationId);
    }

    // Log successful authentication
    await supabase.from('audit_logs').insert({
      user_id: userId,
      event_type: 'ldap_auth_success',
      event_category: 'authentication',
      description: `LDAP authentication successful for ${username}`,
      metadata: {
        username,
        organization_id: organizationId,
        config_id: config.id,
        ldap_dn: ldapUser.ldapDn,
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'LDAP authentication successful',
        user: {
          id: userId,
          email: ldapUser.email,
          firstName: ldapUser.firstName,
          lastName: ldapUser.lastName,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ LDAP authentication error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'LDAP authentication failed',
        fallbackToLocal: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simulated LDAP authentication (REPLACE WITH ACTUAL LDAP IMPLEMENTATION)
async function simulateLdapAuth(
  config: any, 
  username: string, 
  password: string
): Promise<LdapAuthResponse> {
  // This is a placeholder that simulates LDAP authentication
  // In production, you would use an actual LDAP library or service
  
  console.log('📝 Note: Using simulated LDAP authentication');
  console.log('🔧 For production, integrate with actual LDAP library or proxy service');
  
  // For demonstration, we'll return a simulated failure
  // to trigger the fallback to local authentication
  return {
    success: false,
    message: 'LDAP server connection not implemented. Falling back to local authentication.',
    fallbackToLocal: true
  };
  
  // Example of what a successful response would look like:
  // return {
  //   success: true,
  //   message: 'Authentication successful',
  //   user: {
  //     email: 'user@company.com',
  //     firstName: 'John',
  //     lastName: 'Doe',
  //     ldapDn: 'CN=John Doe,OU=Users,DC=company,DC=com',
  //     ldapGroups: ['CN=Employees,OU=Groups,DC=company,DC=com']
  //   }
  // };
}

// Apply LDAP group mappings to user
async function applyGroupMappings(
  supabase: any,
  configId: string,
  userId: string,
  ldapGroups: string[],
  organizationId: string
): Promise<void> {
  try {
    // Get all active group mappings for this config
    const { data: mappings } = await supabase
      .from('ldap_group_mappings')
      .select('*')
      .eq('ldap_config_id', configId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (!mappings || mappings.length === 0) return;

    // Find matching mappings
    for (const mapping of mappings) {
      const matches = ldapGroups.some(group => 
        group.toLowerCase().includes(mapping.ldap_group_dn.toLowerCase())
      );

      if (matches) {
        console.log(`🎯 Matched group: ${mapping.ldap_group_name}`);

        // Apply role if mapped
        if (mapping.mapped_role) {
          await supabase
            .from('user_profiles')
            .update({ role: mapping.mapped_role })
            .eq('id', userId);
        }

        // Apply security template if mapped
        if (mapping.mapped_security_template_id) {
          await supabase
            .from('user_security_parameters')
            .upsert({
              user_id: userId,
              security_template_id: mapping.mapped_security_template_id,
              use_template_settings: true,
            }, { onConflict: 'user_id' });
        }

        // Add to group if mapped
        if (mapping.mapped_group_id) {
          await supabase
            .from('group_memberships')
            .upsert({
              group_id: mapping.mapped_group_id,
              member_id: userId,
              member_type: 'user',
              added_by: userId,
            }, { onConflict: 'group_id,member_id' });
        }

        // Only apply first matching mapping (highest priority)
        break;
      }
    }
  } catch (error) {
    console.error('Error applying group mappings:', error);
  }
}
