// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};



export async function ldapTestConnection(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  // Handle CORS preflight
  

  try {
    const { configId } = body;
    
    if (!configId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Configuration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authHeader = ctx.getHeader('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = ctx.getEnv('SUPABASE_URL')!;
    const supabaseServiceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;
    

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to verify admin status
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get LDAP configuration
    const { data: config, error: configError } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('id', configId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, message: 'LDAP configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providerType: string = config.provider_type || 'ldap';
    const isOidc = ['azure_entra', 'google_workspace', 'okta'].includes(providerType);
    const validationErrors: string[] = [];

    if (isOidc) {
      console.log(`🔍 Testing OIDC discovery for ${providerType}: ${config.oidc_issuer_url}`);
      if (!config.oidc_issuer_url) {
        validationErrors.push('OIDC Issuer URL is required');
      }
      if (!config.oidc_client_id) {
        validationErrors.push('OIDC Client ID is required');
      }
      if (validationErrors.length === 0) {
        try {
          const discoveryUrl = `${config.oidc_issuer_url.replace(/\/$/, '')}/.well-known/openid-configuration`;
          const res = await fetch(discoveryUrl, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) {
            validationErrors.push(`OIDC discovery failed: HTTP ${res.status} from ${discoveryUrl}`);
          } else {
            const doc = await res.json();
            if (!doc.token_endpoint || !doc.authorization_endpoint) {
              validationErrors.push('OIDC discovery document missing required endpoints');
            }
          }
        } catch (err: any) {
          validationErrors.push(`OIDC discovery error: ${err.message}`);
        }
      }
    } else {
      console.log(`🔍 Testing LDAP connection to: ${config.server_url}`);
      console.log(`📂 Base DN: ${config.base_dn}`);
      if (!config.server_url || !config.server_url.match(/^ldaps?:\/\/.+/)) {
        validationErrors.push('Invalid server URL format. Use ldap:// or ldaps://');
      }
      if (!config.base_dn || !config.base_dn.match(/^(DC|OU|CN)=/i)) {
        validationErrors.push('Invalid Base DN format. Should start with DC=, OU=, or CN=');
      }
      if (!config.use_ssl && !config.use_starttls) {
        validationErrors.push('Warning: Connection is not encrypted. SSL or StartTLS is recommended.');
      }
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Configuration validation failed: ' + validationErrors.join('; ')
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simulate connection test
    // In production, this would actually connect to the LDAP server
    console.log('✅ LDAP configuration validated successfully');
    console.log('📝 Note: Actual LDAP connection test requires LDAP library integration');
    
    // Log the test attempt
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'ldap_connection_test',
      event_category: 'ldap',
      description: `LDAP connection test for ${config.name}`,
      metadata: {
        config_id: configId,
        provider_type: providerType,
        server_url: config.server_url,
        oidc_issuer_url: config.oidc_issuer_url,
        result: 'configuration_validated'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isOidc
          ? `OIDC discovery succeeded for ${providerType}. Provider endpoints are reachable.`
          : 'LDAP configuration is valid. Ensure the LDAP server is accessible from the network for actual binds.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error testing LDAP connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Failed to test LDAP connection'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
