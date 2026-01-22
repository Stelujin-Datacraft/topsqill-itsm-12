import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveredField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  sample?: string;
}

interface HttpApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  authType: 'none' | 'bearer' | 'basic' | 'api_key';
  authConfig?: {
    token?: string;
    username?: string;
    password?: string;
    apiKeyHeader?: string;
    apiKeyValue?: string;
  };
  responsePath?: string;
  body?: string;
}

interface FileConfig {
  sourceMode: 'upload' | 'url';
  fileUrl?: string;
  uploadedFilePath?: string;
  fileType: 'csv' | 'excel' | 'json';
  sheetName?: string;
  delimiter?: string;
  hasHeader?: boolean;
}

interface FtpConfig {
  protocol: 'ftp' | 'sftp';
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
  fileType: 'csv' | 'excel' | 'json';
  hasHeader?: boolean;
}

interface CloudStorageConfig {
  provider: 's3' | 'gcs' | 'azure_blob';
  bucketName: string;
  objectPath: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  serviceAccountJson?: string;
  connectionString?: string;
  fileType: 'csv' | 'excel' | 'json';
  hasHeader?: boolean;
}

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  authType: 'api_key' | 'service_account';
  apiKey?: string;
  serviceAccountJson?: string;
  hasHeader?: boolean;
}

interface ExternalSourceConfig {
  httpApi?: HttpApiConfig;
  file?: FileConfig;
  ftp?: FtpConfig;
  cloudStorage?: CloudStorageConfig;
  googleSheets?: GoogleSheetsConfig;
}

function inferFieldType(value: any): DiscoveredField['type'] {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  
  const strValue = String(value);
  
  // Check for date patterns
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue) || /^\d{2}\/\d{2}\/\d{4}/.test(strValue)) {
    return 'date';
  }
  
  // Check for number
  if (/^-?\d+\.?\d*$/.test(strValue) && !isNaN(parseFloat(strValue))) {
    return 'number';
  }
  
  // Check for boolean strings
  if (['true', 'false', 'yes', 'no', '1', '0'].includes(strValue.toLowerCase())) {
    return 'boolean';
  }
  
  return 'text';
}

function extractFieldsFromData(data: any[]): DiscoveredField[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  
  const sample = data[0];
  if (typeof sample !== 'object' || sample === null) return [];
  
  const fields: DiscoveredField[] = [];
  
  for (const key of Object.keys(sample)) {
    const value = sample[key];
    fields.push({
      id: key,
      name: key,
      type: inferFieldType(value),
      sample: value !== null && value !== undefined ? String(value).substring(0, 100) : undefined
    });
  }
  
  return fields;
}

function navigateJsonPath(data: any, path: string): any[] {
  if (!path || path === '$' || path === '$.') return Array.isArray(data) ? data : [data];
  
  // Simple JSONPath navigation
  const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
  let current = data;
  
  for (const part of parts) {
    if (current === null || current === undefined) return [];
    if (part === '*') {
      if (Array.isArray(current)) return current;
      continue;
    }
    current = current[part];
  }
  
  return Array.isArray(current) ? current : [current];
}

