import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormsData } from '@/hooks/useFormsData';
import { useProject } from '@/contexts/ProjectContext';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Eye, Edit, Trash2, Share, Settings, Calendar, User, Grid, List, Columns } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingScreen } from '@/components/LoadingScreen';
import NoProjectSelected from '@/components/NoProjectSelected';

export function FormsList() {
  const navigate = useNavigate();
  const { forms, loading, deleteForm } = useFormsData();
  const { currentProject } = useProject();
  const { getButtonState, checkPermissionWithAlert, hasPermission, getVisibleResources } = useUnifiedAccessControl();
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('list');

  console.log('📋 FormsList - Current project:', currentProject?.id);
  console.log('📋 FormsList - Forms data:', forms);
  console.log('📋 FormsList - Loading state:', loading);

  if (!currentProject) {
    return <NoProjectSelected />;
  }

  if (loading) {
    return <LoadingScreen message="Loading forms..." />;
  }

  // Filter forms based on user's permissions
  const visibleForms = getVisibleResources('forms', forms);
  
  console.log('📋 FormsList - Visible forms:', visibleForms.length, 'out of', forms.length);

  const handleViewForm = (formId: string) => {
    console.log('👁️ Viewing form:', formId);
    navigate(`/form/${formId}`);
  };

  const handleEditForm = (formId: string) => {
    if (!checkPermissionWithAlert('forms', 'update', formId)) {
      return;
    }
    console.log('✏️ Editing form:', formId);
    navigate(`/form-builder/${formId}`);
  };

  const handleDeleteForm = async (formId: string) => {
    if (!checkPermissionWithAlert('forms', 'delete', formId)) {
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this form?')) {
      try {
        await deleteForm(formId);
        console.log('🗑️ Form deleted successfully');
      } catch (error) {
        console.error('❌ Error deleting form:', error);
      }
    }
  };

  const handleFormAccess = (formId: string) => {
    navigate(`/form/${formId}/access`);
  };

  const handleFormSettings = (formId: string) => {
    if (!checkPermissionWithAlert('forms', 'update', formId)) {
      return;
    }
    navigate(`/form/${formId}/settings`);
  };

  if (visibleForms.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No forms available</h3>
              <p className="text-muted-foreground">
                {forms.length === 0 
                  ? "No forms have been created yet."
                  : "You don't have permission to view any forms in this project."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderGridView = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {visibleForms.map((form) => {
        const editButtonState = getButtonState('forms', 'update', form.id);
        const deleteButtonState = getButtonState('forms', 'delete', form.id);
        
        return (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{form.name}</CardTitle>
                  {form.description && (
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                  )}
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewForm(form.id)}
                    title="Preview Form"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditForm(form.id)}
                          disabled={editButtonState.disabled}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Form"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormAccess(form.id)}
                    title="User Access"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFormSettings(form.id)}
                          disabled={editButtonState.disabled}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Form Settings"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteForm(form.id)}
                          disabled={deleteButtonState.disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Form"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(form.createdAt), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {form.status && (
                    <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>
                      {form.status}
                    </Badge>
                  )}
                  {form.isPublic && (
                    <Badge variant="outline">Public</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {visibleForms.map((form) => {
        const editButtonState = getButtonState('forms', 'update', form.id);
        const deleteButtonState = getButtonState('forms', 'delete', form.id);
        
        return (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{form.name}</h3>
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(form.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      {form.status && (
                        <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>
                          {form.status}
                        </Badge>
                      )}
                      {form.isPublic && (
                        <Badge variant="outline">Public</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewForm(form.id)}
                    title="Preview Form"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditForm(form.id)}
                          disabled={editButtonState.disabled}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Form"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormAccess(form.id)}
                    title="User Access"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFormSettings(form.id)}
                          disabled={editButtonState.disabled}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Form Settings"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/form/${form.id}/share`)}
                    title="Share Form"
                  >
                    <Share className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteForm(form.id)}
                          disabled={deleteButtonState.disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Form"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderKanbanView = () => {
    const statusColumns = [
      { key: 'draft', label: 'Draft', bgColor: 'bg-gray-100' },
      { key: 'active', label: 'Active', bgColor: 'bg-green-100' },
      { key: 'published', label: 'Published', bgColor: 'bg-blue-100' },
      { key: 'archived', label: 'Archived', bgColor: 'bg-red-100' },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statusColumns.map((status) => (
          <div key={status.key} className="space-y-4">
            <h3 className={`font-semibold text-center p-2 ${status.bgColor} rounded`}>
              {status.label}
            </h3>
            {visibleForms.filter(f => f.status === status.key).map((form) => {
              const editButtonState = getButtonState('forms', 'update', form.id);
              const deleteButtonState = getButtonState('forms', 'delete', form.id);
              
              return (
                <Card key={form.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h4 className="font-semibold">{form.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(form.createdAt), 'MMM d')}
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewForm(form.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditForm(form.id)}
                                disabled={editButtonState.disabled}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Form"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteForm(form.id)}
                                disabled={deleteButtonState.disabled}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Form"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Mode Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <Columns className="h-4 w-4 mr-1" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Render based on view mode */}
      {viewMode === 'grid' && renderGridView()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'kanban' && renderKanbanView()}
    </div>
  );
}