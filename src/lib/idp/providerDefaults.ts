/**
 * Identity Provider definitions and per-provider defaults.
 *
 * Used by the IdP/LDAP settings page to pre-populate sensible
 * defaults when an admin picks a provider type.
 */

export type ProviderType =
  | 'ldap'
  | 'active_directory'
  | 'azure_entra'
  | 'google_workspace'
  | 'okta'
  | 'aws_directory';

export type ProviderCategory = 'ldap' | 'oidc';

export interface ProviderDefinition {
  id: ProviderType;
  label: string;
  shortLabel: string;
  category: ProviderCategory;
  description: string;
  /** Sensible defaults applied to the form when this provider is selected. */
  defaults: Partial<{
    server_url: string;
    base_dn: string;
    user_search_filter: string;
    username_attribute: string;
    email_attribute: string;
    first_name_attribute: string;
    last_name_attribute: string;
    display_name_attribute: string;
    member_of_attribute: string;
    use_ssl: boolean;
    oidc_issuer_url: string;
    oidc_scopes: string[];
    oidc_groups_claim: string;
  }>;
  /** Helper text shown in the OIDC tenant field for this provider. */
  tenantHelp?: string;
  /** Function that builds the issuer URL from the tenant value. */
  buildIssuerUrl?: (tenant: string) => string;
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'ldap',
    label: 'OpenLDAP / Generic LDAP',
    shortLabel: 'LDAP',
    category: 'ldap',
    description: 'Standards-compliant LDAP v3 directory server',
    defaults: {
      user_search_filter: '(uid={username})',
      username_attribute: 'uid',
      email_attribute: 'mail',
      first_name_attribute: 'givenName',
      last_name_attribute: 'sn',
      display_name_attribute: 'cn',
      member_of_attribute: 'memberOf',
      use_ssl: true,
    },
  },
  {
    id: 'active_directory',
    label: 'Microsoft Active Directory',
    shortLabel: 'AD',
    category: 'ldap',
    description: 'On-premises Windows Server Active Directory (LDAPS)',
    defaults: {
      user_search_filter: '(sAMAccountName={username})',
      username_attribute: 'sAMAccountName',
      email_attribute: 'mail',
      first_name_attribute: 'givenName',
      last_name_attribute: 'sn',
      display_name_attribute: 'displayName',
      member_of_attribute: 'memberOf',
      use_ssl: true,
    },
  },
  {
    id: 'aws_directory',
    label: 'AWS Directory Service',
    shortLabel: 'AWS DS',
    category: 'ldap',
    description: 'AWS Managed Microsoft AD or Simple AD via LDAPS',
    defaults: {
      user_search_filter: '(sAMAccountName={username})',
      username_attribute: 'sAMAccountName',
      email_attribute: 'mail',
      first_name_attribute: 'givenName',
      last_name_attribute: 'sn',
      display_name_attribute: 'displayName',
      member_of_attribute: 'memberOf',
      use_ssl: true,
    },
  },
  {
    id: 'azure_entra',
    label: 'Microsoft Entra ID (Azure AD)',
    shortLabel: 'Entra',
    category: 'oidc',
    description: 'Cloud identity for Microsoft 365 / Azure tenants',
    defaults: {
      oidc_scopes: ['openid', 'email', 'profile', 'User.Read'],
      oidc_groups_claim: 'groups',
    },
    tenantHelp: 'Your Azure tenant ID (UUID) or domain (e.g. contoso.onmicrosoft.com)',
    buildIssuerUrl: (tenant) =>
      `https://login.microsoftonline.com/${tenant.trim() || 'common'}/v2.0`,
  },
  {
    id: 'google_workspace',
    label: 'Google Workspace',
    shortLabel: 'Google',
    category: 'oidc',
    description: 'Google Identity for Workspace / Cloud Identity domains',
    defaults: {
      oidc_issuer_url: 'https://accounts.google.com',
      oidc_scopes: ['openid', 'email', 'profile'],
      oidc_groups_claim: 'groups',
    },
    tenantHelp: 'Optional — your Google Workspace primary domain (e.g. yourcompany.com)',
    buildIssuerUrl: () => 'https://accounts.google.com',
  },
  {
    id: 'okta',
    label: 'Okta',
    shortLabel: 'Okta',
    category: 'oidc',
    description: 'Okta Workforce / Customer Identity Cloud',
    defaults: {
      oidc_scopes: ['openid', 'email', 'profile', 'groups'],
      oidc_groups_claim: 'groups',
    },
    tenantHelp: 'Your Okta domain (e.g. yourcompany.okta.com)',
    buildIssuerUrl: (tenant) => {
      const t = tenant.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      return t ? `https://${t}/oauth2/default` : '';
    },
  },
];

export const PROVIDER_BY_ID: Record<ProviderType, ProviderDefinition> =
  PROVIDER_DEFINITIONS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<ProviderType, ProviderDefinition>);

export const isOidcProvider = (type: ProviderType | string | undefined | null): boolean => {
  if (!type) return false;
  return ['azure_entra', 'google_workspace', 'okta'].includes(type);
};

export const isLdapProvider = (type: ProviderType | string | undefined | null): boolean => {
  if (!type) return false;
  return ['ldap', 'active_directory', 'aws_directory'].includes(type);
};

export const getProviderLabel = (type: ProviderType | string | undefined | null): string => {
  if (!type) return 'Identity Provider';
  return PROVIDER_BY_ID[type as ProviderType]?.label ?? type;
};