function parseCSV(content: string, hasHeader: boolean = true): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = hasHeader ? parseLine(lines[0]) : parseLine(lines[0]).map((_, i) => `column_${i + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  return dataLines.map(line => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });
}

interface DiscoveryResult {
  fields: DiscoveredField[];
  previewData: any[];
}

async function discoverHttpApiFields(config: HttpApiConfig): Promise<DiscoveryResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(config.headers || {})
  };
  
  if (config.authType === 'bearer' && config.authConfig?.token) {
    headers['Authorization'] = `Bearer ${config.authConfig.token}`;
  } else if (config.authType === 'basic' && config.authConfig?.username) {
    const credentials = btoa(`${config.authConfig.username}:${config.authConfig.password || ''}`);
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (config.authType === 'api_key' && config.authConfig?.apiKeyHeader && config.authConfig?.apiKeyValue) {
    headers[config.authConfig.apiKeyHeader] = config.authConfig.apiKeyValue;
  }
  
  const fetchOptions: RequestInit = {
    method: config.method,
    headers
  };
  
  if (config.method === 'POST' && config.body) {
    fetchOptions.body = config.body;
    headers['Content-Type'] = 'application/json';
  }
  
  console.log(`Fetching from ${config.url} with method ${config.method}`);
  
  const response = await fetch(config.url, fetchOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
  }
  
  const data = await response.json();
  const records = navigateJsonPath(data, config.responsePath || '$');
  
  console.log(`Found ${records.length} records`);
  
  const previewData = records.slice(0, 10).map((record: any) => {
    const flattened: Record<string, any> = {};
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flattened[key] = JSON.stringify(value);
      } else if (Array.isArray(value)) {
        flattened[key] = JSON.stringify(value);
      } else {
        flattened[key] = value;
      }
    }
    return flattened;
  });
  
  return {
    fields: extractFieldsFromData(records),
    previewData
  };
}

async function discoverFileFields(config: FileConfig, supabase: any): Promise<DiscoveryResult> {
  let content: string;
  
  if (config.sourceMode === 'url' && config.fileUrl) {
    const response = await fetch(config.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    content = await response.text();
  } else if (config.sourceMode === 'upload' && config.uploadedFilePath) {
    const { data, error } = await supabase.storage
      .from('data-feed-files')
      .download(config.uploadedFilePath);
    
    if (error) throw error;
    content = await data.text();
  } else {
    throw new Error('No file source configured');
  }
  
  let records: any[] = [];
  
  if (config.fileType === 'json') {
    const data = JSON.parse(content);
    records = Array.isArray(data) ? data : [data];
  } else if (config.fileType === 'csv') {
    records = parseCSV(content, config.hasHeader !== false);
  } else if (config.fileType === 'excel') {
    throw new Error('Excel field discovery requires the file to be converted to CSV first');
  }
  
  const previewData = records.slice(0, 10);
  
  return {
    fields: extractFieldsFromData(records),
    previewData
  };
}

async function discoverGoogleSheetsFields(config: GoogleSheetsConfig): Promise<DiscoveryResult> {
  if (!config.spreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }

  let url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/`;
  
  // Build the range
  const range = config.sheetName 
    ? `'${config.sheetName}'!${config.range || 'A:Z'}`
    : config.range || 'A:Z';
  
  url += encodeURIComponent(range);
  
  if (config.authType === 'api_key' && config.apiKey) {
    url += `?key=${config.apiKey}`;
  } else {
    throw new Error('API key authentication is required for Google Sheets');
  }

  console.log(`Fetching Google Sheets: ${config.spreadsheetId}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets API error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  const values = data.values || [];
  
  if (values.length === 0) {
    return { fields: [], previewData: [] };
  }
  
  // First row is headers if hasHeader is true
  const headers = config.hasHeader !== false 
    ? values[0].map((h: string) => String(h).trim())
    : values[0].map((_: any, i: number) => `column_${i + 1}`);
  
  const dataRows = config.hasHeader !== false ? values.slice(1) : values;
  
  const records = dataRows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
  
  console.log(`Found ${records.length} records from Google Sheets`);
  
  return {
    fields: extractFieldsFromData(records),
    previewData: records.slice(0, 10)
  };
}

async function discoverCloudStorageFields(config: CloudStorageConfig): Promise<DiscoveryResult> {
  let content: string;
  
  if (config.provider === 's3') {
    // For S3, we need to construct a pre-signed URL or use public access
    // This is a simplified implementation - in production you'd use AWS SDK
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('AWS credentials are required for S3 access');
    }
    
    // Try public URL first for read-only access
    const s3Url = `https://${config.bucketName}.s3.${config.region || 'us-east-1'}.amazonaws.com/${config.objectPath}`;
    
    console.log(`Fetching from S3: ${s3Url}`);
    
    const response = await fetch(s3Url);
    if (!response.ok) {
      throw new Error(`S3 access error ${response.status}: Ensure the object is publicly readable or use proper AWS SDK authentication`);
    }
    content = await response.text();
    
  } else if (config.provider === 'gcs') {
    // Google Cloud Storage public URL
    const gcsUrl = `https://storage.googleapis.com/${config.bucketName}/${config.objectPath}`;
    
    console.log(`Fetching from GCS: ${gcsUrl}`);
    
    const response = await fetch(gcsUrl);
    if (!response.ok) {
      throw new Error(`GCS access error ${response.status}: Ensure the object is publicly readable`);
    }
    content = await response.text();
    
  } else if (config.provider === 'azure_blob') {
    // Azure Blob Storage - requires connection string for private blobs
    if (!config.connectionString) {
      throw new Error('Azure connection string is required');
    }
    
    // Extract account name from connection string
    const accountMatch = config.connectionString.match(/AccountName=([^;]+)/);
    if (!accountMatch) {
      throw new Error('Invalid Azure connection string');
    }
    const accountName = accountMatch[1];
    
    // Try public URL
    const azureUrl = `https://${accountName}.blob.core.windows.net/${config.bucketName}/${config.objectPath}`;
    
    console.log(`Fetching from Azure Blob: ${azureUrl}`);
    
    const response = await fetch(azureUrl);
    if (!response.ok) {
      throw new Error(`Azure Blob access error ${response.status}: Ensure the blob is publicly readable`);
    }
    content = await response.text();
    
  } else {
    throw new Error(`Unsupported cloud provider: ${config.provider}`);
  }
  
  // Parse content based on file type
  let records: any[] = [];
  
  if (config.fileType === 'json') {
    const data = JSON.parse(content);
    records = Array.isArray(data) ? data : [data];
  } else if (config.fileType === 'csv') {
    records = parseCSV(content, config.hasHeader !== false);
  } else if (config.fileType === 'excel') {
    throw new Error('Excel files from cloud storage require conversion to CSV first');
  }
  
  console.log(`Found ${records.length} records from cloud storage`);
  
  return {
    fields: extractFieldsFromData(records),
    previewData: records.slice(0, 10)
  };
}

