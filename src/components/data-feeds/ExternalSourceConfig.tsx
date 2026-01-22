import { useState, useEffect } from 'react';
import { 
  SourceType, 
  ExternalSourceConfig as ExternalSourceConfigType,
  HttpApiConfig,
  DatabaseConfig,
  FileConfig,
  FtpConfig,
  CloudStorageConfig,
  WebhookConfig,
  GoogleSheetsConfig,
  DiscoveredField,
  SOURCE_TYPE_OPTIONS,
  HTTP_AUTH_OPTIONS,
  DATABASE_TYPE_OPTIONS,
  CLOUD_STORAGE_PROVIDERS,
  HttpAuthType,
  DatabaseType,
  CloudStorageProvider,
  DataSourceConnection
} from '@/types/externalDataSource';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormInput, FileSpreadsheet, Sheet, Globe, Database, Upload, Link, RefreshCw, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, FolderOpen, Server, Cloud, Webhook, Table2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExternalSourceConfigProps {
  sourceType: SourceType;
  onSourceTypeChange: (type: SourceType) => void;
  config: ExternalSourceConfigType;
  onConfigChange: (config: ExternalSourceConfigType) => void;
  discoveredFields: DiscoveredField[];
  onFieldsDiscovered: (fields: DiscoveredField[]) => void;
  projectId: string;
  // Shared connections
  sharedConnections: DataSourceConnection[];
  selectedConnectionId?: string;
  onConnectionSelect: (connectionId: string | undefined) => void;
  useSharedConnection: boolean;
  onUseSharedConnectionChange: (use: boolean) => void;
}

const getSourceIcon = (sourceType: SourceType) => {
  switch (sourceType) {
    case 'form': return <FormInput className="h-5 w-5" />;
    case 'csv': return <FileSpreadsheet className="h-5 w-5" />;
    case 'excel': return <Sheet className="h-5 w-5" />;
    case 'http_api': return <Globe className="h-5 w-5" />;
    case 'database': return <Database className="h-5 w-5" />;
    case 'google_sheets': return <Table2 className="h-5 w-5" />;
    case 'ftp': return <Server className="h-5 w-5" />;
    case 'cloud_storage': return <Cloud className="h-5 w-5" />;
    case 'webhook': return <Webhook className="h-5 w-5" />;
    default: return <FileSpreadsheet className="h-5 w-5" />;
  }
};

