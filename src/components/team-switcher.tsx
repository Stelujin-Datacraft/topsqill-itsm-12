import { useState } from "react"
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMyOrganizations } from "@/hooks/useMyOrganizations"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/hooks/use-toast"

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
  const navigate = useNavigate()
  const activeTeam = teams[0]
  const { organizations, loading, reload, switchOrganization } = useMyOrganizations()
  const { refreshProfile } = useAuth() as any
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) return
    setSwitching(orgId)
    try {
      await switchOrganization(orgId)
      toast({ title: "Organization switched", description: "Reloading your workspace…" })
      // Hard reload to refresh all org-scoped caches/contexts safely
      window.location.reload()
    } catch (e: any) {
      toast({ title: "Could not switch organization", description: e?.message || "Try again", variant: "destructive" })
    } finally {
      setSwitching(null)
    }
  }

  const hasMultiple = organizations.length > 1

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(o) => o && reload()}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={currentOrganization?.name || activeTeam.name}
              className="cursor-pointer hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
            >
              <div className={`flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden flex-shrink-0 ${
                currentOrganization?.logo_url
                  ? 'bg-background border border-border'
                  : 'bg-primary'
              }`} style={{ color: 'white' }}>
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
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your organizations
            </DropdownMenuLabel>
            {loading && organizations.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && organizations.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                You only belong to {currentOrganization?.name || "this organization"}.
              </div>
            )}
            {organizations.map((org) => {
              const isActive = org.organization_id === currentOrganization?.id
              return (
                <DropdownMenuItem
                  key={org.organization_id}
                  onClick={() => handleSwitch(org.organization_id)}
                  disabled={switching === org.organization_id}
                  className="gap-2"
                >
                  <div className="flex size-6 items-center justify-center rounded bg-muted overflow-hidden">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="size-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{org.name}</div>
                    <div className="truncate text-xs text-muted-foreground capitalize">{org.role}</div>
                  </div>
                  {isActive && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/organizations')} className="gap-2">
              <Plus className="size-4" />
              <span>Manage organizations</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
