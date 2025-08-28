import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Trash2, Settings } from 'lucide-react';
import { useEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface EmailTemplateConfig {
  templateId?: string;
  recipients: {
    type: 'static' | 'form_field' | 'form_creator' | 'custom';
    value: string;
  }[];
  templateData: {
    key: string;
    type: 'static' | 'form_field';
    value: string;
  }[];
}

interface EmailTemplateSelectorProps {
  value?: EmailTemplateConfig;
  onChange: (config: EmailTemplateConfig) => void;
  formFields: Array<{ id: string; label: string; type: string }>;
}

export function EmailTemplateSelector({ value, onChange, formFields }: EmailTemplateSelectorProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { getTemplatesForProject } = useEmailTemplates();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const config = value || {
    recipients: [],
    templateData: []
  };

  useEffect(() => {
    if (projectId) {
      loadTemplates();
    }
  }, [projectId]);

  useEffect(() => {
    if (config.templateId) {
      const template = templates.find(t => t.id === config.templateId);
      setSelectedTemplate(template || null);
      if (template && config.templateData.length === 0) {
        // Initialize template data with available variables
        const initialData = template.template_variables.map(variable => ({
          key: variable,
          type: 'static' as const,
          value: ''
        }));
        onChange({
          ...config,
          templateData: initialData
        });
      }
    }
  }, [config.templateId, templates]);

  const loadTemplates = async () => {
    try {
      const data = await getTemplatesForProject(projectId!);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const addRecipient = () => {
    onChange({
      ...config,
      recipients: [...config.recipients, { type: 'static', value: '' }]
    });
  };

  const updateRecipient = (index: number, updates: Partial<typeof config.recipients[0]>) => {
    const newRecipients = [...config.recipients];
    newRecipients[index] = { ...newRecipients[index], ...updates };
    onChange({
      ...config,
      recipients: newRecipients
    });
  };

  const removeRecipient = (index: number) => {
    onChange({
      ...config,
      recipients: config.recipients.filter((_, i) => i !== index)
    });
  };

  const updateTemplateData = (index: number, updates: Partial<typeof config.templateData[0]>) => {
    const newData = [...config.templateData];
    newData[index] = { ...newData[index], ...updates };
    onChange({
      ...config,
      templateData: newData
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label>Email Template</Label>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to navigate to the email templates page where you can create a new template.
              </p>
              <Button 
                onClick={() => {
                  navigate(`/email-templates/${projectId}`);
                }}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Go to Email Templates
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Select
        value={config.templateId || ''}
        onValueChange={(templateId) => {
          onChange({ ...config, templateId });
          setShowConfig(!!templateId);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an email template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center justify-between w-full">
                <span>{template.name}</span>
                <Badge variant="outline" className="ml-2">
                  {template.template_variables.length} vars
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTemplate && showConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Email Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipients Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Recipients</Label>
                <Button size="sm" variant="outline" onClick={addRecipient}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Recipient
                </Button>
              </div>
              
              {config.recipients.map((recipient, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <Select
                    value={recipient.type}
                    onValueChange={(type) => updateRecipient(index, { type: type as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static Email</SelectItem>
                      <SelectItem value="form_field">Form Field</SelectItem>
                      <SelectItem value="form_creator">Form Creator</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {recipient.type === 'form_field' ? (
                    <Select
                      value={recipient.value}
                      onValueChange={(value) => updateRecipient(index, { value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {formFields
                          .filter(field => field.type === 'email' || field.type === 'text')
                          .map(field => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={
                        recipient.type === 'static' ? 'Enter email address' :
                        recipient.type === 'custom' ? 'Enter custom value' :
                        'Form creator email will be used'
                      }
                      value={recipient.value}
                      onChange={(e) => updateRecipient(index, { value: e.target.value })}
                      disabled={recipient.type === 'form_creator'}
                      className="flex-1"
                    />
                  )}
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeRecipient(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Template Variables Configuration */}
            {selectedTemplate.template_variables.length > 0 && (
              <div>
                <Label className="text-sm">Template Variables</Label>
                <div className="space-y-2 mt-2">
                  {config.templateData.map((data, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline" className="min-w-fit">
                        {data.key}
                      </Badge>
                      
                      <Select
                        value={data.type}
                        onValueChange={(type) => updateTemplateData(index, { type: type as any })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">Static Value</SelectItem>
                          <SelectItem value="form_field">Form Field</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {data.type === 'form_field' ? (
                        <Select
                          value={data.value}
                          onValueChange={(value) => updateTemplateData(index, { value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {formFields.map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="Enter static value"
                          value={data.value}
                          onChange={(e) => updateTemplateData(index, { value: e.target.value })}
                          className="flex-1"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}