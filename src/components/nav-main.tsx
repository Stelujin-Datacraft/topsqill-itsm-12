import { useCallback } from "react"
import { LucideIcon } from "lucide-react"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { prefetchRoute } from "@/utils/routePreloader"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    isDisabled?: boolean
  }[]
}) {
  const location = useLocation()

  const handleMouseEnter = useCallback((url: string) => {
    prefetchRoute(url);
  }, []);

  const handlePointerDown = useCallback((url: string) => {
    prefetchRoute(url);
  }, []);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active = location.pathname === item.url
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton 
                asChild 
                isActive={active}
                disabled={item.isDisabled}
                tooltip={item.title}
              >
                <Link 
                  to={item.url}
                  onMouseEnter={() => handleMouseEnter(item.url)}
                  onPointerDown={() => handlePointerDown(item.url)}
                  onFocus={() => handleMouseEnter(item.url)}
                >
                  {item.icon && <item.icon className={active ? 'text-accent' : 'text-sidebar-foreground'} />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
