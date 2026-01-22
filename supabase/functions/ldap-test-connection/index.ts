import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { configId } = await req.json();
    
    if (!configId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Configuration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`🔍 Testing LDAP connection to: ${config.server_url}`);
    console.log(`📂 Base DN: ${config.base_dn}`);

    // In a real implementation, you would use an LDAP library here
    // Since Deno doesn't have native LDAP support, we'll simulate the test
    // or you could use an external LDAP proxy service
    
    // For now, we'll do basic validation and simulate a successful connection
    // In production, you would:
    // 1. Use a library like 'ldapjs' via npm: specifiers or
    // 2. Call an external LDAP proxy service, or
    // 3. Use a WebSocket-based LDAP bridge
    
    const validationErrors: string[] = [];
    
    // Validate server URL format
    if (!config.server_url.match(/^ldaps?:\/\/.+/)) {
      validationErrors.push('Invalid server URL format. Use ldap:// or ldaps://');
    }
    
    // Validate Base DN format
    if (!config.base_dn.match(/^(DC|OU|CN)=/i)) {
      validationErrors.push('Invalid Base DN format. Should start with DC=, OU=, or CN=');
    }
    
    // Check if SSL is used
    if (!config.use_ssl && !config.use_starttls) {
      validationErrors.push('Warning: Connection is not encrypted. SSL or StartTLS is recommended.');
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
        server_url: config.server_url,
        result: 'configuration_validated'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'LDAP configuration is valid. Note: For full connection testing, ensure the LDAP server is accessible from the network.'
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
});
