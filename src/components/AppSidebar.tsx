
import * as React from "react"
import { LayoutDashboard, FolderKanban, GalleryVerticalEnd, Calendar, ChevronUp, User2, Plus, LogOut, Bell, Building2, Shield, FileText, Mail, GitBranch, BarChart3, Database, Monitor, ClipboardList, History, RefreshCw, Search, ServerCog, Key, Timer } from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { ProjectSwitcher } from "@/components/ProjectSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { useImpersonation } from "@/contexts/ImpersonationContext"
import { useProject } from "@/contexts/ProjectContext"
import { useOrganization } from "@/contexts/OrganizationContext"
import { NotificationPanel } from "@/components/NotificationPanel"
import { ThemeSelector } from "@/components/ThemeSelector"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { userProfile: realUserProfile } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { projects, currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  
  // Use impersonated user's profile when impersonating, otherwise use real profile
  const effectiveProfile = isImpersonating && impersonatedUser ? impersonatedUser : realUserProfile;
  const effectiveRole = effectiveProfile?.role || 'user';
  
  const data = {
    user: {
      name: effectiveProfile?.first_name ? `${effectiveProfile.first_name} ${effectiveProfile.last_name}` : effectiveProfile?.email || "User",
      email: effectiveProfile?.email || "",
      avatar: "",
    },
    teams: [
      {
        name: currentOrganization?.name || "Organization",
        logo: GalleryVerticalEnd,
        plan: "Enterprise",
      },
    ],
    navMain: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: LayoutDashboard,
        isActive: true,
      },
      {
        title: "Projects",
        url: "/projects",
        icon: FolderKanban,
      },
      {
        title: "Members",
        url: "/users",
        icon: User2,
      },
      {
        title: "SQL Builder",
        url: "/query",
        icon: Database,
      },
      {
        title: "Form Builder", 
        url: "/forms",
        icon: Calendar,
        isDisabled: !currentProject,
      },
      {
        title: "Workflows",
        url: "/workflows", 
        icon: GitBranch,
        isDisabled: !currentProject,
      },
      {
        title: "Report Analytics",
        url: "/reports",
        icon: BarChart3,
        isDisabled: !currentProject,
      },
      {
        title: "Data Feeds",
        url: "/data-feeds",
        icon: RefreshCw,
        isDisabled: !currentProject,
      },
      {
        title: "Email Config",
        url: "/settings",
        icon: Mail,
      },
      {
        title: "LDAP / AD",
        url: "/ldap-settings",
        icon: ServerCog,
      },
      // Add admin-only navigation items - only show if effective role is admin
      ...(effectiveRole === 'admin' ? [
        {
          title: "API Integration",
          url: "/api-integration",
          icon: Key,
        },
      ] : []),
    ],
    projects: projects.map(project => ({
      name: project.name,
      url: `/projects/${project.id}/overview`,
      icon: FolderKanban,
    })),
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="group-data-[collapsible=icon]:p-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <TeamSwitcher teams={data.teams} />
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <NotificationPanel />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Project Switcher Section */}
        <div className="px-2 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
          <div className="text-xs font-medium text-sidebar-foreground/60 mb-2 px-2 group-data-[collapsible=icon]:hidden">
            Current Project
          </div>
          <ProjectSwitcher />
        </div>
        
        <SidebarSeparator />
        
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <ThemeSelector />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
