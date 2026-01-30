import { useState } from "react"
import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNavigate } from "react-router-dom"
import { OrganizationDialog } from "@/components/OrganizationDialog"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { isMobile } = useSidebar()
  const { organizations, currentOrganization, setCurrentOrganization, loadOrganizations } = useOrganization()
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const activeTeam = teams[0]

  const handleOrganizationSwitch = (organization: any) => {
    setCurrentOrganization(organization)
  }

  const handleManageOrganizations = () => {
    navigate('/organizations')
  }

  const handleCreateOrganization = async (data: {
    name: string;
    description: string;
    domain: string;
    admin_email: string;
    logo_url?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          description: data.description,
          domain: data.domain,
          admin_email: data.admin_email,
          logo_url: data.logo_url,
          status: 'active'
        })

      if (error) throw error

      toast({
        title: "Organization created",
        description: "The organization has been successfully created.",
      })
      
      setIsCreateDialogOpen(false)
      loadOrganizations()
    } catch (error: any) {
      console.error('Error creating organization:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create organization.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                  {currentOrganization?.logo_url ? (
                    <img 
                      src={currentOrganization.logo_url} 
                      alt={currentOrganization.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <activeTeam.logo className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{currentOrganization?.name || activeTeam.name}</span>
                  <span className="truncate text-xs">{activeTeam.plan}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              
              {/* Current Organization */}
              {currentOrganization && (
                <DropdownMenuItem className="gap-2 p-2 bg-muted/50">
                  <div className="flex size-6 items-center justify-center rounded-sm border bg-primary text-primary-foreground overflow-hidden">
                    {currentOrganization.logo_url ? (
                      <img 
                        src={currentOrganization.logo_url} 
                        alt={currentOrganization.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="size-4 shrink-0" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{currentOrganization.name}</div>
                    <div className="text-xs text-muted-foreground">Current</div>
                  </div>
                  <Check className="size-4 text-primary" />
                </DropdownMenuItem>
              )}

              {/* Other Organizations */}
              {organizations
                .filter(org => org.id !== currentOrganization?.id)
                .map((organization, index) => (
                  <DropdownMenuItem 
                    key={organization.id} 
                    className="gap-2 p-2 cursor-pointer"
                    onClick={() => handleOrganizationSwitch(organization)}
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                      {organization.logo_url ? (
                        <img 
                          src={organization.logo_url} 
                          alt={organization.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="size-4 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{organization.name}</div>
                      <div className="text-xs text-muted-foreground">{organization.description || 'No description'}</div>
                    </div>
                    <DropdownMenuShortcut>⌘{index + 2}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}

              <DropdownMenuSeparator />
              
              {/* Manage Organizations */}
              <DropdownMenuItem 
                className="gap-2 p-2 cursor-pointer"
                onClick={handleManageOrganizations}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Building2 className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Manage Organizations</div>
              </DropdownMenuItem>

              {/* Add Organization */}
              <DropdownMenuItem 
                className="gap-2 p-2 cursor-pointer"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Add Organization</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <OrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateOrganization}
      />
    </>
  )
}
