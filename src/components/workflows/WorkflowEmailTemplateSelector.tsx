import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates';
import { Loader2, Mail } from 'lucide-react';

interface WorkflowEmailTemplateSelectorProps {
  projectId?: string;
  value?: string;
  onValueChange: (templateId: string, templateName: string, templateSubject: string) => void;
}

export function WorkflowEmailTemplateSelector({ projectId, value, onValueChange }: WorkflowEmailTemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { getTemplatesForProject } = useEmailTemplates(projectId);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getTemplatesForProject(projectId);
        setTemplates(data || []);
      } catch (error) {
        console.error('Error loading email templates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [projectId]);

  const selectedTemplate = templates.find(t => t.id === value);

  return (
    <div className="space-y-2">
      <Label>Email Template *</Label>
      <Select 
        value={value || ''} 
        onValueChange={(templateId) => {
          const template = templates.find(t => t.id === templateId);
          if (template) {
            onValueChange(templateId, template.name, template.subject);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading templates..." : "Select email template"}>
            {selectedTemplate && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{selectedTemplate.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <div className="flex items-center justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : templates.length > 0 ? (
            templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{template.name}</span>
                  {template.description && (
                    <span className="text-xs text-muted-foreground">{template.description}</span>
                  )}
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No email templates found. Create templates in Settings → Email Templates.
            </div>
          )}
        </SelectContent>
      </Select>
      {selectedTemplate && (
        <p className="text-xs text-muted-foreground">
          Subject: {selectedTemplate.subject}
        </p>
      )}
    </div>
  );
}
