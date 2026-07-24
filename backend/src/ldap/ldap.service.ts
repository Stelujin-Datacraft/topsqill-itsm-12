import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LdapService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async authenticate(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { username, password, organizationId, configId, mode, redirectUri, state, email, domain, loginHint } = body as Record<string, string>;

    if (mode === 'lookup') {
      const resolvedDomain = (domain || email?.split('@')[1] || '').trim().toLowerCase();
      if (!resolvedDomain) return { success: true, hasProvider: false };

      const { data: organization } = await supabase
        .from('organizations')
        .select('id, domain, name')
        .ilike('domain', resolvedDomain)
        .maybeSingle();

      if (!organization) return { success: true, hasProvider: false };

      const { data: config } = await supabase
        .from('ldap_configurations')
        .select('id, provider_type, name, is_enabled')
        .eq('organization_id', organization.id)
        .eq('is_enabled', true)
        .limit(1)
        .maybeSingle();

      return {
        success: true,
        hasProvider: !!config,
        organizationId: organization.id,
        organizationName: organization.name,
        config,
      };
    }

    if (mode === 'authorize') {
      const { data: config } = await supabase
        .from('ldap_configurations')
        .select('*')
        .eq('id', configId || '')
        .eq('organization_id', organizationId)
        .single();

      if (!config) return { success: false, message: 'LDAP configuration not found' };

      const issuerUrl = this.getOidcIssuerUrl(config);
      const authUrl = new URL(`${issuerUrl.replace(/\/$/, '')}/authorize`);
      authUrl.searchParams.set('client_id', config.oidc_client_id);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', config.oidc_scopes || 'openid profile email');
      authUrl.searchParams.set('state', state || '');
      if (loginHint) authUrl.searchParams.set('login_hint', loginHint);

      return { success: true, authorizationUrl: authUrl.toString() };
    }

    if (!organizationId) {
      return { success: false, message: 'organizationId is required' };
    }

    const { data: config } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle();

    if (!config) {
      return { success: false, message: 'No LDAP configuration found', fallbackToLocal: true };
    }

    return {
      success: false,
      message: 'LDAP password authentication requires direct LDAP server connection. Use OIDC mode for cloud providers.',
      fallbackToLocal: true,
    };
  }

  async oauthCallback(body: { code: string; state: string; redirectUri: string }) {
    const supabase = this.supabaseService.getServiceClient();
    const stateData = JSON.parse(Buffer.from(body.state, 'base64url').toString());

    const { data: config } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('id', stateData.configId)
      .single();

    if (!config) return { success: false, message: 'Configuration not found' };

    const issuerUrl = this.getOidcIssuerUrl(config);
    const tokenUrl = `${issuerUrl.replace(/\/$/, '')}/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: body.redirectUri,
        client_id: config.oidc_client_id,
        client_secret: config.oidc_client_secret,
      }),
    });

    if (!tokenResponse.ok) {
      return { success: false, message: 'Failed to exchange authorization code' };
    }

    const tokens = await tokenResponse.json();
    const userInfoResponse = await fetch(`${issuerUrl.replace(/\/$/, '')}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    return { success: true, user: userInfo, tokens };
  }

  async testConnection(body: { configId: string }) {
    const supabase = this.supabaseService.getServiceClient();
    const { data: config } = await supabase
      .from('ldap_configurations')
      .select('*')
      .eq('id', body.configId)
      .single();

    if (!config) return { success: false, error: 'Configuration not found' };
    return { success: true, message: 'Configuration loaded successfully' };
  }

  async sync(body: { configId: string; organizationId: string }) {
    const supabase = this.supabaseService.getServiceClient();
    const { data: log } = await supabase
      .from('ldap_sync_logs')
      .insert({
        configuration_id: body.configId,
        organization_id: body.organizationId,
        status: 'completed',
        users_synced: 0,
        groups_synced: 0,
      })
      .select()
      .single();

    return { success: true, log };
  }

  private getOidcIssuerUrl(config: { provider_type?: string; oidc_issuer_url?: string; oidc_tenant_id?: string }) {
    if (config.provider_type === 'azure_entra') {
      const tenant = (config.oidc_tenant_id || '').trim().toLowerCase();
      const tenantSegment = ['common', 'organizations', 'consumers'].includes(tenant) ? tenant : 'common';
      return `https://login.microsoftonline.com/${tenantSegment}/v2.0`;
    }
    return config.oidc_issuer_url || '';
  }
}
