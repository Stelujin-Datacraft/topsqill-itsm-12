import { cn } from "@/lib/utils";
import { Bell, Home, LayoutDashboard, Settings, Users, FileText, BarChart3, Calendar, Search, ChevronDown } from "lucide-react";

interface DecorativeBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DecorativeBackground = ({ children, className }: DecorativeBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Blurred Dashboard Background */}
      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900">
        {/* Sidebar */}
        <div className="absolute left-0 top-0 h-full w-16 bg-slate-800 dark:bg-slate-950 flex flex-col items-center py-4 gap-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col gap-4 mt-4">
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-slate-400" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
          </div>
          <div className="mt-auto">
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="absolute left-16 top-0 right-0 h-full">
          {/* Header */}
          <div className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-4 py-2 w-64">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-sm">Search...</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                <Bell className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-6">
            {/* Welcome Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome Back, User!</h1>
              <p className="text-slate-500 dark:text-slate-400">Here's what's happening with your projects</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-500 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-sm opacity-90">Sales:</span>
                </div>
                <span className="text-2xl font-bold">1,250</span>
              </div>
              <div className="bg-blue-500 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-sm opacity-90">New Users:</span>
                </div>
                <span className="text-2xl font-bold">320</span>
              </div>
              <div className="bg-orange-500 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Tasks:</span>
                </div>
                <span className="text-2xl font-bold">18</span>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Pie Chart Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Performance Stats</h3>
                <div className="flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-[20px] border-emerald-500 relative">
                    <div className="absolute inset-0 rounded-full border-[20px] border-transparent border-t-blue-500 border-r-blue-500 rotate-45" />
                    <div className="absolute inset-0 rounded-full border-[20px] border-transparent border-b-amber-500 rotate-180" />
                    <div className="absolute inset-0 rounded-full border-[20px] border-transparent border-l-rose-500 rotate-45" />
                  </div>
                </div>
              </div>

              {/* Line Chart Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Overview</h3>
                <div className="h-32 flex items-end gap-1">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400" />
                      <div className="flex-1">
                        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-600 rounded" />
                        <div className="h-2 w-16 bg-slate-100 dark:bg-slate-500 rounded mt-1" />
                      </div>
                      <div className="h-2 w-12 bg-slate-100 dark:bg-slate-500 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Upcoming Events</h3>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                      <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-rose-500" />
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-28 bg-slate-200 dark:bg-slate-600 rounded" />
                        <div className="h-2 w-20 bg-slate-100 dark:bg-slate-500 rounded mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blur Overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-slate-900/40 dark:bg-slate-950/50" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};