async function discoverFtpFields(config: FtpConfig): Promise<DiscoveryResult> {
  // FTP/SFTP requires server-side implementation with proper libraries
  // This is a placeholder - in production you'd use a library like ssh2-sftp-client
  throw new Error(
    `FTP/SFTP field discovery is not yet fully implemented. ` +
    `Please use HTTP API or Cloud Storage as an alternative, or contact support for FTP integration.`
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sourceType, config, connectionId } = await req.json();

    console.log(`Discovering fields for source type: ${sourceType}`);

    let externalConfig = config as ExternalSourceConfig;

    // If using a shared connection, load the connection config
    if (connectionId) {
      const { data: connection, error } = await supabase
        .from('data_source_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error) throw error;

      if (connection.connection_type === 'http_api') {
        externalConfig = {
          httpApi: {
            url: connection.http_url,
            method: connection.http_method as 'GET' | 'POST',
            headers: connection.http_headers,
            authType: connection.http_auth_type as any,
            authConfig: connection.http_auth_config,
            responsePath: connection.http_response_path
          }
        };
      } else if (connection.connection_type === 'file_url') {
        externalConfig = {
          file: {
            sourceMode: 'url',
            fileUrl: connection.file_url,
            fileType: connection.file_type as any,
            sheetName: connection.file_sheet_name,
            hasHeader: true
          }
        };
      }
    }

    let result: DiscoveryResult = { fields: [], previewData: [] };

    if (sourceType === 'http_api' && externalConfig.httpApi) {
      result = await discoverHttpApiFields(externalConfig.httpApi);
    } else if ((sourceType === 'csv' || sourceType === 'excel' || sourceType === 'file_url') && externalConfig.file) {
      result = await discoverFileFields(externalConfig.file, supabase);
    } else if (sourceType === 'google_sheets' && externalConfig.googleSheets) {
      result = await discoverGoogleSheetsFields(externalConfig.googleSheets);
    } else if (sourceType === 'cloud_storage' && externalConfig.cloudStorage) {
      result = await discoverCloudStorageFields(externalConfig.cloudStorage);
    } else if (sourceType === 'ftp' && externalConfig.ftp) {
      result = await discoverFtpFields(externalConfig.ftp);
    } else if (sourceType === 'webhook') {
      // Webhooks don't have field discovery - fields are determined when data is received
      return new Response(
        JSON.stringify({ 
          success: true, 
          fields: [], 
          previewData: [],
          message: 'Webhook fields will be discovered when data is first received'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    console.log(`Discovered ${result.fields.length} fields, ${result.previewData.length} preview records`);

    // Update connection with discovered fields if using shared connection
    if (connectionId && result.fields.length > 0) {
      await supabase
        .from('data_source_connections')
        .update({ 
          discovered_fields: result.fields,
          last_field_discovery_at: new Date().toISOString()
        })
        .eq('id', connectionId);
    }

    return new Response(
      JSON.stringify({ success: true, fields: result.fields, previewData: result.previewData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Field discovery error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
