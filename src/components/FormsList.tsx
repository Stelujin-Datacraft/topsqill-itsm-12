import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormsData } from '@/hooks/useFormsData';
import { useProject } from '@/contexts/ProjectContext';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Eye, Edit, Trash2, Share, Settings, Calendar, User, Grid, List, Columns, Lock, Globe, Database } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingScreen } from '@/components/LoadingScreen';
import NoProjectSelected from '@/components/NoProjectSelected';
export function FormsList() {
  const navigate = useNavigate();
  const {
    forms,
    loading,
    deleteForm
  } = useFormsData();
  const {
    currentProject
  } = useProject();
  const {
    getButtonState,
    checkPermissionWithAlert,
    hasPermission,
    getVisibleResources
  } = useUnifiedAccessControl();
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
    navigate(`/form-builder/${formId}?tab=access`);
  };
  const handleFormShare = (formId: string) => {
    navigate(`/form-builder/${formId}?tab=share`);
  };
  const handleFormSettings = (formId: string) => {
    if (!checkPermissionWithAlert('forms', 'update', formId)) {
      return;
    }
    navigate(`/form/${formId}/settings`);
  };
  const handleViewRecords = (formId: string) => {
    console.log('📊 Viewing form records:', formId);
    navigate(`/form-submissions?formId=${formId}`);
  };
  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'active':
        return {
          variant: 'default' as const,
          className: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400'
        };
      case 'draft':
        return {
          variant: 'secondary' as const,
          className: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400'
        };
      case 'completed':
        return {
          variant: 'default' as const,
          className: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-400'
        };
      case 'approved':
        return {
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white border-green-400'
        };
      case 'rejected':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600 text-white border-red-400'
        };
      case 'pending_review':
        return {
          variant: 'secondary' as const,
          className: 'bg-orange-500 hover:bg-orange-600 text-white border-orange-400'
        };
      case 'in_progress':
        return {
          variant: 'secondary' as const,
          className: 'bg-purple-500 hover:bg-purple-600 text-white border-purple-400'
        };
      case 'archived':
        return {
          variant: 'outline' as const,
          className: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-400'
        };
      default:
        return {
          variant: 'secondary' as const,
          className: 'bg-slate-500 hover:bg-slate-600 text-white border-slate-400'
        };
    }
  };
  if (visibleForms.length === 0) {
    return <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No forms available</h3>
              <p className="text-muted-foreground">
                {forms.length === 0 ? "No forms have been created yet." : "You don't have permission to view any forms in this project."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>;
  }
  const renderGridView = () => <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {visibleForms.map(form => {
      const editButtonState = getButtonState('forms', 'update', form.id);
      const deleteButtonState = getButtonState('forms', 'delete', form.id);
      const statusBadgeProps = getStatusBadgeProps(form.status);
      return <Card key={form.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <CardTitle className="text-lg text-primary">{form.name}</CardTitle>
                  {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
                  <div className="flex items-center gap-2">
                    <Badge {...statusBadgeProps}>
                      {form.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant={form.isPublic ? 'default' : 'secondary'} className={form.isPublic ? 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-400' : 'bg-slate-600 hover:bg-slate-700 text-white border-slate-500'}>
                      {form.isPublic ? <>Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                    </Badge>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => handleViewForm(form.id)} title="Preview Form" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleViewRecords(form.id)} title="View Records" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <Database className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => handleEditForm(form.id)} disabled={editButtonState.disabled} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Form"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="ghost" size="sm" onClick={() => handleFormAccess(form.id)} title="User Access" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                    <User className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleFormShare(form.id)} title="Share Form" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                    <Share className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteForm(form.id)} disabled={deleteButtonState.disabled} className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
                  <Calendar className="h-3 w-3 text-blue-500" />
                  <span>{format(new Date(form.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>;
    })}
    </div>;
  const renderListView = () => <div className="space-y-4">
      {visibleForms.map(form => {
      const editButtonState = getButtonState('forms', 'update', form.id);
      const deleteButtonState = getButtonState('forms', 'delete', form.id);
      const statusBadgeProps = getStatusBadgeProps(form.status);
      return <Card key={form.id} className="hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-primary">{form.name}</h3>
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 text-blue-500" />
                        <span>{format(new Date(form.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      <Badge {...statusBadgeProps}>
                        {form.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={form.isPublic ? 'default' : 'secondary'} className={form.isPublic ? 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-400' : 'bg-slate-600 hover:bg-slate-700 text-white border-slate-500'}>
                        {form.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => handleViewForm(form.id)} title="Preview Form" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleViewRecords(form.id)} title="View Records" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <Database className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => handleEditForm(form.id)} disabled={editButtonState.disabled} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                          <Edit className="h-4 w-4" />
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
                        <Button variant="ghost" size="sm" onClick={() => handleFormSettings(form.id)} disabled={editButtonState.disabled} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{editButtonState.disabled ? editButtonState.tooltip : "Form Settings"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>;
    })}
    </div>;
  const renderKanbanView = () => {
    const statusColumns = [{
      key: 'draft',
      label: 'Draft',
      bgColor: 'bg-amber-100 border-amber-200',
      headerColor: 'bg-amber-500 text-white',
      count: visibleForms.filter(f => f.status === 'draft').length
    }, {
      key: 'active',
      label: 'Active',
      bgColor: 'bg-emerald-100 border-emerald-200',
      headerColor: 'bg-emerald-500 text-white',
      count: visibleForms.filter(f => f.status === 'active').length
    }, {
      key: 'pending_review',
      label: 'Pending Review',
      bgColor: 'bg-orange-100 border-orange-200',
      headerColor: 'bg-orange-500 text-white',
      count: visibleForms.filter(f => f.status === 'pending_review').length
    }, {
      key: 'approved',
      label: 'Approved',
      bgColor: 'bg-green-100 border-green-200',
      headerColor: 'bg-green-500 text-white',
      count: visibleForms.filter(f => f.status === 'approved').length
    }, {
      key: 'completed',
      label: 'Completed',
      bgColor: 'bg-blue-100 border-blue-200',
      headerColor: 'bg-blue-500 text-white',
      count: visibleForms.filter(f => f.status === 'completed').length
    }, {
      key: 'rejected',
      label: 'Rejected',
      bgColor: 'bg-red-100 border-red-200',
      headerColor: 'bg-red-500 text-white',
      count: visibleForms.filter(f => f.status === 'rejected').length
    }, {
      key: 'in_progress',
      label: 'In Progress',
      bgColor: 'bg-purple-100 border-purple-200',
      headerColor: 'bg-purple-500 text-white',
      count: visibleForms.filter(f => f.status === 'in_progress').length
    }, {
      key: 'archived',
      label: 'Archived',
      bgColor: 'bg-gray-100 border-gray-200',
      headerColor: 'bg-gray-500 text-white',
      count: visibleForms.filter(f => f.status === 'archived').length
    }];
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statusColumns.map(status => <div key={status.key} className={`space-y-4 p-4 rounded-lg border-2 ${status.bgColor} min-h-[400px]`}>
            <div className={`font-bold text-center p-3 rounded-lg ${status.headerColor} shadow-sm`}>
              <div>{status.label}</div>
              <div className="text-sm opacity-90">({status.count})</div>
            </div>
            <div className="space-y-3">
              {visibleForms.filter(f => f.status === status.key).map(form => {
            const editButtonState = getButtonState('forms', 'update', form.id);
            const deleteButtonState = getButtonState('forms', 'delete', form.id);
            return <Card key={form.id} className="hover:shadow-md transition-all duration-200 hover:scale-[1.02] bg-white">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-primary line-clamp-2">{form.name}</h4>
                          <Badge variant={form.isPublic ? 'default' : 'secondary'} className={`ml-2 shrink-0 ${form.isPublic ? 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-400' : 'bg-slate-600 hover:bg-slate-700 text-white border-slate-500'}`}>
                            {form.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </Badge>
                        </div>
                        {form.description && <p className="text-sm text-muted-foreground line-clamp-2">{form.description}</p>}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-blue-500" />
                            <span>{format(new Date(form.createdAt), 'MMM d')}</span>
                          </div>
                        </div>
                        <div className="flex justify-between gap-1">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewForm(form.id)} className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleViewRecords(form.id)} className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                              <Database className="h-3 w-3" />
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditForm(form.id)} disabled={editButtonState.disabled} className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Form"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="sm" onClick={() => handleFormAccess(form.id)} className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                              <User className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleFormShare(form.id)} className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                              <Share className="h-3 w-3" />
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteForm(form.id)} disabled={deleteButtonState.disabled} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
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
                      </div>
                    </CardContent>
                  </Card>;
          })}
            </div>
          </div>)}
      </div>;
  };
  return <div className="space-y-6">
      {/* View Mode Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-blue-500 hover:bg-blue-600' : ''}>
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-blue-500 hover:bg-blue-600' : ''}>
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')} className={viewMode === 'kanban' ? 'bg-blue-500 hover:bg-blue-600' : ''}>
            <Columns className="h-4 w-4 mr-1" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Render based on view mode */}
      {viewMode === 'grid' && renderGridView()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'kanban' && renderKanbanView()}
    </div>;
}