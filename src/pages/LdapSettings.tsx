import React, { useState, useEffect } from "react";
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
  Loader2,
  Network,
  UserCheck,
  Activity,
  Lock,
  Zap,
  Building2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { LdapGroupMappings } from "@/components/ldap/LdapGroupMappings";
import { LdapSyncLogs } from "@/components/ldap/LdapSyncLogs";

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
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  
  // Generate unique default name
  const getDefaultConfigName = () => {
    const existingNames = configurations.map(c => c.name.toLowerCase());
    if (!existingNames.includes('primary ldap')) {
      return 'Primary LDAP';
    }
    let counter = 2;
    while (existingNames.includes(`ldap server ${counter}`.toLowerCase())) {
      counter++;
    }
    return `LDAP Server ${counter}`;
  };

  const [formData, setFormData] = useState<CreateLdapConfigInput>({
    name: '',
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
          <Card className="max-w-md border-destructive/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10 w-fit">
                <Shield className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access LDAP settings. Only administrators can configure LDAP integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate('/dashboard')} variant="outline">
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
      name: getDefaultConfigName(),
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
  
  // Set default selected config when configurations load
  React.useEffect(() => {
    if (configurations.length > 0 && !selectedConfigId) {
      setSelectedConfigId(configurations[0].id);
    }
  }, [configurations, selectedConfigId]);

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

  // Calculate stats
  const enabledConfigs = configurations.filter(c => c.is_enabled).length;
  const lastSyncConfig = configurations.find(c => c.last_sync_at);
  const hasFailedSync = configurations.some(c => c.last_sync_status === 'failed');

  const ConfigurationForm = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="connection" className="gap-2">
          <Network className="h-4 w-4" />
          <span className="hidden sm:inline">Connection</span>
        </TabsTrigger>
        <TabsTrigger value="search" className="gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </TabsTrigger>
        <TabsTrigger value="attributes" className="gap-2">
          <Key className="h-4 w-4" />
          <span className="hidden sm:inline">Attributes</span>
        </TabsTrigger>
        <TabsTrigger value="behavior" className="gap-2">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Behavior</span>
        </TabsTrigger>
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

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Security Options</h4>
            
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-600" />
                  Use SSL/TLS
                </Label>
                <p className="text-xs text-muted-foreground">Encrypt connection (recommended)</p>
              </div>
              <Switch
                checked={formData.use_ssl}
                onCheckedChange={(checked) => setFormData({ ...formData, use_ssl: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label>Use StartTLS</Label>
                <p className="text-xs text-muted-foreground">Upgrade plain connection to TLS</p>
              </div>
              <Switch
                checked={formData.use_starttls}
                onCheckedChange={(checked) => setFormData({ ...formData, use_starttls: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-900/20">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Allow Self-Signed Certificates
                </Label>
                <p className="text-xs text-muted-foreground">Not recommended for production</p>
              </div>
              <Switch
                checked={formData.allow_self_signed_certs}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_self_signed_certs: checked })}
              />
            </div>
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
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {'{username}'} will be replaced with the login username
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="attributes" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Map LDAP attributes to user profile fields. Common Active Directory attributes are pre-filled.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username_attribute">Username Attribute</Label>
              <Input
                id="username_attribute"
                value={formData.username_attribute}
                onChange={(e) => setFormData({ ...formData, username_attribute: e.target.value })}
                placeholder="sAMAccountName"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_attribute">Email Attribute</Label>
              <Input
                id="email_attribute"
                value={formData.email_attribute}
                onChange={(e) => setFormData({ ...formData, email_attribute: e.target.value })}
                placeholder="mail"
                className="font-mono text-sm"
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
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name_attribute">Last Name Attribute</Label>
              <Input
                id="last_name_attribute"
                value={formData.last_name_attribute}
                onChange={(e) => setFormData({ ...formData, last_name_attribute: e.target.value })}
                placeholder="sn"
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="behavior" className="space-y-4 mt-4">
        <div className="grid gap-4">
          <h4 className="text-sm font-medium text-muted-foreground">User Provisioning</h4>
          
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Auto-Provision Users
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically create user accounts on first LDAP login
              </p>
            </div>
            <Switch
              checked={formData.auto_provision_users}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_provision_users: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
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

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
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

          <h4 className="text-sm font-medium text-muted-foreground">Directory Synchronization</h4>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Enable Directory Sync
              </Label>
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
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label htmlFor="sync_interval">Sync Interval (minutes)</Label>
              <Input
                id="sync_interval"
                type="number"
                min={15}
                max={1440}
                value={formData.sync_interval_minutes || 60}
                onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) })}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 15 minutes, maximum 24 hours (1440 minutes)
              </p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );

  // Create dialog component for reuse
  const CreateConfigDialog = () => (
    <Dialog open={showCreateDialog} onOpenChange={(open) => {
      if (open) {
        setFormData(prev => ({ ...prev, name: getDefaultConfigName() }));
      }
      setShowCreateDialog(open);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Configuration
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
  );

  return (
    <DashboardLayout 
      title="LDAP / Active Directory" 
      description="Configure enterprise authentication and user synchronization"
      actions={<CreateConfigDialog />}
    >
      <div className="space-y-6">

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading LDAP configurations...</p>
            </div>
          </div>
        ) : configurations.length === 0 ? (
          /* Empty State - Full width like other pages */
          <Card className="border-dashed">
            <CardContent className="py-16">
              <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
                <div className="mb-6 p-5 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                  <Server className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">No LDAP Configuration</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Connect your organization's LDAP or Active Directory server to enable enterprise authentication and automatic user provisioning.
                </p>
                
                <div className="grid sm:grid-cols-3 gap-6 mb-8 w-full">
                  <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/50 border">
                    <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">Single Sign-On</p>
                      <p className="text-sm text-muted-foreground">Use existing credentials</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/50 border">
                    <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <RefreshCw className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">Auto Sync</p>
                      <p className="text-sm text-muted-foreground">Keep users up-to-date</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/50 border">
                    <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Shield className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">Group Mapping</p>
                      <p className="text-sm text-muted-foreground">Sync roles & permissions</p>
                    </div>
                  </div>
                </div>
                
                <Button size="lg" className="gap-2" onClick={() => {
                  setFormData(prev => ({ ...prev, name: getDefaultConfigName() }));
                  setShowCreateDialog(true);
                }}>
                  <Plus className="h-5 w-5" />
                  Add LDAP Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Configurations</p>
                      <p className="text-3xl font-bold">{configurations.length}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Server className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${enabledConfigs > 0 ? 'border-l-green-500' : 'border-l-muted'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active</p>
                      <p className="text-3xl font-bold">{enabledConfigs}</p>
                    </div>
                    <div className={`p-3 rounded-full ${enabledConfigs > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                      <Activity className={`h-6 w-6 ${enabledConfigs > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${hasFailedSync ? 'border-l-destructive' : 'border-l-blue-500'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Sync Status</p>
                      <p className="text-lg font-semibold">
                        {hasFailedSync ? (
                          <span className="text-destructive">Errors</span>
                        ) : lastSyncConfig ? (
                          <span className="text-green-600">Healthy</span>
                        ) : (
                          <span className="text-muted-foreground">No syncs</span>
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${hasFailedSync ? 'bg-destructive/10' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                      <RefreshCw className={`h-6 w-6 ${hasFailedSync ? 'text-destructive' : 'text-blue-600'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                      <p className="text-lg font-semibold">
                        {lastSyncConfig?.last_sync_at
                          ? formatDistanceToNow(new Date(lastSyncConfig.last_sync_at), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-muted">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configuration Cards */}
            {configurations.map((config) => (
              <Card key={config.id} className={`overflow-hidden ${config.is_enabled ? 'border-l-4 border-l-green-500' : ''}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${config.is_enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                        <Server className={`h-6 w-6 ${config.is_enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          {config.name}
                          {config.is_enabled ? (
                            <Badge className="bg-green-500 hover:bg-green-600">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">
                          {config.server_url}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {config.is_enabled ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                          checked={config.is_enabled}
                          onCheckedChange={(checked) => toggleEnabled(config.id, checked)}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Config Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 mb-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Base DN</p>
                      <p className="font-mono text-sm truncate" title={config.base_dn}>{config.base_dn}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SSL/TLS</p>
                      <div className="flex items-center gap-1.5">
                        {config.use_ssl ? (
                          <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">Enabled</span>
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600 font-medium">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto-provision</p>
                      <div className="flex items-center gap-1.5">
                        {config.auto_provision_users ? (
                          <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Yes</span>
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">No</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Sync</p>
                      <p className="text-sm">
                        {config.last_sync_at 
                          ? format(new Date(config.last_sync_at), 'MMM d, HH:mm')
                          : 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {config.last_sync_status === 'failed' && config.last_sync_error && (
                    <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-destructive text-sm">Last sync failed</p>
                        <p className="text-sm text-destructive/80 mt-1">{config.last_sync_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(config.id)}
                      disabled={isTesting}
                      className="gap-2"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(config.id)}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSyncLogs(config.id)}
                      className="gap-2"
                    >
                      <History className="h-4 w-4" />
                      Sync History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(config)}
                      className="gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteConfirmId(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Group Mappings */}
            <LdapGroupMappings 
              configurations={configurations}
              selectedConfigId={selectedConfigId || configurations[0]?.id}
              onConfigChange={(configId) => setSelectedConfigId(configId)}
            />

            {/* Sync Logs */}
            <LdapSyncLogs 
              syncLogs={syncLogs}
              configurations={configurations}
              onRefresh={loadSyncLogs}
              selectedConfigId={selectedConfigId || configurations[0]?.id}
              onConfigChange={(configId) => {
                setSelectedConfigId(configId);
                loadSyncLogs(configId);
              }}
            />
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
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete LDAP Configuration?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this LDAP configuration. Users who authenticated via LDAP will need to use local authentication or wait for a new LDAP configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfig} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
