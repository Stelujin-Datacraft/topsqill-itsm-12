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

// Eagerly loaded (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
    import("./pages/Dashboard");
    import("./pages/Forms");
    import("./pages/Projects");
    import("./pages/Workflows");
    import("./pages/Reports");
  }, 1000);
};

// Delayed loading fallback - only shows spinner after 200ms to avoid flash
const PageLoader = () => {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!showLoader) {
    // Return empty div to maintain layout while waiting
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
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/docs" element={<Documentation />} />
                          <Route path="/accept-invitation" element={<AcceptInvitation />} />
                          <Route path="/public/form/:formId" element={<PublicFormView />} />
                          
                          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                          <Route path="/query" element={<ProtectedRoute><QueryPage /></ProtectedRoute>} />
                          <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                          <Route path="/form-builder" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                          <Route path="/form-builder/:formId" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                          <Route path="/form-edit/:formId" element={<ProtectedRoute><FormEdit /></ProtectedRoute>} />
                          <Route path="/form/:formId" element={<ProtectedRoute><FormView /></ProtectedRoute>} />
                          <Route path="/form/:formId/submissions" element={<ProtectedRoute><FormSubmissionsTable /></ProtectedRoute>} />
                          <Route path="/form/:formId/submission/:submissionId" element={<ProtectedRoute><FormSubmission /></ProtectedRoute>} />
                          <Route path="/form-preview/:formId" element={<ProtectedRoute><FormPreviewPage /></ProtectedRoute>} />
                          <Route path="/form-access/:formId" element={<ProtectedRoute><FormAccessManagement /></ProtectedRoute>} />
                          <Route path="/my-submissions" element={<ProtectedRoute><MySubmissions /></ProtectedRoute>} />
                          <Route path="/submissions/:submissionId" element={<ProtectedRoute><SubmissionView /></ProtectedRoute>} />
                          
                          <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
                          <Route path="/workflow-builder" element={<ProtectedRoute><WorkflowDesignerPage /></ProtectedRoute>} />
                          <Route path="/workflow-builder/:workflowId" element={<ProtectedRoute><WorkflowDesignerPage /></ProtectedRoute>} />
                          <Route path="/workflow-viewer/:workflowId" element={<ProtectedRoute><WorkflowViewerPage /></ProtectedRoute>} />
                          <Route path="/workflow-access/:workflowId" element={<ProtectedRoute><WorkflowAccessManagement /></ProtectedRoute>} />
                          
                          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                          <Route path="/report-builder" element={<ProtectedRoute><ReportEditor /></ProtectedRoute>} />
                          <Route path="/report-builder/:reportId" element={<ProtectedRoute><ReportEditor /></ProtectedRoute>} />
                          <Route path="/report-viewer/:reportId" element={<ProtectedRoute><ReportViewerPage /></ProtectedRoute>} />
                          <Route path="/report-access/:reportId" element={<ProtectedRoute><ReportAccessManagement /></ProtectedRoute>} />
                          <Route path="/analytics-dashboard" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
                          <Route path="/data-table-builder" element={<ProtectedRoute><DataTableBuilder /></ProtectedRoute>} />
                          
                          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                          <Route path="/roles-and-access" element={<ProtectedRoute><RolesAndAccess /></ProtectedRoute>} />
                          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                          <Route path="/projects/:projectId/overview" element={<ProtectedRoute><ProjectOverview /></ProtectedRoute>} />
                          <Route path="/projects/:projectId/access" element={<ProtectedRoute><ProjectAccessPage /></ProtectedRoute>} />
                          <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
                          
                          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                          <Route path="/email-config" element={<ProtectedRoute><EmailConfigPage /></ProtectedRoute>} />
                          <Route path="/email-templates" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
                          <Route path="/data-feeds" element={<ProtectedRoute><DataFeeds /></ProtectedRoute>} />
                          <Route path="/settings-page" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
                          <Route path="/manage-sessions" element={<ProtectedRoute><ManageSessions /></ProtectedRoute>} />
                          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                          <Route path="/form-audit-logs" element={<ProtectedRoute><FormAuditLogs /></ProtectedRoute>} />
                          <Route path="/investigate-access" element={<ProtectedRoute><InvestigateAccess /></ProtectedRoute>} />
                          <Route path="/ldap-settings" element={<ProtectedRoute><LdapSettings /></ProtectedRoute>} />
                          
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
