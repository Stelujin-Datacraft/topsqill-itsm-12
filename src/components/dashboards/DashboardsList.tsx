import React, { useState } from 'react';
import { DashboardWithReports } from '@/types/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LayoutDashboard, Calendar, Eye, Edit, Trash2, FileText, Plus, Copy, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useDashboards } from '@/hooks/useDashboards';
import { CreateDashboardDialog } from './CreateDashboardDialog';
import { EditDashboardDialog } from './EditDashboardDialog';
import { SetDefaultDashboardDialog } from './SetDefaultDashboardDialog';

export interface DashboardsListProps {
  dashboards: DashboardWithReports[];
  onView: (dashboard: DashboardWithReports) => void;
  onDelete: (dashboardId: string) => void;
  onCreate: () => boolean;
}

export function DashboardsList({
  dashboards = [],
  onView,
  onDelete,
  onCreate
}: DashboardsListProps) {
  const [loading, setLoading] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<DashboardWithReports | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getButtonState, checkPermissionWithAlert } = useUnifiedAccessControl();
  const { deleteDashboard, setDefaultDashboard, refetchDashboards } = useDashboards();

  const handleCopyId = (dashboardId: string) => {
    navigator.clipboard.writeText(dashboardId);
    toast({
      title: "Copied",
      description: "Dashboard ID copied to clipboard",
    });
  };

  const handleEditClick = (dashboard: DashboardWithReports) => {
    if (!checkPermissionWithAlert('reports', 'update')) {
      return;
    }
    setEditingDashboard(dashboard);
  };

  const handleSetDefault = async (dashboard: DashboardWithReports) => {
    if (!checkPermissionWithAlert('reports', 'update')) return;
    try {
      setLoading(true);
      const newDefault = !(dashboard as any).is_default;
      await setDefaultDashboard(dashboard.id, newDefault);
    } catch (error) {
      console.error('Error setting default dashboard:', error);
      toast({ title: "Error", description: "Failed to update default dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (dashboard: DashboardWithReports) => {
    if (!checkPermissionWithAlert('reports', 'delete')) {
      return;
    }
    
    const reportCount = dashboard.reports?.length || 0;
    const confirmMessage = reportCount > 0 
      ? `Are you sure you want to delete "${dashboard.name}"? This will also delete ${reportCount} report(s) inside it.`
      : `Are you sure you want to delete "${dashboard.name}"?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        await deleteDashboard(dashboard.id);
        toast({
          title: "Success",
          description: "Dashboard deleted successfully"
        });
        onDelete(dashboard.id);
      } catch (error) {
        console.error('Error deleting dashboard:', error);
        toast({
          title: "Error",
          description: "Failed to delete dashboard",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const createButtonState = getButtonState('reports', 'create');

  const CreateDashboardButton = () => (
    <CreateDashboardDialog>
      <Button disabled={createButtonState.disabled}>
        <Plus className="h-4 w-4 mr-2" />
        Create Dashboard
      </Button>
    </CreateDashboardDialog>
  );

  const CreateFirstDashboardButton = () => (
    <CreateDashboardDialog>
      <Button disabled={createButtonState.disabled}>
        Create Your First Dashboard
      </Button>
    </CreateDashboardDialog>
  );

  return (
    <div className="space-y-6">

      {dashboards.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <LayoutDashboard className="h-12 w-12 text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">No dashboards yet</h3>
                <p className="text-muted-foreground">
                  Get started by creating your first dashboard to organize your reports.
                </p>
              </div>
              {createButtonState.disabled ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <CreateFirstDashboardButton />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{createButtonState.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <CreateFirstDashboardButton />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map(dashboard => {
            const editButtonState = getButtonState('reports', 'update');
            const deleteButtonState = getButtonState('reports', 'delete');
            const reportCount = dashboard.reports?.length || 0;
            const isDefault = (dashboard as any).is_default;
            
            return (
              <Card key={dashboard.id} className={`hover:shadow-md transition-shadow cursor-pointer ${isDefault ? 'ring-2 ring-primary' : ''}`} onClick={() => onView(dashboard)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                        {isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                      </div>
                      {dashboard.description && (
                        <CardDescription className="line-clamp-2">{dashboard.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleSetDefault(dashboard)} disabled={editButtonState.disabled || loading}>
                              <Star className={`h-4 w-4 ${isDefault ? 'fill-primary text-primary' : 'text-primary'}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isDefault ? 'Remove as Default' : 'Set as Default'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyId(dashboard.id)} title="Copy Dashboard ID">
                        <Copy className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onView(dashboard)} title="View Dashboard">
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(dashboard)} disabled={editButtonState.disabled}>
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Dashboard"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(dashboard)} disabled={deleteButtonState.disabled || loading}>
                              <Trash2 className="h-4 w-4 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Dashboard"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <FileText className="h-3 w-3 text-primary" />
                        <span>{reportCount} report{reportCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-primary" />
                        <span>{format(new Date(dashboard.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    {dashboard.is_public && <Badge variant="secondary">Public</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dashboard Dialog */}
      <EditDashboardDialog
        dashboard={editingDashboard}
        isOpen={!!editingDashboard}
        onClose={() => setEditingDashboard(null)}
        onSuccess={() => refetchDashboards()}
      />
    </div>
  );
}
