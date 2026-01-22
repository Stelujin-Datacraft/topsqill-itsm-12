import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLdapConfiguration, LdapConfiguration, CreateLdapConfigInput } from "@/hooks/useLdapConfiguration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Shield, 
  Users, 
  RefreshCw, 
  Trash2, 
  Check, 
  X,
  Server,
  Key,
  Clock,
  History,
  AlertCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";

export default function LdapSettings() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const {
    configurations,
    syncLogs,
    isLoading,
    isTesting,
    loadSyncLogs,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    toggleEnabled,
    testConnection,
    triggerSync,
  } = useLdapConfiguration();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LdapConfiguration | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("connection");
  const [formData, setFormData] = useState<CreateLdapConfigInput>({
    name: 'Primary LDAP',
    server_url: '',
    base_dn: '',
    bind_dn: '',
    bind_password: '',
    user_search_base: '',
    user_search_filter: '(sAMAccountName={username})',
    username_attribute: 'sAMAccountName',
    email_attribute: 'mail',
    first_name_attribute: 'givenName',
    last_name_attribute: 'sn',
    use_ssl: true,
    auto_provision_users: true,
    fallback_to_local_auth: true,
  });

  if (userProfile?.role !== 'admin') {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center py-12">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You don't have permission to access LDAP settings. Only administrators can configure LDAP integration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleCreateConfig = async () => {
    if (!formData.server_url || !formData.base_dn) {
      return;
    }
    
    const result = await createConfiguration(formData);
    if (result) {
      setShowCreateDialog(false);
      resetForm();
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;
    
    const result = await updateConfiguration(editingConfig.id, formData);
    if (result) {
      setEditingConfig(null);
      resetForm();
    }
  };

  const handleDeleteConfig = async () => {
    if (!deleteConfirmId) return;
    
    await deleteConfiguration(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const resetForm = () => {
    setFormData({
      name: 'Primary LDAP',
      server_url: '',
      base_dn: '',
      bind_dn: '',
      bind_password: '',
      user_search_base: '',
      user_search_filter: '(sAMAccountName={username})',
      username_attribute: 'sAMAccountName',
      email_attribute: 'mail',
      first_name_attribute: 'givenName',
      last_name_attribute: 'sn',
      use_ssl: true,
      auto_provision_users: true,
      fallback_to_local_auth: true,
    });
    setActiveTab("connection");
  };

  const openEditDialog = (config: LdapConfiguration) => {
    setFormData({
      name: config.name,
      server_url: config.server_url,
      base_dn: config.base_dn,
      bind_dn: config.bind_dn || '',
      bind_password: '', // Don't show existing password
      user_search_base: config.user_search_base || '',
      user_search_filter: config.user_search_filter,
      username_attribute: config.username_attribute,
      email_attribute: config.email_attribute,
      first_name_attribute: config.first_name_attribute,
      last_name_attribute: config.last_name_attribute,
      use_ssl: config.use_ssl,
      use_starttls: config.use_starttls,
      allow_self_signed_certs: config.allow_self_signed_certs,
      auto_provision_users: config.auto_provision_users,
      sync_user_status: config.sync_user_status,
      fallback_to_local_auth: config.fallback_to_local_auth,
      sync_enabled: config.sync_enabled,
      sync_interval_minutes: config.sync_interval_minutes,
    });
    setEditingConfig(config);
  };

  const handleViewSyncLogs = async (configId: string) => {
    await loadSyncLogs(configId);
  };

  const ConfigurationForm = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="connection">Connection</TabsTrigger>
        <TabsTrigger value="search">Search</TabsTrigger>
        <TabsTrigger value="attributes">Attributes</TabsTrigger>
        <TabsTrigger value="behavior">Behavior</TabsTrigger>
      </TabsList>

      <TabsContent value="connection" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Primary LDAP"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="server_url">Server URL *</Label>
            <Input
              id="server_url"
              value={formData.server_url}
              onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
              placeholder="ldaps://ad.company.com:636"
            />
            <p className="text-xs text-muted-foreground">
              Use ldaps:// for SSL or ldap:// with StartTLS
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_dn">Base DN *</Label>
            <Input
              id="base_dn"
              value={formData.base_dn}
              onChange={(e) => setFormData({ ...formData, base_dn: e.target.value })}
              placeholder="DC=company,DC=com"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="bind_dn">Bind DN (Service Account)</Label>
            <Input
              id="bind_dn"
              value={formData.bind_dn}
              onChange={(e) => setFormData({ ...formData, bind_dn: e.target.value })}
              placeholder="CN=LDAPService,OU=ServiceAccounts,DC=company,DC=com"
            />
            <p className="text-xs text-muted-foreground">
              Service account for directory searches
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bind_password">Bind Password</Label>
            <Input
              id="bind_password"
              type="password"
              value={formData.bind_password}
              onChange={(e) => setFormData({ ...formData, bind_password: e.target.value })}
              placeholder={editingConfig ? "Leave blank to keep existing" : "Enter password"}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use SSL/TLS</Label>
              <p className="text-xs text-muted-foreground">Encrypt connection (recommended)</p>
            </div>
            <Switch
              checked={formData.use_ssl}
              onCheckedChange={(checked) => setFormData({ ...formData, use_ssl: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use StartTLS</Label>
              <p className="text-xs text-muted-foreground">Upgrade plain connection to TLS</p>
            </div>
            <Switch
              checked={formData.use_starttls}
              onCheckedChange={(checked) => setFormData({ ...formData, use_starttls: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Self-Signed Certificates</Label>
              <p className="text-xs text-muted-foreground">Not recommended for production</p>
            </div>
            <Switch
              checked={formData.allow_self_signed_certs}
              onCheckedChange={(checked) => setFormData({ ...formData, allow_self_signed_certs: checked })}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="search" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_search_base">User Search Base</Label>
            <Input
              id="user_search_base"
              value={formData.user_search_base}
              onChange={(e) => setFormData({ ...formData, user_search_base: e.target.value })}
              placeholder="OU=Users,DC=company,DC=com"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use Base DN
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user_search_filter">User Search Filter</Label>
            <Input
              id="user_search_filter"
              value={formData.user_search_filter}
              onChange={(e) => setFormData({ ...formData, user_search_filter: e.target.value })}
              placeholder="(sAMAccountName={username})"
            />
            <p className="text-xs text-muted-foreground">
              {'{username}'} will be replaced with the login username
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="attributes" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username_attribute">Username Attribute</Label>
              <Input
                id="username_attribute"
                value={formData.username_attribute}
                onChange={(e) => setFormData({ ...formData, username_attribute: e.target.value })}
                placeholder="sAMAccountName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_attribute">Email Attribute</Label>
              <Input
                id="email_attribute"
                value={formData.email_attribute}
                onChange={(e) => setFormData({ ...formData, email_attribute: e.target.value })}
                placeholder="mail"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name_attribute">First Name Attribute</Label>
              <Input
                id="first_name_attribute"
                value={formData.first_name_attribute}
                onChange={(e) => setFormData({ ...formData, first_name_attribute: e.target.value })}
                placeholder="givenName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name_attribute">Last Name Attribute</Label>
              <Input
                id="last_name_attribute"
                value={formData.last_name_attribute}
                onChange={(e) => setFormData({ ...formData, last_name_attribute: e.target.value })}
                placeholder="sn"
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="behavior" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Provision Users</Label>
              <p className="text-xs text-muted-foreground">
                Automatically create user accounts on first LDAP login
              </p>
            </div>
            <Switch
              checked={formData.auto_provision_users}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_provision_users: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sync User Status</Label>
              <p className="text-xs text-muted-foreground">
                Disable accounts when removed from LDAP
              </p>
            </div>
            <Switch
              checked={formData.sync_user_status}
              onCheckedChange={(checked) => setFormData({ ...formData, sync_user_status: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Fallback to Local Auth</Label>
              <p className="text-xs text-muted-foreground">
                Allow local login if LDAP is unavailable
              </p>
            </div>
            <Switch
              checked={formData.fallback_to_local_auth}
              onCheckedChange={(checked) => setFormData({ ...formData, fallback_to_local_auth: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Directory Sync</Label>
              <p className="text-xs text-muted-foreground">
                Periodically sync users from LDAP
              </p>
            </div>
            <Switch
              checked={formData.sync_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, sync_enabled: checked })}
            />
          </div>

          {formData.sync_enabled && (
            <div className="space-y-2">
              <Label htmlFor="sync_interval">Sync Interval (minutes)</Label>
              <Input
                id="sync_interval"
                type="number"
                min={15}
                max={1440}
                value={formData.sync_interval_minutes || 60}
                onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) })}
              />
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <DashboardLayout title="LDAP / Active Directory">
      <div className="space-y-6">

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : configurations.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
                <Server className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>No LDAP Configuration</CardTitle>
              <CardDescription>
                Connect your organization's LDAP or Active Directory server to enable enterprise authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add LDAP Configuration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add LDAP Configuration</DialogTitle>
                    <DialogDescription>
                      Configure your LDAP/Active Directory server connection
                    </DialogDescription>
                  </DialogHeader>
                  <ConfigurationForm />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateConfig} disabled={!formData.server_url || !formData.base_dn}>
                      Create Configuration
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {configurations.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.is_enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.name}
                          {config.is_enabled ? (
                            <Badge variant="default" className="bg-green-500">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{config.server_url}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.is_enabled}
                        onCheckedChange={(checked) => toggleEnabled(config.id, checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Base DN:</span>
                      <span className="font-mono text-xs truncate">{config.base_dn}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">SSL:</span>
                      {config.use_ssl ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Auto-provision:</span>
                      {config.auto_provision_users ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last sync:</span>
                      <span>{config.last_sync_at ? format(new Date(config.last_sync_at), 'MMM d, HH:mm') : 'Never'}</span>
                    </div>
                  </div>

                  {config.last_sync_status === 'failed' && config.last_sync_error && (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="text-sm text-destructive">
                        <span className="font-medium">Last sync failed: </span>
                        {config.last_sync_error}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(config.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(config.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSyncLogs(config.id)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      Sync History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(config)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(config.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Sync Logs */}
            {syncLogs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Sync History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {syncLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={
                              log.status === 'success' ? 'default' : 
                              log.status === 'failed' ? 'destructive' : 
                              'secondary'
                            }
                          >
                            {log.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(log.started_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>Found: {log.users_found}</span>
                          <span className="text-green-600">Created: {log.users_created}</span>
                          <span className="text-blue-600">Updated: {log.users_updated}</span>
                          {log.errors_count > 0 && (
                            <span className="text-red-600">Errors: {log.errors_count}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(open) => { if (!open) { setEditingConfig(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit LDAP Configuration</DialogTitle>
            <DialogDescription>
              Update your LDAP/Active Directory server settings
            </DialogDescription>
          </DialogHeader>
          <ConfigurationForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingConfig(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConfig}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LDAP Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this LDAP configuration. Users who authenticated via LDAP will need to use local authentication or wait for a new LDAP configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfig} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
