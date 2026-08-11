
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
import { DelegationProvider } from "@/contexts/DelegationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { DelegationBanner } from "@/components/DelegationBanner";
import ProtectedLayout from "@/components/ProtectedLayout";
import PasswordExpiryWarning from "./components/PasswordExpiryWarning";
import { AIChatbot } from "./components/ai/AIChatbot";
import { RouteLoader } from "./components/RouteLoader";

// Wrap React.lazy with retry + reload-on-failure to handle stale chunk hashes after redeploys
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    const RELOAD_KEY = 'lovable:chunk-reloaded';
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isChunkErr =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module');
      // Only auto-reload in production. In dev/preview, Vite HMR can
      // transiently fail dynamic imports — reloading causes an annoying
      // refresh loop. Just rethrow so the RouteLoader error boundary handles it.
      if (isChunkErr && typeof window !== 'undefined' && import.meta.env.PROD) {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
          // Return a never-resolving promise while reload happens
          return new Promise(() => {}) as any;
        }
      }
      throw err;
    }
  });

// Eagerly loaded routes (critical path - should load immediately)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
const AIStudio = lazyWithRetry(() => import("./pages/AIStudio"));
import QueryPage from "./pages/QueryPage";
import Forms from "./pages/Forms";
import Workflows from "./pages/Workflows";
import Reports from "./pages/Reports";
import KnowledgeBase from "./pages/KnowledgeBase";

