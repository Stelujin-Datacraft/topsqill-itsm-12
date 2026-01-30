import { Building2 } from "lucide-react"
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
  const { currentOrganization } = useOrganization()
  const { state } = useSidebar()
  const navigate = useNavigate()
  const activeTeam = teams[0]
  const isCollapsed = state === 'collapsed'

  const handleClick = () => {
    navigate('/organizations')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={handleClick}
          tooltip={currentOrganization?.name || activeTeam.name}
          className="cursor-pointer hover:bg-sidebar-accent"
        >
          <div className={`flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden flex-shrink-0 ${
            currentOrganization?.logo_url 
              ? 'bg-background border border-border' 
              : 'bg-sidebar-primary text-sidebar-primary-foreground'
          }`}>
            {currentOrganization?.logo_url ? (
              <img 
                src={currentOrganization.logo_url} 
                alt={currentOrganization.name} 
                className="w-full h-full object-contain"
              />
            ) : (
              <activeTeam.logo className="size-4" />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{currentOrganization?.name || activeTeam.name}</span>
            <span className="truncate text-xs">{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
