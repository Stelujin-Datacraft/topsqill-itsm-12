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
import { Trash2, Plus, Mail, Eye, Code, FileText, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { EmailPreview } from '@/components/email/EmailPreview';
import { EmailTagInput } from '@/components/email/EmailTagInput';
import { EMAIL_TEMPLATES } from '@/data/emailTemplates';
import DashboardLayout from '@/components/DashboardLayout';
import { AIContentGenerator } from '@/components/ai/AIContentGenerator';
import { AIEmailTemplateGenerator } from '@/components/email/AIEmailTemplateGenerator';

interface AttachmentConfig {
  type: 'static' | 'dynamic';
  name: string;
  url?: string; // For static attachments (storage URL)
  formId?: string; // For dynamic attachments from form file fields
  fieldId?: string;
  fieldLabel?: string;
}

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
  attachments?: AttachmentConfig[];
  is_active: boolean;
  project_id: string;
  custom_params?: {
    smtp_config_id?: string;
    fieldMappings?: Record<string, string>;
    [key: string]: any;
  };
}

interface RecipientConfig {
  type: 'static' | 'dynamic' | 'parameter';
  value: string;
  label?: string;
  formId?: string;
  fieldId?: string;
}

interface FormInfo {
  id: string;
  name: string;
}

interface FormFieldInfo {
  id: string;
  label: string;
  field_type: string;
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
  const [forms, setForms] = useState<FormInfo[]>([]);
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
      
      const processedTemplates = (data || []).map(template => {
        const customParams = template.custom_params as Record<string, any> || {};
        const defaultRecipients = { to: [], cc: [], bcc: [], permanent_recipients: [] };
        const rawRecipients = (typeof template.recipients === 'object' && template.recipients !== null && !Array.isArray(template.recipients))
          ? template.recipients as any
          : {};
        return {
          ...template,
          template_variables: Array.isArray(template.template_variables) 
            ? template.template_variables.map(v => String(v))
            : [],
          recipients: {
            ...defaultRecipients,
            ...rawRecipients,
            to: Array.isArray(rawRecipients.to) ? rawRecipients.to : [],
            cc: Array.isArray(rawRecipients.cc) ? rawRecipients.cc : [],
            bcc: Array.isArray(rawRecipients.bcc) ? rawRecipients.bcc : [],
            permanent_recipients: Array.isArray(rawRecipients.permanent_recipients) ? rawRecipients.permanent_recipients : []
          },
          attachments: customParams.attachments || [],
          custom_params: customParams
        };
      }) as EmailTemplate[];
      
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

  const loadForms = async () => {
    if (!currentProject?.id) return;

    try {
      const { data, error } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', currentProject.id)
        .order('name');

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error('Error loading forms:', error);
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
    loadForms();
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
        custom_params: {
          ...template.custom_params,
          attachments: template.attachments || [],
        } as any,
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
              forms={forms}
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
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <AIEmailTemplateGenerator onTemplateCreated={loadTemplates} />
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
                    <CardDescription className="space-y-1">
                      <div>{template.description || template.subject}</div>
                      {template.custom_params?.smtp_config_id && (
                        <div className="text-xs">
                          <strong>SMTP:</strong>{' '}
                          {smtpConfigs.find(c => c.id === template.custom_params?.smtp_config_id)?.name || 'Unknown'}{' '}
                          <span className="text-muted-foreground">
                            ({smtpConfigs.find(c => c.id === template.custom_params?.smtp_config_id)?.from_email})
                          </span>
                        </div>
                      )}
                      {!template.custom_params?.smtp_config_id && (
                        <div className="text-xs">
                          <strong>SMTP:</strong> <Badge variant="secondary" className="text-xs">Default</Badge>
                        </div>
                      )}
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
      </div>
    </DashboardLayout>
  );
}

interface EmailTemplateFormProps {
  template: EmailTemplate;
  users: any[];
  forms: FormInfo[];
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
  forms,
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
  const [formFields, setFormFields] = useState<Record<string, FormFieldInfo[]>>({});
  const [allFormFields, setAllFormFields] = useState<Record<string, FormFieldInfo[]>>({});
  const [selectedFormForVariables, setSelectedFormForVariables] = useState<string>('');

