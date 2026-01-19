import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Building2, 
  Database, 
  Calendar, 
  FileText, 
  GitBranch, 
  BarChart3, 
  User2, 
  Mail, 
  History, 
  Shield,
  Bell,
  Settings,
  Search,
  ChevronDown,
  Plus
} from "lucide-react";

interface DecorativeBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DecorativeBackground = ({ children, className }: DecorativeBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Blurred Dashboard Background - Matching our app design */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-slate-900">
        
        {/* Sidebar - Matching AppSidebar */}
        <div className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
          {/* Team Switcher Area */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="h-3 w-24 bg-sidebar-accent rounded" />
                <div className="h-2 w-16 bg-sidebar-accent/50 rounded mt-1" />
              </div>
              <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
            </div>
          </div>

          {/* Platform Section */}
          <div className="p-4">
            <div className="text-xs font-medium text-sidebar-foreground/50 mb-3">Platform</div>
            <div className="space-y-1">
              {[
                { icon: LayoutDashboard, label: "Dashboard", active: true },
                { icon: FolderKanban, label: "Projects" },
                { icon: Building2, label: "Organizations" },
                { icon: Database, label: "Data Explorer" },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md",
                    item.active ? "bg-sidebar-accent" : ""
                  )}
                >
                  <item.icon className="w-4 h-4 text-sidebar-foreground/70" />
                  <span className="text-sm text-sidebar-foreground/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Project Section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="text-xs font-medium text-sidebar-foreground/50 mb-3">Current Project</div>
            <div className="space-y-1">
              {[
                { icon: Calendar, label: "Form Builder" },
                { icon: FileText, label: "My Submissions" },
                { icon: GitBranch, label: "Task Automation" },
                { icon: BarChart3, label: "Report Analytics" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
                  <item.icon className="w-4 h-4 text-sidebar-foreground/70" />
                  <span className="text-sm text-sidebar-foreground/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Settings Section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="space-y-1">
              {[
                { icon: User2, label: "Team Members" },
                { icon: Mail, label: "Email Config" },
                { icon: History, label: "Form History" },
                { icon: Shield, label: "Roles and Access" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
                  <item.icon className="w-4 h-4 text-sidebar-foreground/70" />
                  <span className="text-sm text-sidebar-foreground/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* User Area */}
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60" />
              <div className="flex-1">
                <div className="h-3 w-20 bg-sidebar-accent rounded" />
                <div className="h-2 w-28 bg-sidebar-accent/50 rounded mt-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="absolute left-64 top-0 right-0 h-full">
          {/* Header - Matching DashboardLayout */}
          <div className="h-16 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md border border-border flex items-center justify-center">
                <Bell className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="w-9 h-9 rounded-md border border-border flex items-center justify-center">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-6">
            {/* Quick Actions - Matching our blue-50 style */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: Plus, title: "New Form", desc: "Create a new form" },
                  { icon: GitBranch, title: "New Workflow", desc: "Automate tasks" },
                  { icon: BarChart3, title: "New Report", desc: "Build analytics" },
                  { icon: User2, title: "Invite User", desc: "Add team member" },
                ].map((action, i) => (
                  <div 
                    key={i} 
                    className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                  >
                    <action.icon className="w-6 h-6 text-primary mb-2" />
                    <div className="font-medium text-sm text-foreground">{action.title}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Cards - Matching Dashboard.tsx */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              {[
                { title: "Total Projects", value: "5", desc: "projects available", icon: FolderKanban },
                { title: "Current Role", value: "Admin", desc: "Organization member", icon: User2 },
                { title: "Active Project", value: "1", desc: "Project selected", icon: FileText },
              ].map((stat, i) => (
                <div key={i} className="bg-card rounded-lg border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                    <stat.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.desc}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity Card */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-32 bg-muted rounded" />
                      <div className="h-2 w-48 bg-muted/60 rounded mt-2" />
                    </div>
                    <div className="h-2 w-16 bg-muted/60 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blur Overlay */}
      <div className="absolute inset-0 backdrop-blur-[2px] bg-slate-900/50 dark:bg-slate-950/60" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};
