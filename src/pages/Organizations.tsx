
import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Plus, Building2, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OrganizationDialog } from '@/components/OrganizationDialog';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/alert-dialog';

const Organizations = () => {
  const { organizations, currentOrganization, deleteOrganization, setCurrentOrganization, loadOrganizations } = useOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);

  const handleSubmit = async (data: {
    name: string;
    description: string;
    domain: string;
    admin_email: string;
    logo_url?: string;
  }) => {
    try {
      if (editingOrg) {
        const { error } = await supabase
          .from('organizations')
          .update({
            name: data.name,
            description: data.description,
            domain: data.domain,
            admin_email: data.admin_email,
            logo_url: data.logo_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingOrg.id);

        if (error) throw error;

        toast({
          title: "Organization updated",
          description: "The organization has been successfully updated.",
        });
        setEditingOrg(null);
      } else {
        const { error } = await supabase
          .from('organizations')
          .insert({
            name: data.name,
            description: data.description,
            domain: data.domain,
            admin_email: data.admin_email,
            logo_url: data.logo_url,
            status: 'active'
          });

        if (error) throw error;

        toast({
          title: "Organization created",
          description: "The organization has been successfully created.",
        });
        setIsCreateOpen(false);
      }
      
      loadOrganizations();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save organization.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (org: any) => {
    setEditingOrg(org);
  };

  const handleDelete = async (orgId: string) => {
    if (currentOrganization?.id === orgId) {
      toast({
        title: "Cannot delete",
        description: "You cannot delete the currently active organization.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      toast({
        title: "Organization deleted",
        description: "The organization has been successfully deleted.",
      });
      
      loadOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete organization.",
        variant: "destructive",
      });
    }
  };

  const actions = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Create Organization
    </Button>
  );

  return (
    <DashboardLayout title="Organizations" description="Manage your organizations and switch between workspaces" actions={actions}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
          <Card key={org.id} className={`hover:shadow-lg transition-shadow ${
            currentOrganization?.id === org.id ? 'ring-2 ring-primary' : ''
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Organization Logo */}
                  <div className="w-12 h-12 rounded-lg border bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {org.logo_url ? (
                      <img 
                        src={org.logo_url} 
                        alt={org.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {org.name}
                      {currentOrganization?.id === org.id && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {org.description || 'No description'}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>{org.domain}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {currentOrganization?.id !== org.id && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentOrganization(org)}
                    className="flex-1"
                  >
                    Switch To
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(org)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{org.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(org.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      </div>

      {/* Create Organization Dialog */}
      <OrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleSubmit}
      />

      {/* Edit Organization Dialog */}
      <OrganizationDialog
        open={!!editingOrg}
        onOpenChange={(open) => !open && setEditingOrg(null)}
        editingOrg={editingOrg}
        onSubmit={handleSubmit}
      />
    </DashboardLayout>
  );
};

export default Organizations;
