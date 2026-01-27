import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Hono } from 'https://deno.land/x/hono@v3.12.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const app = new Hono().basePath('/public-api');

// Supabase client with service role for API operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Hash function for API key validation
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Middleware: Validate API Key
async function validateApiKey(c: any, next: () => Promise<void>) {
  const startTime = Date.now();
  const apiKey = c.req.header('x-api-key');
  const endpoint = c.req.path;
  const method = c.req.method;
  const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';

  if (!apiKey) {
    return c.json({ error: 'API key required', code: 'MISSING_API_KEY' }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const supabase = getServiceClient();

  // Validate the API key
  const { data: keyData, error: keyError } = await supabase
    .rpc('validate_api_key', { key_hash_param: keyHash });

  if (keyError || !keyData || keyData.length === 0) {
    // Log failed attempt
    await supabase.rpc('log_api_request', {
      p_api_key_id: null,
      p_organization_id: '00000000-0000-0000-0000-000000000000',
      p_endpoint: endpoint,
      p_method: method,
      p_request_body: null,
      p_response_status: 401,
      p_response_time_ms: Date.now() - startTime,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_error_message: 'Invalid or expired API key'
    });
    return c.json({ error: 'Invalid or expired API key', code: 'INVALID_API_KEY' }, 401);
  }

  const keyInfo = keyData[0];

  // Check IP whitelist
  if (keyInfo.allowed_ips && keyInfo.allowed_ips.length > 0) {
    if (!keyInfo.allowed_ips.includes(ip)) {
      await supabase.rpc('log_api_request', {
        p_api_key_id: keyInfo.api_key_id,
        p_organization_id: keyInfo.organization_id,
        p_endpoint: endpoint,
        p_method: method,
        p_request_body: null,
        p_response_status: 403,
        p_response_time_ms: Date.now() - startTime,
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_error_message: 'IP not whitelisted'
      });
      return c.json({ error: 'IP not allowed', code: 'IP_NOT_ALLOWED' }, 403);
    }
  }

  // Store key info in context for route handlers
  c.set('apiKeyInfo', keyInfo);
  c.set('startTime', startTime);
  c.set('ip', ip);
  c.set('userAgent', userAgent);

  await next();
}

// Middleware: Log successful request
async function logRequest(c: any, status: number, error?: string) {
  const keyInfo = c.get('apiKeyInfo');
  const startTime = c.get('startTime');
  const ip = c.get('ip');
  const userAgent = c.get('userAgent');

  if (!keyInfo) return;

  const supabase = getServiceClient();
  let requestBody = null;
  try {
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      requestBody = await c.req.json().catch(() => null);
    }
  } catch {
    // Ignore body parsing errors
  }

  await supabase.rpc('log_api_request', {
    p_api_key_id: keyInfo.api_key_id,
    p_organization_id: keyInfo.organization_id,
    p_endpoint: c.req.path,
    p_method: c.req.method,
    p_request_body: requestBody,
    p_response_status: status,
    p_response_time_ms: Date.now() - startTime,
    p_ip_address: ip,
    p_user_agent: userAgent,
    p_error_message: error || null
  });
}

// Permission check helper
function hasPermission(keyInfo: any, resource: string, action: string): boolean {
  const permissions = keyInfo.permissions || {};
  const resourcePerms = permissions[resource];
  if (!resourcePerms) return false;
  if (Array.isArray(resourcePerms)) return resourcePerms.includes(action);
  return resourcePerms[action] === true;
}

// CORS preflight
app.options('*', (c) => new Response(null, { headers: corsHeaders }));

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
});

// Documentation endpoint (no auth required)
app.get('/docs', (c) => {
  const docs = {
    name: 'Topsqill ITSM Public API',
    version: '1.0.0',
    description: 'External API for integrating with forms, submissions, workflows, and reports',
    authentication: {
      type: 'API Key',
      header: 'x-api-key',
      description: 'Include your API key in the x-api-key header'
    },
    endpoints: {
      forms: {
        'GET /forms': 'List all accessible forms',
        'GET /forms/:id': 'Get form by ID or reference_id',
        'GET /forms/:id/fields': 'Get form fields'
      },
      submissions: {
        'GET /submissions': 'List submissions (query: form_id, limit, offset)',
        'GET /submissions/:id': 'Get submission by ID or submission_ref_id',
        'POST /submissions': 'Create new submission',
        'PUT /submissions/:id': 'Update submission',
        'DELETE /submissions/:id': 'Delete submission'
      },
      workflows: {
        'GET /workflows': 'List workflows',
        'POST /workflows/:id/trigger': 'Trigger workflow for submission'
      },
      reports: {
        'GET /reports': 'List reports',
        'GET /reports/:id/data': 'Get report data'
      }
    },
    permissions: {
      forms: ['read'],
      submissions: ['read', 'create', 'update', 'delete'],
      workflows: ['read', 'trigger'],
      reports: ['read']
    },
    rateLimit: 'Configurable per API key (default: 60 requests/minute)'
  };
  return c.json(docs, 200, corsHeaders);
});

