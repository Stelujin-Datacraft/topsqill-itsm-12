import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Server, TestTube, FileText, Mail, Edit, CheckCircle2, XCircle, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import { PageContent } from '@/components/layouts/PageContent';
import { TestEmailDialog } from '@/components/email/TestEmailDialog';
import { useNavigate } from 'react-router-dom';

interface SMTPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_default: boolean;
  is_active: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  is_active: boolean;
  created_at: string;
}

export default function EmailConfigPage() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SMTPConfig[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMTPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [configToTest, setConfigToTest] = useState<SMTPConfig | null>(null);

  const loadConfigs = async () => {
    if (!userProfile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error loading SMTP configs:', error);
      toast({
        title: "Error",
        description: "Failed to load SMTP configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!currentProject?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, is_active, created_at')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!error) {
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadTemplates();
  }, [userProfile?.organization_id, currentProject?.id]);

  const createNewConfig = (): SMTPConfig => ({
    id: '',
    name: '',
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
    is_default: false,
    is_active: true,
  });

  const saveConfig = async (config: SMTPConfig) => {
    if (!userProfile?.organization_id) return;

    try {
      setLoading(true);
      
      const configData = {
        ...config,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id,
      };

      if (config.id) {
        const { error } = await supabase
          .from('smtp_configs')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('smtp_configs')
          .insert([configData]);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `SMTP configuration ${config.id ? 'updated' : 'created'} successfully`,
      });

      await loadConfigs();
      setEditingConfig(null);
      setIsCreating(false);
    } catch (error: any) {
      console.error('Error saving SMTP config:', error);
      toast({
        title: "Error",
        description: `Failed to save SMTP configuration: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('smtp_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "SMTP configuration deleted successfully",
      });

      await loadConfigs();
    } catch (error: any) {
      console.error('Error deleting SMTP config:', error);
      toast({
        title: "Error",
        description: `Failed to delete SMTP configuration: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const openTestDialog = (config: SMTPConfig) => {
    setConfigToTest(config);
    setTestDialogOpen(true);
  };

  const testConfig = async (testEmail: string) => {
    if (!configToTest) return;
    
    setTestingConfig(configToTest.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: { 
          configId: configToTest.id,
          testEmail: testEmail
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Test Email Sent",
          description: `Test email sent successfully to ${testEmail}`,
        });
      } else {
        throw new Error(data?.message || 'Test failed');
      }
    } catch (error: any) {
      console.error('Error testing SMTP config:', error);
      toast({
        title: "Test Failed",
        description: error.message || 'Failed to send test email',
        variant: "destructive",
      });
    } finally {
      setTestingConfig(null);
      setConfigToTest(null);
    }
  };

  const defaultConfig = configs.find(c => c.is_default);
  const activeConfigsCount = configs.filter(c => c.is_active).length;

  if (loading && configs.length === 0) {
    return (
      <PageContent title="Email Configuration">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent title="Email Configuration">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Email Configuration</h1>
              <p className="text-muted-foreground">
                Manage SMTP servers and email templates for your organization
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{configs.length}</p>
                  <p className="text-sm text-muted-foreground">SMTP Servers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeConfigsCount}</p>
                  <p className="text-sm text-muted-foreground">Active Servers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates.length}</p>
                  <p className="text-sm text-muted-foreground">Email Templates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{defaultConfig ? '1' : '0'}</p>
                  <p className="text-sm text-muted-foreground">Default Server</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SMTP Configurations Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                SMTP Server Configurations
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure outgoing mail servers for sending emails
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add SMTP Server
            </Button>
          </div>

          {configs.length === 0 && !isCreating ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Server className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No SMTP Servers Configured</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Add your first SMTP server to enable email sending from the platform. 
                  You can configure multiple servers and set one as default.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First SMTP Server
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => (
                <Card key={config.id} className={`transition-all hover:shadow-md ${config.is_default ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {config.name}
                          <div className="flex gap-1.5">
                            {config.is_default && (
                              <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                                Default
                              </Badge>
                            )}
                            {config.is_active ? (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-500 text-red-600">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Server className="h-3.5 w-3.5" />
                            {config.host}:{config.port}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {config.from_email}
                          </span>
                          {config.use_tls && (
                            <Badge variant="secondary" className="text-xs">TLS</Badge>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTestDialog(config)}
                          disabled={testingConfig === config.id || !config.is_active}
                        >
                          <TestTube className="h-4 w-4 mr-1" />
                          {testingConfig === config.id ? 'Testing...' : 'Test'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingConfig(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (config.is_default) {
                              const confirmDelete = window.confirm(
                                '⚠️ This is a default SMTP configuration. Deleting it may affect email templates using it.\n\nAre you sure you want to delete this default configuration?'
                              );
                              if (!confirmDelete) return;
                            }
                            deleteConfig(config.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {/* Create/Edit Form */}
          {(isCreating || editingConfig) && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingConfig ? (
                    <>
                      <Edit className="h-5 w-5" />
                      Edit SMTP Configuration
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Add New SMTP Configuration
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Enter your SMTP server details below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SMTPConfigForm
                  config={editingConfig || createNewConfig()}
                  onSave={saveConfig}
                  onCancel={() => {
                    setEditingConfig(null);
                    setIsCreating(false);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Email Templates Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Email Templates
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage email templates for automated communications
              </p>
            </div>
            <Button onClick={() => navigate('/email-templates')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Manage All Templates
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Email Templates</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create email templates for automated notifications, welcome emails, 
                  password resets, and more.
                </p>
                <Button onClick={() => navigate('/email-templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">{template.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {template.is_active ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-400 text-gray-500">
                            Inactive
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate('/email-templates')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {templates.length >= 5 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/email-templates')}
                >
                  View All Templates
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Test Email Dialog */}
        <TestEmailDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          onConfirm={testConfig}
          configName={configToTest?.name || ''}
          defaultEmail={userProfile?.email || ''}
        />
      </div>
    </PageContent>
  );
}

interface SMTPConfigFormProps {
  config: SMTPConfig;
  onSave: (config: SMTPConfig) => void;
  onCancel: () => void;
}

function SMTPConfigForm({ config, onSave, onCancel }: SMTPConfigFormProps) {
  const [formData, setFormData] = useState<SMTPConfig>(config);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Server Details */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Server Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Hostinger SMTP"
              required
            />
          </div>
          <div>
            <Label htmlFor="host">SMTP Host</Label>
            <Input
              id="host"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              placeholder="e.g., smtp.hostinger.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
              placeholder="587"
              required
            />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="use_tls"
                checked={formData.use_tls}
                onCheckedChange={(checked) => setFormData({ ...formData, use_tls: checked })}
              />
              <Label htmlFor="use_tls">Use TLS</Label>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Authentication */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Authentication
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="your-email@domain.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Your app password"
              required
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Sender Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Sender Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="from_email">From Email</Label>
            <Input
              id="from_email"
              type="email"
              value={formData.from_email}
              onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
              placeholder="contact@topsqill.tech"
              required
            />
          </div>
          <div>
            <Label htmlFor="from_name">From Name</Label>
            <Input
              id="from_name"
              value={formData.from_name}
              onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
              placeholder="TopSqill ITSM"
              required
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Options
        </h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
            />
            <Label htmlFor="is_default">Set as Default Server</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {config.id ? 'Update Configuration' : 'Create Configuration'}
        </Button>
      </div>
    </form>
  );
}
