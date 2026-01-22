import { LucideIcon } from "lucide-react"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { usePrefetch, getPrefetchProps } from "@/hooks/usePrefetch"

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
  const { prefetch, cancelPrefetch } = usePrefetch()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton 
              asChild 
              isActive={location.pathname === item.url}
              disabled={item.isDisabled}
            >
              <Link 
                to={item.url}
                {...getPrefetchProps(prefetch, cancelPrefetch, item.url)}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
