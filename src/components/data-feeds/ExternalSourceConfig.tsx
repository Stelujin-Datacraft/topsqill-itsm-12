import { useState, useEffect } from 'react';
import { 
  SourceType, 
  ExternalSourceConfig as ExternalSourceConfigType,
  HttpApiConfig,
  DatabaseConfig,
  FileConfig,
  DiscoveredField,
  SOURCE_TYPE_OPTIONS,
  HTTP_AUTH_OPTIONS,
  DATABASE_TYPE_OPTIONS,
  HttpAuthType,
  DatabaseType,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormInput, FileSpreadsheet, Sheet, Globe, Database, Upload, Link, RefreshCw, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  // Filter connections by type
  const filteredConnections = sharedConnections.filter(c => {
    if (sourceType === 'http_api') return c.connection_type === 'http_api';
    if (sourceType === 'database') return c.connection_type === 'database';
    if (sourceType === 'csv' || sourceType === 'excel' || sourceType === 'file_url') return c.connection_type === 'file_url';
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

      // Auto-discover fields after upload with the new config (don't rely on stale state)
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
    } catch (error: any) {
      console.error('Field discovery error:', error);
      setDiscoveryError(error.message || 'Failed to discover fields');
      onFieldsDiscovered([]);
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
            </div>

            {discoveryError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{discoveryError}</AlertDescription>
              </Alert>
            )}

            {discoveredFields.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {discoveredFields.map((field) => (
                  <Badge key={field.id} variant="secondary" className="flex items-center gap-1">
                    <span className="font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground">({field.type})</span>
                  </Badge>
                ))}
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
