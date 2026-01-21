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

interface ExternalSourceConfig {
  httpApi?: HttpApiConfig;
  file?: FileConfig;
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
      // Return current if it's an array
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
  
  // Simple CSV parsing (doesn't handle all edge cases)
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

async function discoverHttpApiFields(config: HttpApiConfig): Promise<DiscoveredField[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(config.headers || {})
  };
  
  // Apply authentication
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
  
  return extractFieldsFromData(records);
}

async function discoverFileFields(config: FileConfig, supabase: any): Promise<DiscoveredField[]> {
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
  
  if (config.fileType === 'json') {
    const data = JSON.parse(content);
    const records = Array.isArray(data) ? data : [data];
    return extractFieldsFromData(records);
  }
  
  if (config.fileType === 'csv') {
    const records = parseCSV(content, config.hasHeader !== false);
    return extractFieldsFromData(records);
  }
  
  // Excel requires special handling - for now return error
  if (config.fileType === 'excel') {
    throw new Error('Excel field discovery requires the file to be converted to CSV first');
  }
  
  return [];
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

    let fields: DiscoveredField[] = [];

    if (sourceType === 'http_api' && externalConfig.httpApi) {
      fields = await discoverHttpApiFields(externalConfig.httpApi);
    } else if ((sourceType === 'csv' || sourceType === 'excel' || sourceType === 'file_url') && externalConfig.file) {
      fields = await discoverFileFields(externalConfig.file, supabase);
    } else {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    console.log(`Discovered ${fields.length} fields`);

    // Update connection with discovered fields if using shared connection
    if (connectionId && fields.length > 0) {
      await supabase
        .from('data_source_connections')
        .update({ 
          discovered_fields: fields,
          last_field_discovery_at: new Date().toISOString()
        })
        .eq('id', connectionId);
    }

    return new Response(
      JSON.stringify({ success: true, fields }),
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
