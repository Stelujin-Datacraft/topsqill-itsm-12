
import * as React from "react"
import { AudioWaveform, Command, GalleryVerticalEnd, Calendar, Settings2, ChevronUp, User2, Plus, LogOut, Bell, Building2, Shield, FileText, Mail } from "lucide-react"
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
        icon: AudioWaveform,
        isActive: true,
      },
      {
        title: "Projects",
        url: "/projects",
        icon: Command,
      },
      {
        title: "Organizations",
        url: "/organizations",
        icon: Building2,
      },
      {
        title: "SQL Query",
        url: "/query",
        icon: Settings2,
      },
      {
        title: "Forms", 
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
        title: "Workflows",
        url: "/workflows", 
        icon: Settings2,
        isDisabled: !currentProject,
      },
      {
        title: "Reports",
        url: "/reports",
        icon: Settings2,
        isDisabled: !currentProject,
      },
      {
        title: "Users",
        url: "/users",
        icon: User2,
      },
      {
        title: "Email Config",
        url: "/settings",
        icon: Mail,
      },
      // Add Roles and Access tab only for admins
      ...(userProfile?.role === 'admin' ? [{
        title: "Roles and Access",
        url: "/roles-and-access",
        icon: Shield,
      }] : []),
    ],
    projects: projects.map(project => ({
      name: project.name,
      url: `/projects/${project.id}/overview`,
      icon: Command,
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
