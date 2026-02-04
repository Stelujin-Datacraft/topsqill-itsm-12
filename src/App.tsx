
import React, { Suspense, lazy } from 'react';
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
import { AIChatbot } from "./components/ai/AIChatbot";
import { RoutePreloader } from "./components/RoutePreloader";
import { RouteLoader } from "./components/RouteLoader";

// Eagerly loaded routes (critical path - should load immediately)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded routes - split by feature area for optimal chunking
const Documentation = lazy(() => import("./pages/Documentation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const QueryPage = lazy(() => import("./pages/QueryPage"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));

// Forms feature
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

// Workflows feature
const Workflows = lazy(() => import("./pages/Workflows"));
const WorkflowDesignerPage = lazy(() => import("./pages/WorkflowDesignerPage"));
const WorkflowViewerPage = lazy(() => import("./pages/WorkflowViewer"));
const WorkflowAccessManagement = lazy(() => import("./pages/WorkflowAccessManagement"));

// Reports feature
const Reports = lazy(() => import("./pages/Reports"));
const ReportEditor = lazy(() => import("./pages/ReportEditor"));
const ReportViewerPage = lazy(() => import("./pages/ReportViewer"));
const ReportAccessManagement = lazy(() => import("./pages/ReportAccessManagement"));
const DashboardView = lazy(() => import("./pages/DashboardView"));

// Admin & Settings
const Users = lazy(() => import("./pages/Users"));
const ApiIntegration = lazy(() => import("./pages/ApiIntegration"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
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
const ManageSessions = lazy(() => import("./pages/ManageSessions"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const FormAuditLogs = lazy(() => import("./pages/FormAuditLogs"));
const InvestigateAccess = lazy(() => import("./pages/InvestigateAccess"));
const LdapSettings = lazy(() => import("./pages/LdapSettings"));

// Performance-optimized React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 2 minutes - prevents unnecessary refetches
      staleTime: 2 * 60 * 1000,
      // Cache data retained for 10 minutes after becoming unused
      gcTime: 10 * 60 * 1000,
      // Prevent refetch on window focus for better UX
      refetchOnWindowFocus: false,
      // Retry failed requests once with delay
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ImpersonationProvider>
        <OrganizationProvider>
          <ProjectProvider>
            <FormProvider>
              <WorkflowProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <SessionTimeoutWarning />
                  <ImpersonationBanner />
                  <BrowserRouter>
                    <RoutePreloader />
                    <PasswordExpiryWarning />
                    <Suspense fallback={<RouteLoader />}>
                      <Routes>
                        {/* Eagerly loaded routes */}
                        <Route path="/" element={<Index />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/login" element={<Navigate to="/auth" replace />} />
                        <Route path="*" element={<NotFound />} />
                        
                        {/* Public routes */}
                        <Route path="/docs" element={<Documentation />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/accept-invitation" element={<AcceptInvitation />} />
                        <Route path="/public/form/:id" element={<PublicFormView />} />
                        <Route path="/change-password" element={<ChangePassword />} />
                        
                        {/* Protected routes - Dashboard */}
                        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/query" element={<ProtectedRoute><QueryPage /></ProtectedRoute>} />
                        
                        {/* Protected routes - Forms */}
                        <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                        <Route path="/form-builder" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                        <Route path="/form-builder/:id" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                        <Route path="/form-edit/:id" element={<ProtectedRoute><FormEdit /></ProtectedRoute>} />
                        <Route path="/form/:id" element={<ProtectedRoute><FormView /></ProtectedRoute>} />
                        <Route path="/form/:id/submit" element={<ProtectedRoute><FormSubmission /></ProtectedRoute>} />
                        <Route path="/form/:id/preview" element={<ProtectedRoute><FormPreviewPage /></ProtectedRoute>} />
                        <Route path="/form/:id/access" element={<ProtectedRoute><FormAccessManagement /></ProtectedRoute>} />
                        <Route path="/form/:id/settings" element={<ProtectedRoute><FormView /></ProtectedRoute>} />
                        <Route path="/my-submissions" element={<ProtectedRoute><MySubmissions /></ProtectedRoute>} />
                        <Route path="/submission/:submissionId" element={<ProtectedRoute><SubmissionView /></ProtectedRoute>} />
                        <Route path="/form-submissions" element={<ProtectedRoute><FormSubmissionsTable /></ProtectedRoute>} />
                        
                        {/* Protected routes - Workflows */}
                        <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
                        <Route path="/workflow-view/:id" element={<ProtectedRoute><WorkflowViewerPage /></ProtectedRoute>} />
                        <Route path="/workflow-designer/:id" element={<ProtectedRoute><WorkflowDesignerPage /></ProtectedRoute>} />
                        <Route path="/workflow/:id/access" element={<ProtectedRoute><WorkflowAccessManagement /></ProtectedRoute>} />
                        
                        {/* Protected routes - Reports */}
                        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                        <Route path="/dashboard-view/:id" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
                        <Route path="/report-editor/:id" element={<ProtectedRoute><ReportEditor /></ProtectedRoute>} />
                        <Route path="/report-view/:id" element={<ProtectedRoute><ReportViewerPage /></ProtectedRoute>} />
                        <Route path="/report/:id/access" element={<ProtectedRoute><ReportAccessManagement /></ProtectedRoute>} />
                        
                        {/* Protected routes - Admin */}
                        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                        <Route path="/roles-and-access" element={<ProtectedRoute><RolesAndAccess /></ProtectedRoute>} />
                        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                        <Route path="/projects/:projectId/access" element={<ProtectedRoute><ProjectAccessPage /></ProtectedRoute>} />
                        <Route path="/projects/:projectId/overview" element={<ProtectedRoute><ProjectOverview /></ProtectedRoute>} />
                        <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                        <Route path="/analytics-dashboard" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
                        <Route path="/data-table-builder" element={<ProtectedRoute><DataTableBuilder /></ProtectedRoute>} />
                        <Route path="/email-config" element={<ProtectedRoute><EmailConfigPage /></ProtectedRoute>} />
                        <Route path="/email-config/:projectId" element={<ProtectedRoute><EmailConfigPage /></ProtectedRoute>} />
                        <Route path="/email-templates" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
                        <Route path="/email-templates/:templateId" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
                        <Route path="/data-feeds" element={<ProtectedRoute><DataFeeds /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                        <Route path="/manage-sessions" element={<ProtectedRoute><ManageSessions /></ProtectedRoute>} />
                        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                        <Route path="/form-audit-logs" element={<ProtectedRoute><FormAuditLogs /></ProtectedRoute>} />
                        <Route path="/investigate-access" element={<ProtectedRoute><InvestigateAccess /></ProtectedRoute>} />
                        <Route path="/ldap-settings" element={<ProtectedRoute><LdapSettings /></ProtectedRoute>} />
                        <Route path="/api-integration" element={<ProtectedRoute><ApiIntegration /></ProtectedRoute>} />
                        <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
                      </Routes>
                    </Suspense>
                    <AIChatbot />
                  </BrowserRouter>
                </TooltipProvider>
              </WorkflowProvider>
            </FormProvider>
          </ProjectProvider>
        </OrganizationProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
