
import * as React from "react"
import { LayoutDashboard, FolderKanban, GalleryVerticalEnd, Calendar, User2, GitBranch, BarChart3, Database, RefreshCw, Map, ScrollText, HardDrive, Mail, ServerCog, Key, UserCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const { userProfile: realUserProfile } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { projects, currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  
  // Use impersonated user's profile when impersonating, otherwise use real profile
  const effectiveProfile = isImpersonating && impersonatedUser ? impersonatedUser : realUserProfile;
  const effectiveRole = effectiveProfile?.role || 'user';
  
  const data = {
    user: {
      name: effectiveProfile?.first_name ? `${effectiveProfile.first_name} ${effectiveProfile.last_name}` : effectiveProfile?.email || t('common.user'),
      email: effectiveProfile?.email || "",
      avatar: "",
    },
    teams: [
      {
        name: currentOrganization?.name || t('common.enterprise'),
        logo: GalleryVerticalEnd,
        plan: t('common.enterprise'),
      },
    ],
    navMain: [
      {
        title: t('nav.overview'),
        url: "/dashboard",
        icon: LayoutDashboard,
        isActive: true,
        iconColor: "text-module-overview",
      },
      {
        title: t('nav.projects'),
        url: "/projects",
        icon: FolderKanban,
        iconColor: "text-module-projects",
      },
      {
        title: "AI Builder",
        url: "/build",
        icon: Wand2,
        iconColor: "text-primary",
      },
      {
        title: t('nav.accessControl'),
        url: "/users",
        icon: User2,
        iconColor: "text-module-access",
      },
      {
        title: t('nav.sqlBuilder'),
        url: "/query",
        icon: Database,
        iconColor: "text-module-query",
      },
      {
        title: t('nav.formBuilder'),
        url: "/forms",
        icon: Calendar,
        isDisabled: !currentProject,
        iconColor: "text-module-forms",
      },
      {
        title: t('nav.workflows'),
        url: "/workflows",
        icon: GitBranch,
        isDisabled: !currentProject,
        iconColor: "text-module-workflows",
      },
      {
        title: t('nav.reportAnalytics'),
        url: "/reports",
        icon: BarChart3,
        isDisabled: !currentProject,
        iconColor: "text-module-reports",
      },
      {
        title: t('nav.relationshipMap'),
        url: "/relationship-map",
        icon: Map,
        isDisabled: !currentProject,
        iconColor: "text-module-relationship",
      },
      {
        title: t('nav.dataFeeds'),
        url: "/data-feeds",
        icon: RefreshCw,
        isDisabled: !currentProject,
        iconColor: "text-module-feeds",
      },
      {
        title: t('nav.knowledgeBase'),
        url: "/knowledge-base",
        icon: ScrollText,
        isDisabled: !currentProject,
        iconColor: "text-module-knowledge",
      },
      {
        title: t('nav.itAssets'),
        url: "/it-assets",
        icon: HardDrive,
        iconColor: "text-module-itam",
      },
      {
        title: t('nav.emailConfig'),
        url: "/settings",
        icon: Mail,
        iconColor: "text-module-email",
      },
      {
        title: t('nav.recordDelegation'),
        url: "/record-delegations",
        icon: UserCheck,
        iconColor: "text-module-access",
      },
      {
        title: t('nav.ldap'),
        url: "/ldap-settings",
        icon: ServerCog,
        iconColor: "text-module-ldap",
      },
      ...(effectiveRole === 'admin' ? [
        {
          title: t('nav.apiIntegration'),
          url: "/api-integration",
          icon: Key,
          iconColor: "text-module-api",
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
            {t('nav.currentProject')}
          </div>
          <ProjectSwitcher />
        </div>
        
        <SidebarSeparator />
        
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <LanguageSwitcher variant="sidebar" />
        <ThemeSelector />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
