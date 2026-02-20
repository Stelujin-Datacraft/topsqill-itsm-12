import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Building2, Edit, Globe, Mail, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OrganizationDialog } from '@/components/OrganizationDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const Organizations = () => {
  const { currentOrganization, loadOrganizations } = useOrganization();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleSubmit = async (data: {
    name: string;
    description: string;
    domain: string;
    admin_email: string;
    logo_url?: string;
  }) => {
    if (!currentOrganization) return;

    try {
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
        .eq('id', currentOrganization.id);

      if (error) throw error;

      toast({
        title: "Organization updated",
        description: "Your organization settings have been saved.",
      });
      setIsEditOpen(false);
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

  if (!currentOrganization) {
    return (
      <DashboardLayout title="Organization Settings" description="Manage your organization details">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You are not currently associated with any organization. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const actions = (
    <Button onClick={() => setIsEditOpen(true)}>
      <Edit className="h-4 w-4 mr-2" />
      Edit Settings
    </Button>
  );

  return (
    <DashboardLayout 
      title="Organization Settings" 
      description="Manage your organization details and branding"
      actions={actions}
    >
      <div className="space-y-6">
        {/* Organization Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              {/* Organization Logo */}
              <div className="w-20 h-20 rounded-xl border-2 border-border bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {currentOrganization.logo_url ? (
                  <img 
                    src={currentOrganization.logo_url} 
                    alt={currentOrganization.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{currentOrganization.name}</CardTitle>
                  <Badge variant="default">{currentOrganization.status}</Badge>
                </div>
                <CardDescription className="text-base">
                  {currentOrganization.description || 'No description provided'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Domain */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Domain</p>
                  <p className="text-sm">{currentOrganization.domain}</p>
                </div>
              </div>

              {/* Admin Email */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Admin Email</p>
                  <p className="text-sm">{currentOrganization.admin_email}</p>
                </div>
              </div>

              {/* Created Date */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {currentOrganization.created_at 
                      ? format(new Date(currentOrganization.created_at), 'MMM d, yyyy')
                      : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Organization Dialog */}
      <OrganizationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editingOrg={currentOrganization}
        onSubmit={handleSubmit}
      />
    </DashboardLayout>
  );
};

export default Organizations;
