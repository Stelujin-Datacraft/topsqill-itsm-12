import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/types/form';
import { FormSubmissionsDialog } from '@/components/FormSubmissionsDialog';
import { useFormSubmissionAccess } from '@/hooks/useFormSubmissionAccess';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { 
  Eye, 
  Edit, 
  Settings, 
  FileText, 
  Calendar,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Archive,
  Trash2,
  Database
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EnhancedFormCardProps {
  form: Form;
  onEdit: (form: Form) => void;
  onConfigure: (form: Form) => void;
  onView: (form: Form) => void;
  onDelete?: (form: Form) => void;
  submissionCount?: number;
  layout?: 'grid' | 'list' | 'kanban';
}

export function EnhancedFormCard({ 
  form, 
  onEdit, 
  onConfigure, 
  onView, 
  onDelete,
  submissionCount = 0,
  layout = 'grid'
}: EnhancedFormCardProps) {
  const { canViewSubmissions } = useFormSubmissionAccess(form.id);
  
  // Check permissions for different actions
  const { hasPermission: canView } = usePermissionCheck('form', form.id, 'view');
  const { hasPermission: canEdit } = usePermissionCheck('form', form.id, 'edit');
  const { hasPermission: canDelete } = usePermissionCheck('form', form.id, 'delete');
  const { hasPermission: canManageAccess } = usePermissionCheck('form', form.id, 'manage_access');
  const { hasPermission: canViewData } = usePermissionCheck('form', form.id, 'view_submissions');

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active': 
        return { 
          color: 'bg-green-100 text-green-800 border-green-200', 
          icon: CheckCircle, 
          iconColor: 'text-green-600' 
        };
      case 'draft': 
        return { 
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
          icon: Clock, 
          iconColor: 'text-yellow-600' 
        };
      case 'completed': 
        return { 
          color: 'bg-blue-100 text-blue-800 border-blue-200', 
          icon: CheckCircle, 
          iconColor: 'text-blue-600' 
        };
      case 'approved': 
        return { 
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
          icon: CheckCircle, 
          iconColor: 'text-emerald-600' 
        };
      case 'rejected': 
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          icon: XCircle, 
          iconColor: 'text-red-600' 
        };
      case 'pending_review': 
        return { 
          color: 'bg-orange-100 text-orange-800 border-orange-200', 
          icon: AlertCircle, 
          iconColor: 'text-orange-600' 
        };
      case 'in_progress': 
        return { 
          color: 'bg-purple-100 text-purple-800 border-purple-200', 
          icon: Clock, 
          iconColor: 'text-purple-600' 
        };
      case 'archived': 
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: Archive, 
          iconColor: 'text-gray-600' 
        };
      default: 
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: Clock, 
          iconColor: 'text-gray-600' 
        };
    }
  };

  const statusConfig = getStatusConfig(form.status);
  const StatusIcon = statusConfig.icon;

  if (layout === 'list') {
    return (
      <Card className="w-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-6">
            {/* Form Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-gray-900 truncate mb-2">
                    {form.name}
                  </h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {form.description}
                    </p>
                  )}
                </div>
                <Badge className={`${statusConfig.color} border shrink-0`}>
                  <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig.iconColor}`} />
                  <span className="text-xs font-medium capitalize">{form.status.replace('_', ' ')}</span>
                </Badge>
              </div>
              
              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>{form.fields?.length || 0} fields</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>{submissionCount} submissions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Updated {new Date(form.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canView && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onView(form)}
                  title="View Form"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              
              {canEdit && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onEdit(form)}
                  title="Edit Form"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              
              {canManageAccess && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onConfigure(form)}
                  title="Configure Form"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              {canViewData && (
                <FormSubmissionsDialog initialFormId={form.id}>
                  <Button 
                    size="sm" 
                    variant="outline"
                    title="View Records"
                  >
                    <Database className="h-4 w-4" />
                  </Button>
                </FormSubmissionsDialog>
              )}

              {canDelete && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      title="Delete Form"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the form "{form.name}" and all its associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onDelete(form)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (layout === 'kanban') {
    return (
      <Card className="w-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
              {form.name}
            </CardTitle>
            <Badge className={`${statusConfig.color} border shrink-0`}>
              <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig.iconColor}`} />
              <span className="text-xs font-medium capitalize">{form.status.replace('_', ' ')}</span>
            </Badge>
          </div>
          {form.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {form.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Form Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">{form.fields?.length || 0} fields</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">{submissionCount} submissions</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>Updated {new Date(form.updatedAt).toLocaleDateString()}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-wrap pt-2">
              {canView && (
                <Button size="sm" variant="outline" onClick={() => onView(form)} className="text-xs px-2 py-1 h-7">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => onEdit(form)} className="text-xs px-2 py-1 h-7">
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {canManageAccess && (
                <Button size="sm" variant="outline" onClick={() => onConfigure(form)} className="text-xs px-2 py-1 h-7">
                  <Settings className="h-3 w-3 mr-1" />
                  Config
                </Button>
              )}
              
              {canViewData && (
                <FormSubmissionsDialog initialFormId={form.id}>
                  <Button size="sm" variant="outline" className="text-xs px-2 py-1 h-7">
                    <Database className="h-3 w-3 mr-1" />
                    Records
                  </Button>
                </FormSubmissionsDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid layout
  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-gray-300 hover:-translate-y-1 h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-lg font-semibold leading-tight flex-1">
            {form.name}
          </CardTitle>
          <Badge className={`${statusConfig.color} border shrink-0`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig.iconColor}`} />
            <span className="text-xs font-medium capitalize">{form.status.replace('_', ' ')}</span>
          </Badge>
        </div>
        {form.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {form.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Form Stats */}
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{form.fields?.length || 0} fields</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span>{submissionCount} submissions</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Updated {new Date(form.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {canView && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onView(form)}
                title="View Form"
                className="flex-1 max-w-[60px]"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            {canEdit && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onEdit(form)}
                title="Edit Form"
                className="flex-1 max-w-[60px]"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            {canManageAccess && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onConfigure(form)}
                title="Configure Form"
                className="flex-1 max-w-[60px]"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            
            {canViewData && (
              <FormSubmissionsDialog initialFormId={form.id}>
                <Button 
                  size="sm" 
                  variant="outline"
                  title="View Records"
                  className="flex-1 max-w-[60px]"
                >
                  <Database className="h-4 w-4" />
                </Button>
              </FormSubmissionsDialog>
            )}
            
            {canDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 max-w-[60px] text-red-600 hover:text-red-700 hover:border-red-300"
                    title="Delete Form"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the form "{form.name}" and all its associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDelete(form)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
