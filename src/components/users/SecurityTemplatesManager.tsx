import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  Key,
  Clock,
  Lock,
  Smartphone
} from 'lucide-react';
import { useSecurityTemplates, SecurityTemplate, SecurityTemplateInput } from '@/hooks/useSecurityTemplates';
import { SecurityTemplateFormDialog } from './SecurityTemplateFormDialog';

interface SecurityTemplatesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityTemplatesManager({ open, onOpenChange }: SecurityTemplatesManagerProps) {
  const { 
    templates, 
    loading, 
    saving, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    defaultTemplate 
  } = useSecurityTemplates();

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SecurityTemplate | undefined>();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SecurityTemplate | null>(null);

  const handleCreateNew = () => {
    setSelectedTemplate(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (template: SecurityTemplate) => {
    setSelectedTemplate(template);
    setFormDialogOpen(true);
  };

  const handleDelete = (template: SecurityTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete.id);
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleSave = async (data: SecurityTemplateInput): Promise<boolean> => {
    if (selectedTemplate) {
      return await updateTemplate(selectedTemplate.id, data);
    } else {
      const result = await createTemplate(data);
      return result !== null;
    }
  };

  const getTemplateStats = (template: SecurityTemplate) => {
    const stats = [];
    
    if (template.mfa_required) {
      stats.push({ icon: Smartphone, label: 'MFA Required', color: 'text-blue-600' });
    }
    
    if (template.password_min_length >= 12) {
      stats.push({ icon: Key, label: 'Strong Password', color: 'text-emerald-600' });
    }
    
    if (template.session_timeout_minutes <= 15) {
      stats.push({ icon: Clock, label: 'Short Session', color: 'text-amber-600' });
    }
    
    if (template.max_failed_login_attempts <= 2) {
      stats.push({ icon: Lock, label: 'Strict Lockout', color: 'text-red-600' });
    }
    
    return stats;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Security Templates</DialogTitle>
                  <DialogDescription>
                    Create and manage reusable security profiles
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button onClick={handleCreateNew} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>

              {/* Templates List */}
              {templates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground text-center">
                      No security templates yet.<br />
                      Create one to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.name}
                              {template.is_default && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </CardTitle>
                            {template.description && (
                              <CardDescription className="mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(template)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(template)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2">
                          {getTemplateStats(template).map((stat, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs flex items-center gap-1">
                              <stat.icon className={`h-3 w-3 ${stat.color}`} />
                              {stat.label}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-xs">
                            Password: {template.password_min_length}+ chars
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Session: {template.session_timeout_minutes}m
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Max Sessions: {template.max_concurrent_sessions}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <SecurityTemplateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        template={selectedTemplate}
        defaultValues={defaultTemplate}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Security Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? 
              Users assigned to this template will fall back to organization defaults.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
