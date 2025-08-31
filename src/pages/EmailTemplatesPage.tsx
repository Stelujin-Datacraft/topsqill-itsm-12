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
import { Trash2, Plus, Mail, Eye, Code, FileText } from 'lucide-react';
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
}

interface RecipientConfig {
  type: 'static' | 'dynamic' | 'parameter';
  value: string;
  label?: string;
}

export default function EmailTemplatesPage() {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
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

  useEffect(() => {
    loadTemplates();
    loadUsers();
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
        is_active: template.is_active,
        project_id: currentProject.id,
        created_by: userProfile.id,
        custom_params: {},
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

  return (
    <DashboardLayout 
      title="Email Templates"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Email Templates</h2>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Existing Templates */}
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {template.name}
                      {!template.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <Badge variant="outline">
                        {template.template_variables.length} variables
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {template.description || template.subject}
                    </CardDescription>
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
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {template.template_variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.template_variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="text-xs">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog 
          open={isCreating || !!editingTemplate} 
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              setEditingTemplate(null);
              setShowPreview(false);
            }
          }}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
              </DialogTitle>
            </DialogHeader>
            
            {(isCreating || editingTemplate) && (
              <EmailTemplateForm
                template={editingTemplate || createNewTemplate()}
                users={users}
                onSave={saveTemplate}
                onCancel={() => {
                  setEditingTemplate(null);
                  setIsCreating(false);
                  setShowPreview(false);
                }}
                contentMode={contentMode}
                onContentModeChange={setContentMode}
                showPreview={showPreview}
                onShowPreviewChange={setShowPreview}
                onContentChange={handleContentChange}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

interface EmailTemplateFormProps {
  template: EmailTemplate;
  users: any[];
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Welcome email"
            required
          />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Welcome to {{company_name}}!"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this template"
        />
      </div>

      {/* Recipients Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Recipients</h3>
        
        <Tabs defaultValue="to" className="w-full">
          <TabsList>
            <TabsTrigger value="to">To</TabsTrigger>
            <TabsTrigger value="cc">CC</TabsTrigger>
            <TabsTrigger value="bcc">BCC</TabsTrigger>
            <TabsTrigger value="permanent_recipients">Permanent</TabsTrigger>
          </TabsList>
          
          {(['to', 'cc', 'bcc', 'permanent_recipients'] as const).map((recipientType) => (
            <TabsContent key={recipientType} value={recipientType} className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="capitalize">{recipientType.replace('_', ' ')} Recipients</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRecipient(recipientType)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              
              {formData.recipients[recipientType].map((recipient, index) => (
                <div key={index} className="flex items-center gap-2">
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

      {/* Content Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Email Content</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={contentMode === 'html'}
                onCheckedChange={(checked) => onContentModeChange(checked ? 'html' : 'text')}
              />
              <Label>{contentMode === 'html' ? 'HTML' : 'Text'}</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onShowPreviewChange(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
          <div className="space-y-4">
            {contentMode === 'html' && (
              <div>
                <Label>Predefined Templates</Label>
                <Select onValueChange={(value) => insertPredefinedTemplate(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
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
            
            <div>
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
                className="font-mono"
              />
            </div>
          </div>

          {showPreview && (
            <div>
              <Label>Preview</Label>
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

      {/* Template Variables */}
      {formData.template_variables.length > 0 && (
        <div>
          <Label>Detected Variables</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.template_variables.map((variable) => (
              <Badge key={variable} variant="outline">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label>Active</Label>
        </div>
        
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            Save Template
          </Button>
        </div>
      </div>
    </form>
  );
}
