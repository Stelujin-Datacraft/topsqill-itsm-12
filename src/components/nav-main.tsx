import { Lock, LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AppIcon } from "@/components/icons"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    isDisabled?: boolean
    iconColor?: string
    locked?: boolean
  }[]
}) {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
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
                >
                  {item.icon && (
                    <AppIcon
                      icon={item.icon}
                      size="md"
                      className={active ? 'text-sidebar-primary-foreground' : (item.iconColor ?? 'text-sidebar-foreground/80')}
                    />
                  )}
                  <span>{item.title}</span>
                  {item.locked && (
                    <Lock aria-label="Not in your plan" className="ms-auto h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
