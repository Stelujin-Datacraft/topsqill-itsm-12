
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
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ProtectedLayout from "@/components/ProtectedLayout";
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
const RelationshipMap = lazy(() => import("./pages/RelationshipMap"));

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
const SLAManagementPage = lazy(() => import("./pages/SLAManagementPage"));

// Policies / Knowledge Base feature
const Policies = lazy(() => import("./pages/Policies"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const KnowledgeBaseFolder = lazy(() => import("./pages/KnowledgeBaseFolder"));
const PolicyDetail = lazy(() => import("./pages/PolicyDetail"));
const CreatePolicy = lazy(() => import("./pages/CreatePolicy"));
const CreateTemplate = lazy(() => import("./pages/CreateTemplate"));

// Compliance, Audit, Evidence
const CompliancePage = lazy(() => import("./pages/CompliancePage"));
const AuditProgramsPage = lazy(() => import("./pages/AuditProgramsPage"));
const EvidenceLockerPage = lazy(() => import("./pages/EvidenceLockerPage"));

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
    <ThemeProvider>
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
                    <Routes>
                      {/* Public routes - eagerly loaded */}
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/login" element={<Navigate to="/auth" replace />} />
                      
                      {/* Public routes - lazy loaded */}
                      <Route path="/docs" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Documentation />
                        </Suspense>
                      } />
                      <Route path="/forgot-password" element={
                        <Suspense fallback={<RouteLoader />}>
                          <ForgotPassword />
                        </Suspense>
                      } />
                      <Route path="/accept-invitation" element={
                        <Suspense fallback={<RouteLoader />}>
                          <AcceptInvitation />
                        </Suspense>
                      } />
                      <Route path="/public/form/:id" element={
                        <Suspense fallback={<RouteLoader />}>
                          <PublicFormView />
                        </Suspense>
                      } />
                      <Route path="/change-password" element={
                        <Suspense fallback={<RouteLoader />}>
                          <ChangePassword />
                        </Suspense>
                      } />
                      
                      {/* Protected routes - nested under ProtectedLayout for persistent sidebar */}
                      <Route element={<ProtectedLayout />}>
                        {/* Dashboard */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/query" element={<QueryPage />} />
                        
                        {/* Forms */}
                        <Route path="/forms" element={<Forms />} />
                        <Route path="/form-builder" element={<FormBuilder />} />
                        <Route path="/form-builder/:id" element={<FormBuilder />} />
                        <Route path="/form-edit/:id" element={<FormEdit />} />
                        <Route path="/form/:id" element={<FormView />} />
                        <Route path="/form/:id/submit" element={<FormSubmission />} />
                        <Route path="/form/:id/preview" element={<FormPreviewPage />} />
                        <Route path="/form/:id/access" element={<FormAccessManagement />} />
                        <Route path="/form/:id/settings" element={<FormView />} />
                        <Route path="/my-submissions" element={<MySubmissions />} />
                        <Route path="/submission/:submissionId" element={<SubmissionView />} />
                        <Route path="/form-submissions" element={<FormSubmissionsTable />} />
                        
                        {/* Workflows */}
                        <Route path="/workflows" element={<Workflows />} />
                        <Route path="/workflow-view/:id" element={<WorkflowViewerPage />} />
                        <Route path="/workflow-designer/:id" element={<WorkflowDesignerPage />} />
                        <Route path="/workflow/:id/access" element={<WorkflowAccessManagement />} />
                        
                        {/* Reports */}
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/dashboard-view/:id" element={<DashboardView />} />
                        <Route path="/report-editor/:id" element={<ReportEditor />} />
                        <Route path="/report-view/:id" element={<ReportViewerPage />} />
                        <Route path="/report/:id/access" element={<ReportAccessManagement />} />
                        <Route path="/relationship-map" element={<RelationshipMap />} />
                        
                        {/* Knowledge Base / Policies */}
                        <Route path="/knowledge-base" element={<KnowledgeBase />} />
                        <Route path="/knowledge-base/:folderId" element={<KnowledgeBaseFolder />} />
                        <Route path="/policies" element={<Navigate to="/knowledge-base" replace />} />
                        <Route path="/policies/create" element={<CreatePolicy />} />
                        <Route path="/policies/create-template" element={<CreateTemplate />} />
                        <Route path="/policy/:id" element={<PolicyDetail />} />
                        <Route path="/compliance" element={<CompliancePage />} />
                        <Route path="/audit-programs" element={<AuditProgramsPage />} />
                        <Route path="/evidence-locker" element={<EvidenceLockerPage />} />
                        
                        {/* Admin */}
                        <Route path="/users" element={<Users />} />
                        <Route path="/roles-and-access" element={<RolesAndAccess />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/:projectId/access" element={<ProjectAccessPage />} />
                        <Route path="/projects/:projectId/overview" element={<ProjectOverview />} />
                        <Route path="/organizations" element={<Organizations />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/analytics-dashboard" element={<AnalyticsDashboard />} />
                        <Route path="/data-table-builder" element={<DataTableBuilder />} />
                        <Route path="/email-config" element={<EmailConfigPage />} />
                        <Route path="/email-config/:projectId" element={<EmailConfigPage />} />
                        <Route path="/email-templates" element={<EmailTemplatesPage />} />
                        <Route path="/email-templates/:templateId" element={<EmailTemplatesPage />} />
                        <Route path="/data-feeds" element={<DataFeeds />} />
                        <Route path="/profile" element={<UserProfile />} />
                        <Route path="/manage-sessions" element={<ManageSessions />} />
                        <Route path="/audit-logs" element={<AuditLogs />} />
                        <Route path="/form-audit-logs" element={<FormAuditLogs />} />
                        <Route path="/investigate-access" element={<InvestigateAccess />} />
                        <Route path="/ldap-settings" element={<LdapSettings />} />
                        <Route path="/sla-management" element={<SLAManagementPage />} />
                        <Route path="/api-integration" element={<ApiIntegration />} />
                        <Route path="/api-docs" element={<ApiDocs />} />
                      </Route>
                      
                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <AIChatbot />
                  </BrowserRouter>
                </TooltipProvider>
              </WorkflowProvider>
            </FormProvider>
          </ProjectProvider>
        </OrganizationProvider>
      </ImpersonationProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
