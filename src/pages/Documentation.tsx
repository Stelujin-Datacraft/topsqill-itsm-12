import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Book, Code, Database, FileText, Menu, X } from 'lucide-react';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { ApiEndpoint, ApiEndpointProps, ErrorResponse } from '@/components/docs/ApiEndpoint';
import { CodeBlock } from '@/components/docs/CodeBlock';

const BASE_URL = 'https://fnmkczsvwpzpxyklztkt.supabase.co/functions/v1/form-api';

// Sidebar navigation structure
const sidebarSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      { id: 'introduction', title: 'Introduction' },
      { id: 'authentication', title: 'Authentication' },
      { id: 'response-format', title: 'Response Format' },
      { id: 'error-handling', title: 'Error Handling' },
    ],
  },
  {
    id: 'forms',
    title: 'Forms',
    items: [
      { id: 'list-forms', title: 'List Forms', method: 'GET' as const },
      { id: 'get-form', title: 'Get Form', method: 'GET' as const },
      { id: 'get-form-fields', title: 'Get Form Fields', method: 'GET' as const },
      { id: 'get-form-schema', title: 'Get Form Schema', method: 'GET' as const },
    ],
  },
  {
    id: 'records',
    title: 'Records (Submissions)',
    items: [
      { id: 'list-records', title: 'List Records', method: 'GET' as const },
      { id: 'create-record', title: 'Create Record', method: 'POST' as const },
      { id: 'get-record', title: 'Get Record', method: 'GET' as const },
      { id: 'update-record', title: 'Update Record', method: 'PUT' as const },
      { id: 'patch-record', title: 'Partial Update', method: 'PATCH' as const },
      { id: 'delete-record', title: 'Delete Record', method: 'DELETE' as const },
    ],
  },
  {
    id: 'bulk',
    title: 'Bulk Operations',
    items: [
      { id: 'bulk-create', title: 'Bulk Create', method: 'POST' as const },
      { id: 'bulk-delete', title: 'Bulk Delete', method: 'DELETE' as const },
    ],
  },
  {
    id: 'utility',
    title: 'Utility',
    items: [
      { id: 'count-records', title: 'Count Records', method: 'GET' as const },
      { id: 'validate-data', title: 'Validate Data', method: 'POST' as const },
    ],
  },
];

// Common errors
const commonErrors: ErrorResponse[] = [
  { code: 'FORM_NOT_FOUND', status: 404, description: 'Form with given ID or reference_id not found' },
  { code: 'RECORD_NOT_FOUND', status: 404, description: 'Record with given ID or submission_ref_id not found' },
  { code: 'VALIDATION_ERROR', status: 400, description: 'Required fields are missing or validation failed' },
  { code: 'INVALID_INPUT', status: 400, description: 'Request body structure is invalid' },
  { code: 'LIMIT_EXCEEDED', status: 400, description: 'Bulk operation limit exceeded (max 100 records)' },
  { code: 'FETCH_ERROR', status: 500, description: 'Database fetch operation failed' },
  { code: 'CREATE_ERROR', status: 500, description: 'Database insert operation failed' },
  { code: 'UPDATE_ERROR', status: 500, description: 'Database update operation failed' },
  { code: 'DELETE_ERROR', status: 500, description: 'Database delete operation failed' },
  { code: 'INTERNAL_ERROR', status: 500, description: 'Unexpected server error' },
];

