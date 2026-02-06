import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, CheckCircle, Mail } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
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

export function AIEmailTemplateGenerator({ onTemplateCreated }: AIEmailTemplateGeneratorProps) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal' | 'casual'>('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the email template you want to create');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate-email-template',
          context: {
            userInput: prompt,
            tone,
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

  const resetForm = () => {
    setPrompt('');
    setGeneratedTemplate(null);
    setTone('professional');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Email Template Generator
          </DialogTitle>
          <DialogDescription>
            Describe the email template you want and AI will generate it with name, subject, and HTML content.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
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
                rows={8}
                className="resize-none"
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
              <p className="font-medium">💡 Tips for better results:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Specify the template name you want</li>
                <li>Describe the purpose and audience</li>
                <li>Mention any placeholders needed (e.g., user_name, order_id)</li>
                <li>Include any specific content requirements</li>
                <li>Mention recipient emails if static (e.g., "send to support@company.com")</li>
              </ul>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Template...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Template
                </>
              )}
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            {generatedTemplate ? (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Template Generated!</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <p className="font-medium">{generatedTemplate.name}</p>
                    </div>

                    {generatedTemplate.description && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <p className="text-sm text-muted-foreground">{generatedTemplate.description}</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">Subject</Label>
                      <p className="text-sm">{generatedTemplate.subject}</p>
                    </div>

                    {generatedTemplate.templateVariables.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Variables</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {generatedTemplate.templateVariables.map((v) => (
                            <span key={v} className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">HTML Preview</Label>
                      <ScrollArea className="h-48 border rounded-md mt-1">
                        <div 
                          className="p-3 text-sm"
                          dangerouslySetInnerHTML={{ __html: generatedTemplate.htmlContent }}
                        />
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
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
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-8">
                <div className="text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Your generated template will appear here</p>
                  <p className="text-sm mt-1">Describe what you need and click Generate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