  // Load email-compatible fields for recipient selection (cached)
  const loadFormFields = async (formId: string) => {
    if (formFields[formId]) return; // Already loaded

    try {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .in('field_type', ['email', 'text', 'short_text', 'select', 'dropdown', 'radio', 'submission-access'])
        .order('field_order');

      if (error) throw error;
      setFormFields(prev => ({
        ...prev,
        [formId]: data || []
      }));
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  };

  // Load ALL fields from a form for body variable insertion
  const loadAllFormFields = async (formId: string) => {
    if (allFormFields[formId]) return; // Already loaded

    try {
      const { data, error } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formId)
        .order('field_order');

      if (error) throw error;
      setAllFormFields(prev => ({
        ...prev,
        [formId]: data || []
      }));
    } catch (error) {
      console.error('Error loading all form fields:', error);
    }
  };

  // Insert field variable into content using label for display
  const insertFieldVariable = (fieldId: string, fieldLabel: string) => {
    // Use field label for display in the template
    const variable = `{{${fieldLabel}}}`;
    const currentContent = contentMode === 'html' ? formData.html_content : (formData.text_content || '');
    const newContent = currentContent + variable;
    const updatedTemplate = onContentChange(formData, newContent, contentMode === 'html');
    
    // Store mapping of label to fieldId in custom_params for backend resolution
    const fieldMappings = formData.custom_params?.fieldMappings || {};
    fieldMappings[fieldLabel] = fieldId;
    
    setFormData({
      ...updatedTemplate,
      custom_params: {
        ...updatedTemplate.custom_params,
        fieldMappings
      }
    });
  };