// API Endpoints data
const endpoints: ApiEndpointProps[] = [
  // Forms endpoints
  {
    id: 'list-forms',
    method: 'GET',
    path: '/forms',
    title: 'List All Forms',
    description: 'Retrieve a paginated list of all forms accessible via the API.',
    authenticated: false,
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number for pagination', default: '1' },
      { name: 'limit', type: 'number', required: false, description: 'Number of records per page (max 100)', default: '50' },
      { name: 'status', type: 'string', required: false, description: 'Filter by form status (active, draft, archived)' },
      { name: 'search', type: 'string', required: false, description: 'Search forms by name' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms?page=1&limit=10'`,
    jsExample: `const response = await fetch('${BASE_URL}/forms?page=1&limit=10');
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Customer Feedback Form",
      "reference_id": "customer-feedback-form",
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}`,
    errors: [
      { code: 'FETCH_ERROR', status: 500, description: 'Failed to fetch forms from database' },
    ],
    notes: [
      'Returns forms sorted by created_at descending (newest first)',
      'Maximum limit is 100 records per request',
    ],
  },
  {
    id: 'get-form',
    method: 'GET',
    path: '/forms/:formId',
    title: 'Get Form Details',
    description: 'Retrieve detailed information about a specific form by its UUID or reference_id.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id (e.g., "customer-feedback-form")' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form'`,
    jsExample: `const response = await fetch('${BASE_URL}/forms/customer-feedback-form');
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Customer Feedback Form",
    "reference_id": "customer-feedback-form",
    "description": "Collect customer feedback",
    "status": "active",
    "is_public": true,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found with given ID or reference' },
    ],
    notes: [
      'You can use either the UUID or the human-readable reference_id',
      'Reference IDs are auto-generated from the form name and are unique',
    ],
  },
  {
    id: 'get-form-fields',
    method: 'GET',
    path: '/forms/:formId/fields',
    title: 'Get Form Fields',
    description: 'Retrieve all field definitions for a form including validation rules and options.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form/fields'`,
    jsExample: `const response = await fetch('${BASE_URL}/forms/customer-feedback-form/fields');
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "field-uuid-1",
      "label": "Full Name",
      "field_type": "text",
      "required": true,
      "field_order": 1,
      "placeholder": "Enter your name",
      "validation": { "minLength": 2, "maxLength": 100 }
    },
    {
      "id": "field-uuid-2",
      "label": "Rating",
      "field_type": "select",
      "required": true,
      "field_order": 2,
      "options": ["Excellent", "Good", "Average", "Poor"]
    }
  ]
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
    ],
    notes: [
      'Fields are returned in order by field_order',
      'Use these field IDs when submitting data, or set useLabels: true to use labels instead',
    ],
  },
  {
    id: 'get-form-schema',
    method: 'GET',
    path: '/forms/:formId/schema',
    title: 'Get Form Schema',
    description: 'Retrieve the complete form structure including form metadata and all fields. Useful for rendering forms dynamically.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form/schema'`,
    jsExample: `const response = await fetch('${BASE_URL}/forms/customer-feedback-form/schema');
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": {
    "form": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Customer Feedback Form",
      "reference_id": "customer-feedback-form",
      "description": "Collect customer feedback"
    },
    "fields": [
      {
        "id": "field-uuid-1",
        "label": "Full Name",
        "field_type": "text",
        "required": true
      }
    ]
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
    ],
    notes: [
      'This endpoint is ideal for building dynamic form renderers',
      'Contains both form metadata and field definitions in a single request',
    ],
  },

  // Records endpoints
  {
    id: 'list-records',
    method: 'GET',
    path: '/forms/:formId/records',
    title: 'List Form Records',
    description: 'Retrieve a paginated list of all submissions for a form with optional filtering and sorting.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number', default: '1' },
      { name: 'limit', type: 'number', required: false, description: 'Records per page (max 100)', default: '50' },
      { name: 'sort', type: 'string', required: false, description: 'Field to sort by', default: 'submitted_at' },
      { name: 'order', type: 'string', required: false, description: 'Sort order: asc or desc', default: 'desc' },
      { name: 'filter', type: 'string', required: false, description: 'JSON encoded filter object for submission_data fields' },
      { name: 'approval_status', type: 'string', required: false, description: 'Filter by approval status' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form/records?page=1&limit=20&sort=submitted_at&order=desc'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records?page=1&limit=20'
);
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "record-uuid-1",
      "submission_ref_id": "SUB-0001",
      "submission_data": {
        "field-uuid-1": "John Doe",
        "field-uuid-2": "Excellent"
      },
      "submitted_at": "2025-01-15T10:30:00Z",
      "approval_status": "approved"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'FETCH_ERROR', status: 500, description: 'Failed to fetch records' },
    ],
    notes: [
      'Use the filter parameter for advanced filtering on submission data fields',
      'Filter format: {"fieldId": "value"} or {"fieldLabel": "value"} if using labels',
    ],
  },
  {
    id: 'create-record',
    method: 'POST',
    path: '/forms/:formId/records',
    title: 'Create a Record',
    description: 'Create a new submission record for a form. You can use field IDs or labels for the data.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    bodyParams: [
      { name: 'data', type: 'object', required: true, description: 'Field values as key-value pairs (fieldId or label -> value)' },
      { name: 'useLabels', type: 'boolean', required: false, description: 'If true, data keys are field labels instead of IDs', default: 'false' },
      { name: 'validate', type: 'boolean', required: false, description: 'Skip validation if false', default: 'true' },
      { name: 'submitted_by', type: 'string', required: false, description: 'User ID of the submitter' },
      { name: 'approval_status', type: 'string', required: false, description: 'Initial approval status', default: 'pending' },
    ],
    requestExample: `{
  "useLabels": true,
  "data": {
    "Full Name": "John Doe",
    "Email": "john@example.com",
    "Rating": "Excellent"
  }
}`,
    curlExample: `curl -X POST '${BASE_URL}/forms/customer-feedback-form/records' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "useLabels": true,
    "data": {
      "Full Name": "John Doe",
      "Rating": "Excellent"
    }
  }'`,
    jsExample: `const response = await fetch('${BASE_URL}/forms/customer-feedback-form/records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useLabels: true,
    data: {
      'Full Name': 'John Doe',
      'Rating': 'Excellent'
    }
  })
});
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "new-record-uuid",
    "form_id": "form-uuid",
    "submission_ref_id": "SUB-0001",
    "submission_data": {
      "field-uuid-1": "John Doe",
      "field-uuid-2": "Excellent"
    },
    "submitted_at": "2025-01-15T10:30:00Z",
    "approval_status": "pending"
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'VALIDATION_ERROR', status: 400, description: 'Required fields missing' },
      { code: 'CREATE_ERROR', status: 500, description: 'Failed to create record' },
    ],
    notes: [
      'Set useLabels: true to use field labels (e.g., "Full Name") instead of field UUIDs',
      'The submission_ref_id is auto-generated based on the form reference_id',
      'Validation checks required fields by default; set validate: false to skip',
    ],
  },
  {
    id: 'get-record',
    method: 'GET',
    path: '/forms/:formId/records/:recordId',
    title: 'Get a Record',
    description: 'Retrieve a specific submission record by its UUID or submission_ref_id.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
      { name: 'recordId', type: 'string', required: true, description: 'Record UUID or submission_ref_id (e.g., "SUB-0001")' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001'
);
const data = await response.json();
console.log(data);`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "record-uuid",
    "submission_ref_id": "SUB-0001",
    "submission_data": {
      "field-uuid-1": "John Doe",
      "field-uuid-2": "Excellent"
    },
    "submitted_at": "2025-01-15T10:30:00Z",
    "approval_status": "approved"
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'RECORD_NOT_FOUND', status: 404, description: 'Record not found' },
    ],
    notes: [
      'You can use either the UUID or the human-readable submission_ref_id',
    ],
  },
  {
    id: 'update-record',
    method: 'PUT',
    path: '/forms/:formId/records/:recordId',
    title: 'Update a Record (Full)',
    description: 'Fully replace the submission data for a record. All fields must be provided.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
      { name: 'recordId', type: 'string', required: true, description: 'Record UUID or submission_ref_id' },
    ],
    bodyParams: [
      { name: 'data', type: 'object', required: true, description: 'Complete field values (replaces existing data)' },
      { name: 'useLabels', type: 'boolean', required: false, description: 'If true, data keys are field labels', default: 'false' },
      { name: 'approval_status', type: 'string', required: false, description: 'Update approval status' },
      { name: 'approval_notes', type: 'string', required: false, description: 'Add approval notes' },
    ],
    requestExample: `{
  "useLabels": true,
  "data": {
    "Full Name": "Jane Doe",
    "Email": "jane@example.com",
    "Rating": "Good"
  },
  "approval_status": "approved"
}`,
    curlExample: `curl -X PUT '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "useLabels": true,
    "data": {
      "Full Name": "Jane Doe",
      "Rating": "Good"
    }
  }'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      useLabels: true,
      data: {
        'Full Name': 'Jane Doe',
        'Rating': 'Good'
      }
    })
  }
);`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "record-uuid",
    "submission_data": {
      "field-uuid-1": "Jane Doe",
      "field-uuid-2": "Good"
    },
    "approval_status": "approved"
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'RECORD_NOT_FOUND', status: 404, description: 'Record not found' },
      { code: 'UPDATE_ERROR', status: 500, description: 'Failed to update record' },
    ],
    notes: [
      'PUT replaces all submission_data; omitted fields will be removed',
      'Use PATCH for partial updates that preserve existing fields',
    ],
  },
  {
    id: 'patch-record',
    method: 'PATCH',
    path: '/forms/:formId/records/:recordId',
    title: 'Partial Update a Record',
    description: 'Partially update a record. Only provided fields are updated; others are preserved.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
      { name: 'recordId', type: 'string', required: true, description: 'Record UUID or submission_ref_id' },
    ],
    bodyParams: [
      { name: 'data', type: 'object', required: true, description: 'Fields to update (merged with existing data)' },
      { name: 'useLabels', type: 'boolean', required: false, description: 'If true, data keys are field labels', default: 'false' },
      { name: 'approval_status', type: 'string', required: false, description: 'Update approval status' },
    ],
    requestExample: `{
  "useLabels": true,
  "data": {
    "Rating": "Excellent"
  }
}`,
    curlExample: `curl -X PATCH '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "useLabels": true,
    "data": { "Rating": "Excellent" }
  }'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001',
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      useLabels: true,
      data: { Rating: 'Excellent' }
    })
  }
);`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "record-uuid",
    "submission_data": {
      "field-uuid-1": "John Doe",
      "field-uuid-2": "Excellent"
    }
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'RECORD_NOT_FOUND', status: 404, description: 'Record not found' },
      { code: 'UPDATE_ERROR', status: 500, description: 'Failed to update record' },
    ],
    notes: [
      'PATCH merges data with existing submission_data using JSONB concatenation',
      'Existing fields not included in the request are preserved',
    ],
  },
  {
    id: 'delete-record',
    method: 'DELETE',
    path: '/forms/:formId/records/:recordId',
    title: 'Delete a Record',
    description: 'Permanently delete a submission record.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
      { name: 'recordId', type: 'string', required: true, description: 'Record UUID or submission_ref_id' },
    ],
    curlExample: `curl -X DELETE '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/SUB-0001',
  { method: 'DELETE' }
);`,
    responseExample: `{
  "success": true,
  "message": "Record deleted successfully"
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'RECORD_NOT_FOUND', status: 404, description: 'Record not found' },
      { code: 'DELETE_ERROR', status: 500, description: 'Failed to delete record' },
    ],
    notes: [
      'This action is permanent and cannot be undone',
      'Associated workflow executions may also be affected',
    ],
  },

  // Bulk operations
  {
    id: 'bulk-create',
    method: 'POST',
    path: '/forms/:formId/records/bulk',
    title: 'Bulk Create Records',
    description: 'Create multiple submission records in a single request. Maximum 100 records per request.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    bodyParams: [
      { name: 'records', type: 'array', required: true, description: 'Array of record objects (max 100)' },
      { name: 'useLabels', type: 'boolean', required: false, description: 'If true, data keys are field labels', default: 'false' },
      { name: 'validate', type: 'boolean', required: false, description: 'Validate all records before insert', default: 'true' },
    ],
    requestExample: `{
  "useLabels": true,
  "records": [
    { "Full Name": "John Doe", "Rating": "Excellent" },
    { "Full Name": "Jane Smith", "Rating": "Good" },
    { "Full Name": "Bob Wilson", "Rating": "Average" }
  ]
}`,
    curlExample: `curl -X POST '${BASE_URL}/forms/customer-feedback-form/records/bulk' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "useLabels": true,
    "records": [
      { "Full Name": "John Doe", "Rating": "Excellent" },
      { "Full Name": "Jane Smith", "Rating": "Good" }
    ]
  }'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/bulk',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      useLabels: true,
      records: [
        { 'Full Name': 'John Doe', Rating: 'Excellent' },
        { 'Full Name': 'Jane Smith', Rating: 'Good' }
      ]
    })
  }
);`,
    responseExample: `{
  "success": true,
  "data": {
    "created": 2,
    "records": [
      { "id": "uuid-1", "submission_ref_id": "SUB-0001" },
      { "id": "uuid-2", "submission_ref_id": "SUB-0002" }
    ]
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'LIMIT_EXCEEDED', status: 400, description: 'More than 100 records in request' },
      { code: 'VALIDATION_ERROR', status: 400, description: 'One or more records failed validation' },
      { code: 'CREATE_ERROR', status: 500, description: 'Failed to create records' },
    ],
    notes: [
      'Maximum 100 records per request',
      'All records are validated before any are inserted (atomic operation)',
      'If validation fails, error response includes details for each failed record',
    ],
  },
  {
    id: 'bulk-delete',
    method: 'DELETE',
    path: '/forms/:formId/records/bulk',
    title: 'Bulk Delete Records',
    description: 'Delete multiple submission records in a single request.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    bodyParams: [
      { name: 'ids', type: 'array', required: true, description: 'Array of record UUIDs or submission_ref_ids to delete' },
    ],
    requestExample: `{
  "ids": ["SUB-0001", "SUB-0002", "SUB-0003"]
}`,
    curlExample: `curl -X DELETE '${BASE_URL}/forms/customer-feedback-form/records/bulk' \\
  -H 'Content-Type: application/json' \\
  -d '{ "ids": ["SUB-0001", "SUB-0002"] }'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/bulk',
  {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: ['SUB-0001', 'SUB-0002']
    })
  }
);`,
    responseExample: `{
  "success": true,
  "data": {
    "deleted": 2
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
      { code: 'LIMIT_EXCEEDED', status: 400, description: 'More than 100 IDs in request' },
      { code: 'DELETE_ERROR', status: 500, description: 'Failed to delete records' },
    ],
    notes: [
      'Maximum 100 records per request',
      'Non-existent IDs are silently ignored',
      'This action is permanent and cannot be undone',
    ],
  },

  // Utility endpoints
  {
    id: 'count-records',
    method: 'GET',
    path: '/forms/:formId/records/count',
    title: 'Count Records',
    description: 'Get the total count of records for a form, optionally filtered.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    queryParams: [
      { name: 'filter', type: 'string', required: false, description: 'JSON encoded filter object' },
      { name: 'approval_status', type: 'string', required: false, description: 'Filter by approval status' },
    ],
    curlExample: `curl -X GET '${BASE_URL}/forms/customer-feedback-form/records/count'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/records/count'
);
const data = await response.json();
console.log(data.data.count); // e.g., 150`,
    responseExample: `{
  "success": true,
  "data": {
    "count": 150
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
    ],
    notes: [
      'Useful for building pagination without fetching all records',
      'Same filter syntax as the list records endpoint',
    ],
  },
  {
    id: 'validate-data',
    method: 'POST',
    path: '/forms/:formId/validate',
    title: 'Validate Data',
    description: 'Validate submission data against form field requirements without creating a record.',
    authenticated: false,
    pathParams: [
      { name: 'formId', type: 'string', required: true, description: 'Form UUID or reference_id' },
    ],
    bodyParams: [
      { name: 'data', type: 'object', required: true, description: 'Field values to validate' },
      { name: 'useLabels', type: 'boolean', required: false, description: 'If true, data keys are field labels', default: 'false' },
    ],
    requestExample: `{
  "useLabels": true,
  "data": {
    "Full Name": "John Doe"
  }
}`,
    curlExample: `curl -X POST '${BASE_URL}/forms/customer-feedback-form/validate' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "useLabels": true,
    "data": { "Full Name": "John Doe" }
  }'`,
    jsExample: `const response = await fetch(
  '${BASE_URL}/forms/customer-feedback-form/validate',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      useLabels: true,
      data: { 'Full Name': 'John Doe' }
    })
  }
);`,
    responseExample: `{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "field": "Rating",
        "fieldId": "field-uuid-2",
        "message": "This field is required"
      }
    ]
  }
}`,
    errors: [
      { code: 'FORM_NOT_FOUND', status: 404, description: 'Form not found' },
    ],
    notes: [
      'Use this to pre-validate data before submission',
      'Returns detailed error messages for each invalid field',
      'Does not create any database records',
    ],
  },
];

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('introduction');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = 'API Documentation - Topsqill';
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden mr-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to="/" className="flex items-center gap-2 mr-6">
            <ArrowLeft className="h-4 w-4" />
            <img 
              src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png" 
              alt="Topsqill" 
              className="h-8 w-8"
            />
            <span className="font-semibold">Topsqill</span>
          </Link>
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">API Documentation</span>
          </div>
          <div className="ml-auto">
            <Badge variant="secondary">v1.0</Badge>
          </div>
        </div>
      </header>

      <div className="container flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-background border-r pt-14 transform transition-transform md:relative md:translate-x-0 md:pt-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <DocsSidebar
            sections={sidebarSections}
            activeSection={activeSection}
            onSectionClick={scrollToSection}
          />
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 py-6 px-4 md:px-8 max-w-4xl">
          {/* Introduction */}
          <section id="introduction" className="mb-12 scroll-mt-20">
            <h1 className="text-3xl font-bold mb-4">Form API Documentation</h1>
            <p className="text-lg text-muted-foreground mb-6">
              The Topsqill Form API allows you to programmatically access and manage forms and their submissions.
              This RESTful API supports all CRUD operations with flexible filtering, pagination, and sorting.
            </p>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Base URL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={BASE_URL} />
              </CardContent>
            </Card>
          </section>

          {/* Authentication */}
          <section id="authentication" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-4">Authentication</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-1">Public API</Badge>
                  <div>
                    <p className="text-muted-foreground">
                      The Form API is currently <strong>public</strong> and does not require authentication.
                      All endpoints can be accessed without an API key or bearer token.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      <em>Note: Authentication may be added in future versions for enhanced security.</em>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Response Format */}
          <section id="response-format" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-4">Response Format</h2>
            <p className="text-muted-foreground mb-4">
              All API responses follow a consistent JSON structure:
            </p>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Success Response</h4>
                <CodeBlock
                  code={`{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}`}
                  language="json"
                />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Error Response</h4>
                <CodeBlock
                  code={`{
  "success": false,
  "error": {
    "code": "FORM_NOT_FOUND",
    "message": "Form with ID 'xxx' not found"
  }
}`}
                  language="json"
                />
              </div>
            </div>
          </section>

          {/* Error Handling */}
          <section id="error-handling" className="mb-12 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-4">Error Handling</h2>
            <p className="text-muted-foreground mb-4">
              The API uses standard HTTP status codes and returns detailed error information:
            </p>
            
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {commonErrors.map((error) => (
                    <tr key={error.code} className="border-t">
                      <td className="p-3">
                        <Badge variant={error.status >= 500 ? 'destructive' : 'outline'} className="text-xs">
                          {error.status}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{error.code}</td>
                      <td className="p-3 text-muted-foreground">{error.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Separator className="my-12" />

          {/* Forms Endpoints */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Forms Endpoints
            </h2>
            <div className="space-y-4">
              {endpoints.filter(e => ['list-forms', 'get-form', 'get-form-fields', 'get-form-schema'].includes(e.id)).map((endpoint) => (
                <ApiEndpoint key={endpoint.id} {...endpoint} />
              ))}
            </div>
          </section>

          <Separator className="my-12" />

          {/* Records Endpoints */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Database className="h-6 w-6" />
              Records (Submissions) Endpoints
            </h2>
            <div className="space-y-4">
              {endpoints.filter(e => ['list-records', 'create-record', 'get-record', 'update-record', 'patch-record', 'delete-record'].includes(e.id)).map((endpoint) => (
                <ApiEndpoint key={endpoint.id} {...endpoint} />
              ))}
            </div>
          </section>

          <Separator className="my-12" />

          {/* Bulk Operations */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Code className="h-6 w-6" />
              Bulk Operations
            </h2>
            <div className="space-y-4">
              {endpoints.filter(e => ['bulk-create', 'bulk-delete'].includes(e.id)).map((endpoint) => (
                <ApiEndpoint key={endpoint.id} {...endpoint} />
              ))}
            </div>
          </section>

          <Separator className="my-12" />

          {/* Utility Endpoints */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Utility Endpoints</h2>
            <div className="space-y-4">
              {endpoints.filter(e => ['count-records', 'validate-data'].includes(e.id)).map((endpoint) => (
                <ApiEndpoint key={endpoint.id} {...endpoint} />
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t pt-8 mt-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Need help? Contact our support team.
              </p>
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Documentation;
