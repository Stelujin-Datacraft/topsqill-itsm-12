/** Outbound third-party connectors (Integrations hub). */

export type ConnectorMode = 'realtime' | 'batch';

export type ConnectorAuthType =
  | 'api_key'
  | 'basic'
  | 'bearer'
  | 'oauth_client'
  | 'custom';

export type ConnectorProvider =
  | 'generic_http'
  | 'salesforce'
  | 'servicenow'
  | 'jira'
  | 'slack'
  | 'custom';

export interface ConnectorCredentials {
  /** API key auth */
  apiKeyHeader?: string;
  apiKeyValue?: string;
  /** Basic auth */
  username?: string;
  password?: string;
  /** Bearer */
  token?: string;
  /** OAuth client credentials */
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scopes?: string;
  /** Custom extras */
  extraJson?: string;
}

export interface OutboundConnector {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  provider: ConnectorProvider | string;
  mode: ConnectorMode;
  base_url: string | null;
  auth_type: ConnectorAuthType;
  credentials: ConnectorCredentials;
  headers: Record<string, string>;
  schedule_cron: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OutboundConnectorFormData {
  name: string;
  description: string;
  provider: ConnectorProvider;
  mode: ConnectorMode;
  base_url: string;
  auth_type: ConnectorAuthType;
  credentials: ConnectorCredentials;
  headers: Record<string, string>;
  schedule_cron: string;
  project_id: string | null;
  is_active: boolean;
}

export const CONNECTOR_PROVIDER_OPTIONS: {
  value: ConnectorProvider;
  label: string;
  description: string;
  defaultAuth: ConnectorAuthType;
  defaultUrl?: string;
}[] = [
  {
    value: 'generic_http',
    label: 'Generic HTTP / REST',
    description: 'Any REST API with URL and credentials',
    defaultAuth: 'api_key',
  },
  {
    value: 'salesforce',
    label: 'Salesforce',
    description: 'Salesforce REST API (OAuth client credentials)',
    defaultAuth: 'oauth_client',
    defaultUrl: 'https://login.salesforce.com',
  },
  {
    value: 'servicenow',
    label: 'ServiceNow',
    description: 'ServiceNow instance API',
    defaultAuth: 'basic',
  },
  {
    value: 'jira',
    label: 'Jira',
    description: 'Atlassian Jira Cloud / Server',
    defaultAuth: 'basic',
  },
  {
    value: 'slack',
    label: 'Slack',
    description: 'Slack Web API (bot token)',
    defaultAuth: 'bearer',
    defaultUrl: 'https://slack.com/api',
  },
  {
    value: 'custom',
    label: 'Custom tool',
    description: 'Flexible fields for any third-party system',
    defaultAuth: 'custom',
  },
];

export const CONNECTOR_AUTH_OPTIONS: {
  value: ConnectorAuthType;
  label: string;
  description: string;
}[] = [
  { value: 'api_key', label: 'API key', description: 'Header + secret key' },
  { value: 'basic', label: 'Username & password', description: 'HTTP basic auth' },
  { value: 'bearer', label: 'Bearer token', description: 'Authorization: Bearer …' },
  { value: 'oauth_client', label: 'OAuth client credentials', description: 'Client ID + secret + token URL' },
  { value: 'custom', label: 'Custom', description: 'Mix of key, user/pass, client secret, extras' },
];

export const CONNECTOR_MODE_OPTIONS: {
  value: ConnectorMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'realtime',
    label: 'Real-time',
    description: 'Call on workflow events / webhooks (push when something happens)',
  },
  {
    value: 'batch',
    label: 'Not real-time (batch)',
    description: 'Scheduled or on-demand sync (poll / batch jobs)',
  },
];

export const emptyConnectorForm = (): OutboundConnectorFormData => ({
  name: '',
  description: '',
  provider: 'generic_http',
  mode: 'batch',
  base_url: '',
  auth_type: 'api_key',
  credentials: {
    apiKeyHeader: 'x-api-key',
    apiKeyValue: '',
  },
  headers: {},
  schedule_cron: '',
  project_id: null,
  is_active: true,
});

/** Mask secret fields for list/display. */
export function maskCredentials(creds: ConnectorCredentials): ConnectorCredentials {
  const mask = (v?: string) => (v && v.length > 0 ? '••••••••' : '');
  return {
    ...creds,
    apiKeyValue: mask(creds.apiKeyValue),
    password: mask(creds.password),
    token: mask(creds.token),
    clientSecret: mask(creds.clientSecret),
  };
}
