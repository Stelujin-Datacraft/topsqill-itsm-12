import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Mail, Server, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';

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

export default function EmailConfigPage() {
  const { userProfile } = useAuth();
  const [configs, setConfigs] = useState<SMTPConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMTPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);

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

  useEffect(() => {
    loadConfigs();
  }, [userProfile?.organization_id]);

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

  const testConfig = async (config: SMTPConfig) => {
    setTestingConfig(config.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp-config', {
        body: { 
          configId: config.id,
          testEmail: userProfile?.email 
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent",
        description: "Check your inbox for the test email",
      });
    } catch (error: any) {
      console.error('Error testing SMTP config:', error);
      toast({
        title: "Test Failed",
        description: `Failed to send test email: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTestingConfig(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Email Configuration">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Email Configuration"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <h2 className="text-xl font-semibold">SMTP Configurations</h2>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add SMTP Config
          </Button>
        </div>

        {/* Existing Configurations */}
        <div className="grid gap-4">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {config.name}
                      {config.is_default && (
                        <Badge variant="default">Default</Badge>
                      )}
                      {!config.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {config.host}:{config.port} • {config.from_email}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConfig(config)}
                      disabled={testingConfig === config.id}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      {testingConfig === config.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingConfig(config)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteConfig(config.id)}
                      disabled={config.is_default}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Create/Edit Form */}
        {(isCreating || editingConfig) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingConfig ? 'Edit SMTP Configuration' : 'Create SMTP Configuration'}
              </CardTitle>
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
    </DashboardLayout>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Configuration Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Gmail SMTP"
            required
          />
        </div>
        <div>
          <Label htmlFor="host">SMTP Host</Label>
          <Input
            id="host"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            placeholder="e.g., smtp.gmail.com"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="from_email">From Email</Label>
          <Input
            id="from_email"
            type="email"
            value={formData.from_email}
            onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
            placeholder="noreply@yourdomain.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="from_name">From Name</Label>
          <Input
            id="from_name"
            value={formData.from_name}
            onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
            placeholder="Your Company Name"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.use_tls}
              onCheckedChange={(checked) => setFormData({ ...formData, use_tls: checked })}
            />
            <Label>Use TLS</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
            />
            <Label>Set as Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label>Active</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Configuration
        </Button>
      </div>
    </form>
  );
}