  // Load form fields for existing parameter recipients when editing
  React.useEffect(() => {
    const loadExistingFormFields = async () => {
      const allFormIds = new Set<string>();
      
      (['to', 'cc', 'bcc'] as const).forEach(type => {
        formData.recipients[type]?.forEach(recipient => {
          if (recipient.type === 'parameter' && recipient.formId) {
            allFormIds.add(recipient.formId);
          }
        });
      });

      for (const formId of allFormIds) {
        await loadFormFields(formId);
      }
    };

    loadExistingFormFields();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addRecipient = (type: 'to' | 'cc' | 'bcc') => {
    setFormData({
      ...formData,
      recipients: {
        ...formData.recipients,
        [type]: [...formData.recipients[type], { type: 'static', value: '', label: '' }]
      }
    });
  };

  const updateRecipient = (
    recipientType: 'to' | 'cc' | 'bcc',
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

  const removeRecipient = (type: 'to' | 'cc' | 'bcc', index: number) => {
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
          <div className="flex gap-2">
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Welcome to {{company_name}}!"
              required
              className="flex-1"
            />
            <AIContentGenerator
              contentType="email_subject"
              onApply={(content) => setFormData({ ...formData, subject: content })}
              context={formData.name}
              buttonLabel="AI"
              buttonSize="sm"
            />
          </div>
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
          </TabsList>
          
          {(['to', 'cc', 'bcc'] as const).map((recipientType) => (
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
              
              {(formData.recipients[recipientType] || []).map((recipient, index) => (
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
                      selected={recipient.value ? recipient.value.split(',').filter(v => v.trim()) : []}
                      onChange={(values) => updateRecipient(recipientType, index, { value: values.join(',') })}
                      placeholder="Select multiple users..."
                      className="flex-1"
                    />
                  ) : recipient.type === 'parameter' ? (
                    <div className="flex flex-1 gap-2">
                      {/* Form Selector */}
                      <Select
                        value={recipient.formId || ''}
                        onValueChange={(formId) => {
                          updateRecipient(recipientType, index, { formId, fieldId: '', value: '' });
                          loadFormFields(formId);
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select form..." />
                        </SelectTrigger>
                        <SelectContent>
                          {forms.length > 0 ? (
                            forms.map((form) => (
                              <SelectItem key={form.id} value={form.id}>
                                {form.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                              No forms available
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Field Selector */}
                      <Select
                        value={recipient.fieldId || ''}
                        onValueChange={(fieldId) => {
                          const field = formFields[recipient.formId || '']?.find(f => f.id === fieldId);
                          updateRecipient(recipientType, index, { 
                            fieldId, 
                            value: fieldId,
                            label: field?.label || ''
                          });
                        }}
                        disabled={!recipient.formId}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={recipient.formId ? "Select field..." : "Select form first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {recipient.formId && formFields[recipient.formId]?.length > 0 ? (
                            formFields[recipient.formId].map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label} ({field.field_type})
                              </SelectItem>
                            ))
                          ) : recipient.formId ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                              No email/text fields found
                            </div>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <EmailTagInput
                      value={recipient.value}
                      onChange={(value) => updateRecipient(recipientType, index, { value })}
                      placeholder="Type email and press Enter"
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

      {/* Attachments Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Attachments</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = async (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (!files || files.length === 0) return;
                  
                  const newAttachments: AttachmentConfig[] = [];
                  let successCount = 0;
                  let failCount = 0;
                  
                  for (const file of Array.from(files)) {
                    try {
                      const fileName = `${Date.now()}-${file.name}`;
                      const { data, error } = await supabase.storage
                        .from('email-attachments')
                        .upload(fileName, file);
                      
                      if (error) throw error;
                      
                      const { data: urlData } = supabase.storage
                        .from('email-attachments')
                        .getPublicUrl(fileName);
                      
                      newAttachments.push({ type: 'static', name: file.name, url: urlData.publicUrl });
                      successCount++;
                    } catch (error: any) {
                      console.error(`Failed to upload ${file.name}:`, error);
                      failCount++;
                    }
                  }
                  
                  if (newAttachments.length > 0) {
                    setFormData({
                      ...formData,
                      attachments: [...(formData.attachments || []), ...newAttachments]
                    });
                  }
                  
                  if (successCount > 0) {
                    toast({ 
                      title: 'Files uploaded', 
                      description: `${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
                    });
                  } else if (failCount > 0) {
                    toast({ title: 'Upload failed', description: 'All file uploads failed', variant: 'destructive' });
                  }
                };
                input.click();
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Upload Files
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({
                ...formData,
                attachments: [
                  ...(formData.attachments || []),
                  { type: 'dynamic', name: '', formId: '', fieldId: '' }
                ]
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              From Form Field
            </Button>
          </div>
        </div>
        
        {(formData.attachments || []).length > 0 && (
          <div className="space-y-2">
            {formData.attachments?.map((attachment, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                {attachment.type === 'static' ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Badge variant="secondary">Static</Badge>
                    <span className="text-sm truncate">{attachment.name}</span>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <Badge variant="outline">Dynamic</Badge>
                    <Select
                      value={attachment.formId || ''}
                      onValueChange={(formId) => {
                        const newAttachments = [...(formData.attachments || [])];
                        newAttachments[index] = { ...attachment, formId, fieldId: '' };
                        setFormData({ ...formData, attachments: newAttachments });
                        loadAllFormFields(formId);
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select form..." />
                      </SelectTrigger>
                      <SelectContent>
                        {forms.map((form) => (
                          <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={attachment.fieldId || ''}
                      onValueChange={(fieldId) => {
                        const field = allFormFields[attachment.formId || '']?.find(f => f.id === fieldId);
                        const newAttachments = [...(formData.attachments || [])];
                        newAttachments[index] = { 
                          ...attachment, 
                          fieldId, 
                          fieldLabel: field?.label,
                          name: field?.label || 'File attachment'
                        };
                        setFormData({ ...formData, attachments: newAttachments });
                      }}
                      disabled={!attachment.formId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select file field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {attachment.formId && (allFormFields[attachment.formId] || [])
                          .filter(f => f.field_type === 'file')
                          .map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newAttachments = (formData.attachments || []).filter((_, i) => i !== index);
                    setFormData({ ...formData, attachments: newAttachments });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Upload static files or link to file fields from forms for dynamic attachments
        </p>
      </div>

      {/* Content Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Email Content</h3>
          <div className="flex items-center gap-2">
            <AIContentGenerator
              contentType="email_body"
              onApply={(content) => {
                const updatedTemplate = onContentChange(formData, content, contentMode === 'html');
                setFormData(updatedTemplate);
              }}
              context={`Template: ${formData.name}. Subject: ${formData.subject}`}
              buttonLabel="AI Draft"
              buttonSize="sm"
              outputFormat={contentMode}
            />
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
            
            {/* Insert Form Field Variables */}
            <div className="space-y-2">
              <Label>Insert Form Field Variable</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedFormForVariables}
                  onValueChange={(formId) => {
                    setSelectedFormForVariables(formId);
                    loadAllFormFields(formId);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select form..." />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value=""
                  onValueChange={(fieldId) => {
                    const field = allFormFields[selectedFormForVariables]?.find(f => f.id === fieldId);
                    if (field) {
                      insertFieldVariable(field.id, field.label);
                    }
                  }}
                  disabled={!selectedFormForVariables || !allFormFields[selectedFormForVariables]?.length}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={selectedFormForVariables ? "Select field to insert..." : "Select form first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFormForVariables && allFormFields[selectedFormForVariables]?.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label} ({field.field_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Select a form and field to insert as a variable in the content</p>
            </div>

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



      {/* SMTP Configuration */}
      <div className="space-y-2">
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
          <SelectTrigger id="smtp_config">
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
