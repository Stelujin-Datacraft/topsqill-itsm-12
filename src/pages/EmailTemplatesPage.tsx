import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Mail, Eye, Code, FileText, X, ArrowLeft, Edit, LayoutTemplate } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { EmailPreview } from '@/components/email/EmailPreview';
import { EMAIL_TEMPLATES } from '@/data/emailTemplates';
import DashboardLayout from '@/components/DashboardLayout';

interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  html_content: string;
  text_content?: string;
  template_variables: string[];
  recipients: {
    to: RecipientConfig[];
    cc: RecipientConfig[];
    bcc: RecipientConfig[];
    permanent_recipients: RecipientConfig[];
  };
  is_active: boolean;
  project_id: string;
  custom_params?: {
    smtp_config_id?: string;
    [key: string]: any;
  };
}

interface RecipientConfig {
  type: 'static' | 'dynamic' | 'parameter';
  value: string;
  label?: string;
}

interface SMTPConfig {
  id: string;
  name: string;
  from_email: string;
  is_default: boolean;
  is_active: boolean;
}

export default function EmailTemplatesPage() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentMode, setContentMode] = useState<'html' | 'text'>('html');
  const [showPreview, setShowPreview] = useState(false);

  const loadTemplates = async () => {
    if (!currentProject?.id) return;

    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedTemplates = (data || []).map(template => ({
        ...template,
        template_variables: Array.isArray(template.template_variables) 
          ? template.template_variables.map(v => String(v))
          : [],
        recipients: (typeof template.recipients === 'object' && template.recipients !== null && !Array.isArray(template.recipients))
          ? template.recipients as any
          : {
              to: [],
              cc: [],
              bcc: [],
              permanent_recipients: []
            }
      })) as EmailTemplate[];
      
      setTemplates(processedTemplates);
    } catch (error) {
      console.error('Error loading email templates:', error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!userProfile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .eq('organization_id', userProfile.organization_id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadSMTPConfigs = async () => {
    if (!userProfile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('smtp_configs')
        .select('id, name, from_email, is_default, is_active')
        .eq('organization_id', userProfile.organization_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSmtpConfigs(data || []);
    } catch (error) {
      console.error('Error loading SMTP configs:', error);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadUsers();
    loadSMTPConfigs();
  }, [currentProject?.id, userProfile?.organization_id]);

  const createNewTemplate = (): EmailTemplate => ({
    id: '',
    name: '',
    description: '',
    subject: '',
    html_content: '',
    text_content: '',
    template_variables: [],
    recipients: {
      to: [],
      cc: [],
      bcc: [],
      permanent_recipients: []
    },
    is_active: true,
    project_id: currentProject?.id || '',
  });

  const saveTemplate = async (template: EmailTemplate) => {
    if (!currentProject?.id || !userProfile?.id) return;

    try {
      setLoading(true);
      
      const templateData = {
        name: template.name,
        description: template.description,
        subject: template.subject,
        html_content: template.html_content,
        text_content: template.text_content,
        template_variables: template.template_variables as any,
        recipients: template.recipients as any,
        custom_params: template.custom_params || {},
        is_active: template.is_active,
        project_id: currentProject.id,
        created_by: userProfile.id,
      };

      if (template.id) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert([templateData]);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Email template ${template.id ? 'updated' : 'created'} successfully`,
      });

      await loadTemplates();
      setEditingTemplate(null);
      setIsCreating(false);
    } catch (error: any) {
      console.error('Error saving email template:', error);
      toast({
        title: "Error",
        description: `Failed to save email template: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email template deleted successfully",
      });

      await loadTemplates();
    } catch (error: any) {
      console.error('Error deleting email template:', error);
      toast({
        title: "Error",
        description: `Failed to delete email template: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const extractVariables = (content: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  };

  const handleContentChange = (template: EmailTemplate, content: string, isHtml: boolean) => {
    const variables = extractVariables(content);
    const updatedTemplate = {
      ...template,
      ...(isHtml ? { html_content: content } : { text_content: content }),
      template_variables: variables
    };
    
    if (editingTemplate) {
      setEditingTemplate(updatedTemplate);
    }
    
    return updatedTemplate;
  };

  if (loading) {
    return (
      <DashboardLayout title="Email Templates">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  // If creating or editing, show the form inline
  if (isCreating || editingTemplate) {
    const handleCancel = () => {
      setEditingTemplate(null);
      setIsCreating(false);
      setShowPreview(false);
    };

    return (
      <DashboardLayout title={editingTemplate ? 'Edit Email Template' : 'Create Email Template'}>
        <Card className="border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {editingTemplate ? 'Edit Email Template' : 'Create New Email Template'}
              </CardTitle>
              <CardDescription>
                {editingTemplate ? 'Update the template details below' : 'Fill in the details to create a new email template'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <EmailTemplateForm
              template={editingTemplate || createNewTemplate()}
              users={users}
              smtpConfigs={smtpConfigs}
              onSave={saveTemplate}
              onCancel={handleCancel}
              contentMode={contentMode}
              onContentModeChange={setContentMode}
              showPreview={showPreview}
              onShowPreviewChange={setShowPreview}
              onContentChange={handleContentChange}
            />
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Email Templates">
      <div className="space-y-6 max-w-6xl">
        {/* Page Header Card */}
        <Card className="border">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <LayoutTemplate className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Email Templates</CardTitle>
                  <CardDescription>
                    Manage your email templates for automated communications
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => setIsCreating(true)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Stats Row */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-muted-foreground">Active:</span>
                <span className="font-medium">{templates.filter(t => t.is_active).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span className="text-muted-foreground">Inactive:</span>
                <span className="font-medium">{templates.filter(t => !t.is_active).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">{templates.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        {templates.length === 0 ? (
          <Card className="border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No templates yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first email template to get started with automated emails
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="border hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${template.is_active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                        <Mail className={`h-5 w-5 ${template.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          {template.name}
                          {!template.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {template.description || template.subject}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Preview: {template.name}</DialogTitle>
                          </DialogHeader>
                          <EmailPreview
                            subject={template.subject}
                            htmlContent={template.html_content}
                            textContent={template.text_content}
                            templateVariables={template.template_variables.map(v => ({ name: v, value: `[${v}]` }))}
                            isHtmlMode={true}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {/* SMTP Config */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">SMTP:</span>
                      {template.custom_params?.smtp_config_id ? (
                        <span className="font-medium">
                          {smtpConfigs.find(c => c.id === template.custom_params?.smtp_config_id)?.name || 'Unknown'}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    
                    {/* Variables */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Variables:</span>
                      <Badge variant="outline" className="text-xs">
                        {template.template_variables.length}
                      </Badge>
                    </div>

                    {/* Variable Tags */}
                    {template.template_variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {template.template_variables.slice(0, 3).map((variable) => (
                          <Badge key={variable} variant="outline" className="text-xs font-mono">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                        {template.template_variables.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.template_variables.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface EmailTemplateFormProps {
  template: EmailTemplate;
  users: any[];
  smtpConfigs: SMTPConfig[];
  onSave: (template: EmailTemplate) => void;
  onCancel: () => void;
  contentMode: 'html' | 'text';
  onContentModeChange: (mode: 'html' | 'text') => void;
  showPreview: boolean;
  onShowPreviewChange: (show: boolean) => void;
  onContentChange: (template: EmailTemplate, content: string, isHtml: boolean) => EmailTemplate;
}

function EmailTemplateForm({ 
  template, 
  users,
  smtpConfigs, 
  onSave, 
  onCancel, 
  contentMode,
  onContentModeChange,
  showPreview,
  onShowPreviewChange,
  onContentChange
}: EmailTemplateFormProps) {
  const [formData, setFormData] = useState<EmailTemplate>(template);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addRecipient = (type: 'to' | 'cc' | 'bcc' | 'permanent_recipients') => {
    setFormData({
      ...formData,
      recipients: {
        ...formData.recipients,
        [type]: [...formData.recipients[type], { type: 'static', value: '', label: '' }]
      }
    });
  };

  const updateRecipient = (
    recipientType: 'to' | 'cc' | 'bcc' | 'permanent_recipients',
    index: number,
    updates: Partial<RecipientConfig>
  ) => {
    const recipients = [...formData.recipients[recipientType]];
    recipients[index] = { ...recipients[index], ...updates };
    setFormData({
      ...formData,
      recipients: {
        ...formData.recipients,
        [recipientType]: recipients
      }
    });
  };

  const removeRecipient = (type: 'to' | 'cc' | 'bcc' | 'permanent_recipients', index: number) => {
    setFormData({
      ...formData,
      recipients: {
        ...formData.recipients,
        [type]: formData.recipients[type].filter((_, i) => i !== index)
      }
    });
  };

  const insertPredefinedTemplate = (templateHtml: string) => {
    const updatedTemplate = onContentChange(formData, templateHtml, true);
    setFormData(updatedTemplate);
  };

  const userOptions = users.map(user => ({
    value: user.email,
    label: `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim()
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <FileText className="h-4 w-4" />
          Basic Information
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Welcome email"
              required
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Welcome to {{company_name}}!"
              required
              className="bg-background"
            />
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Input
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this template's purpose"
          />
        </div>
      </div>

      {/* Recipients Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Mail className="h-4 w-4" />
          Recipients Configuration
        </div>
        
        <div className="p-4 bg-muted/30 rounded-lg border">
          <Tabs defaultValue="to" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="to">To</TabsTrigger>
              <TabsTrigger value="cc">CC</TabsTrigger>
              <TabsTrigger value="bcc">BCC</TabsTrigger>
              <TabsTrigger value="permanent_recipients">Permanent</TabsTrigger>
            </TabsList>
            
            {(['to', 'cc', 'bcc', 'permanent_recipients'] as const).map((recipientType) => (
              <TabsContent key={recipientType} value={recipientType} className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="capitalize font-medium">{recipientType.replace('_', ' ')} Recipients</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRecipient(recipientType)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Recipient
                  </Button>
                </div>
                
                {formData.recipients[recipientType].length === 0 && (
                  <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg bg-background">
                    No {recipientType.replace('_', ' ')} recipients configured
                  </div>
                )}
                
                {formData.recipients[recipientType].map((recipient, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                    <Select
                      value={recipient.type}
                      onValueChange={(value: 'static' | 'dynamic' | 'parameter') =>
                        updateRecipient(recipientType, index, { type: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static</SelectItem>
                        <SelectItem value="dynamic">Dynamic</SelectItem>
                        <SelectItem value="parameter">Parameter</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {recipient.type === 'dynamic' ? (
                      <MultiSelect
                        options={userOptions}
                        selected={recipient.value ? [recipient.value] : []}
                        onChange={(values) => updateRecipient(recipientType, index, { value: values[0] || '' })}
                        placeholder="Select users..."
                        className="flex-1"
                      />
                    ) : (
                      <Input
                        value={recipient.value}
                        onChange={(e) => updateRecipient(recipientType, index, { value: e.target.value })}
                        placeholder={
                          recipient.type === 'static' ? 'email@example.com' : '{{user_email}}'
                        }
                        className="flex-1"
                      />
                    )}
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeRecipient(recipientType, index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Code className="h-4 w-4" />
            Email Content
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <Switch
                checked={contentMode === 'html'}
                onCheckedChange={(checked) => onContentModeChange(checked ? 'html' : 'text')}
              />
              <Label className="text-sm font-medium">{contentMode === 'html' ? 'HTML' : 'Plain Text'}</Label>
            </div>
            <Button
              type="button"
              variant={showPreview ? "secondary" : "outline"}
              size="sm"
              onClick={() => onShowPreviewChange(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>
        </div>

        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="grid gap-4" style={{ gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
            <div className="space-y-4">
              {contentMode === 'html' && (
                <div className="space-y-2">
                  <Label>Start from a Template</Label>
                  <Select onValueChange={(value) => insertPredefinedTemplate(value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose a predefined template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_TEMPLATES.map((template, index) => (
                        <SelectItem key={index} value={template.htmlContent}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>{contentMode === 'html' ? 'HTML Content' : 'Text Content'}</Label>
                <Textarea
                  value={contentMode === 'html' ? formData.html_content : formData.text_content || ''}
                  onChange={(e) => {
                    const updatedTemplate = onContentChange(formData, e.target.value, contentMode === 'html');
                    setFormData(updatedTemplate);
                  }}
                  placeholder={
                    contentMode === 'html' ? 
                    'Enter HTML content with variables like {{name}}...' :
                    'Enter plain text content with variables like {{name}}...'
                  }
                  rows={15}
                  className="font-mono bg-background"
                />
              </div>
            </div>

            {showPreview && (
              <div className="space-y-2">
                <Label>Live Preview</Label>
                <div className="border rounded-lg p-4 bg-background min-h-[400px]">
                  <EmailPreview
                    subject={formData.subject}
                    htmlContent={formData.html_content}
                    textContent={formData.text_content}
                    templateVariables={formData.template_variables.map(v => ({ name: v, value: `[${v}]` }))}
                    isHtmlMode={contentMode === 'html'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Variables */}
      {formData.template_variables.length > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <Label className="text-green-800 dark:text-green-300">Detected Variables</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.template_variables.map((variable) => (
              <Badge key={variable} variant="outline" className="font-mono bg-background">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* SMTP Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Mail className="h-4 w-4" />
          SMTP Settings
        </div>
        
        <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
          <Label htmlFor="smtp_config">SMTP Configuration</Label>
          <Select
            value={formData.custom_params?.smtp_config_id || 'default'}
            onValueChange={(value) => setFormData({
              ...formData,
              custom_params: {
                ...formData.custom_params,
                smtp_config_id: value === 'default' ? undefined : value
              }
            })}
          >
            <SelectTrigger id="smtp_config" className="bg-background">
              <SelectValue placeholder="Select SMTP configuration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                  <span className="text-sm">Use default SMTP config</span>
                </div>
              </SelectItem>
              {smtpConfigs.map(config => (
                <SelectItem key={config.id} value={config.id}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.name}</span>
                      {config.is_default && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{config.from_email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose which SMTP configuration to use for sending emails from this template
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-3 px-3 py-1.5 bg-muted rounded-lg">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label className="font-medium">{formData.is_active ? 'Active' : 'Inactive'}</Label>
        </div>
        
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            <Mail className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </div>
      </div>
    </form>
  );
}
