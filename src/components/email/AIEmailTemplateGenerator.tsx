import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, CheckCircle, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

interface AIEmailTemplateGeneratorProps {
  onTemplateCreated?: () => void;
}

interface GeneratedTemplate {
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  templateVariables: string[];
  recipients?: {
    to: Array<{ type: string; value: string; label?: string }>;
  };
}

interface FormOption {
  id: string;
  name: string;
  fields: Array<{ id: string; label: string; type: string }>;
}

export function AIEmailTemplateGenerator({ onTemplateCreated }: AIEmailTemplateGeneratorProps) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal' | 'casual'>('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [loadingForms, setLoadingForms] = useState(false);

  // Fetch forms when dialog opens
  useEffect(() => {
    if (isOpen && currentProject?.id) {
      fetchForms();
    }
  }, [isOpen, currentProject?.id]);

  const fetchForms = async () => {
    if (!currentProject?.id) return;
    setLoadingForms(true);
    try {
      const { data: formsData, error } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', currentProject.id)
        .order('name');

      if (error) throw error;

      // Fetch fields for each form
      const formsWithFields: FormOption[] = [];
      for (const form of formsData || []) {
        const { data: fieldsData } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', form.id)
          .order('order_index');

        formsWithFields.push({
          id: form.id,
          name: form.name,
          fields: (fieldsData || []).map(f => ({ id: f.id, label: f.label, type: f.field_type }))
        });
      }
      setForms(formsWithFields);
    } catch (err) {
      console.error('Error fetching forms:', err);
    } finally {
      setLoadingForms(false);
    }
  };

  const selectedForm = forms.find(f => f.id === selectedFormId);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the email template you want to create');
      return;
    }

    setIsGenerating(true);
    try {
      // Build context with form fields if a form is selected
      // Use EXACT field labels (not normalized) to match manual insertion format
      let formContext = '';
      if (selectedForm) {
        const fieldList = selectedForm.fields.map(f => `{{${f.label}}} (${f.type})`).join(', ');
        formContext = `\n\nATTACHED FORM: "${selectedForm.name}" with these available dynamic fields: ${fieldList}. IMPORTANT: Use these EXACT field placeholder names (including spaces and capitalization) in the template content where appropriate. For example, use {{First Name}} not {{first_name}}.`;
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate-email-template',
          context: {
            userInput: prompt + formContext,
            tone,
            attachedForm: selectedForm ? {
              id: selectedForm.id,
              name: selectedForm.name,
              fields: selectedForm.fields
            } : undefined
          }
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate template');
      }

      setGeneratedTemplate(data.result);
      toast.success('Email template generated!');
    } catch (err) {
      console.error('Error generating template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate template');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTemplate || !currentProject?.id || !userProfile?.id) {
      toast.error('Missing required data to save template');
      return;
    }

    setIsSaving(true);
    try {
      // Build fieldMappings from template variables and selected form fields
      // Map exact field labels to field IDs (same format as manual insertion)
      const fieldMappings: Record<string, string> = {};
      if (selectedForm && generatedTemplate.templateVariables) {
        generatedTemplate.templateVariables.forEach(variable => {
          // Find matching field by exact label match first, then try case-insensitive
          const matchingField = selectedForm.fields.find(f => f.label === variable) ||
            selectedForm.fields.find(f => f.label.toLowerCase() === variable.toLowerCase()) ||
            selectedForm.fields.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === variable.toLowerCase().replace(/\s+/g, '_'));
          if (matchingField) {
            fieldMappings[variable] = matchingField.id;
          }
        });
      }

      const templateData = {
        name: generatedTemplate.name,
        description: generatedTemplate.description,
        subject: generatedTemplate.subject,
        html_content: generatedTemplate.htmlContent,
        text_content: '',
        template_variables: generatedTemplate.templateVariables,
        recipients: generatedTemplate.recipients || {
          to: [],
          cc: [],
          bcc: [],
          permanent_recipients: []
        },
        is_active: true,
        project_id: currentProject.id,
        created_by: userProfile.id,
        custom_params: selectedFormId ? {
          attached_form_id: selectedFormId,
          attached_form_name: selectedForm?.name,
          fieldMappings
        } : {}
      };

      const { error } = await supabase
        .from('email_templates')
        .insert([templateData]);

      if (error) throw error;

      toast.success('Email template created successfully!');
      setIsOpen(false);
      resetForm();
      onTemplateCreated?.();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAndSave = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the email template you want to create');
      return;
    }

    setIsGenerating(true);
    try {
      // Use EXACT field labels (not normalized) to match manual insertion format
      let formContext = '';
      if (selectedForm) {
        const fieldList = selectedForm.fields.map(f => `{{${f.label}}} (${f.type})`).join(', ');
        formContext = `\n\nATTACHED FORM: "${selectedForm.name}" with these available dynamic fields: ${fieldList}. IMPORTANT: Use these EXACT field placeholder names (including spaces and capitalization) in the template content where appropriate. For example, use {{First Name}} not {{first_name}}.`;
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate-email-template',
          context: {
            userInput: prompt + formContext,
            tone,
            attachedForm: selectedForm ? {
              id: selectedForm.id,
              name: selectedForm.name,
              fields: selectedForm.fields
            } : undefined
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate template');

      // Directly save without preview
      if (!currentProject?.id || !userProfile?.id) {
        throw new Error('Missing project or user context');
      }

      const result = data.result;
      
      // Build fieldMappings from template variables and selected form fields
      // Map exact field labels to field IDs (same format as manual insertion)
      const fieldMappings: Record<string, string> = {};
      if (selectedForm && result.templateVariables) {
        result.templateVariables.forEach((variable: string) => {
          // Find matching field by exact label match first, then try case-insensitive
          const matchingField = selectedForm.fields.find(f => f.label === variable) ||
            selectedForm.fields.find(f => f.label.toLowerCase() === variable.toLowerCase()) ||
            selectedForm.fields.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === variable.toLowerCase().replace(/\s+/g, '_'));
          if (matchingField) {
            fieldMappings[variable] = matchingField.id;
          }
        });
      }

      const templateData = {
        name: result.name,
        description: result.description,
        subject: result.subject,
        html_content: result.htmlContent,
        text_content: '',
        template_variables: result.templateVariables,
        recipients: result.recipients || { to: [], cc: [], bcc: [], permanent_recipients: [] },
        is_active: true,
        project_id: currentProject.id,
        created_by: userProfile.id,
        custom_params: selectedFormId ? {
          attached_form_id: selectedFormId,
          attached_form_name: selectedForm?.name,
          fieldMappings
        } : {}
      };

      const { error: saveError } = await supabase
        .from('email_templates')
        .insert([templateData]);

      if (saveError) throw saveError;

      toast.success('Email template created successfully!');
      setIsOpen(false);
      resetForm();
      onTemplateCreated?.();
    } catch (err) {
      console.error('Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setPrompt('');
    setGeneratedTemplate(null);
    setTone('professional');
    setSelectedFormId('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Email Template Generator
          </DialogTitle>
          <DialogDescription>
            Describe your email template and optionally attach a form to use its dynamic fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Left: Input */}
            <div className="space-y-4 overflow-y-auto pr-2">
              {/* Form Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Attach Form (Optional)
                </Label>
              <Select value={selectedFormId || "_none"} onValueChange={(v) => setSelectedFormId(v === "_none" ? "" : v)} disabled={loadingForms}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingForms ? "Loading forms..." : "Select a form to use its fields"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No form attached</SelectItem>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name} ({form.fields.length} fields)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedForm && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">Available fields:</span>
                    {selectedForm.fields.slice(0, 5).map((f) => (
                      <Badge key={f.id} variant="secondary" className="text-xs">
                        {`{{${f.label.toLowerCase().replace(/\s+/g, '_')}}}`}
                      </Badge>
                    ))}
                    {selectedForm.fields.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedForm.fields.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Describe your email template</Label>
                <Textarea
                  placeholder="Example: Create a welcome email template for new users. Include their name, a warm greeting, quick start tips, and a call-to-action button. Add placeholders for user_name, company_name, and login_url."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
                <p className="font-medium">💡 Tips for better results:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Specify the template name you want</li>
                  <li>Describe the purpose and audience</li>
                  <li>Attach a form to automatically use its fields</li>
                  <li>Mention recipient emails if static</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Preview First
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGenerateAndSave}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Create Directly
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="flex flex-col min-h-0 overflow-hidden border rounded-lg">
              {generatedTemplate ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Template Generated!</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {generatedTemplate.name}</p>
                      <p><span className="text-muted-foreground">Subject:</span> {generatedTemplate.subject}</p>
                    </div>
                    {generatedTemplate.templateVariables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {generatedTemplate.templateVariables.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <ScrollArea className="flex-1 p-4">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: generatedTemplate.htmlContent }}
                    />
                  </ScrollArea>

                  <div className="flex gap-2 p-4 border-t bg-muted/20 flex-shrink-0">
                    <Button 
                      variant="outline" 
                      onClick={handleGenerate} 
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      Regenerate
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Save Template
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Preview will appear here</p>
                    <p className="text-sm mt-1">Or use "Create Directly" to skip preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}