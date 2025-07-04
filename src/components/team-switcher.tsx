import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNavigate } from "react-router-dom"

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
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization()
  const navigate = useNavigate()
  const activeTeam = teams[0]

  const handleOrganizationSwitch = (organization: any) => {
    setCurrentOrganization(organization)
    // Optionally navigate to a different page or refresh data
  }

  const handleManageOrganizations = () => {
    navigate('/organizations')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeTeam.name}</span>
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
                <div className="flex size-6 items-center justify-center rounded-sm border bg-primary text-primary-foreground">
                  <Building2 className="size-4 shrink-0" />
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
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Building2 className="size-4 shrink-0" />
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
            <DropdownMenuItem className="gap-2 p-2 cursor-pointer">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add Organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
