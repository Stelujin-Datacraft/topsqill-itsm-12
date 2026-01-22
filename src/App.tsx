
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { FormProvider } from "@/contexts/FormContext";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Documentation from "./pages/Documentation";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import { Navigate } from "react-router-dom";
import QueryPage from "./pages/QueryPage";
import Forms from "./pages/Forms";
import FormBuilder from "./pages/FormBuilder";
import FormEdit from "./pages/FormEdit";
import FormView from "./pages/FormView";
import FormSubmission from "./pages/FormSubmission";
import PublicFormView from "./pages/PublicFormView";
import FormPreviewPage from "./pages/FormPreviewPage";
import FormAccessManagement from "./pages/FormAccessManagement";
import MySubmissions from "./pages/MySubmissions";
import SubmissionView from "./pages/SubmissionView";
import FormSubmissionsTable from "./pages/FormSubmissionsTable";
import Workflows from "./pages/Workflows";
import WorkflowDesignerPage from "./pages/WorkflowDesignerPage";
import WorkflowViewerPage from "./pages/WorkflowViewer";
import WorkflowAccessManagement from "./pages/WorkflowAccessManagement";
import Reports from "./pages/Reports";
import ReportEditor from "./pages/ReportEditor";
import ReportViewerPage from "./pages/ReportViewer";
import ReportAccessManagement from "./pages/ReportAccessManagement";
import Users from "./pages/Users";

import RolesAndAccess from "./pages/RolesAndAccess";
import Projects from "./pages/Projects";
import ProjectOverview from "./components/projects/ProjectOverview";
import ProjectAccessPage from "./components/projects/ProjectAccessPage";
import Organizations from "./pages/Organizations";
import Settings from "./pages/Settings";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import DataTableBuilder from "./pages/DataTableBuilder";
import EmailConfigPage from "./pages/EmailConfigPage";
import DataFeeds from "./pages/DataFeeds";
import EmailTemplatesPage from "./pages/EmailTemplatesPage";
import SettingsPage from "./pages/SettingsPage";
import UserProfile from "./pages/UserProfile";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ManageSessions from "./pages/ManageSessions";
import AuditLogs from "./pages/AuditLogs";
import FormAuditLogs from "./pages/FormAuditLogs";
import InvestigateAccess from "./pages/InvestigateAccess";
import PasswordExpiryWarning from "./components/PasswordExpiryWarning";
import AcceptInvitation from "./pages/AcceptInvitation";
import NotFound from "./pages/NotFound";
import LdapSettings from "./pages/LdapSettings";

const queryClient = new QueryClient();

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
                    <PasswordExpiryWarning />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/docs" element={<Documentation />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/login" element={<Navigate to="/auth" replace />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/accept-invitation" element={<AcceptInvitation />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/query" element={<ProtectedRoute><QueryPage /></ProtectedRoute>} />
                    <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                    <Route path="/form-builder" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                    <Route path="/form-builder/:id" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
                    <Route path="/form-edit/:id" element={<ProtectedRoute><FormEdit /></ProtectedRoute>} />
                    <Route path="/form/:id" element={<ProtectedRoute><FormView /></ProtectedRoute>} />
                    <Route path="/form/:id/submit" element={<ProtectedRoute><FormSubmission /></ProtectedRoute>} />
                    <Route path="/form/:id/preview" element={<ProtectedRoute><FormPreviewPage /></ProtectedRoute>} />
                    <Route path="/form/:id/access" element={<ProtectedRoute><FormAccessManagement /></ProtectedRoute>} />
                    <Route path="/form/:id/settings" element={<ProtectedRoute><FormView /></ProtectedRoute>} />
                    <Route path="/public/form/:id" element={<PublicFormView />} />
                    <Route path="/my-submissions" element={<ProtectedRoute><MySubmissions /></ProtectedRoute>} />
                    <Route path="/submission/:submissionId" element={<ProtectedRoute><SubmissionView /></ProtectedRoute>} />
                    <Route path="/form-submissions" element={<ProtectedRoute><FormSubmissionsTable /></ProtectedRoute>} />
                    <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
                    <Route path="/workflow-view/:id" element={<ProtectedRoute><WorkflowViewerPage /></ProtectedRoute>} />
                    <Route path="/workflow-designer/:id" element={<ProtectedRoute><WorkflowDesignerPage /></ProtectedRoute>} />
                    <Route path="/workflow/:id/access" element={<ProtectedRoute><WorkflowAccessManagement /></ProtectedRoute>} />
                     <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                     <Route path="/report-editor/:id" element={<ProtectedRoute><ReportEditor /></ProtectedRoute>} />
                     <Route path="/report-view/:id" element={<ProtectedRoute><ReportViewerPage /></ProtectedRoute>} />
                     <Route path="/report/:id/access" element={<ProtectedRoute><ReportAccessManagement /></ProtectedRoute>} />
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
                     <Route path="/change-password" element={<ChangePassword />} />
                     <Route path="/manage-sessions" element={<ProtectedRoute><ManageSessions /></ProtectedRoute>} />
                     <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                     <Route path="/form-audit-logs" element={<ProtectedRoute><FormAuditLogs /></ProtectedRoute>} />
                     <Route path="/investigate-access" element={<ProtectedRoute><InvestigateAccess /></ProtectedRoute>} />
                     <Route path="/ldap-settings" element={<ProtectedRoute><LdapSettings /></ProtectedRoute>} />
                     <Route path="*" element={<NotFound />} />
                  </Routes>
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
