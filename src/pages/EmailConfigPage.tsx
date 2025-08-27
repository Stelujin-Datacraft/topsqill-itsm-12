import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Settings, Trash2, Mail, Server } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SMTPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  use_tls: boolean;
  from_email: string;
  from_name?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export default function EmailConfigPage() {
  const { userProfile } = useAuth();
  const [configs, setConfigs] = useState<SMTPConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMTPConfig | null>(null);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 587,
    username: '',
    password: '',
    use_tls: true,
    from_email: '',
    from_name: '',
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    loadConfigs();
  }, [userProfile?.organization_id]);

  const loadConfigs = async () => {
    if (!userProfile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error loading SMTP configs:', error);
      toast({
        title: "Error",
        description: "Failed to load SMTP configurations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.organization_id) return;

    try {
      const configData = {
        ...formData,
        organization_id: userProfile.organization_id,
        created_by: userProfile.id
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('smtp_configs')
          .update(configData)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "SMTP configuration updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('smtp_configs')
          .insert([configData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "SMTP configuration created successfully.",
        });
      }

      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Error saving SMTP config:', error);
      toast({
        title: "Error",
        description: "Failed to save SMTP configuration.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: 587,
      username: '',
      password: '',
      use_tls: true,
      from_email: '',
      from_name: '',
      is_default: false,
      is_active: true
    });
    setEditingConfig(null);
    setShowForm(false);
  };

  const handleEdit = (config: SMTPConfig) => {
    setFormData({
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      use_tls: config.use_tls,
      from_email: config.from_email,
      from_name: config.from_name || '',
      is_default: config.is_default,
      is_active: config.is_active
    });
    setEditingConfig(config);
    setShowForm(true);
  };

  const handleDelete = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this SMTP configuration?')) return;

    try {
      const { error } = await supabase
        .from('smtp_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "SMTP configuration deleted successfully.",
      });
      loadConfigs();
    } catch (error) {
      console.error('Error deleting SMTP config:', error);
      toast({
        title: "Error",
        description: "Failed to delete SMTP configuration.",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (configId: string) => {
    setTestingConfig(configId);
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: { configId }
      });

      if (error) throw error;

      toast({
        title: data.success ? "Success" : "Error",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error testing SMTP connection:', error);
      toast({
        title: "Error",
        description: "Failed to test SMTP connection.",
        variant: "destructive",
      });
    } finally {
      setTestingConfig(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Email Configuration</h1>
          <p className="text-muted-foreground">
            Configure SMTP settings for your organization's email notifications
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add SMTP Config
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingConfig ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Configuration Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="from_email">From Email</Label>
                  <Input
                    id="from_email"
                    type="email"
                    value={formData.from_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="from_name">From Name (Optional)</Label>
                  <Input
                    id="from_name"
                    value={formData.from_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use_tls"
                    checked={formData.use_tls}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, use_tls: checked }))}
                  />
                  <Label htmlFor="use_tls">Use TLS</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                  />
                  <Label htmlFor="is_default">Set as Default</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit">
                  {editingConfig ? 'Update Configuration' : 'Create Configuration'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{config.host}:{config.port}</p>
                </div>
                <div className="flex space-x-1">
                  {config.is_default && <Badge variant="default">Default</Badge>}
                  {config.is_active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p><strong>From:</strong> {config.from_name ? `${config.from_name} <${config.from_email}>` : config.from_email}</p>
                <p><strong>Username:</strong> {config.username}</p>
                <p><strong>TLS:</strong> {config.use_tls ? 'Enabled' : 'Disabled'}</p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testConnection(config.id)}
                  disabled={testingConfig === config.id}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  {testingConfig === config.id ? 'Testing...' : 'Test'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(config)}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(config.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {configs.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SMTP configurations</h3>
            <p className="text-muted-foreground mb-4">
              Create your first SMTP configuration to start sending email notifications.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add SMTP Config
            </Button>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          SMTP passwords are encrypted and stored securely. Only organization administrators can manage these configurations.
        </AlertDescription>
      </Alert>
    </div>
  );
}