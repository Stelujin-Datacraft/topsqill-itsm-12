
import * as React from "react"
import { LayoutDashboard, FolderKanban, GalleryVerticalEnd, Calendar, ChevronUp, User2, Plus, LogOut, Bell, Building2, Shield, FileText, Mail, GitBranch, BarChart3, Database, Monitor, ClipboardList, History } from "lucide-react"
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
import { useProject } from "@/contexts/ProjectContext"
import { useOrganization } from "@/contexts/OrganizationContext"
import { NotificationPanel } from "@/components/NotificationPanel"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { userProfile } = useAuth();
  const { projects, currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  
  const data = {
    user: {
      name: userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : userProfile?.email || "User",
      email: userProfile?.email || "",
      avatar: "/avatars/shadcn.jpg",
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
        title: "Dashboard",
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
        title: "Organizations",
        url: "/organizations",
        icon: Building2,
      },
      {
        title: "Data Explorer",
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
        title: "My Submissions",
        url: "/my-submissions",
        icon: FileText,
      },
      {
        title: "Task Automation",
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
        title: "Team Members",
        url: "/users",
        icon: User2,
      },
      {
        title: "Email Config",
        url: "/settings",
        icon: Mail,
      },
      {
        title: "Form History",
        url: "/form-audit-logs",
        icon: History,
      },
      // Add admin-only navigation items
      ...(userProfile?.role === 'admin' ? [
        {
          title: "Roles and Access",
          url: "/roles-and-access",
          icon: Shield,
        },
        {
          title: "Manage Sessions",
          url: "/manage-sessions",
          icon: Monitor,
        },
        {
          title: "Audit Logs",
          url: "/audit-logs",
          icon: ClipboardList,
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
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <TeamSwitcher teams={data.teams} />
          <div className="flex items-center gap-1">
            <NotificationPanel />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Project Switcher Section */}
        <div className="px-2 py-4">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Current Project
          </div>
          <ProjectSwitcher />
        </div>
        
        <SidebarSeparator />
        
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
