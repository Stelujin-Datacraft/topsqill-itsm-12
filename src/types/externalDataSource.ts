// External Data Source Types for Data Feed

export type SourceType = 'form' | 'http_api' | 'database' | 'csv' | 'excel' | 'file_url';

export type HttpAuthType = 'none' | 'bearer' | 'basic' | 'api_key';

export type DatabaseType = 'postgresql' | 'mysql' | 'mssql';

export interface HttpApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  authType: HttpAuthType;
  authConfig?: {
    token?: string; // For bearer
    username?: string; // For basic
    password?: string; // For basic
    apiKeyHeader?: string; // For api_key
    apiKeyValue?: string; // For api_key
  };
  responsePath?: string; // JSONPath to data array in response
  body?: string; // Request body for POST
}

export interface DatabaseConfig {
  type: DatabaseType;
  connectionString: string;
  query: string;
}

export interface FileConfig {
  sourceMode: 'upload' | 'url';
  fileUrl?: string;
  uploadedFilePath?: string;
  fileType: 'csv' | 'excel' | 'json';
  sheetName?: string; // For Excel files
  delimiter?: string; // For CSV files
  hasHeader?: boolean;
}

export interface ExternalSourceConfig {
  httpApi?: HttpApiConfig;
  database?: DatabaseConfig;
  file?: FileConfig;
}

export interface DiscoveredField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  sample?: string;
}

export interface DataSourceConnection {
  id: string;
  name: string;
  description?: string;
  connection_type: 'http_api' | 'database' | 'file_url';
  project_id: string;
  organization_id?: string;
  // HTTP API
  http_url?: string;
  http_method?: string;
  http_headers?: Record<string, string>;
  http_auth_type?: HttpAuthType;
  http_auth_config?: Record<string, any>;
  http_response_path?: string;
  // Database
  db_type?: DatabaseType;
  db_connection_string?: string;
  db_query?: string;
  // File URL
  file_url?: string;
  file_type?: string;
  file_sheet_name?: string;
  // Field discovery
  discovered_fields?: DiscoveredField[];
  last_field_discovery_at?: string;
  // Metadata
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string; description: string; icon: string }[] = [
  { value: 'form', label: 'Form', description: 'Use records from another form in this project', icon: 'FormInput' },
  { value: 'csv', label: 'CSV File', description: 'Upload or link to a CSV file', icon: 'FileSpreadsheet' },
  { value: 'excel', label: 'Excel File', description: 'Upload or link to an Excel spreadsheet', icon: 'Sheet' },
  { value: 'http_api', label: 'HTTP API', description: 'Fetch data from an external REST API', icon: 'Globe' },
  { value: 'database', label: 'Database', description: 'Connect to an external database', icon: 'Database' },
];

export const HTTP_AUTH_OPTIONS: { value: HttpAuthType; label: string }[] = [
  { value: 'none', label: 'No Authentication' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api_key', label: 'API Key Header' },
];

export const DATABASE_TYPE_OPTIONS: { value: DatabaseType; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'SQL Server' },
];
