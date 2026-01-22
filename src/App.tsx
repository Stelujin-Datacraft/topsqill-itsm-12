import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { FormProvider } from "@/contexts/FormContext";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import PasswordExpiryWarning from "./components/PasswordExpiryWarning";
import { Loader2 } from "lucide-react";
import { cacheManager } from "@/lib/cacheManager";

// Eagerly loaded (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Layout for protected routes - keeps sidebar persistent
const ProtectedLayout = lazy(() => import("./components/layouts/ProtectedLayout"));

// Lazy loaded pages - reduces initial bundle size significantly
const Documentation = lazy(() => import("./pages/Documentation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const QueryPage = lazy(() => import("./pages/QueryPage"));
const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const FormEdit = lazy(() => import("./pages/FormEdit"));
const FormView = lazy(() => import("./pages/FormView"));
const FormSubmission = lazy(() => import("./pages/FormSubmission"));
const PublicFormView = lazy(() => import("./pages/PublicFormView"));
const FormPreviewPage = lazy(() => import("./pages/FormPreviewPage"));
const FormAccessManagement = lazy(() => import("./pages/FormAccessManagement"));
const MySubmissions = lazy(() => import("./pages/MySubmissions"));
const SubmissionView = lazy(() => import("./pages/SubmissionView"));
const FormSubmissionsTable = lazy(() => import("./pages/FormSubmissionsTable"));
const Workflows = lazy(() => import("./pages/Workflows"));
const WorkflowDesignerPage = lazy(() => import("./pages/WorkflowDesignerPage"));
const WorkflowViewerPage = lazy(() => import("./pages/WorkflowViewer"));
const WorkflowAccessManagement = lazy(() => import("./pages/WorkflowAccessManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportEditor = lazy(() => import("./pages/ReportEditor"));
const ReportViewerPage = lazy(() => import("./pages/ReportViewer"));
const ReportAccessManagement = lazy(() => import("./pages/ReportAccessManagement"));
const Users = lazy(() => import("./pages/Users"));
const RolesAndAccess = lazy(() => import("./pages/RolesAndAccess"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectOverview = lazy(() => import("./components/projects/ProjectOverview"));
const ProjectAccessPage = lazy(() => import("./components/projects/ProjectAccessPage"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Settings = lazy(() => import("./pages/Settings"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const DataTableBuilder = lazy(() => import("./pages/DataTableBuilder"));
const EmailConfigPage = lazy(() => import("./pages/EmailConfigPage"));
const DataFeeds = lazy(() => import("./pages/DataFeeds"));
const EmailTemplatesPage = lazy(() => import("./pages/EmailTemplatesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ManageSessions = lazy(() => import("./pages/ManageSessions"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const FormAuditLogs = lazy(() => import("./pages/FormAuditLogs"));
const InvestigateAccess = lazy(() => import("./pages/InvestigateAccess"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const LdapSettings = lazy(() => import("./pages/LdapSettings"));

// Preload critical routes immediately after initial render
const preloadCriticalRoutes = () => {
  // Small delay to not block initial render
  setTimeout(() => {
    import("./components/layouts/ProtectedLayout");
    import("./pages/Dashboard");
    import("./pages/Forms");
    import("./pages/Projects");
    import("./pages/Workflows");
    import("./pages/Reports");
    import("./pages/Users");
    import("./pages/MySubmissions");
  }, 500);
};

// Full-page loader for initial app load only
const FullPageLoader = () => {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!showLoader) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
};

// Optimized QueryClient with performance-focused defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - cache retention  
      retry: 1,
      refetchOnWindowFocus: false, // Prevents unnecessary refetching
      refetchOnReconnect: true,
    },
  },
});

// Initialize cache manager with query client
cacheManager.setQueryClient(queryClient);

const App = () => {
  // Preload critical routes after initial mount
  useEffect(() => {
    preloadCriticalRoutes();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <ImpersonationProvider>
                <ProjectProvider>
                  <FormProvider>
                    <WorkflowProvider>
                      <ImpersonationBanner />
                      <SessionTimeoutWarning />
                      <PasswordExpiryWarning />
                      <Suspense fallback={<FullPageLoader />}>
                        <Routes>
                          {/* Public routes */}
                          <Route path="/" element={<Index />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/docs" element={<Documentation />} />
                          <Route path="/accept-invitation" element={<AcceptInvitation />} />
                          <Route path="/public/form/:formId" element={<PublicFormView />} />
                          
                          {/* Protected routes with persistent sidebar layout */}
                          <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/query" element={<QueryPage />} />
                            <Route path="/forms" element={<Forms />} />
                            <Route path="/form-builder" element={<FormBuilder />} />
                            <Route path="/form-builder/:formId" element={<FormBuilder />} />
                            <Route path="/form-edit/:formId" element={<FormEdit />} />
                            <Route path="/form/:formId" element={<FormView />} />
                            <Route path="/form/:formId/submissions" element={<FormSubmissionsTable />} />
                            <Route path="/form/:formId/submission/:submissionId" element={<FormSubmission />} />
                            <Route path="/form-preview/:formId" element={<FormPreviewPage />} />
                            <Route path="/form-access/:formId" element={<FormAccessManagement />} />
                            <Route path="/my-submissions" element={<MySubmissions />} />
                            <Route path="/submissions/:submissionId" element={<SubmissionView />} />
                            
                            <Route path="/workflows" element={<Workflows />} />
                            <Route path="/workflow-builder" element={<WorkflowDesignerPage />} />
                            <Route path="/workflow-builder/:workflowId" element={<WorkflowDesignerPage />} />
                            <Route path="/workflow-viewer/:workflowId" element={<WorkflowViewerPage />} />
                            <Route path="/workflow-access/:workflowId" element={<WorkflowAccessManagement />} />
                            
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/report-builder" element={<ReportEditor />} />
                            <Route path="/report-builder/:reportId" element={<ReportEditor />} />
                            <Route path="/report-viewer/:reportId" element={<ReportViewerPage />} />
                            <Route path="/report-access/:reportId" element={<ReportAccessManagement />} />
                            <Route path="/analytics-dashboard" element={<AnalyticsDashboard />} />
                            <Route path="/data-table-builder" element={<DataTableBuilder />} />
                            
                            <Route path="/users" element={<Users />} />
                            <Route path="/roles-and-access" element={<RolesAndAccess />} />
                            <Route path="/projects" element={<Projects />} />
                            <Route path="/projects/:projectId/overview" element={<ProjectOverview />} />
                            <Route path="/projects/:projectId/access" element={<ProjectAccessPage />} />
                            <Route path="/organizations" element={<Organizations />} />
                            
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/email-config" element={<EmailConfigPage />} />
                            <Route path="/email-templates" element={<EmailTemplatesPage />} />
                            <Route path="/data-feeds" element={<DataFeeds />} />
                            <Route path="/settings-page" element={<SettingsPage />} />
                            <Route path="/profile" element={<UserProfile />} />
                            <Route path="/change-password" element={<ChangePassword />} />
                            <Route path="/manage-sessions" element={<ManageSessions />} />
                            <Route path="/audit-logs" element={<AuditLogs />} />
                            <Route path="/form-audit-logs" element={<FormAuditLogs />} />
                            <Route path="/investigate-access" element={<InvestigateAccess />} />
                            <Route path="/ldap-settings" element={<LdapSettings />} />
                          </Route>
                          
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </WorkflowProvider>
                  </FormProvider>
                </ProjectProvider>
              </ImpersonationProvider>
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