// Lazy loaded routes - keep deep/secondary pages split, but eager-load the
// main module entry pages to avoid a dev-only double loading sequence
// (route chunk loader first, then page data loader).
const Documentation = lazyWithRetry(() => import("./pages/Documentation"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const AcceptInvitation = lazyWithRetry(() => import("./pages/AcceptInvitation"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const Solutions = lazyWithRetry(() => import("./pages/Solutions"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));

// Forms feature
const FormBuilder = lazyWithRetry(() => import("./pages/FormBuilder"));
const FormEdit = lazyWithRetry(() => import("./pages/FormEdit"));
const FormView = lazyWithRetry(() => import("./pages/FormView"));
const FormSubmission = lazyWithRetry(() => import("./pages/FormSubmission"));
const PublicFormView = lazyWithRetry(() => import("./pages/PublicFormView"));
const FormPreviewPage = lazyWithRetry(() => import("./pages/FormPreviewPage"));
const FormAccessManagement = lazyWithRetry(() => import("./pages/FormAccessManagement"));
const SubmissionView = lazyWithRetry(() => import("./pages/SubmissionView"));
const FormSubmissionsTable = lazyWithRetry(() => import("./pages/FormSubmissionsTable"));

// Workflows feature
const WorkflowDesignerPage = lazyWithRetry(() => import("./pages/WorkflowDesignerPage"));
const WorkflowViewerPage = lazyWithRetry(() => import("./pages/WorkflowViewer"));
const WorkflowAccessManagement = lazyWithRetry(() => import("./pages/WorkflowAccessManagement"));

// Reports feature
const ReportEditor = lazyWithRetry(() => import("./pages/ReportEditor"));
const ReportViewerPage = lazyWithRetry(() => import("./pages/ReportViewer"));
const ReportAccessManagement = lazyWithRetry(() => import("./pages/ReportAccessManagement"));
const DashboardView = lazyWithRetry(() => import("./pages/DashboardView"));
const RelationshipMap = lazyWithRetry(() => import("./pages/RelationshipMap"));

// Admin & Settings
const Users = lazyWithRetry(() => import("./pages/Users"));
const ApiIntegration = lazyWithRetry(() => import("./pages/ApiIntegration"));
const ApiDocs = lazyWithRetry(() => import("./pages/ApiDocs"));
const RolesAndAccess = lazyWithRetry(() => import("./pages/RolesAndAccess"));
const Projects = lazyWithRetry(() => import("./pages/Projects"));
const ProjectOverview = lazyWithRetry(() => import("./components/projects/ProjectOverview"));
const ProjectAccessPage = lazyWithRetry(() => import("./components/projects/ProjectAccessPage"));
const Organizations = lazyWithRetry(() => import("./pages/Organizations"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const AnalyticsDashboard = lazyWithRetry(() => import("./pages/AnalyticsDashboard"));
const DataTableBuilder = lazyWithRetry(() => import("./pages/DataTableBuilder"));
const EmailConfigPage = lazyWithRetry(() => import("./pages/EmailConfigPage"));
const DataFeeds = lazyWithRetry(() => import("./pages/DataFeeds"));
const EmailTemplatesPage = lazyWithRetry(() => import("./pages/EmailTemplatesPage"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const UserProfile = lazyWithRetry(() => import("./pages/UserProfile"));
const ChangePassword = lazyWithRetry(() => import("./pages/ChangePassword"));
const ManageSessions = lazyWithRetry(() => import("./pages/ManageSessions"));
const AuditLogs = lazyWithRetry(() => import("./pages/AuditLogs"));
const FormAuditLogs = lazyWithRetry(() => import("./pages/FormAuditLogs"));
const InvestigateAccess = lazyWithRetry(() => import("./pages/InvestigateAccess"));
const LdapSettings = lazyWithRetry(() => import("./pages/LdapSettings"));
const SLAManagementPage = lazyWithRetry(() => import("./pages/SLAManagementPage"));
const RecordDelegations = lazyWithRetry(() => import("./pages/RecordDelegations"));

// Policies / Knowledge Base feature
const Policies = lazyWithRetry(() => import("./pages/Policies"));
const KnowledgeBaseFolder = lazyWithRetry(() => import("./pages/KnowledgeBaseFolder"));
const PolicyDetail = lazyWithRetry(() => import("./pages/PolicyDetail"));
const CreatePolicy = lazyWithRetry(() => import("./pages/CreatePolicy"));
const CreateTemplate = lazyWithRetry(() => import("./pages/CreateTemplate"));

// Compliance, Audit, Evidence
const CompliancePage = lazyWithRetry(() => import("./pages/CompliancePage"));
const AuditProgramsPage = lazyWithRetry(() => import("./pages/AuditProgramsPage"));
const EvidenceLockerPage = lazyWithRetry(() => import("./pages/EvidenceLockerPage"));

// IT Asset Management
const ITAssets = lazyWithRetry(() => import("./pages/ITAssets"));
const ProjectPerformance = lazyWithRetry(() => import("./pages/ProjectPerformance"));

// Performance-optimized React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 5 minutes - prevents unnecessary refetches on navigation.
      // Realtime subscriptions push live updates when data actually changes.
      staleTime: 5 * 60 * 1000,
      // Cache data retained for 15 minutes after becoming unused
      gcTime: 15 * 60 * 1000,
      // Don't refetch on window focus - realtime keeps data fresh
      refetchOnWindowFocus: false,
      // Don't refetch on remount within staleTime - eliminates top loading bar flash on navigation
      refetchOnMount: false,
      // Avoid reconnect-triggered refetch flashes right after navigation.
      // Realtime subscriptions and explicit invalidations keep data fresh.
      refetchOnReconnect: false,
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
        <DelegationProvider>
         <OrganizationProvider>
          <ProjectProvider>
            <FormProvider>
              <WorkflowProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <SessionTimeoutWarning />
                  <ImpersonationBanner />
                  <DelegationBanner />
                  <BrowserRouter>
                    <PasswordExpiryWarning />
                    <Routes>
                      {/* Public routes - eagerly loaded */}
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/login" element={<Navigate to="/auth" replace />} />
                      <Route path="/auth/callback" element={
                        <Suspense fallback={<RouteLoader />}>
                          <AuthCallback />
                        </Suspense>
                      } />
                      
                      {/* Public routes - lazy loaded */}
                      <Route path="/docs" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Documentation />
                        </Suspense>
                      } />
                      <Route path="/solutions" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Solutions />
                        </Suspense>
                      } />
                      <Route path="/contact" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Contact />
                        </Suspense>
                      } />
                      <Route path="/privacy" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Privacy />
                        </Suspense>
                      } />
                      <Route path="/terms" element={
                        <Suspense fallback={<RouteLoader />}>
                          <Terms />
                        </Suspense>
                      } />
                      {/* Legacy direct links redirect into the tabbed Solutions page */}
                      <Route path="/solutions/employee-onboarding" element={<Navigate to="/solutions?tab=onboarding" replace />} />
                      <Route path="/solutions/grc" element={<Navigate to="/solutions?tab=grc" replace />} />
                      <Route path="/solutions/itsm" element={<Navigate to="/solutions?tab=itsm" replace />} />
                      <Route path="/solutions/vendor-management" element={<Navigate to="/solutions?tab=vendor" replace />} />
                      <Route path="/solutions/security" element={<Navigate to="/solutions?tab=security" replace />} />
                      <Route path="/solutions/hr" element={<Navigate to="/solutions?tab=hr" replace />} />
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
                        <Route path="/build" element={
                          <Suspense fallback={<RouteLoader />}>
                            <AIStudio />
                          </Suspense>
                        } />
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
                        <Route path="/record-delegations" element={<RecordDelegations />} />
                        <Route path="/api-integration" element={<ApiIntegration />} />
                        <Route path="/api-docs" element={<ApiDocs />} />
                        <Route path="/it-assets" element={<ITAssets />} />
                        <Route path="/project-performance" element={<ProjectPerformance />} />
                      </Route>
                      
                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <ChatbotGate />
                  </BrowserRouter>
                </TooltipProvider>
              </WorkflowProvider>
            </FormProvider>
          </ProjectProvider>
         </OrganizationProvider>
        </DelegationProvider>
      </ImpersonationProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
