import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, Key, Shield, FileText, GitBranch, BarChart3, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const BASE_URL = 'https://fnmkczsvwpzpxyklztkt.supabase.co/functions/v1/public-api';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  permissions: string[];
  pathParams?: { name: string; type: string; description: string }[];
  queryParams?: { name: string; type: string; description: string; required?: boolean }[];
  bodyParams?: { name: string; type: string; description: string; required?: boolean }[];
  requestExample?: string;
  responseExample: string;
  notes?: string[];
}

const endpoints: Record<string, Endpoint[]> = {
  forms: [
    {
      method: 'GET',
      path: '/forms',
      title: 'List Forms',
      description: 'Retrieve a list of all forms accessible to this API key within your organization.',
      permissions: ['forms:read'],
      queryParams: [
        { name: 'status', type: 'string', description: 'Filter by status: active, draft, archived' },
      ],
      responseExample: `{
  "data": [
    {
      "id": "uuid",
      "name": "Customer Feedback",
      "description": "Collect customer feedback",
      "reference_id": "CF00001234",
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1
}`,
    },
    {
      method: 'GET',
      path: '/forms/:id',
      title: 'Get Form Details',
      description: 'Retrieve detailed information about a specific form including layout and pages.',
      permissions: ['forms:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
      ],
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Customer Feedback",
    "description": "Collect customer feedback",
    "reference_id": "CF00001234",
    "status": "active",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z",
    "layout": { ... },
    "pages": [ ... ]
  }
}`,
    },
    {
      method: 'GET',
      path: '/forms/:id/fields',
      title: 'Get Form Fields',
      description: 'Retrieve all field definitions for a specific form.',
      permissions: ['forms:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
      ],
      responseExample: `{
  "data": [
    {
      "id": "field-uuid",
      "label": "Full Name",
      "field_type": "text",
      "required": true,
      "placeholder": "Enter your name",
      "options": null,
      "field_order": 1
    },
    {
      "id": "field-uuid-2",
      "label": "Rating",
      "field_type": "select",
      "required": true,
      "options": ["Excellent", "Good", "Average", "Poor"],
      "field_order": 2
    }
  ],
  "count": 2
}`,
      notes: ['Use these field IDs when submitting data, or set use_labels: true to use labels instead'],
    },
    {
      method: 'POST',
      path: '/forms',
      title: 'Create Form',
      description: 'Create a new form in your organization.',
      permissions: ['forms:create'],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Form name', required: true },
        { name: 'description', type: 'string', description: 'Form description' },
        { name: 'project_id', type: 'string', description: 'Project UUID (required if API key is not scoped to a project)' },
        { name: 'status', type: 'string', description: 'Form status: draft, active, archived (default: draft)' },
      ],
      requestExample: `{
  "name": "New Feedback Form",
  "description": "Collect customer feedback",
  "project_id": "project-uuid",
  "status": "draft"
}`,
      responseExample: `{
  "data": {
    "id": "new-uuid",
    "name": "New Feedback Form",
    "reference_id": "NF00001234",
    "status": "draft",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "message": "Form created successfully"
}`,
    },
    {
      method: 'PUT',
      path: '/forms/:id',
      title: 'Update Form',
      description: 'Update an existing form\'s metadata.',
      permissions: ['forms:update'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
      ],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Updated form name' },
        { name: 'description', type: 'string', description: 'Updated description' },
        { name: 'status', type: 'string', description: 'Updated status: draft, active, archived' },
      ],
      requestExample: `{
  "name": "Updated Form Name",
  "status": "active"
}`,
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Updated Form Name",
    "reference_id": "NF00001234",
    "status": "active",
    "updated_at": "2025-01-15T11:00:00Z"
  },
  "message": "Form updated successfully"
}`,
    },
    {
      method: 'DELETE',
      path: '/forms/:id',
      title: 'Delete Form',
      description: 'Permanently delete a form and all its submissions.',
      permissions: ['forms:delete'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
      ],
      responseExample: `{
  "message": "Form deleted successfully"
}`,
      notes: ['This action is irreversible', 'All submissions associated with this form will also be deleted'],
    },
  ],
  submissions: [
    {
      method: 'GET',
      path: '/submissions',
      title: 'List Submissions',
      description: 'Retrieve submissions with optional filtering by form.',
      permissions: ['submissions:read'],
      queryParams: [
        { name: 'form_id', type: 'string', description: 'Filter by form UUID' },
        { name: 'form_ref_id', type: 'string', description: 'Filter by form reference_id' },
        { name: 'limit', type: 'number', description: 'Items per page (default: 100)' },
        { name: 'offset', type: 'number', description: 'Pagination offset (default: 0)' },
      ],
      responseExample: `{
  "data": [
    {
      "id": "uuid",
      "form_id": "form-uuid",
      "submission_ref_id": "CF01150001",
      "submission_data": {
        "field-id-1": "John Doe",
        "field-id-2": "Excellent"
      },
      "submitted_at": "2025-01-15T10:30:00Z",
      "submitted_by": null,
      "approval_status": "pending"
    }
  ],
  "count": 1,
  "limit": 100,
  "offset": 0
}`,
    },
    {
      method: 'GET',
      path: '/submissions/:id',
      title: 'Get Submission',
      description: 'Retrieve a specific submission by UUID or submission_ref_id.',
      permissions: ['submissions:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Submission UUID or submission_ref_id' },
      ],
      responseExample: `{
  "data": {
    "id": "uuid",
    "form_id": "form-uuid",
    "form_name": "Customer Feedback",
    "form_reference_id": "CF00001234",
    "submission_ref_id": "CF01150001",
    "submission_data": {
      "field-id-1": "John Doe",
      "field-id-2": "Excellent"
    },
    "submitted_at": "2025-01-15T10:30:00Z",
    "submitted_by": null,
    "approval_status": "approved",
    "approval_notes": "Approved by manager"
  }
}`,
    },
    {
      method: 'POST',
      path: '/submissions',
      title: 'Create Submission',
      description: 'Create a new submission record for a form.',
      permissions: ['submissions:create'],
      bodyParams: [
        { name: 'form_id', type: 'string', description: 'Form UUID (required if form_ref_id not provided)' },
        { name: 'form_ref_id', type: 'string', description: 'Form reference_id (required if form_id not provided)' },
        { name: 'submission_data', type: 'object', description: 'Field values as key-value pairs', required: true },
        { name: 'use_labels', type: 'boolean', description: 'Use field labels instead of field IDs (default: false)' },
      ],
      requestExample: `{
  "form_ref_id": "CF00001234",
  "use_labels": true,
  "submission_data": {
    "Full Name": "John Doe",
    "Email": "john@example.com",
    "Rating": "Excellent"
  }
}`,
      responseExample: `{
  "data": {
    "id": "new-uuid",
    "submission_ref_id": "CF01150002",
    "submitted_at": "2025-01-15T10:35:00Z"
  },
  "message": "Submission created successfully"
}`,
    },
    {
      method: 'PUT',
      path: '/submissions/:id',
      title: 'Update Submission',
      description: 'Update an existing submission. By default merges with existing data.',
      permissions: ['submissions:update'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Submission UUID or submission_ref_id' },
      ],
      bodyParams: [
        { name: 'submission_data', type: 'object', description: 'Updated field values' },
        { name: 'use_labels', type: 'boolean', description: 'Use field labels instead of field IDs' },
        { name: 'merge', type: 'boolean', description: 'Merge with existing data (default: true). Set false to replace.' },
      ],
      requestExample: `{
  "use_labels": true,
  "submission_data": {
    "Rating": "Good"
  },
  "merge": true
}`,
      responseExample: `{
  "data": {
    "id": "uuid",
    "submission_ref_id": "CF01150001",
    "submitted_at": "2025-01-15T10:30:00Z"
  },
  "message": "Submission updated successfully"
}`,
    },
    {
      method: 'DELETE',
      path: '/submissions/:id',
      title: 'Delete Submission',
      description: 'Permanently delete a submission record.',
      permissions: ['submissions:delete'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Submission UUID or submission_ref_id' },
      ],
      responseExample: `{
  "message": "Submission deleted successfully"
}`,
    },
  ],
  workflows: [
    {
      method: 'GET',
      path: '/workflows',
      title: 'List Workflows',
      description: 'Retrieve a list of all workflows accessible to this API key.',
      permissions: ['workflows:read'],
      responseExample: `{
  "data": [
    {
      "id": "uuid",
      "name": "Approval Workflow",
      "description": "Automated approval process",
      "reference_id": "AW00001234",
      "status": "active",
      "trigger_type": "form_submission",
      "created_at": "2025-01-10T08:00:00Z"
    }
  ],
  "count": 1
}`,
    },
    {
      method: 'GET',
      path: '/workflows/:id',
      title: 'Get Workflow Details',
      description: 'Retrieve detailed information about a specific workflow.',
      permissions: ['workflows:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Workflow UUID or reference_id' },
      ],
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Approval Workflow",
    "description": "Automated approval process",
    "reference_id": "AW00001234",
    "status": "active",
    "trigger_type": "form_submission",
    "trigger_config": { ... },
    "created_at": "2025-01-10T08:00:00Z",
    "updated_at": "2025-01-15T09:00:00Z"
  }
}`,
    },
    {
      method: 'POST',
      path: '/workflows',
      title: 'Create Workflow',
      description: 'Create a new workflow in your organization.',
      permissions: ['workflows:create'],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Workflow name', required: true },
        { name: 'description', type: 'string', description: 'Workflow description' },
        { name: 'project_id', type: 'string', description: 'Project UUID (required if API key is not scoped to a project)' },
        { name: 'trigger_type', type: 'string', description: 'Trigger type: manual, form_submission, scheduled (default: manual)' },
        { name: 'status', type: 'string', description: 'Workflow status: draft, active (default: draft)' },
      ],
      requestExample: `{
  "name": "New Approval Workflow",
  "description": "Automated approval for new requests",
  "project_id": "project-uuid",
  "trigger_type": "form_submission",
  "status": "draft"
}`,
      responseExample: `{
  "data": {
    "id": "new-uuid",
    "name": "New Approval Workflow",
    "reference_id": "NA00001234",
    "status": "draft",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "message": "Workflow created successfully"
}`,
    },
    {
      method: 'POST',
      path: '/workflows/:id/trigger',
      title: 'Trigger Workflow',
      description: 'Manually trigger a workflow execution for a specific submission.',
      permissions: ['workflows:trigger'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Workflow UUID or reference_id' },
      ],
      bodyParams: [
        { name: 'submission_id', type: 'string', description: 'Submission UUID (required if submission_ref_id not provided)' },
        { name: 'submission_ref_id', type: 'string', description: 'Submission reference_id (required if submission_id not provided)' },
      ],
      requestExample: `{
  "submission_ref_id": "CF01150001"
}`,
      responseExample: `{
  "data": {
    "id": "execution-uuid",
    "status": "pending",
    "created_at": "2025-01-15T12:00:00Z"
  },
  "message": "Workflow \\"Approval Workflow\\" triggered successfully"
}`,
      notes: ['Workflow must be in "active" status to be triggered', 'Returns HTTP 202 Accepted'],
    },
    {
      method: 'PUT',
      path: '/workflows/:id',
      title: 'Update Workflow',
      description: 'Update an existing workflow\'s metadata.',
      permissions: ['workflows:update'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Workflow UUID or reference_id' },
      ],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Updated workflow name' },
        { name: 'description', type: 'string', description: 'Updated description' },
        { name: 'status', type: 'string', description: 'Updated status: draft, active' },
        { name: 'trigger_type', type: 'string', description: 'Updated trigger type' },
      ],
      requestExample: `{
  "name": "Updated Workflow Name",
  "status": "active"
}`,
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Updated Workflow Name",
    "reference_id": "NA00001234",
    "status": "active",
    "updated_at": "2025-01-15T11:00:00Z"
  },
  "message": "Workflow updated successfully"
}`,
    },
    {
      method: 'DELETE',
      path: '/workflows/:id',
      title: 'Delete Workflow',
      description: 'Permanently delete a workflow.',
      permissions: ['workflows:delete'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Workflow UUID or reference_id' },
      ],
      responseExample: `{
  "message": "Workflow deleted successfully"
}`,
      notes: ['This action is irreversible', 'All execution history associated with this workflow will also be deleted'],
    },
  ],
  reports: [
    {
      method: 'GET',
      path: '/reports',
      title: 'List Reports',
      description: 'Retrieve a list of all reports accessible to this API key.',
      permissions: ['reports:read'],
      responseExample: `{
  "data": [
    {
      "id": "uuid",
      "name": "Monthly Summary",
      "description": "Monthly submission summary report",
      "reference_id": "MS00001234",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1
}`,
    },
    {
      method: 'GET',
      path: '/reports/:id',
      title: 'Get Report Details',
      description: 'Retrieve detailed information about a specific report.',
      permissions: ['reports:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Report UUID or reference_id' },
      ],
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Monthly Summary",
    "description": "Monthly submission summary report",
    "reference_id": "MS00001234",
    "dashboard_id": "dashboard-uuid",
    "is_public": false,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T09:00:00Z"
  }
}`,
    },
    {
      method: 'POST',
      path: '/reports',
      title: 'Create Report',
      description: 'Create a new report in your organization.',
      permissions: ['reports:create'],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Report name', required: true },
        { name: 'description', type: 'string', description: 'Report description' },
        { name: 'project_id', type: 'string', description: 'Project UUID (required if API key is not scoped to a project)' },
        { name: 'dashboard_id', type: 'string', description: 'Optional dashboard UUID to associate with' },
        { name: 'is_public', type: 'boolean', description: 'Whether the report is publicly accessible (default: false)' },
      ],
      requestExample: `{
  "name": "New Monthly Report",
  "description": "Monthly metrics summary",
  "project_id": "project-uuid",
  "is_public": false
}`,
      responseExample: `{
  "data": {
    "id": "new-uuid",
    "name": "New Monthly Report",
    "reference_id": "NM00001234",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "message": "Report created successfully"
}`,
    },
    {
      method: 'PUT',
      path: '/reports/:id',
      title: 'Update Report',
      description: 'Update an existing report\'s metadata.',
      permissions: ['reports:update'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Report UUID or reference_id' },
      ],
      bodyParams: [
        { name: 'name', type: 'string', description: 'Updated report name' },
        { name: 'description', type: 'string', description: 'Updated description' },
        { name: 'is_public', type: 'boolean', description: 'Updated public visibility' },
      ],
      requestExample: `{
  "name": "Updated Report Name",
  "is_public": true
}`,
      responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Updated Report Name",
    "reference_id": "NM00001234",
    "updated_at": "2025-01-15T11:00:00Z"
  },
  "message": "Report updated successfully"
}`,
    },
    {
      method: 'DELETE',
      path: '/reports/:id',
      title: 'Delete Report',
      description: 'Permanently delete a report.',
      permissions: ['reports:delete'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Report UUID or reference_id' },
      ],
      responseExample: `{
  "message": "Report deleted successfully"
}`,
      notes: ['This action is irreversible'],
    },
  ],
};

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const ApiDocs: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Copied to clipboard' });
  };

  const renderEndpoint = (endpoint: Endpoint, index: number) => {
    const endpointId = `${endpoint.method}-${endpoint.path}`;
    const isActive = activeEndpoint === endpointId;

    return (
      <Card key={index} className="mb-4">
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActiveEndpoint(isActive ? null : endpointId)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={methodColors[endpoint.method]}>
                {endpoint.method}
              </Badge>
              <code className="text-sm font-mono">{endpoint.path}</code>
            </div>
            <ChevronRight className={`h-5 w-5 transition-transform ${isActive ? 'rotate-90' : ''}`} />
          </div>
          <CardDescription>{endpoint.title}</CardDescription>
        </CardHeader>
        
        {isActive && (
          <CardContent className="space-y-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">{endpoint.description}</p>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Required permissions:</span>
              {endpoint.permissions.map((perm) => (
                <Badge key={perm} variant="outline">{perm}</Badge>
              ))}
            </div>

            {endpoint.pathParams && endpoint.pathParams.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Path Parameters</h4>
                <div className="bg-muted rounded-md p-3 space-y-2">
                  {endpoint.pathParams.map((param) => (
                    <div key={param.name} className="text-sm">
                      <code className="text-primary">{param.name}</code>
                      <span className="text-muted-foreground ml-2">({param.type})</span>
                      <span className="ml-2">- {param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.queryParams && endpoint.queryParams.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Query Parameters</h4>
                <div className="bg-muted rounded-md p-3 space-y-2">
                  {endpoint.queryParams.map((param) => (
                    <div key={param.name} className="text-sm">
                      <code className="text-primary">{param.name}</code>
                      <span className="text-muted-foreground ml-2">({param.type})</span>
                      {param.required && <Badge variant="destructive" className="ml-2 text-xs">required</Badge>}
                      <span className="ml-2">- {param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Body Parameters</h4>
                <div className="bg-muted rounded-md p-3 space-y-2">
                  {endpoint.bodyParams.map((param) => (
                    <div key={param.name} className="text-sm">
                      <code className="text-primary">{param.name}</code>
                      <span className="text-muted-foreground ml-2">({param.type})</span>
                      {param.required && <Badge variant="destructive" className="ml-2 text-xs">required</Badge>}
                      <span className="ml-2">- {param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.requestExample && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Request Example</h4>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(endpoint.requestExample!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs">
                  {endpoint.requestExample}
                </pre>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Response Example</h4>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(endpoint.responseExample)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs">
                {endpoint.responseExample}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <DashboardLayout
      title="API Documentation"
      actions={
        <Button variant="outline" onClick={() => navigate('/api-integration')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to API Keys
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Button
                variant={activeSection === 'getting-started' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('getting-started')}
              >
                <Key className="h-4 w-4 mr-2" />
                Getting Started
              </Button>
              <Button
                variant={activeSection === 'authentication' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('authentication')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Authentication
              </Button>
              <Separator className="my-2" />
              <Button
                variant={activeSection === 'forms' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('forms')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Forms
              </Button>
              <Button
                variant={activeSection === 'submissions' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('submissions')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Submissions
              </Button>
              <Button
                variant={activeSection === 'workflows' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('workflows')}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Workflows
              </Button>
              <Button
                variant={activeSection === 'reports' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('reports')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Reports
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {activeSection === 'getting-started' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Getting Started with the Public API</CardTitle>
                    <CardDescription>
                      Integrate Topsqill with external systems using our secure REST API
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Base URL</h3>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-muted rounded-md text-sm">
                          {BASE_URL}
                        </code>
                        <Button variant="outline" size="icon" onClick={() => handleCopy(BASE_URL)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Quick Start</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Create an API key from the API Integration page</li>
                        <li>Copy your API key (you won't be able to see it again)</li>
                        <li>Include the key in the <code>x-api-key</code> header</li>
                        <li>Make requests to the endpoints below</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Example Request</h3>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`curl -X GET '${BASE_URL}/forms' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json'`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Available Permissions</CardTitle>
                    <CardDescription>
                      API keys can be configured with specific permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Forms</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li><code>forms:read</code> - View forms and fields</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Submissions</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li><code>submissions:read</code> - View submissions</li>
                          <li><code>submissions:create</code> - Create submissions</li>
                          <li><code>submissions:update</code> - Update submissions</li>
                          <li><code>submissions:delete</code> - Delete submissions</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Workflows</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li><code>workflows:read</code> - View workflows</li>
                          <li><code>workflows:trigger</code> - Trigger workflows</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Reports</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li><code>reports:read</code> - View reports</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'authentication' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                      All API requests require authentication via API key
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">API Key Header</h3>
                      <code className="block p-3 bg-muted rounded-md text-sm">
                        x-api-key: tsk_your_api_key_here
                      </code>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Security Features</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                        <li><strong>IP Whitelisting:</strong> Restrict API access to specific IP addresses</li>
                        <li><strong>Rate Limiting:</strong> Configure requests per minute limits</li>
                        <li><strong>Key Expiration:</strong> Set automatic expiry dates for keys</li>
                        <li><strong>Granular Permissions:</strong> Control access per resource type</li>
                        <li><strong>Audit Logging:</strong> All requests are logged for security review</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Error Responses</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">401</Badge>
                          <span className="text-sm">Missing or invalid API key</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">403</Badge>
                          <span className="text-sm">Insufficient permissions or IP blocked</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">429</Badge>
                          <span className="text-sm">Rate limit exceeded</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'forms' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Forms Endpoints
                </h2>
                {endpoints.forms.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </div>
            )}

            {activeSection === 'submissions' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Submissions Endpoints
                </h2>
                {endpoints.submissions.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </div>
            )}

            {activeSection === 'workflows' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Workflows Endpoints
                </h2>
                {endpoints.workflows.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </div>
            )}

            {activeSection === 'reports' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Reports Endpoints
                </h2>
                {endpoints.reports.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;