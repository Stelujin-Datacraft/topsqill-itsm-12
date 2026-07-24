// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallbackRequest {
  code: string;
  state: string;
  redirectUri: string;
}

/**
 * Decodes a JWT payload without verifying the signature.
 * Signature verification is implicitly handled because we get the token
 * directly from the provider's token endpoint over HTTPS.
 */
function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getOidcIssuerUrl(config: { provider_type?: string | null; oidc_issuer_url?: string | null; oidc_tenant_id?: string | null }) {
  if (config.provider_type === 'azure_entra') {
    const tenant = (config.oidc_tenant_id || '').trim().toLowerCase();
    const tenantSegment = ['common', 'organizations', 'consumers'].includes(tenant) ? tenant : 'common';
    return `https://login.microsoftonline.com/${tenantSegment}/v2.0`;
  }

  return config.oidc_issuer_url || '';
}



export async function idpOauthCallback(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  

  try {
    const { code, state, redirectUri }: CallbackRequest = body;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ success: false, message: 'code and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // state format: organizationId:configId[:urlEncodedExpectedEmail]
    const stateParts = state.split(':');
    const organizationId = stateParts[0];
    const configId = stateParts[1];
    const expectedEmail = stateParts.length > 2
      ? decodeURIComponent(stateParts.slice(2).join(':')).toLowerCase()
      : '';
    if (!organizationId || !configId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    

    // Load the IdP configuration
    const { data: config, error: configError } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('id', configId)
      .eq('organization_id', organizationId)
      .eq('is_enabled', true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, message: 'Identity provider configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Discover token endpoint
    const issuerUrl = getOidcIssuerUrl(config);
    const discoveryRes = await fetch(
      `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`
    );
    if (!discoveryRes.ok) {
      throw new Error(`OIDC discovery failed: ${discoveryRes.status}`);
    }
    const discovery = await discoveryRes.json();
    const tokenEndpoint = discovery.token_endpoint;
    if (!tokenEndpoint) throw new Error('No token_endpoint in discovery doc');

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || config.oidc_redirect_uri,
      client_id: config.oidc_client_id,
    });
    if (config.oidc_client_secret_encrypted) {
      tokenParams.set('client_secret', config.oidc_client_secret_encrypted);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', errText);
      return new Response(
        JSON.stringify({ success: false, message: `Token exchange failed: ${errText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenRes.json();
    const idToken = tokens.id_token;
    if (!idToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'No id_token returned by provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claims = decodeJwt(idToken);
    if (!claims) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid id_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email: string | undefined = claims.email || claims.preferred_username;
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Provider did not return an email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reject if the provider signed in a different account than the one the
    // user typed at our login screen (e.g. an existing browser SSO session).
    if (expectedEmail && email.toLowerCase() !== expectedEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `You signed in to Microsoft as ${email}, but you started the sign-in for ${expectedEmail}. Please sign out of Microsoft (or use a private window) and try again.`,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = claims.given_name || (claims.name?.split(' ')[0] ?? '');
    const lastName = claims.family_name || (claims.name?.split(' ').slice(1).join(' ') ?? '');
    const groupsClaim = config.oidc_groups_claim || 'groups';
    const groups: string[] = Array.isArray(claims[groupsClaim]) ? claims[groupsClaim] : [];

    // Find or provision user
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('organization_id', organizationId)
      .maybeSingle();

    let userId = existingProfile?.id;

    if (!userId && config.auto_provision_users) {
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          idp_provider: config.provider_type,
          organization_id: organizationId,
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to provision user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = authUser.user.id;

      await supabase.from('user_profiles').insert({
        id: userId,
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        organization_id: organizationId,
        role: 'user',
        status: 'active',
      });
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'User does not exist locally and auto-provisioning is disabled',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track the IdP link
    await supabase.from('ldap_user_links').upsert(
      {
        user_id: userId,
        ldap_config_id: config.id,
        ldap_dn: claims.sub || email,
        ldap_username: email,
        ldap_groups: groups,
        last_ldap_login_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Generate a one-time magic link the frontend can exchange for a session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
    });

    if (linkError || !linkData) {
      console.error('Magic link generation failed:', linkError);
      return new Response(
        JSON.stringify({ success: false, message: 'Could not finalize sign-in session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      event_type: 'idp_oidc_login_success',
      event_category: 'authentication',
      description: `OIDC login successful via ${config.provider_type} for ${email}`,
      metadata: {
        provider_type: config.provider_type,
        config_id: config.id,
        organization_id: organizationId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        email,
        userId,
        // Magic link properties — frontend uses verifyOtp with the token_hash
        verification: {
          actionLink: linkData.properties?.action_link,
          hashedToken: (linkData.properties as any)?.hashed_token,
          emailOtp: (linkData.properties as any)?.email_otp,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('OIDC callback error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'OIDC callback failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
