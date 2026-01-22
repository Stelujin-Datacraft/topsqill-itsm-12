// External Data Source Types for Data Feed

export type SourceType = 'form' | 'http_api' | 'database' | 'csv' | 'excel' | 'file_url' | 'ftp' | 'cloud_storage' | 'webhook' | 'google_sheets';

export type HttpAuthType = 'none' | 'bearer' | 'basic' | 'api_key';

export type DatabaseType = 'postgresql' | 'mysql' | 'mssql';

export type CloudStorageProvider = 's3' | 'gcs' | 'azure_blob';

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

export interface FtpConfig {
  protocol: 'ftp' | 'sftp';
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string; // For SFTP key-based auth
  remotePath: string; // Path to file on FTP server
  fileType: 'csv' | 'excel' | 'json';
  hasHeader?: boolean;
}

export interface CloudStorageConfig {
  provider: CloudStorageProvider;
  bucketName: string;
  objectPath: string;
  region?: string; // For S3
  // Credentials - stored securely
  accessKeyId?: string;
  secretAccessKey?: string;
  // For GCS
  serviceAccountJson?: string;
  // For Azure
  connectionString?: string;
  // File settings
  fileType: 'csv' | 'excel' | 'json';
  hasHeader?: boolean;
}

export interface WebhookConfig {
  webhookId: string; // Unique ID for the webhook endpoint
  webhookUrl?: string; // Generated URL for receiving data
  secretKey?: string; // For validating incoming requests
  payloadPath?: string; // JSONPath to data in webhook payload
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  range?: string; // e.g., "A1:Z1000"
  // OAuth or API Key auth
  authType: 'api_key' | 'service_account';
  apiKey?: string;
  serviceAccountJson?: string;
  hasHeader?: boolean;
}

export interface ExternalSourceConfig {
  httpApi?: HttpApiConfig;
  database?: DatabaseConfig;
  file?: FileConfig;
  ftp?: FtpConfig;
  cloudStorage?: CloudStorageConfig;
  webhook?: WebhookConfig;
  googleSheets?: GoogleSheetsConfig;
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
  connection_type: 'http_api' | 'database' | 'file_url' | 'ftp' | 'cloud_storage' | 'webhook' | 'google_sheets';
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
  { value: 'google_sheets', label: 'Google Sheets', description: 'Pull data from Google Spreadsheets', icon: 'Table' },
  { value: 'ftp', label: 'FTP/SFTP', description: 'Connect to remote file servers', icon: 'Server' },
  { value: 'cloud_storage', label: 'Cloud Storage', description: 'Read files from S3, GCS, or Azure Blob', icon: 'Cloud' },
  { value: 'webhook', label: 'Webhook', description: 'Receive data pushed from external systems', icon: 'Webhook' },
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

export const CLOUD_STORAGE_PROVIDERS: { value: CloudStorageProvider; label: string }[] = [
  { value: 's3', label: 'Amazon S3' },
  { value: 'gcs', label: 'Google Cloud Storage' },
  { value: 'azure_blob', label: 'Azure Blob Storage' },
];
