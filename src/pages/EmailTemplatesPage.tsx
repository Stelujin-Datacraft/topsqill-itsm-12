import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, Mail, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  html_content: string;
  text_content?: string;
  template_variables: string[];
  custom_params: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'email' | 'number' | 'date' | 'user' | 'form_field';
  required: boolean;
}

export default function EmailTemplatesPage() {
  const { projectId } = useParams();
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    html_content: '',
    text_content: '',
    template_variables: [] as TemplateVariable[],
    custom_params: {},
    is_active: true
  });

  const [newVariable, setNewVariable] = useState<TemplateVariable>({
    name: '',
    description: '',
    type: 'text',
    required: false
  });

  useEffect(() => {
    if (projectId) {
      loadTemplates();
    }
  }, [projectId]);

  const loadTemplates = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(template => ({
        ...template,
        template_variables: Array.isArray(template.template_variables) 
          ? template.template_variables.map(v => String(v))
          : [],
        custom_params: typeof template.custom_params === 'object' && template.custom_params !== null
          ? template.custom_params as Record<string, any>
          : {}
      })));
    } catch (error) {
      console.error('Error loading email templates:', error);
      toast({
        title: "Error",
        description: "Failed to load email templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !userProfile?.id) return;

    try {
      const templateData = {
        ...formData,
        project_id: projectId,
        created_by: userProfile.id,
        template_variables: formData.template_variables.map(v => v.name)
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Email template updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert([templateData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Email template created successfully.",
        });
      }

      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Error saving email template:', error);
      toast({
        title: "Error",
        description: "Failed to save email template.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      subject: '',
      html_content: '',
      text_content: '',
      template_variables: [],
      custom_params: {},
      is_active: true
    });
    setEditingTemplate(null);
    setShowDialog(false);
  };

  const handleEdit = (template: EmailTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content || '',
      template_variables: template.template_variables.map(name => ({
        name,
        description: '',
        type: 'text',
        required: false
      })),
      custom_params: template.custom_params,
      is_active: template.is_active
    });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this email template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Email template deleted successfully.",
      });
      loadTemplates();
    } catch (error) {
      console.error('Error deleting email template:', error);
      toast({
        title: "Error",
        description: "Failed to delete email template.",
        variant: "destructive",
      });
    }
  };

  const addVariable = () => {
    if (newVariable.name) {
      setFormData(prev => ({
        ...prev,
        template_variables: [...prev.template_variables, { ...newVariable }]
      }));
      setNewVariable({
        name: '',
        description: '',
        type: 'text',
        required: false
      });
    }
  };

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      template_variables: prev.template_variables.filter((_, i) => i !== index)
    }));
  };

  const insertVariable = (variableName: string) => {
    const placeholder = `{{${variableName}}}`;
    setFormData(prev => ({
      ...prev,
      html_content: prev.html_content + placeholder
    }));
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
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Create and manage dynamic email templates for notifications
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{template.subject}</p>
                </div>
                <Badge variant={template.is_active ? "secondary" : "outline"}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
              
              <div className="text-sm">
                <p><strong>Variables:</strong> {template.template_variables.length}</p>
                <p><strong>Created:</strong> {new Date(template.created_at).toLocaleDateString()}</p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No email templates</h3>
            <p className="text-muted-foreground mb-4">
              Create your first email template to start sending dynamic notifications.
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Use {{variable_name}} for dynamic content"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Template Variables */}
            <div className="space-y-4">
              <Label>Template Variables</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input
                  placeholder="Variable name"
                  value={newVariable.name}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                />
                <select
                  className="px-3 py-2 border border-input rounded-md"
                  value={newVariable.type}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="user">User</option>
                  <option value="form_field">Form Field</option>
                </select>
                <Button type="button" onClick={addVariable}>Add</Button>
              </div>

              <div className="space-y-2">
                {formData.template_variables.map((variable, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{`{{${variable.name}}}`}</span>
                      <span className="text-sm text-muted-foreground ml-2">({variable.type})</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => insertVariable(variable.name)}
                      >
                        <Code className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeVariable(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Content */}
            <div>
              <Label>Email Content (HTML)</Label>
              <TiptapEditor
                content={formData.html_content}
                onChange={(content) => setFormData(prev => ({ ...prev, html_content: content }))}
                placeholder="Enter your email content here. Use {{variable_name}} for dynamic content."
              />
            </div>

            <div>
              <Label htmlFor="text_content">Text Content (Optional)</Label>
              <Textarea
                id="text_content"
                value={formData.text_content}
                onChange={(e) => setFormData(prev => ({ ...prev, text_content: e.target.value }))}
                rows={4}
                placeholder="Plain text version of your email"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Template is active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Subject:</Label>
                <p className="font-medium">{previewTemplate.subject}</p>
              </div>
              
              <div>
                <Label>Variables:</Label>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.template_variables.map((variable) => (
                    <Badge key={variable} variant="outline">{`{{${variable}}}`}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>HTML Content:</Label>
                <div 
                  className="border rounded p-4 max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setPreviewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}