import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Key, Copy, Eye, EyeOff, Trash2, RefreshCw, Shield, Clock, Activity, Book, AlertCircle, Pencil } from 'lucide-react';
import { useApiKeys, ApiKey } from '@/hooks/useApiKeys';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

const PERMISSION_OPTIONS = {
  forms: ['read', 'create', 'update', 'delete'],
  submissions: ['read', 'create', 'update', 'delete'],
  workflows: ['read', 'create', 'update', 'delete', 'trigger'],
  reports: ['read', 'create', 'update', 'delete']
};

interface ApiKeyManagementProps {
  showCreateDialog?: boolean;
  onCreateDialogChange?: (open: boolean) => void;
}

export function ApiKeyManagement({ showCreateDialog: externalShowCreate, onCreateDialogChange }: ApiKeyManagementProps = {}) {
  const navigate = useNavigate();
  const { apiKeys, requestLogs, loading, createApiKey, updateApiKey, deleteApiKey, revokeApiKey, fetchRequestLogs } = useApiKeys();
  const [internalShowCreate, setInternalShowCreate] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const showCreateDialog = externalShowCreate !== undefined ? externalShowCreate : internalShowCreate;
  const setShowCreateDialog = onCreateDialogChange || setInternalShowCreate;
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    permissions: {
      forms: ['read'] as string[],
      submissions: ['read'] as string[],
      workflows: [] as string[],
      reports: ['read'] as string[]
    },
    rateLimit: 60,
    allowedIps: '',
    expiresInDays: ''
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    permissions: {
      forms: [] as string[],
      submissions: [] as string[],
      workflows: [] as string[],
      reports: [] as string[]
    },
    rateLimit: 60,
    allowedIps: ''
  });

  const handleCreateKey = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'API key name is required',
        variant: 'destructive'
      });
      return;
    }

    const expiresAt = createForm.expiresInDays
      ? new Date(Date.now() + parseInt(createForm.expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const allowedIps = createForm.allowedIps
      ? createForm.allowedIps.split(',').map(ip => ip.trim()).filter(Boolean)
      : undefined;

    const result = await createApiKey(
      createForm.name,
      createForm.description,
      createForm.permissions,
      {
        expiresAt,
        rateLimit: createForm.rateLimit,
        allowedIps
      }
    );

    if (result) {
      setNewKeyValue(result.key);
      setShowCreateDialog(false);
      setCreateForm({
        name: '',
        description: '',
        permissions: {
          forms: ['read'],
          submissions: ['read'],
          workflows: [],
          reports: ['read']
        },
        rateLimit: 60,
        allowedIps: '',
        expiresInDays: ''
      });
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: 'Copied!',
      description: 'API key copied to clipboard'
    });
  };

  const handleViewLogs = (apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    fetchRequestLogs(apiKey.id);
  };

  const togglePermission = (resource: string, action: string) => {
    setCreateForm(prev => {
      const currentPerms = prev.permissions[resource as keyof typeof prev.permissions] || [];
      const newPerms = currentPerms.includes(action)
        ? currentPerms.filter(p => p !== action)
        : [...currentPerms, action];
      
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resource]: newPerms
        }
      };
    });
  };

  const toggleEditPermission = (resource: string, action: string) => {
    setEditForm(prev => {
      const currentPerms = prev.permissions[resource as keyof typeof prev.permissions] || [];
      const newPerms = currentPerms.includes(action)
        ? currentPerms.filter(p => p !== action)
        : [...currentPerms, action];
      
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resource]: newPerms
        }
      };
    });
  };

  const handleEditKey = (key: ApiKey) => {
    setEditingKey(key);
    setEditForm({
      name: key.name,
      description: key.description || '',
      permissions: {
        forms: (key.permissions?.forms as string[]) || [],
        submissions: (key.permissions?.submissions as string[]) || [],
        workflows: (key.permissions?.workflows as string[]) || [],
        reports: (key.permissions?.reports as string[]) || []
      },
      rateLimit: key.rate_limit_per_minute || 60,
      allowedIps: key.allowed_ips?.join(', ') || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;

    if (!editForm.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'API key name is required',
        variant: 'destructive'
      });
      return;
    }

    const allowedIps = editForm.allowedIps
      ? editForm.allowedIps.split(',').map(ip => ip.trim()).filter(Boolean)
      : null;

    const success = await updateApiKey(editingKey.id, {
      name: editForm.name,
      description: editForm.description || null,
      permissions: editForm.permissions,
      rate_limit_per_minute: editForm.rateLimit,
      allowed_ips: allowedIps
    });

    if (success) {
      setShowEditDialog(false);
      setEditingKey(null);
    }
  };

  const getStatusBadge = (key: ApiKey) => {
    if (!key.is_active) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Active</Badge>;
  };

  const apiBaseUrl = `https://fnmkczsvwpzpxyklztkt.supabase.co/functions/v1/public-api`;

  return (
    <div className="space-y-6">
      {/* Create Dialog - opened by external button or internal triggers */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for external integrations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Production Integration"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this API key"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Permissions</Label>
              <p className="text-sm text-muted-foreground">
                Select which operations this API key can perform
              </p>

              {Object.entries(PERMISSION_OPTIONS).map(([resource, actions]) => (
                <div key={resource} className="space-y-2">
                  <Label className="capitalize font-medium">{resource}</Label>
                  <div className="flex flex-wrap gap-4">
                    {actions.map((action) => (
                      <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${resource}-${action}`}
                          checked={createForm.permissions[resource as keyof typeof createForm.permissions]?.includes(action)}
                          onCheckedChange={() => togglePermission(resource, action)}
                        />
                        <Label htmlFor={`${resource}-${action}`} className="text-sm capitalize">
                          {action}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rateLimit">Rate Limit (requests/min)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  min="1"
                  max="1000"
                  value={createForm.rateLimit}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 60 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresIn">Expires In (days)</Label>
                <Input
                  id="expiresIn"
                  type="number"
                  min="1"
                  placeholder="Never"
                  value={createForm.expiresInDays}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, expiresInDays: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedIps">Allowed IPs (comma-separated, optional)</Label>
              <Input
                id="allowedIps"
                placeholder="e.g., 192.168.1.1, 10.0.0.0"
                value={createForm.allowedIps}
                onChange={(e) => setCreateForm(prev => ({ ...prev, allowedIps: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to allow all IPs
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey}>
              Create API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display */}
      {newKeyValue && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Key className="h-5 w-5" />
              Your New API Key
            </CardTitle>
            <CardDescription>
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Copy this key now - you won't be able to see it again!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-white dark:bg-black rounded border font-mono text-sm break-all">
                {showNewKey ? newKeyValue : '•'.repeat(newKeyValue.length)}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNewKey(!showNewKey)}
              >
                {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopyKey(newKeyValue)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => setNewKeyValue(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            API Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Base URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-muted rounded text-sm">
                {apiBaseUrl}
              </code>
              <Button variant="outline" size="icon" onClick={() => handleCopyKey(apiBaseUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Authentication Header</Label>
            <code className="block p-2 bg-muted rounded text-sm mt-1">
              x-api-key: your_api_key_here
            </code>
          </div>
          <Button variant="outline" onClick={() => navigate('/api-docs')}>
            <Book className="h-4 w-4 mr-2" />
            View Full API Docs
          </Button>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys created yet</p>
              <p className="text-sm">Create your first API key to enable external integrations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{key.name}</p>
                        {key.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {key.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.key_prefix}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(key)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(key.permissions || {}).map(([resource, actions]) => (
                          Array.isArray(actions) && actions.length > 0 && (
                            <Badge key={resource} variant="outline" className="text-xs">
                              {resource}: {actions.length}
                            </Badge>
                          )
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.last_used_at ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(key.created_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditKey(key)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewLogs(key)}
                          title="View Logs"
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                        {key.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Revoke">
                                <Shield className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will immediately disable the API key. Any integrations using this key will stop working.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => revokeApiKey(key.id)}>
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The API key and all its request logs will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteApiKey(key.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request Logs Dialog */}
      <Dialog open={!!selectedKey} onOpenChange={() => setSelectedKey(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>API Request Logs - {selectedKey?.name}</DialogTitle>
            <DialogDescription>
              Recent API requests for this key
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            {requestLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No requests logged yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.method}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.response_status < 400 ? 'default' : 'destructive'}
                          className={log.response_status < 400 ? 'bg-green-600' : ''}
                        >
                          {log.response_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.response_time_ms}ms</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit API Key Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) setEditingKey(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>
              Update the settings for this API key
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Key Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Production Integration"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the purpose of this API key"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Permissions</Label>
              <p className="text-sm text-muted-foreground">
                Select which operations this API key can perform
              </p>

              {Object.entries(PERMISSION_OPTIONS).map(([resource, actions]) => (
                <div key={resource} className="space-y-2">
                  <Label className="capitalize font-medium">{resource}</Label>
                  <div className="flex flex-wrap gap-4">
                    {actions.map((action) => (
                      <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${resource}-${action}`}
                          checked={editForm.permissions[resource as keyof typeof editForm.permissions]?.includes(action)}
                          onCheckedChange={() => toggleEditPermission(resource, action)}
                        />
                        <Label htmlFor={`edit-${resource}-${action}`} className="text-sm capitalize">
                          {action}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="edit-rateLimit">Rate Limit (requests/min)</Label>
              <Input
                id="edit-rateLimit"
                type="number"
                min="1"
                max="1000"
                value={editForm.rateLimit}
                onChange={(e) => setEditForm(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 60 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-allowedIps">Allowed IPs (comma-separated, optional)</Label>
              <Input
                id="edit-allowedIps"
                placeholder="e.g., 192.168.1.1, 10.0.0.0"
                value={editForm.allowedIps}
                onChange={(e) => setEditForm(prev => ({ ...prev, allowedIps: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to allow all IPs
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateKey}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