// =============================================
// FORMS ENDPOINTS
// =============================================

app.get('/forms', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  
  if (!hasPermission(keyInfo, 'forms', 'read')) {
    await logRequest(c, 403, 'Permission denied: forms.read');
    return c.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();
  
  let query = supabase
    .from('forms')
    .select('id, name, description, reference_id, status, created_at, updated_at')
    .eq('organization_id', keyInfo.organization_id);

  if (keyInfo.project_id) {
    query = query.eq('project_id', keyInfo.project_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to fetch forms', details: error.message }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data, count: data?.length || 0 }, 200, corsHeaders);
});

app.get('/forms/:id', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const formId = c.req.param('id');

  if (!hasPermission(keyInfo, 'forms', 'read')) {
    await logRequest(c, 403, 'Permission denied: forms.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  // Try UUID first, then reference_id
  let query = supabase
    .from('forms')
    .select('id, name, description, reference_id, status, created_at, updated_at, layout, pages')
    .eq('organization_id', keyInfo.organization_id);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formId);
  
  if (isUuid) {
    query = query.eq('id', formId);
  } else {
    query = query.eq('reference_id', formId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    await logRequest(c, 404, 'Form not found');
    return c.json({ error: 'Form not found' }, 404, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data }, 200, corsHeaders);
});

app.get('/forms/:id/fields', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const formId = c.req.param('id');

  if (!hasPermission(keyInfo, 'forms', 'read')) {
    await logRequest(c, 403, 'Permission denied: forms.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  // Resolve form ID
  let actualFormId = formId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formId);
  
  if (!isUuid) {
    const { data: form } = await supabase
      .from('forms')
      .select('id')
      .eq('reference_id', formId)
      .eq('organization_id', keyInfo.organization_id)
      .single();
    
    if (!form) {
      await logRequest(c, 404, 'Form not found');
      return c.json({ error: 'Form not found' }, 404, corsHeaders);
    }
    actualFormId = form.id;
  }

  const { data, error } = await supabase
    .from('form_fields')
    .select('id, label, field_type, required, placeholder, options, field_order')
    .eq('form_id', actualFormId)
    .order('field_order', { ascending: true });

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to fetch fields' }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data, count: data?.length || 0 }, 200, corsHeaders);
});

// =============================================
// SUBMISSIONS ENDPOINTS
// =============================================

app.get('/submissions', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  
  if (!hasPermission(keyInfo, 'submissions', 'read')) {
    await logRequest(c, 403, 'Permission denied: submissions.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const formId = c.req.query('form_id');
  const formRefId = c.req.query('form_ref_id');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  const supabase = getServiceClient();

  // Resolve form ID if reference provided
  let actualFormId = formId;
  if (formRefId && !formId) {
    const { data: form } = await supabase
      .from('forms')
      .select('id')
      .eq('reference_id', formRefId)
      .eq('organization_id', keyInfo.organization_id)
      .single();
    
    if (form) actualFormId = form.id;
  }

  let query = supabase
    .from('form_submissions')
    .select(`
      id, 
      form_id,
      submission_ref_id,
      submission_data,
      submitted_at,
      submitted_by,
      approval_status,
      forms!inner(organization_id, project_id)
    `)
    .eq('forms.organization_id', keyInfo.organization_id);

  if (keyInfo.project_id) {
    query = query.eq('forms.project_id', keyInfo.project_id);
  }

  if (actualFormId) {
    query = query.eq('form_id', actualFormId);
  }

  const { data, error, count } = await query
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to fetch submissions', details: error.message }, 500, corsHeaders);
  }

  // Clean up response
  const cleanData = data?.map(s => ({
    id: s.id,
    form_id: s.form_id,
    submission_ref_id: s.submission_ref_id,
    submission_data: s.submission_data,
    submitted_at: s.submitted_at,
    submitted_by: s.submitted_by,
    approval_status: s.approval_status
  }));

  await logRequest(c, 200);
  return c.json({ data: cleanData, count: cleanData?.length || 0, limit, offset }, 200, corsHeaders);
});

app.get('/submissions/:id', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const submissionId = c.req.param('id');

  if (!hasPermission(keyInfo, 'submissions', 'read')) {
    await logRequest(c, 403, 'Permission denied: submissions.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId);

  let query = supabase
    .from('form_submissions')
    .select(`
      id, 
      form_id,
      submission_ref_id,
      submission_data,
      submitted_at,
      submitted_by,
      approval_status,
      approval_notes,
      forms!inner(organization_id, name, reference_id)
    `)
    .eq('forms.organization_id', keyInfo.organization_id);

  if (isUuid) {
    query = query.eq('id', submissionId);
  } else {
    query = query.eq('submission_ref_id', submissionId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    await logRequest(c, 404, 'Submission not found');
    return c.json({ error: 'Submission not found' }, 404, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ 
    data: {
      id: data.id,
      form_id: data.form_id,
      form_name: (data as any).forms?.name,
      form_reference_id: (data as any).forms?.reference_id,
      submission_ref_id: data.submission_ref_id,
      submission_data: data.submission_data,
      submitted_at: data.submitted_at,
      submitted_by: data.submitted_by,
      approval_status: data.approval_status,
      approval_notes: data.approval_notes
    }
  }, 200, corsHeaders);
});

app.post('/submissions', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');

  if (!hasPermission(keyInfo, 'submissions', 'create')) {
    await logRequest(c, 403, 'Permission denied: submissions.create');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    await logRequest(c, 400, 'Invalid JSON body');
    return c.json({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const { form_id, form_ref_id, submission_data, use_labels } = body;

  if (!form_id && !form_ref_id) {
    await logRequest(c, 400, 'form_id or form_ref_id required');
    return c.json({ error: 'form_id or form_ref_id is required' }, 400, corsHeaders);
  }

  if (!submission_data || typeof submission_data !== 'object') {
    await logRequest(c, 400, 'submission_data required');
    return c.json({ error: 'submission_data is required and must be an object' }, 400, corsHeaders);
  }

  const supabase = getServiceClient();

  // Resolve form ID
  let actualFormId = form_id;
  if (form_ref_id && !form_id) {
    const { data: form } = await supabase
      .from('forms')
      .select('id')
      .eq('reference_id', form_ref_id)
      .eq('organization_id', keyInfo.organization_id)
      .single();
    
    if (!form) {
      await logRequest(c, 404, 'Form not found');
      return c.json({ error: 'Form not found' }, 404, corsHeaders);
    }
    actualFormId = form.id;
  }

  // If using labels, convert to field IDs
  let finalSubmissionData = submission_data;
  if (use_labels) {
    const { data: fields } = await supabase
      .from('form_fields')
      .select('id, label')
      .eq('form_id', actualFormId);

    if (fields) {
      const labelToId = new Map(fields.map(f => [f.label.toLowerCase(), f.id]));
      finalSubmissionData = {};
      for (const [key, value] of Object.entries(submission_data)) {
        const fieldId = labelToId.get(key.toLowerCase()) || key;
        finalSubmissionData[fieldId] = value;
      }
    }
  }

  const { data, error } = await supabase
    .from('form_submissions')
    .insert({
      form_id: actualFormId,
      submission_data: finalSubmissionData,
      submitted_by: null // API submissions don't have a user
    })
    .select('id, submission_ref_id, submitted_at')
    .single();

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to create submission', details: error.message }, 500, corsHeaders);
  }

  await logRequest(c, 201);
  return c.json({ 
    data,
    message: 'Submission created successfully'
  }, 201, corsHeaders);
});

app.put('/submissions/:id', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const submissionId = c.req.param('id');

  if (!hasPermission(keyInfo, 'submissions', 'update')) {
    await logRequest(c, 403, 'Permission denied: submissions.update');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    await logRequest(c, 400, 'Invalid JSON body');
    return c.json({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const { submission_data, use_labels, merge } = body;

  const supabase = getServiceClient();

  // Find the submission
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId);
  
  let findQuery = supabase
    .from('form_submissions')
    .select('id, form_id, submission_data, forms!inner(organization_id)')
    .eq('forms.organization_id', keyInfo.organization_id);

  if (isUuid) {
    findQuery = findQuery.eq('id', submissionId);
  } else {
    findQuery = findQuery.eq('submission_ref_id', submissionId);
  }

  const { data: existing, error: findError } = await findQuery.single();

  if (findError || !existing) {
    await logRequest(c, 404, 'Submission not found');
    return c.json({ error: 'Submission not found' }, 404, corsHeaders);
  }

  // Convert labels to IDs if needed
  let finalSubmissionData = submission_data;
  if (use_labels && submission_data) {
    const { data: fields } = await supabase
      .from('form_fields')
      .select('id, label')
      .eq('form_id', existing.form_id);

    if (fields) {
      const labelToId = new Map(fields.map(f => [f.label.toLowerCase(), f.id]));
      finalSubmissionData = {};
      for (const [key, value] of Object.entries(submission_data)) {
        const fieldId = labelToId.get(key.toLowerCase()) || key;
        finalSubmissionData[fieldId] = value;
      }
    }
  }

  // Merge or replace data
  const newData = merge !== false
    ? { ...(existing.submission_data as object), ...finalSubmissionData }
    : finalSubmissionData;

  const { data, error } = await supabase
    .from('form_submissions')
    .update({ submission_data: newData })
    .eq('id', existing.id)
    .select('id, submission_ref_id, submitted_at')
    .single();

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to update submission' }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data, message: 'Submission updated successfully' }, 200, corsHeaders);
});

app.delete('/submissions/:id', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const submissionId = c.req.param('id');

  if (!hasPermission(keyInfo, 'submissions', 'delete')) {
    await logRequest(c, 403, 'Permission denied: submissions.delete');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId);

  // Find the submission first
  let findQuery = supabase
    .from('form_submissions')
    .select('id, forms!inner(organization_id)')
    .eq('forms.organization_id', keyInfo.organization_id);

  if (isUuid) {
    findQuery = findQuery.eq('id', submissionId);
  } else {
    findQuery = findQuery.eq('submission_ref_id', submissionId);
  }

  const { data: existing } = await findQuery.single();

  if (!existing) {
    await logRequest(c, 404, 'Submission not found');
    return c.json({ error: 'Submission not found' }, 404, corsHeaders);
  }

  const { error } = await supabase
    .from('form_submissions')
    .delete()
    .eq('id', existing.id);

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to delete submission' }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ message: 'Submission deleted successfully' }, 200, corsHeaders);
});

// =============================================
// WORKFLOWS ENDPOINTS
// =============================================

app.get('/workflows', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');

  if (!hasPermission(keyInfo, 'workflows', 'read')) {
    await logRequest(c, 403, 'Permission denied: workflows.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('workflows')
    .select('id, name, description, reference_id, status, trigger_type, created_at')
    .eq('organization_id', keyInfo.organization_id);

  if (keyInfo.project_id) {
    query = query.eq('project_id', keyInfo.project_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to fetch workflows' }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data, count: data?.length || 0 }, 200, corsHeaders);
});

app.post('/workflows/:id/trigger', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');
  const workflowId = c.req.param('id');

  if (!hasPermission(keyInfo, 'workflows', 'trigger')) {
    await logRequest(c, 403, 'Permission denied: workflows.trigger');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const { submission_id, submission_ref_id } = body;

  if (!submission_id && !submission_ref_id) {
    await logRequest(c, 400, 'submission_id or submission_ref_id required');
    return c.json({ error: 'submission_id or submission_ref_id is required' }, 400, corsHeaders);
  }

  const supabase = getServiceClient();

  // Resolve submission ID
  let actualSubmissionId = submission_id;
  if (submission_ref_id && !submission_id) {
    const { data: sub } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('submission_ref_id', submission_ref_id)
      .single();
    
    if (sub) actualSubmissionId = sub.id;
  }

  if (!actualSubmissionId) {
    await logRequest(c, 404, 'Submission not found');
    return c.json({ error: 'Submission not found' }, 404, corsHeaders);
  }

  // Verify workflow exists and belongs to org
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId);
  
  let workflowQuery = supabase
    .from('workflows')
    .select('id, name')
    .eq('organization_id', keyInfo.organization_id)
    .eq('status', 'active');

  if (isUuid) {
    workflowQuery = workflowQuery.eq('id', workflowId);
  } else {
    workflowQuery = workflowQuery.eq('reference_id', workflowId);
  }

  const { data: workflow } = await workflowQuery.single();

  if (!workflow) {
    await logRequest(c, 404, 'Workflow not found');
    return c.json({ error: 'Workflow not found or inactive' }, 404, corsHeaders);
  }

  // Create workflow execution
  const { data: execution, error } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: workflow.id,
      submission_id: actualSubmissionId,
      status: 'pending',
      triggered_by: 'api',
      context: { api_key_id: keyInfo.api_key_id }
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to trigger workflow' }, 500, corsHeaders);
  }

  await logRequest(c, 202);
  return c.json({ 
    data: execution,
    message: `Workflow "${workflow.name}" triggered successfully`
  }, 202, corsHeaders);
});

// =============================================
// REPORTS ENDPOINTS
// =============================================

app.get('/reports', validateApiKey, async (c) => {
  const keyInfo = c.get('apiKeyInfo');

  if (!hasPermission(keyInfo, 'reports', 'read')) {
    await logRequest(c, 403, 'Permission denied: reports.read');
    return c.json({ error: 'Permission denied' }, 403, corsHeaders);
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('reports')
    .select('id, name, description, reference_id, created_at')
    .eq('organization_id', keyInfo.organization_id);

  if (keyInfo.project_id) {
    query = query.eq('project_id', keyInfo.project_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    await logRequest(c, 500, error.message);
    return c.json({ error: 'Failed to fetch reports' }, 500, corsHeaders);
  }

  await logRequest(c, 200);
  return c.json({ data, count: data?.length || 0 }, 200, corsHeaders);
});

// Main handler
Deno.serve(app.fetch);