export function ExternalSourceConfig({
  sourceType,
  onSourceTypeChange,
  config,
  onConfigChange,
  discoveredFields,
  onFieldsDiscovered,
  projectId,
  sharedConnections,
  selectedConnectionId,
  onConnectionSelect,
  useSharedConnection,
  onUseSharedConnectionChange,
}: ExternalSourceConfigProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();

  // Filter connections by type
  const filteredConnections = sharedConnections.filter(c => {
    if (sourceType === 'http_api') return c.connection_type === 'http_api';
    if (sourceType === 'database') return c.connection_type === 'database';
    if (sourceType === 'csv' || sourceType === 'excel' || sourceType === 'file_url') return c.connection_type === 'file_url';
    if (sourceType === 'ftp') return c.connection_type === 'ftp';
    if (sourceType === 'cloud_storage') return c.connection_type === 'cloud_storage';
    if (sourceType === 'google_sheets') return c.connection_type === 'google_sheets';
    return false;
  });

  const handleHttpConfigChange = (updates: Partial<HttpApiConfig>) => {
    onConfigChange({
      ...config,
      httpApi: { ...(config.httpApi || { url: '', method: 'GET', authType: 'none' }), ...updates }
    });
  };

  const handleDatabaseConfigChange = (updates: Partial<DatabaseConfig>) => {
    onConfigChange({
      ...config,
      database: { ...(config.database || { type: 'postgresql', connectionString: '', query: '' }), ...updates }
    });
  };

  const handleFileConfigChange = (updates: Partial<FileConfig>) => {
    onConfigChange({
      ...config,
      file: { ...(config.file || { sourceMode: 'upload', fileType: 'csv', hasHeader: true }), ...updates }
    });
  };

  const handleFtpConfigChange = (updates: Partial<FtpConfig>) => {
    onConfigChange({
      ...config,
      ftp: { ...(config.ftp || { protocol: 'sftp', host: '', port: 22, username: '', remotePath: '', fileType: 'csv', hasHeader: true }), ...updates }
    });
  };

  const handleCloudStorageConfigChange = (updates: Partial<CloudStorageConfig>) => {
    onConfigChange({
      ...config,
      cloudStorage: { ...(config.cloudStorage || { provider: 's3', bucketName: '', objectPath: '', fileType: 'csv', hasHeader: true }), ...updates }
    });
  };

  const handleWebhookConfigChange = (updates: Partial<WebhookConfig>) => {
    onConfigChange({
      ...config,
      webhook: { ...(config.webhook || { webhookId: crypto.randomUUID() }), ...updates }
    });
  };

  const handleGoogleSheetsConfigChange = (updates: Partial<GoogleSheetsConfig>) => {
    onConfigChange({
      ...config,
      googleSheets: { ...(config.googleSheets || { spreadsheetId: '', authType: 'api_key', hasHeader: true }), ...updates }
    });
  };

  // Generate webhook URL
  const getWebhookUrl = () => {
    const webhookId = config.webhook?.webhookId;
    if (!webhookId) return '';
    return `${window.location.origin}/api/webhook/${webhookId}`;
  };

  const copyWebhookUrl = () => {
    const url = getWebhookUrl();
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'Webhook URL copied to clipboard' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${projectId}/${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('data-feed-files')
        .upload(fileName, file);

      if (error) throw error;

      const newFileConfig: Partial<FileConfig> = {
        uploadedFilePath: data.path,
        fileType: fileExt === 'xlsx' || fileExt === 'xls' ? 'excel' : fileExt === 'json' ? 'json' : 'csv',
        sourceMode: 'upload',
        hasHeader: config.file?.hasHeader !== false,
      };

      handleFileConfigChange(newFileConfig);

      // Auto-discover fields after upload with the new config
      const updatedConfig: ExternalSourceConfigType = {
        ...config,
        file: { 
          ...(config.file || { sourceMode: 'upload', fileType: 'csv', hasHeader: true }), 
          ...newFileConfig 
        } as FileConfig
      };
      discoverFields(updatedConfig);
    } catch (error) {
      console.error('File upload error:', error);
      setDiscoveryError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const discoverFields = async (overrideConfig?: ExternalSourceConfigType) => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    setPreviewData([]);

    const configToSend = overrideConfig || config;

    try {
      const { data, error } = await supabase.functions.invoke('discover-external-fields', {
        body: {
          sourceType,
          config: configToSend,
          connectionId: useSharedConnection ? selectedConnectionId : undefined,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onFieldsDiscovered(data.fields || []);
      setPreviewData(data.previewData || []);
    } catch (error: any) {
      console.error('Field discovery error:', error);
      setDiscoveryError(error.message || 'Failed to discover fields');
      onFieldsDiscovered([]);
      setPreviewData([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Source Type Selection */}
      <div className="space-y-2">
        <Label>Data Source Type</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SOURCE_TYPE_OPTIONS.map((option) => (
            <Card 
              key={option.value}
              className={`cursor-pointer transition-all ${
                sourceType === option.value 
                  ? 'border-primary ring-1 ring-primary' 
                  : 'hover:border-muted-foreground/50'
              }`}
              onClick={() => onSourceTypeChange(option.value)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                {getSourceIcon(option.value)}
                <div>
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{option.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {sourceType !== 'form' && (
        <>
          <Separator />

          {/* Shared Connection Toggle */}
          {filteredConnections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Use Shared Connection</Label>
                  <p className="text-xs text-muted-foreground">Reuse an existing connection configuration</p>
                </div>
                <Switch checked={useSharedConnection} onCheckedChange={onUseSharedConnectionChange} />
              </div>

              {useSharedConnection && (
                <Select value={selectedConnectionId || ''} onValueChange={(v) => onConnectionSelect(v || undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a connection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          <span>{conn.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {(!useSharedConnection || !selectedConnectionId) && (
            <>
              {/* HTTP API Configuration */}
              {sourceType === 'http_api' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <Label>Method</Label>
                      <Select 
                        value={config.httpApi?.method || 'GET'} 
                        onValueChange={(v) => handleHttpConfigChange({ method: v as 'GET' | 'POST' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label>API URL</Label>
                      <Input 
                        value={config.httpApi?.url || ''} 
                        onChange={(e) => handleHttpConfigChange({ url: e.target.value })}
                        placeholder="https://api.example.com/data"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Authentication</Label>
                    <Select 
                      value={config.httpApi?.authType || 'none'} 
                      onValueChange={(v) => handleHttpConfigChange({ authType: v as HttpAuthType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HTTP_AUTH_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {config.httpApi?.authType === 'bearer' && (
                    <div className="space-y-2">
                      <Label>Bearer Token</Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? 'text' : 'password'}
                          value={config.httpApi?.authConfig?.token || ''} 
                          onChange={(e) => handleHttpConfigChange({ 
                            authConfig: { ...config.httpApi?.authConfig, token: e.target.value }
                          })}
                          placeholder="Enter your API token"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="absolute right-1 top-1 h-7 w-7 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {config.httpApi?.authType === 'basic' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Username</Label>
                        <Input 
                          value={config.httpApi?.authConfig?.username || ''} 
                          onChange={(e) => handleHttpConfigChange({ 
                            authConfig: { ...config.httpApi?.authConfig, username: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input 
                          type="password"
                          value={config.httpApi?.authConfig?.password || ''} 
                          onChange={(e) => handleHttpConfigChange({ 
                            authConfig: { ...config.httpApi?.authConfig, password: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  {config.httpApi?.authType === 'api_key' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Header Name</Label>
                        <Input 
                          value={config.httpApi?.authConfig?.apiKeyHeader || ''} 
                          onChange={(e) => handleHttpConfigChange({ 
                            authConfig: { ...config.httpApi?.authConfig, apiKeyHeader: e.target.value }
                          })}
                          placeholder="X-API-Key"
                        />
                      </div>
                      <div>
                        <Label>API Key Value</Label>
                        <Input 
                          type="password"
                          value={config.httpApi?.authConfig?.apiKeyValue || ''} 
                          onChange={(e) => handleHttpConfigChange({ 
                            authConfig: { ...config.httpApi?.authConfig, apiKeyValue: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Response Data Path (JSONPath)</Label>
                    <Input 
                      value={config.httpApi?.responsePath || ''} 
                      onChange={(e) => handleHttpConfigChange({ responsePath: e.target.value })}
                      placeholder="$.data or $.results[*]"
                    />
                    <p className="text-xs text-muted-foreground">Path to the array of records in the API response</p>
                  </div>
                </div>
              )}

              {/* Database Configuration */}
              {sourceType === 'database' && (
                <div className="space-y-4">
                  <div>
                    <Label>Database Type</Label>
                    <Select 
                      value={config.database?.type || 'postgresql'} 
                      onValueChange={(v) => handleDatabaseConfigChange({ type: v as DatabaseType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATABASE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Connection String</Label>
                    <Input 
                      type="password"
                      value={config.database?.connectionString || ''} 
                      onChange={(e) => handleDatabaseConfigChange({ connectionString: e.target.value })}
                      placeholder="postgresql://user:pass@host:5432/db"
                    />
                  </div>

                  <div>
                    <Label>SQL Query</Label>
                    <Textarea 
                      value={config.database?.query || ''} 
                      onChange={(e) => handleDatabaseConfigChange({ query: e.target.value })}
                      placeholder="SELECT * FROM table_name WHERE ..."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* CSV/Excel Configuration */}
              {(sourceType === 'csv' || sourceType === 'excel') && (
                <div className="space-y-4">
                  <div>
                    <Label>File Source</Label>
                    <RadioGroup 
                      value={config.file?.sourceMode || 'upload'} 
                      onValueChange={(v) => handleFileConfigChange({ sourceMode: v as 'upload' | 'url' })}
                      className="grid grid-cols-2 gap-2 mt-2"
                    >
                      <div className="flex items-center space-x-2 p-3 border rounded-md">
                        <RadioGroupItem value="upload" id="file_upload" />
                        <Label htmlFor="file_upload" className="flex items-center gap-2 cursor-pointer">
                          <Upload className="h-4 w-4" />
                          Upload File
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-md">
                        <RadioGroupItem value="url" id="file_url" />
                        <Label htmlFor="file_url" className="flex items-center gap-2 cursor-pointer">
                          <Link className="h-4 w-4" />
                          URL Reference
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {config.file?.sourceMode === 'upload' && (
                    <div>
                      <Label>Upload File</Label>
                      <div className="mt-2">
                        <Input 
                          type="file" 
                          accept={sourceType === 'csv' ? '.csv' : '.xlsx,.xls'}
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                        {uploading && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading...
                          </div>
                        )}
                        {config.file?.uploadedFilePath && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            File uploaded: {config.file.uploadedFilePath.split('/').pop()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {config.file?.sourceMode === 'url' && (
                    <div>
                      <Label>File URL</Label>
                      <Input 
                        value={config.file?.fileUrl || ''} 
                        onChange={(e) => handleFileConfigChange({ fileUrl: e.target.value })}
                        placeholder="https://example.com/data.csv"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports Google Sheets (publish as CSV), Dropbox, or any direct file URL
                      </p>
                    </div>
                  )}

                  {sourceType === 'excel' && (
                    <div>
                      <Label>Sheet Name (optional)</Label>
                      <Input 
                        value={config.file?.sheetName || ''} 
                        onChange={(e) => handleFileConfigChange({ sheetName: e.target.value })}
                        placeholder="Sheet1"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={config.file?.hasHeader !== false}
                      onCheckedChange={(v) => handleFileConfigChange({ hasHeader: v })}
                    />
                    <Label>First row contains headers</Label>
                  </div>
                </div>
              )}

              {/* Google Sheets Configuration */}
              {sourceType === 'google_sheets' && (
                <div className="space-y-4">
                  <div>
                    <Label>Spreadsheet ID</Label>
                    <Input 
                      value={config.googleSheets?.spreadsheetId || ''} 
                      onChange={(e) => handleGoogleSheetsConfigChange({ spreadsheetId: e.target.value })}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Find the ID in the URL: docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Sheet Name (optional)</Label>
                      <Input 
                        value={config.googleSheets?.sheetName || ''} 
                        onChange={(e) => handleGoogleSheetsConfigChange({ sheetName: e.target.value })}
                        placeholder="Sheet1"
                      />
                    </div>
                    <div>
                      <Label>Range (optional)</Label>
                      <Input 
                        value={config.googleSheets?.range || ''} 
                        onChange={(e) => handleGoogleSheetsConfigChange({ range: e.target.value })}
                        placeholder="A1:Z1000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Authentication</Label>
                    <Select 
                      value={config.googleSheets?.authType || 'api_key'} 
                      onValueChange={(v) => handleGoogleSheetsConfigChange({ authType: v as 'api_key' | 'service_account' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="service_account">Service Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config.googleSheets?.authType === 'api_key' && (
                    <div>
                      <Label>Google API Key</Label>
                      <Input 
                        type="password"
                        value={config.googleSheets?.apiKey || ''} 
                        onChange={(e) => handleGoogleSheetsConfigChange({ apiKey: e.target.value })}
                        placeholder="AIza..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Get an API key from the Google Cloud Console. Sheet must be publicly accessible.
                      </p>
                    </div>
                  )}

                  {config.googleSheets?.authType === 'service_account' && (
                    <div>
                      <Label>Service Account JSON</Label>
                      <Textarea 
                        value={config.googleSheets?.serviceAccountJson || ''} 
                        onChange={(e) => handleGoogleSheetsConfigChange({ serviceAccountJson: e.target.value })}
                        placeholder='{"type": "service_account", ...}'
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={config.googleSheets?.hasHeader !== false}
                      onCheckedChange={(v) => handleGoogleSheetsConfigChange({ hasHeader: v })}
                    />
                    <Label>First row contains headers</Label>
                  </div>
                </div>
              )}

              {/* FTP/SFTP Configuration */}
              {sourceType === 'ftp' && (
                <div className="space-y-4">
                  <div>
                    <Label>Protocol</Label>
                    <Select 
                      value={config.ftp?.protocol || 'sftp'} 
                      onValueChange={(v) => handleFtpConfigChange({ protocol: v as 'ftp' | 'sftp', port: v === 'sftp' ? 22 : 21 })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sftp">SFTP (Secure)</SelectItem>
                        <SelectItem value="ftp">FTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>Host</Label>
                      <Input 
                        value={config.ftp?.host || ''} 
                        onChange={(e) => handleFtpConfigChange({ host: e.target.value })}
                        placeholder="ftp.example.com"
                      />
                    </div>
                    <div>
                      <Label>Port</Label>
                      <Input 
                        type="number"
                        value={config.ftp?.port || (config.ftp?.protocol === 'ftp' ? 21 : 22)} 
                        onChange={(e) => handleFtpConfigChange({ port: parseInt(e.target.value) || 22 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Username</Label>
                      <Input 
                        value={config.ftp?.username || ''} 
                        onChange={(e) => handleFtpConfigChange({ username: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input 
                        type="password"
                        value={config.ftp?.password || ''} 
                        onChange={(e) => handleFtpConfigChange({ password: e.target.value })}
                      />
                    </div>
                  </div>

                  {config.ftp?.protocol === 'sftp' && (
                    <div>
                      <Label>Private Key (optional - for key-based auth)</Label>
                      <Textarea 
                        value={config.ftp?.privateKey || ''} 
                        onChange={(e) => handleFtpConfigChange({ privateKey: e.target.value })}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----"
                        rows={3}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Remote File Path</Label>
                    <Input 
                      value={config.ftp?.remotePath || ''} 
                      onChange={(e) => handleFtpConfigChange({ remotePath: e.target.value })}
                      placeholder="/data/exports/daily_report.csv"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>File Type</Label>
                      <Select 
                        value={config.ftp?.fileType || 'csv'} 
                        onValueChange={(v) => handleFtpConfigChange({ fileType: v as 'csv' | 'excel' | 'json' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch 
                        checked={config.ftp?.hasHeader !== false}
                        onCheckedChange={(v) => handleFtpConfigChange({ hasHeader: v })}
                      />
                      <Label>Has headers</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Cloud Storage Configuration */}
              {sourceType === 'cloud_storage' && (
                <div className="space-y-4">
                  <div>
                    <Label>Cloud Provider</Label>
                    <Select 
                      value={config.cloudStorage?.provider || 's3'} 
                      onValueChange={(v) => handleCloudStorageConfigChange({ provider: v as CloudStorageProvider })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOUD_STORAGE_PROVIDERS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Bucket Name</Label>
                      <Input 
                        value={config.cloudStorage?.bucketName || ''} 
                        onChange={(e) => handleCloudStorageConfigChange({ bucketName: e.target.value })}
                        placeholder="my-bucket"
                      />
                    </div>
                    {config.cloudStorage?.provider === 's3' && (
                      <div>
                        <Label>Region</Label>
                        <Input 
                          value={config.cloudStorage?.region || ''} 
                          onChange={(e) => handleCloudStorageConfigChange({ region: e.target.value })}
                          placeholder="us-east-1"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Object Path</Label>
                    <Input 
                      value={config.cloudStorage?.objectPath || ''} 
                      onChange={(e) => handleCloudStorageConfigChange({ objectPath: e.target.value })}
                      placeholder="data/exports/report.csv"
                    />
                  </div>

                  {/* S3 / GCS Credentials */}
                  {(config.cloudStorage?.provider === 's3' || config.cloudStorage?.provider === 'gcs') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Access Key ID</Label>
                        <Input 
                          value={config.cloudStorage?.accessKeyId || ''} 
                          onChange={(e) => handleCloudStorageConfigChange({ accessKeyId: e.target.value })}
                          placeholder="AKIA..."
                        />
                      </div>
                      <div>
                        <Label>Secret Access Key</Label>
                        <Input 
                          type="password"
                          value={config.cloudStorage?.secretAccessKey || ''} 
                          onChange={(e) => handleCloudStorageConfigChange({ secretAccessKey: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Azure Connection String */}
                  {config.cloudStorage?.provider === 'azure_blob' && (
                    <div>
                      <Label>Connection String</Label>
                      <Input 
                        type="password"
                        value={config.cloudStorage?.connectionString || ''} 
                        onChange={(e) => handleCloudStorageConfigChange({ connectionString: e.target.value })}
                        placeholder="DefaultEndpointsProtocol=https;AccountName=..."
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>File Type</Label>
                      <Select 
                        value={config.cloudStorage?.fileType || 'csv'} 
                        onValueChange={(v) => handleCloudStorageConfigChange({ fileType: v as 'csv' | 'excel' | 'json' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch 
                        checked={config.cloudStorage?.hasHeader !== false}
                        onCheckedChange={(v) => handleCloudStorageConfigChange({ hasHeader: v })}
                      />
                      <Label>Has headers</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook Configuration */}
              {sourceType === 'webhook' && (
                <div className="space-y-4">
                  <Alert>
                    <Webhook className="h-4 w-4" />
                    <AlertDescription>
                      Configure your external system to push data to this webhook URL. The data feed will process incoming data automatically.
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        value={getWebhookUrl()} 
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      POST JSON data to this URL to trigger the data feed
                    </p>
                  </div>

                  <div>
                    <Label>Secret Key (optional)</Label>
                    <Input 
                      type="password"
                      value={config.webhook?.secretKey || ''} 
                      onChange={(e) => handleWebhookConfigChange({ secretKey: e.target.value })}
                      placeholder="For validating incoming requests"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If set, incoming requests must include this in the X-Webhook-Secret header
                    </p>
                  </div>

                  <div>
                    <Label>Payload Data Path (JSONPath)</Label>
                    <Input 
                      value={config.webhook?.payloadPath || ''} 
                      onChange={(e) => handleWebhookConfigChange({ payloadPath: e.target.value })}
                      placeholder="$.data or $.records"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Path to the array of records in the webhook payload
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          <Separator />

          {/* Field Discovery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Discovered Fields</Label>
                <p className="text-xs text-muted-foreground">Fields available for mapping</p>
              </div>
              {sourceType !== 'webhook' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => discoverFields()}
                  disabled={isDiscovering}
                >
                  {isDiscovering ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Discover Fields
                    </>
                  )}
                </Button>
              )}
            </div>

            {discoveryError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{discoveryError}</AlertDescription>
              </Alert>
            )}

            {discoveredFields.length > 0 ? (
              <div className="space-y-4">
                {/* Fields Summary */}
                <div className="flex flex-wrap gap-2">
                  {discoveredFields.map((field) => (
                    <Badge key={field.id} variant="secondary" className="text-xs">
                      {field.name} <span className="text-muted-foreground ml-1">({field.type})</span>
                    </Badge>
                  ))}
                </div>

                {/* Data Preview Table */}
                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Data Preview</Label>
                      <span className="text-xs text-muted-foreground">
                        Showing {previewData.length} of fetched records
                      </span>
                    </div>
                    <div className="border rounded-md overflow-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">#</th>
                            {discoveredFields.map((field) => (
                              <th key={field.id} className="text-left px-3 py-2 font-medium text-xs whitespace-nowrap">
                                {field.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              <td className="px-3 py-2 text-muted-foreground text-xs">{rowIndex + 1}</td>
                              {discoveredFields.map((field) => (
                                <td 
                                  key={field.id} 
                                  className="px-3 py-2 text-xs font-mono max-w-[150px] truncate"
                                  title={row[field.id] !== undefined ? String(row[field.id]) : '-'}
                                >
                                  {row[field.id] !== undefined && row[field.id] !== null 
                                    ? String(row[field.id]).substring(0, 50) 
                                    : <span className="text-muted-foreground italic">-</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-4 border-2 border-dashed rounded-md text-muted-foreground">
                <p className="text-sm">No fields discovered yet</p>
                <p className="text-xs">Configure the source and click "Discover Fields"</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
