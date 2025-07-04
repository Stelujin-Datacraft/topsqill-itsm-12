
import { LucideIcon } from "lucide-react"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { useProject } from "@/contexts/ProjectContext"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const location = useLocation()
  const { setCurrentProject, projects: allProjects } = useProject()

  const handleProjectClick = (projectUrl: string) => {
    // Extract project ID from URL and set as current project
    const projectId = projectUrl.split('/')[2]
    const project = allProjects.find(p => p.id === projectId)
    if (project) {
      setCurrentProject(project)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((project) => (
          <SidebarMenuItem key={project.name}>
            <SidebarMenuButton 
              asChild 
              isActive={location.pathname.includes(project.url.split('/')[2])}
            >
              <Link 
                to={project.url}
                onClick={() => handleProjectClick(project.url)}
              >
                {project.icon && <project.icon />}
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
