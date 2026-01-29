import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, Key, Shield, FileText, GitBranch, BarChart3, ChevronRight, Layers, AlertTriangle, Clock, BookOpen, Zap } from 'lucide-react';
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
  curlExample?: string;
  jsExample?: string;
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
      curlExample: `curl -X GET '${BASE_URL}/forms?status=active' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms?status=active',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
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
      curlExample: `curl -X GET '${BASE_URL}/forms/CF00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/CF00001234',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
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
      curlExample: `curl -X GET '${BASE_URL}/forms/CF00001234/fields' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/CF00001234/fields',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "label": "Full Name",
      "field_type": "text",
      "required": true,
      "placeholder": "Enter your name",
      "options": null,
      "field_order": 1
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
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
  "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "status": "draft"
}`,
      curlExample: `curl -X POST '${BASE_URL}/forms' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "New Feedback Form",
    "description": "Collect customer feedback",
    "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "status": "draft"
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/forms', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'New Feedback Form',
    description: 'Collect customer feedback',
    project_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    status: 'draft'
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def0-234567890123",
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
      curlExample: `curl -X PUT '${BASE_URL}/forms/NF00001234' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Updated Form Name",
    "status": "active"
  }'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/NF00001234',
  {
    method: 'PUT',
    headers: {
      'x-api-key': 'tsk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Updated Form Name',
      status: 'active'
    })
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
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
      curlExample: `curl -X DELETE '${BASE_URL}/forms/NF00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/NF00001234',
  {
    method: 'DELETE',
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "message": "Form deleted successfully"
}`,
      notes: ['This action is irreversible', 'All submissions associated with this form will also be deleted'],
    },
    {
      method: 'GET',
      path: '/forms/:id/records',
      title: 'Get Form Records',
      description: 'Retrieve all records (submissions) for a specific form. This is the recommended way to fetch form data.',
      permissions: ['submissions:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
      ],
      queryParams: [
        { name: 'limit', type: 'number', description: 'Items per page (default: 100, max: 1000)' },
        { name: 'offset', type: 'number', description: 'Pagination offset (default: 0)' },
      ],
      curlExample: `curl -X GET '${BASE_URL}/forms/CF00001234/records?limit=50' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/CF00001234/records?limit=50',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "form": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Feedback",
    "reference_id": "CF00001234"
  },
  "data": [
    {
      "id": "e5f6a7b8-c9d0-1234-ef01-345678901234",
      "submission_ref_id": "CF01150001",
      "submission_data": {
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "John Doe",
        "b2c3d4e5-f6a7-8901-bcde-f12345678901": "Excellent"
      },
      "submitted_at": "2025-01-15T10:30:00Z",
      "submitted_by": null,
      "approval_status": "pending"
    }
  ],
  "count": 1,
  "total": 150,
  "limit": 50,
  "offset": 0
}`,
      notes: ['Use form UUID or reference_id in the path', 'Returns form metadata along with records', 'Use limit and offset for pagination'],
    },
    {
      method: 'GET',
      path: '/forms/:id/records/:recordId',
      title: 'Get Specific Record',
      description: 'Retrieve a specific record from a form by record ID or submission_ref_id.',
      permissions: ['submissions:read'],
      pathParams: [
        { name: 'id', type: 'string', description: 'Form UUID or reference_id' },
        { name: 'recordId', type: 'string', description: 'Record UUID or submission_ref_id' },
      ],
      curlExample: `curl -X GET '${BASE_URL}/forms/CF00001234/records/CF01150001' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/forms/CF00001234/records/CF01150001',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "form": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Feedback",
    "reference_id": "CF00001234"
  },
  "data": {
    "id": "e5f6a7b8-c9d0-1234-ef01-345678901234",
    "submission_ref_id": "CF01150001",
    "submission_data": {
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "John Doe",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901": "Excellent"
    },
    "submitted_at": "2025-01-15T10:30:00Z",
    "submitted_by": null,
    "approval_status": "approved",
    "approval_notes": "Approved by manager"
  }
}`,
      notes: ['Use form UUID or reference_id in the path', 'Use record UUID or submission_ref_id to identify the record'],
    },
  ],
  submissions: [
    {
      method: 'GET',
      path: '/submissions',
      title: 'List Submissions',
      description: 'Retrieve submissions across all forms or filtered by a specific form. Use form_id (UUID) or form_ref_id (reference ID) to filter. For a cleaner API, consider using GET /forms/:id/records instead.',
      permissions: ['submissions:read'],
      queryParams: [
        { name: 'form_id', type: 'string', description: 'Filter by form UUID or reference_id', required: false },
        { name: 'form_ref_id', type: 'string', description: 'Filter by form reference_id (alternative to form_id)', required: false },
        { name: 'limit', type: 'number', description: 'Items per page (default: 100, max: 1000)' },
        { name: 'offset', type: 'number', description: 'Pagination offset (default: 0)' },
      ],
      curlExample: `# Using form UUID
curl -X GET '${BASE_URL}/submissions?form_id=550e8400-e29b-41d4-a716-446655440000&limit=50' \\
  -H 'x-api-key: tsk_your_api_key_here'

# Using form reference_id
curl -X GET '${BASE_URL}/submissions?form_ref_id=CF00001234&limit=50' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `// Using form UUID
const response = await fetch(
  '${BASE_URL}/submissions?form_id=550e8400-e29b-41d4-a716-446655440000&limit=50',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);

// Or using form reference_id
const response2 = await fetch(
  '${BASE_URL}/submissions?form_ref_id=CF00001234&limit=50',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);`,
      responseExample: `{
  "data": [
    {
      "id": "e5f6a7b8-c9d0-1234-ef01-345678901234",
      "form_id": "550e8400-e29b-41d4-a716-446655440000",
      "form_name": "Customer Feedback",
      "form_reference_id": "CF00001234",
      "submission_ref_id": "CF01150001",
      "submission_data": {
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "John Doe",
        "b2c3d4e5-f6a7-8901-bcde-f12345678901": "Excellent"
      },
      "submitted_at": "2025-01-15T10:30:00Z",
      "submitted_by": null,
      "approval_status": "pending"
    }
  ],
  "count": 1,
  "limit": 100,
  "offset": 0,
  "form_id": "550e8400-e29b-41d4-a716-446655440000"
}`,
      notes: [
        'Either form_id or form_ref_id is required to filter by form',
        'Without a filter, returns submissions from all accessible forms',
        'Recommended: Use GET /forms/:id/records for fetching records of a specific form'
      ],
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
      curlExample: `curl -X GET '${BASE_URL}/submissions/CF01150001' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/submissions/CF01150001',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "e5f6a7b8-c9d0-1234-ef01-345678901234",
    "form_id": "550e8400-e29b-41d4-a716-446655440000",
    "form_name": "Customer Feedback",
    "form_reference_id": "CF00001234",
    "submission_ref_id": "CF01150001",
    "submission_data": {
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "John Doe",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901": "Excellent"
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
      curlExample: `curl -X POST '${BASE_URL}/submissions' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "form_ref_id": "CF00001234",
    "use_labels": true,
    "submission_data": {
      "Full Name": "John Doe",
      "Rating": "Excellent"
    }
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/submissions', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    form_ref_id: 'CF00001234',
    use_labels: true,
    submission_data: {
      'Full Name': 'John Doe',
      'Rating': 'Excellent'
    }
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "f6a7b8c9-d0e1-2345-f012-456789012345",
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
      curlExample: `curl -X PUT '${BASE_URL}/submissions/CF01150001' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "use_labels": true,
    "submission_data": { "Rating": "Good" },
    "merge": true
  }'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/submissions/CF01150001',
  {
    method: 'PUT',
    headers: {
      'x-api-key': 'tsk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      use_labels: true,
      submission_data: { Rating: 'Good' },
      merge: true
    })
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "e5f6a7b8-c9d0-1234-ef01-345678901234",
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
      curlExample: `curl -X DELETE '${BASE_URL}/submissions/CF01150001' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/submissions/CF01150001',
  {
    method: 'DELETE',
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "message": "Submission deleted successfully"
}`,
      notes: ['This action is irreversible'],
    },
  ],
  bulkOperations: [
    {
      method: 'POST',
      path: '/submissions/bulk',
      title: 'Bulk Create Submissions',
      description: 'Create multiple submission records in a single request. Maximum 100 records per request.',
      permissions: ['submissions:create'],
      bodyParams: [
        { name: 'form_id', type: 'string', description: 'Form UUID (required if form_ref_id not provided)' },
        { name: 'form_ref_id', type: 'string', description: 'Form reference_id (required if form_id not provided)' },
        { name: 'submissions', type: 'array', description: 'Array of submission objects (max 100)', required: true },
        { name: 'use_labels', type: 'boolean', description: 'Use field labels instead of field IDs' },
      ],
      requestExample: `{
  "form_ref_id": "CF00001234",
  "use_labels": true,
  "submissions": [
    { "Full Name": "John Doe", "Rating": "Excellent" },
    { "Full Name": "Jane Smith", "Rating": "Good" },
    { "Full Name": "Bob Wilson", "Rating": "Average" }
  ]
}`,
      curlExample: `curl -X POST '${BASE_URL}/submissions/bulk' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "form_ref_id": "CF00001234",
    "use_labels": true,
    "submissions": [
      { "Full Name": "John Doe", "Rating": "Excellent" },
      { "Full Name": "Jane Smith", "Rating": "Good" }
    ]
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/submissions/bulk', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    form_ref_id: 'CF00001234',
    use_labels: true,
    submissions: [
      { 'Full Name': 'John Doe', Rating: 'Excellent' },
      { 'Full Name': 'Jane Smith', Rating: 'Good' }
    ]
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "created": 2,
    "submissions": [
      { "id": "a7b8c9d0-e1f2-3456-0123-567890123456", "submission_ref_id": "CF01150001" },
      { "id": "b8c9d0e1-f2a3-4567-1234-678901234567", "submission_ref_id": "CF01150002" }
    ]
  },
  "message": "2 submissions created successfully"
}`,
      notes: [
        'Maximum 100 records per request',
        'All records are validated before insertion (atomic operation)',
        'If validation fails, error includes details for each failed record',
      ],
    },
    {
      method: 'PUT',
      path: '/submissions/bulk',
      title: 'Bulk Update Submissions',
      description: 'Update multiple submission records in a single request. Maximum 100 records per request.',
      permissions: ['submissions:update'],
      bodyParams: [
        { name: 'submissions', type: 'array', description: 'Array of update objects with id and data', required: true },
        { name: 'use_labels', type: 'boolean', description: 'Use field labels instead of field IDs' },
        { name: 'merge', type: 'boolean', description: 'Merge with existing data (default: true)' },
      ],
      requestExample: `{
  "use_labels": true,
  "merge": true,
  "submissions": [
    { "id": "CF01150001", "submission_data": { "Rating": "Excellent" } },
    { "id": "CF01150002", "submission_data": { "Rating": "Good" } }
  ]
}`,
      curlExample: `curl -X PUT '${BASE_URL}/submissions/bulk' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "use_labels": true,
    "merge": true,
    "submissions": [
      { "id": "CF01150001", "submission_data": { "Rating": "Excellent" } },
      { "id": "CF01150002", "submission_data": { "Rating": "Good" } }
    ]
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/submissions/bulk', {
  method: 'PUT',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    use_labels: true,
    merge: true,
    submissions: [
      { id: 'CF01150001', submission_data: { Rating: 'Excellent' } },
      { id: 'CF01150002', submission_data: { Rating: 'Good' } }
    ]
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "updated": 2
  },
  "message": "2 submissions updated successfully"
}`,
      notes: [
        'Maximum 100 records per request',
        'Each submission object requires an id (UUID or submission_ref_id)',
        'Non-existent IDs will be skipped with a warning',
      ],
    },
    {
      method: 'DELETE',
      path: '/submissions/bulk',
      title: 'Bulk Delete Submissions',
      description: 'Delete multiple submission records in a single request. Maximum 100 records per request.',
      permissions: ['submissions:delete'],
      bodyParams: [
        { name: 'ids', type: 'array', description: 'Array of submission UUIDs or submission_ref_ids to delete', required: true },
      ],
      requestExample: `{
  "ids": ["CF01150001", "CF01150002", "CF01150003"]
}`,
      curlExample: `curl -X DELETE '${BASE_URL}/submissions/bulk' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{ "ids": ["CF01150001", "CF01150002"] }'`,
      jsExample: `const response = await fetch('${BASE_URL}/submissions/bulk', {
  method: 'DELETE',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ids: ['CF01150001', 'CF01150002']
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "deleted": 2
  },
  "message": "2 submissions deleted successfully"
}`,
      notes: [
        'Maximum 100 records per request',
        'Non-existent IDs are silently ignored',
        'This action is permanent and cannot be undone',
      ],
    },
  ],
  workflows: [
    {
      method: 'GET',
      path: '/workflows',
      title: 'List Workflows',
      description: 'Retrieve a list of all workflows accessible to this API key.',
      permissions: ['workflows:read'],
      curlExample: `curl -X GET '${BASE_URL}/workflows' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/workflows',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": [
    {
      "id": "c9d0e1f2-a3b4-5678-2345-789012345678",
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
      curlExample: `curl -X GET '${BASE_URL}/workflows/AW00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/workflows/AW00001234',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "c9d0e1f2-a3b4-5678-2345-789012345678",
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
  "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "trigger_type": "form_submission",
  "status": "draft"
}`,
      curlExample: `curl -X POST '${BASE_URL}/workflows' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "New Approval Workflow",
    "description": "Automated approval for new requests",
    "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "trigger_type": "form_submission",
    "status": "draft"
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/workflows', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'New Approval Workflow',
    description: 'Automated approval for new requests',
    project_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    trigger_type: 'form_submission',
    status: 'draft'
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "d0e1f2a3-b4c5-6789-3456-890123456789",
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
      curlExample: `curl -X POST '${BASE_URL}/workflows/AW00001234/trigger' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "submission_ref_id": "CF01150001"
  }'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/workflows/AW00001234/trigger',
  {
    method: 'POST',
    headers: {
      'x-api-key': 'tsk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      submission_ref_id: 'CF01150001'
    })
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "e1f2a3b4-c5d6-7890-4567-901234567890",
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
      curlExample: `curl -X PUT '${BASE_URL}/workflows/AW00001234' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Updated Workflow Name",
    "status": "active"
  }'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/workflows/AW00001234',
  {
    method: 'PUT',
    headers: {
      'x-api-key': 'tsk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Updated Workflow Name',
      status: 'active'
    })
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "c9d0e1f2-a3b4-5678-2345-789012345678",
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
      curlExample: `curl -X DELETE '${BASE_URL}/workflows/AW00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/workflows/AW00001234',
  {
    method: 'DELETE',
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
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
      curlExample: `curl -X GET '${BASE_URL}/reports' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/reports',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": [
    {
      "id": "f2a3b4c5-d6e7-8901-5678-012345678901",
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
      curlExample: `curl -X GET '${BASE_URL}/reports/MS00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/reports/MS00001234',
  {
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "f2a3b4c5-d6e7-8901-5678-012345678901",
    "name": "Monthly Summary",
    "description": "Monthly submission summary report",
    "reference_id": "MS00001234",
    "dashboard_id": "a3b4c5d6-e7f8-9012-6789-123456789012",
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
  "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "is_public": false
}`,
      curlExample: `curl -X POST '${BASE_URL}/reports' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "New Monthly Report",
    "description": "Monthly metrics summary",
    "project_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "is_public": false
  }'`,
      jsExample: `const response = await fetch('${BASE_URL}/reports', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'New Monthly Report',
    description: 'Monthly metrics summary',
    project_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    is_public: false
  })
});
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "b4c5d6e7-f8a9-0123-7890-234567890123",
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
      curlExample: `curl -X PUT '${BASE_URL}/reports/MS00001234' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Updated Report Name",
    "is_public": true
  }'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/reports/MS00001234',
  {
    method: 'PUT',
    headers: {
      'x-api-key': 'tsk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Updated Report Name',
      is_public: true
    })
  }
);
const data = await response.json();
console.log(data);`,
      responseExample: `{
  "data": {
    "id": "f2a3b4c5-d6e7-8901-5678-012345678901",
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
      curlExample: `curl -X DELETE '${BASE_URL}/reports/MS00001234' \\
  -H 'x-api-key: tsk_your_api_key_here'`,
      jsExample: `const response = await fetch(
  '${BASE_URL}/reports/MS00001234',
  {
    method: 'DELETE',
    headers: { 'x-api-key': 'tsk_your_api_key_here' }
  }
);
const data = await response.json();
console.log(data);`,
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
                  <h4 className="text-sm font-semibold">Request Body</h4>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(endpoint.requestExample!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs">
                  {endpoint.requestExample}
                </pre>
              </div>
            )}

            {/* Code Examples with Tabs */}
            {(endpoint.curlExample || endpoint.jsExample) && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Code Examples</h4>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="mb-2">
                    {endpoint.curlExample && <TabsTrigger value="curl">cURL</TabsTrigger>}
                    {endpoint.jsExample && <TabsTrigger value="javascript">JavaScript</TabsTrigger>}
                  </TabsList>
                  {endpoint.curlExample && (
                    <TabsContent value="curl">
                      <div className="relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2 z-10"
                          onClick={() => handleCopy(endpoint.curlExample!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs">
                          {endpoint.curlExample}
                        </pre>
                      </div>
                    </TabsContent>
                  )}
                  {endpoint.jsExample && (
                    <TabsContent value="javascript">
                      <div className="relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2 z-10"
                          onClick={() => handleCopy(endpoint.jsExample!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs">
                          {endpoint.jsExample}
                        </pre>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
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

            {endpoint.notes && endpoint.notes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Notes</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {endpoint.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
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
              <Button
                variant={activeSection === 'request-format' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('request-format')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Request Format
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
              <Separator className="my-2" />
              <Button
                variant={activeSection === 'bulk-operations' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('bulk-operations')}
              >
                <Layers className="h-4 w-4 mr-2" />
                Bulk Operations
              </Button>
              <Separator className="my-2" />
              <Button
                variant={activeSection === 'rate-limiting' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('rate-limiting')}
              >
                <Clock className="h-4 w-4 mr-2" />
                Rate Limiting
              </Button>
              <Button
                variant={activeSection === 'pagination' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('pagination')}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Pagination
              </Button>
              <Button
                variant={activeSection === 'error-reference' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('error-reference')}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Error Reference
              </Button>
              <Button
                variant={activeSection === 'versioning' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('versioning')}
              >
                <Zap className="h-4 w-4 mr-2" />
                Versioning
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

            {activeSection === 'request-format' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Request & Response Format</CardTitle>
                    <CardDescription>
                      All API requests and responses use JSON format
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Content-Type Header</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        For all <code className="bg-muted px-1 rounded">POST</code>, <code className="bg-muted px-1 rounded">PUT</code>, and <code className="bg-muted px-1 rounded">PATCH</code> requests, you must include the Content-Type header:
                      </p>
                      <code className="block p-3 bg-muted rounded-md text-sm">
                        Content-Type: application/json
                      </code>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Request Body Format</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        All request bodies must be valid JSON. Invalid JSON will result in a <code className="bg-muted px-1 rounded">400 Bad Request</code> error.
                      </p>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`// ✅ Valid JSON request body
{
  "name": "My Form",
  "description": "A sample form",
  "status": "active"
}

// ❌ Invalid - trailing comma
{
  "name": "My Form",
  "status": "active",
}

// ❌ Invalid - single quotes
{
  'name': 'My Form'
}`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Response Format</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        All API responses are returned in JSON format with a consistent structure:
                      </p>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`// Success response
{
  "data": { ... },      // The requested data
  "message": "...",     // Optional success message
  "count": 10,          // Optional count for list endpoints
  "limit": 100,         // Optional pagination info
  "offset": 0           // Optional pagination info
}

// Error response
{
  "error": "Error code",
  "message": "Human-readable error description",
  "details": { ... }    // Optional additional details
}`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Required Headers Summary</h3>
                      <div className="bg-muted rounded-md p-3 space-y-2">
                        <div className="text-sm">
                          <code className="text-primary">x-api-key</code>
                          <Badge variant="destructive" className="ml-2 text-xs">required</Badge>
                          <span className="ml-2">- Your API key for authentication</span>
                        </div>
                        <div className="text-sm">
                          <code className="text-primary">Content-Type: application/json</code>
                          <Badge variant="outline" className="ml-2 text-xs">POST/PUT/PATCH</Badge>
                          <span className="ml-2">- Required for requests with body</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Example: Complete POST Request</h3>
                      <Tabs defaultValue="curl" className="w-full">
                        <TabsList className="mb-2">
                          <TabsTrigger value="curl">cURL</TabsTrigger>
                          <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                        </TabsList>
                        <TabsContent value="curl">
                          <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`curl -X POST '${BASE_URL}/submissions' \\
  -H 'x-api-key: tsk_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "form_ref_id": "CF00001234",
    "use_labels": true,
    "submission_data": {
      "Full Name": "John Doe",
      "Email": "john@example.com"
    }
  }'`}
                          </pre>
                        </TabsContent>
                        <TabsContent value="javascript">
                          <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`const response = await fetch('${BASE_URL}/submissions', {
  method: 'POST',
  headers: {
    'x-api-key': 'tsk_your_api_key_here',
    'Content-Type': 'application/json'  // Required!
  },
  body: JSON.stringify({
    form_ref_id: 'CF00001234',
    use_labels: true,
    submission_data: {
      'Full Name': 'John Doe',
      'Email': 'john@example.com'
    }
  })
});

const data = await response.json();
console.log(data);`}
                          </pre>
                        </TabsContent>
                      </Tabs>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Common JSON Errors</h3>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive">400</Badge>
                          <div className="text-sm">
                            <span className="font-medium">Invalid JSON body</span>
                            <span className="text-muted-foreground"> - Syntax error in your JSON (missing quotes, trailing commas, etc.)</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive">400</Badge>
                          <div className="text-sm">
                            <span className="font-medium">Missing required field</span>
                            <span className="text-muted-foreground"> - A required field is not present in the request body</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive">415</Badge>
                          <div className="text-sm">
                            <span className="font-medium">Unsupported Media Type</span>
                            <span className="text-muted-foreground"> - Missing or incorrect Content-Type header</span>
                          </div>
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

            {activeSection === 'bulk-operations' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Bulk Operations
                </h2>
                <p className="text-muted-foreground">
                  Perform batch operations on multiple records at once. These endpoints allow you to create, update, or delete 
                  up to 100 records in a single API request, improving efficiency for large-scale data operations.
                </p>
                {endpoints.bulkOperations.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </div>
            )}

            {activeSection === 'rate-limiting' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Rate Limiting
                    </CardTitle>
                    <CardDescription>
                      Understand API rate limits and how to handle them
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Default Rate Limits</h3>
                      <div className="bg-muted rounded-md p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Standard API Keys</span>
                          <Badge>100 requests/minute</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Custom Configured Keys</span>
                          <Badge variant="outline">As configured</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Bulk Operations</span>
                          <Badge variant="secondary">10 requests/minute</Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Rate Limit Headers</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Each API response includes headers to help you track your rate limit status:
                      </p>
                      <div className="bg-muted rounded-md p-3 space-y-2 text-sm">
                        <div>
                          <code className="text-primary">X-RateLimit-Limit</code>
                          <span className="text-muted-foreground ml-2">- Maximum requests allowed per window</span>
                        </div>
                        <div>
                          <code className="text-primary">X-RateLimit-Remaining</code>
                          <span className="text-muted-foreground ml-2">- Requests remaining in current window</span>
                        </div>
                        <div>
                          <code className="text-primary">X-RateLimit-Reset</code>
                          <span className="text-muted-foreground ml-2">- Unix timestamp when the window resets</span>
                        </div>
                        <div>
                          <code className="text-primary">Retry-After</code>
                          <span className="text-muted-foreground ml-2">- Seconds to wait (only on 429 responses)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Handling Rate Limits</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        When you exceed the rate limit, you'll receive a <code className="bg-muted px-1 rounded">429 Too Many Requests</code> response:
                      </p>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please retry after 45 seconds.",
  "retryAfter": 45
}`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Best Practices</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Implement exponential backoff when retrying failed requests</li>
                        <li>Use bulk endpoints instead of multiple single requests</li>
                        <li>Cache responses where appropriate to reduce API calls</li>
                        <li>Monitor <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code> to avoid hitting limits</li>
                        <li>Contact support if you need higher rate limits for production use</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Retry Example (JavaScript)</h3>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(\`Rate limited. Retrying in \${retryAfter}s...\`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'pagination' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Pagination
                    </CardTitle>
                    <CardDescription>
                      Navigate through large datasets efficiently
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Offset-Based Pagination</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        All list endpoints support offset-based pagination using <code className="bg-muted px-1 rounded">limit</code> and <code className="bg-muted px-1 rounded">offset</code> parameters:
                      </p>
                      <div className="bg-muted rounded-md p-3 space-y-2 text-sm">
                        <div>
                          <code className="text-primary">limit</code>
                          <span className="text-muted-foreground ml-2">- Number of records per page (default: 100, max: 1000)</span>
                        </div>
                        <div>
                          <code className="text-primary">offset</code>
                          <span className="text-muted-foreground ml-2">- Number of records to skip (default: 0)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Pagination Example</h3>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`// First page (records 1-100)
GET /submissions?limit=100&offset=0

// Second page (records 101-200)
GET /submissions?limit=100&offset=100

// Third page (records 201-300)
GET /submissions?limit=100&offset=200`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Response Metadata</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Paginated responses include metadata to help navigate:
                      </p>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`{
  "data": [...],
  "count": 50,      // Records returned in this response
  "total": 1250,    // Total records matching the query
  "limit": 100,     // Requested limit
  "offset": 0       // Current offset
}`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Iterating All Records (JavaScript)</h3>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`async function fetchAllSubmissions(formId) {
  const allRecords = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(
      \`\${BASE_URL}/submissions?form_id=\${formId}&limit=\${limit}&offset=\${offset}\`,
      { headers: { 'x-api-key': API_KEY } }
    );
    const { data, total } = await response.json();
    
    allRecords.push(...data);
    offset += limit;
    
    if (offset >= total) break;
  }
  
  return allRecords;
}`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Performance Tips</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Use filters to reduce the dataset before paginating</li>
                        <li>Request only the page sizes you need (smaller limits = faster responses)</li>
                        <li>For very large datasets, consider using date-based filtering</li>
                        <li>Cache pages when building UI pagination</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'error-reference' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Error Reference
                    </CardTitle>
                    <CardDescription>
                      Complete list of error codes and their meanings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">HTTP Status Codes</h3>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">200</Badge>
                          <div>
                            <span className="font-medium">OK</span>
                            <p className="text-sm text-muted-foreground">Request succeeded. Response contains data.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">201</Badge>
                          <div>
                            <span className="font-medium">Created</span>
                            <p className="text-sm text-muted-foreground">Resource created successfully.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">202</Badge>
                          <div>
                            <span className="font-medium">Accepted</span>
                            <p className="text-sm text-muted-foreground">Request accepted for async processing (e.g., workflow trigger).</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">400</Badge>
                          <div>
                            <span className="font-medium">Bad Request</span>
                            <p className="text-sm text-muted-foreground">Invalid JSON, missing required fields, or validation failed.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">401</Badge>
                          <div>
                            <span className="font-medium">Unauthorized</span>
                            <p className="text-sm text-muted-foreground">Missing or invalid API key.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">403</Badge>
                          <div>
                            <span className="font-medium">Forbidden</span>
                            <p className="text-sm text-muted-foreground">API key lacks required permissions or IP is blocked.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">404</Badge>
                          <div>
                            <span className="font-medium">Not Found</span>
                            <p className="text-sm text-muted-foreground">Resource doesn't exist or you don't have access.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">415</Badge>
                          <div>
                            <span className="font-medium">Unsupported Media Type</span>
                            <p className="text-sm text-muted-foreground">Missing Content-Type: application/json header.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">429</Badge>
                          <div>
                            <span className="font-medium">Too Many Requests</span>
                            <p className="text-sm text-muted-foreground">Rate limit exceeded. Check Retry-After header.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                          <Badge variant="destructive">500</Badge>
                          <div>
                            <span className="font-medium">Internal Server Error</span>
                            <p className="text-sm text-muted-foreground">Server error. Please retry or contact support.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Error Codes</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Code</th>
                              <th className="text-left p-2">HTTP Status</th>
                              <th className="text-left p-2">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="p-2"><code>INVALID_API_KEY</code></td>
                              <td className="p-2">401</td>
                              <td className="p-2 text-muted-foreground">API key is malformed or doesn't exist</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>API_KEY_EXPIRED</code></td>
                              <td className="p-2">401</td>
                              <td className="p-2 text-muted-foreground">API key has expired</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>API_KEY_INACTIVE</code></td>
                              <td className="p-2">401</td>
                              <td className="p-2 text-muted-foreground">API key has been deactivated</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>INSUFFICIENT_PERMISSIONS</code></td>
                              <td className="p-2">403</td>
                              <td className="p-2 text-muted-foreground">API key lacks required permission scope</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>IP_NOT_ALLOWED</code></td>
                              <td className="p-2">403</td>
                              <td className="p-2 text-muted-foreground">Request IP not in whitelist</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>RESOURCE_NOT_FOUND</code></td>
                              <td className="p-2">404</td>
                              <td className="p-2 text-muted-foreground">Requested resource doesn't exist</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>VALIDATION_ERROR</code></td>
                              <td className="p-2">400</td>
                              <td className="p-2 text-muted-foreground">Request body failed validation</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>INVALID_JSON</code></td>
                              <td className="p-2">400</td>
                              <td className="p-2 text-muted-foreground">Request body is not valid JSON</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>RATE_LIMIT_EXCEEDED</code></td>
                              <td className="p-2">429</td>
                              <td className="p-2 text-muted-foreground">Too many requests in time window</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>BULK_LIMIT_EXCEEDED</code></td>
                              <td className="p-2">400</td>
                              <td className="p-2 text-muted-foreground">Bulk operation exceeds 100 record limit</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Error Response Structure</h3>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "fields": {
      "name": "Name is required",
      "email": "Invalid email format"
    }
  }
}`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'versioning' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      API Versioning
                    </CardTitle>
                    <CardDescription>
                      Version information and compatibility guidelines
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Current Version</h3>
                      <div className="flex items-center gap-3">
                        <Badge className="text-lg px-3 py-1">v1</Badge>
                        <span className="text-sm text-muted-foreground">Released January 2025</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Versioning Strategy</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        The API version is currently implicit in the base URL. Future major versions will use URL path versioning:
                      </p>
                      <div className="bg-muted rounded-md p-3 space-y-1 text-sm font-mono">
                        <div><span className="text-green-600">Current:</span> {BASE_URL}</div>
                        <div><span className="text-muted-foreground">Future:</span> {BASE_URL.replace('/public-api', '/v2/public-api')}</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Backward Compatibility</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>New fields may be added to responses without version change</li>
                        <li>Existing fields will not be removed without major version bump</li>
                        <li>New optional parameters may be added to endpoints</li>
                        <li>Required parameters will not be added without version change</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Deprecation Policy</h3>
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          When features are deprecated, we provide at least <strong>6 months notice</strong> before removal. 
                          Deprecated features will be marked in the documentation and return a 
                          <code className="bg-amber-100 dark:bg-amber-900 px-1 mx-1 rounded">X-Deprecated</code> header.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Changelog</h3>
                      <div className="space-y-3">
                        <div className="border-l-2 border-primary pl-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">v1.0</Badge>
                            <span className="text-sm text-muted-foreground">January 2025</span>
                          </div>
                          <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                            <li>• Initial public API release</li>
                            <li>• Forms, Submissions, Workflows, Reports CRUD</li>
                            <li>• Bulk operations support</li>
                            <li>• API key authentication with granular permissions</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Stay Updated</h3>
                      <p className="text-sm text-muted-foreground">
                        Subscribe to API updates and changelog notifications through your organization's settings. 
                        Major changes will be announced via email to all API key owners.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;