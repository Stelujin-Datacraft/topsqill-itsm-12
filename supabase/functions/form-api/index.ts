import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

// Response helpers
const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

const errorResponse = (code: string, message: string, status = 400) => {
  return jsonResponse({ success: false, error: { code, message } }, status);
};

const successResponse = (data: any, meta?: any) => {
  return jsonResponse({ success: true, data, ...(meta && { meta }) });
};

// Initialize Supabase client
const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
};

// Helper: Resolve form ID from UUID or reference_id
async function resolveFormId(supabase: any, formIdOrRef: string): Promise<string | null> {
  // Check if it's a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(formIdOrRef)) {
    // Verify the UUID exists
    const { data } = await supabase.from('forms').select('id').eq('id', formIdOrRef).single();
    return data?.id || null;
  }
  
  // Try to find by reference_id
  const { data } = await supabase.from('forms').select('id').eq('reference_id', formIdOrRef).single();
  return data?.id || null;
}

// Helper: Resolve record ID from UUID or submission_ref_id
async function resolveRecordId(supabase: any, recordIdOrRef: string): Promise<string | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(recordIdOrRef)) {
    const { data } = await supabase.from('form_submissions').select('id').eq('id', recordIdOrRef).single();
    return data?.id || null;
  }
  
  const { data } = await supabase.from('form_submissions').select('id').eq('submission_ref_id', recordIdOrRef).single();
  return data?.id || null;
}

// Helper: Get form fields and create label-to-ID mapping
async function getFieldMapping(supabase: any, formId: string): Promise<Map<string, { id: string; type: string }>> {
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, label, field_type')
    .eq('form_id', formId);
  
  const mapping = new Map();
  if (fields) {
    for (const field of fields) {
      mapping.set(field.label.toLowerCase(), { id: field.id, type: field.field_type });
      mapping.set(field.id, { id: field.id, type: field.field_type });
    }
  }
  return mapping;
}

// Helper: Convert label-based data to field ID-based data
async function mapLabelsToFieldIds(supabase: any, formId: string, data: Record<string, any>): Promise<Record<string, any>> {
  const fieldMapping = await getFieldMapping(supabase, formId);
  const mappedData: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const fieldInfo = fieldMapping.get(key.toLowerCase()) || fieldMapping.get(key);
    if (fieldInfo) {
      mappedData[fieldInfo.id] = value;
    } else {
      // Keep original key if no mapping found (might already be an ID)
      mappedData[key] = value;
    }
  }
  
  return mappedData;
}

// Helper: Validate required fields
async function validateRequiredFields(supabase: any, formId: string, data: Record<string, any>): Promise<string[]> {
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, label, required')
    .eq('form_id', formId)
    .eq('required', true);
  
  const errors: string[] = [];
  if (fields) {
    for (const field of fields) {
      if (!(field.id in data) || data[field.id] === null || data[field.id] === '') {
        errors.push(`Field "${field.label}" is required`);
      }
    }
  }
  return errors;
}

// Helper: Parse pagination params
function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Helper: Parse sort params
function parseSort(url: URL): { column: string; ascending: boolean } {
  const sort = url.searchParams.get('sort') || 'submitted_at';
  const order = url.searchParams.get('order') || 'desc';
  return { column: sort, ascending: order === 'asc' };
}

// Route handlers
async function handleGetForms(supabase: any, url: URL) {
  console.log('GET /forms - Fetching all forms');
  
  const { page, limit, offset } = parsePagination(url);
  const projectId = url.searchParams.get('project_id');
  const status = url.searchParams.get('status');
  
  let query = supabase.from('forms').select('id, name, description, reference_id, status, is_public, created_at, updated_at, project_id', { count: 'exact' });
  
  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  
  const { data, error, count } = await query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching forms:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse(data, {
    page,
    limit,
    total: count,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

async function handleGetForm(supabase: any, formIdOrRef: string) {
  console.log('GET /forms/:formId - Fetching form:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', formId)
    .single();
  
  if (error) {
    console.error('Error fetching form:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse(data);
}

async function handleGetFormFields(supabase: any, formIdOrRef: string) {
  console.log('GET /forms/:formId/fields - Fetching fields for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const { data, error } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });
  
  if (error) {
    console.error('Error fetching fields:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse(data);
}

async function handleGetFormSchema(supabase: any, formIdOrRef: string) {
  console.log('GET /forms/:formId/schema - Fetching schema for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('id, name, description, reference_id, status, pages, layout')
    .eq('id', formId)
    .single();
  
  if (formError) {
    console.error('Error fetching form:', formError);
    return errorResponse('FETCH_ERROR', formError.message, 500);
  }
  
  const { data: fields, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, label, field_type, required, placeholder, default_value, options, validation, custom_config')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });
  
  if (fieldsError) {
    console.error('Error fetching fields:', fieldsError);
    return errorResponse('FETCH_ERROR', fieldsError.message, 500);
  }
  
  return successResponse({
    form,
    fields,
    fieldCount: fields?.length || 0,
  });
}

async function handleGetRecords(supabase: any, formIdOrRef: string, url: URL) {
  console.log('GET /forms/:formId/records - Fetching records for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const { page, limit, offset } = parsePagination(url);
  const { column, ascending } = parseSort(url);
  
  // Build query with filters
  let query = supabase
    .from('form_submissions')
    .select('*', { count: 'exact' })
    .eq('form_id', formId);
  
  // Apply field filters (format: filter[fieldId]=value)
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('filter[') && key.endsWith(']')) {
      const fieldId = key.slice(7, -1);
      query = query.contains('submission_data', { [fieldId]: value });
    }
  }
  
  // Apply approval status filter
  const approvalStatus = url.searchParams.get('approval_status');
  if (approvalStatus) {
    query = query.eq('approval_status', approvalStatus);
  }
  
  // Apply date range filters
  const fromDate = url.searchParams.get('from_date');
  const toDate = url.searchParams.get('to_date');
  if (fromDate) query = query.gte('submitted_at', fromDate);
  if (toDate) query = query.lte('submitted_at', toDate);
  
  const { data, error, count } = await query
    .range(offset, offset + limit - 1)
    .order(column, { ascending });
  
  if (error) {
    console.error('Error fetching records:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse(data, {
    page,
    limit,
    total: count,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

async function handleCreateRecord(supabase: any, formIdOrRef: string, body: any) {
  console.log('POST /forms/:formId/records - Creating record for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  let submissionData = body.data || body;
  
  // If useLabels flag is set, convert labels to field IDs
  if (body.useLabels) {
    submissionData = await mapLabelsToFieldIds(supabase, formId, body.data || {});
  }
  
  // Validate required fields if validate flag is set
  if (body.validate !== false) {
    const validationErrors = await validateRequiredFields(supabase, formId, submissionData);
    if (validationErrors.length > 0) {
      return errorResponse('VALIDATION_ERROR', validationErrors.join(', '), 400);
    }
  }
  
  const { data, error } = await supabase
    .from('form_submissions')
    .insert({
      form_id: formId,
      submission_data: submissionData,
      submitted_by: body.submitted_by || null,
      approval_status: body.approval_status || 'pending',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating record:', error);
    return errorResponse('CREATE_ERROR', error.message, 500);
  }
  
  console.log('Record created successfully:', data.id);
  return successResponse(data, undefined);
}

async function handleGetRecord(supabase: any, formIdOrRef: string, recordIdOrRef: string) {
  console.log('GET /forms/:formId/records/:recordId - Fetching record:', recordIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const recordId = await resolveRecordId(supabase, recordIdOrRef);
  if (!recordId) {
    return errorResponse('RECORD_NOT_FOUND', `Record "${recordIdOrRef}" not found`, 404);
  }
  
  const { data, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('id', recordId)
    .eq('form_id', formId)
    .single();
  
  if (error) {
    console.error('Error fetching record:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse(data);
}

async function handleUpdateRecord(supabase: any, formIdOrRef: string, recordIdOrRef: string, body: any, partial = false) {
  console.log(`${partial ? 'PATCH' : 'PUT'} /forms/:formId/records/:recordId - Updating record:`, recordIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const recordId = await resolveRecordId(supabase, recordIdOrRef);
  if (!recordId) {
    return errorResponse('RECORD_NOT_FOUND', `Record "${recordIdOrRef}" not found`, 404);
  }
  
  let submissionData = body.data || body;
  
  // If useLabels flag is set, convert labels to field IDs
  if (body.useLabels) {
    submissionData = await mapLabelsToFieldIds(supabase, formId, body.data || {});
  }
  
  // For partial updates, merge with existing data
  if (partial) {
    const { data: existing } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('id', recordId)
      .single();
    
    if (existing) {
      submissionData = { ...existing.submission_data, ...submissionData };
    }
  }
  
  const updatePayload: any = { submission_data: submissionData };
  
  // Allow updating approval status if provided
  if (body.approval_status) updatePayload.approval_status = body.approval_status;
  if (body.approval_notes) updatePayload.approval_notes = body.approval_notes;
  if (body.approved_by) updatePayload.approved_by = body.approved_by;
  
  const { data, error } = await supabase
    .from('form_submissions')
    .update(updatePayload)
    .eq('id', recordId)
    .eq('form_id', formId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating record:', error);
    return errorResponse('UPDATE_ERROR', error.message, 500);
  }
  
  console.log('Record updated successfully:', data.id);
  return successResponse(data);
}

async function handleUpdateField(supabase: any, formIdOrRef: string, recordIdOrRef: string, fieldIdOrLabel: string, body: any) {
  console.log('PATCH /forms/:formId/records/:recordId/fields/:fieldId - Updating field:', fieldIdOrLabel);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const recordId = await resolveRecordId(supabase, recordIdOrRef);
  if (!recordId) {
    return errorResponse('RECORD_NOT_FOUND', `Record "${recordIdOrRef}" not found`, 404);
  }
  
  // Resolve field ID from label if needed
  const fieldMapping = await getFieldMapping(supabase, formId);
  const fieldInfo = fieldMapping.get(fieldIdOrLabel.toLowerCase()) || fieldMapping.get(fieldIdOrLabel);
  const fieldId = fieldInfo?.id || fieldIdOrLabel;
  
  // Get existing submission data
  const { data: existing } = await supabase
    .from('form_submissions')
    .select('submission_data')
    .eq('id', recordId)
    .single();
  
  if (!existing) {
    return errorResponse('RECORD_NOT_FOUND', 'Record not found', 404);
  }
  
  // Update the specific field
  const updatedData = {
    ...existing.submission_data,
    [fieldId]: body.value,
  };
  
  const { data, error } = await supabase
    .from('form_submissions')
    .update({ submission_data: updatedData })
    .eq('id', recordId)
    .eq('form_id', formId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating field:', error);
    return errorResponse('UPDATE_ERROR', error.message, 500);
  }
  
  console.log('Field updated successfully');
  return successResponse(data);
}

async function handleDeleteRecord(supabase: any, formIdOrRef: string, recordIdOrRef: string) {
  console.log('DELETE /forms/:formId/records/:recordId - Deleting record:', recordIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const recordId = await resolveRecordId(supabase, recordIdOrRef);
  if (!recordId) {
    return errorResponse('RECORD_NOT_FOUND', `Record "${recordIdOrRef}" not found`, 404);
  }
  
  const { error } = await supabase
    .from('form_submissions')
    .delete()
    .eq('id', recordId)
    .eq('form_id', formId);
  
  if (error) {
    console.error('Error deleting record:', error);
    return errorResponse('DELETE_ERROR', error.message, 500);
  }
  
  console.log('Record deleted successfully');
  return successResponse({ deleted: true, id: recordId });
}

async function handleBulkCreateRecords(supabase: any, formIdOrRef: string, body: any) {
  console.log('POST /forms/:formId/records/bulk - Bulk creating records for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const records = body.records || [];
  if (!Array.isArray(records) || records.length === 0) {
    return errorResponse('INVALID_INPUT', 'Records array is required', 400);
  }
  
  if (records.length > 100) {
    return errorResponse('LIMIT_EXCEEDED', 'Maximum 100 records per bulk operation', 400);
  }
  
  const insertRecords = [];
  for (const record of records) {
    let submissionData = record.data || record;
    
    if (body.useLabels) {
      submissionData = await mapLabelsToFieldIds(supabase, formId, submissionData);
    }
    
    insertRecords.push({
      form_id: formId,
      submission_data: submissionData,
      submitted_by: record.submitted_by || body.submitted_by || null,
      approval_status: record.approval_status || 'pending',
    });
  }
  
  const { data, error } = await supabase
    .from('form_submissions')
    .insert(insertRecords)
    .select();
  
  if (error) {
    console.error('Error bulk creating records:', error);
    return errorResponse('CREATE_ERROR', error.message, 500);
  }
  
  console.log('Bulk records created successfully:', data.length);
  return successResponse(data, { created: data.length });
}

async function handleBulkDeleteRecords(supabase: any, formIdOrRef: string, body: any) {
  console.log('DELETE /forms/:formId/records/bulk - Bulk deleting records for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  const ids = body.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse('INVALID_INPUT', 'IDs array is required', 400);
  }
  
  if (ids.length > 100) {
    return errorResponse('LIMIT_EXCEEDED', 'Maximum 100 records per bulk delete', 400);
  }
  
  // Resolve all record IDs
  const resolvedIds = [];
  for (const id of ids) {
    const recordId = await resolveRecordId(supabase, id);
    if (recordId) resolvedIds.push(recordId);
  }
  
  const { error } = await supabase
    .from('form_submissions')
    .delete()
    .eq('form_id', formId)
    .in('id', resolvedIds);
  
  if (error) {
    console.error('Error bulk deleting records:', error);
    return errorResponse('DELETE_ERROR', error.message, 500);
  }
  
  console.log('Bulk records deleted successfully:', resolvedIds.length);
  return successResponse({ deleted: resolvedIds.length, ids: resolvedIds });
}

async function handleGetRecordsCount(supabase: any, formIdOrRef: string, url: URL) {
  console.log('GET /forms/:formId/records/count - Counting records for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  let query = supabase
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', formId);
  
  // Apply approval status filter
  const approvalStatus = url.searchParams.get('approval_status');
  if (approvalStatus) {
    query = query.eq('approval_status', approvalStatus);
  }
  
  const { count, error } = await query;
  
  if (error) {
    console.error('Error counting records:', error);
    return errorResponse('FETCH_ERROR', error.message, 500);
  }
  
  return successResponse({ count });
}

async function handleValidateData(supabase: any, formIdOrRef: string, body: any) {
  console.log('POST /forms/:formId/validate - Validating data for:', formIdOrRef);
  
  const formId = await resolveFormId(supabase, formIdOrRef);
  if (!formId) {
    return errorResponse('FORM_NOT_FOUND', `Form "${formIdOrRef}" not found`, 404);
  }
  
  let submissionData = body.data || body;
  
  if (body.useLabels) {
    submissionData = await mapLabelsToFieldIds(supabase, formId, body.data || {});
  }
  
  const errors = await validateRequiredFields(supabase, formId, submissionData);
  
  return successResponse({
    valid: errors.length === 0,
    errors,
    mappedData: submissionData,
  });
}

// Main router
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/form-api/, '');
    const segments = path.split('/').filter(Boolean);
    
    console.log(`${req.method} ${path} - Segments:`, segments);
    
    // Parse request body for POST/PUT/PATCH/DELETE
    let body = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
      } catch (e) {
        console.log('No JSON body or parse error');
      }
    }
    
    // Route: GET /forms
    if (segments.length === 1 && segments[0] === 'forms' && req.method === 'GET') {
      return await handleGetForms(supabase, url);
    }
    
    // Route: GET /forms/:formId
    if (segments.length === 2 && segments[0] === 'forms' && req.method === 'GET') {
      return await handleGetForm(supabase, segments[1]);
    }
    
    // Route: GET /forms/:formId/fields
    if (segments.length === 3 && segments[0] === 'forms' && segments[2] === 'fields' && req.method === 'GET') {
      return await handleGetFormFields(supabase, segments[1]);
    }
    
    // Route: GET /forms/:formId/schema
    if (segments.length === 3 && segments[0] === 'forms' && segments[2] === 'schema' && req.method === 'GET') {
      return await handleGetFormSchema(supabase, segments[1]);
    }
    
    // Route: GET /forms/:formId/records
    if (segments.length === 3 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'GET') {
      return await handleGetRecords(supabase, segments[1], url);
    }
    
    // Route: POST /forms/:formId/records
    if (segments.length === 3 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'POST') {
      return await handleCreateRecord(supabase, segments[1], body);
    }
    
    // Route: GET /forms/:formId/records/count
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && segments[3] === 'count' && req.method === 'GET') {
      return await handleGetRecordsCount(supabase, segments[1], url);
    }
    
    // Route: POST /forms/:formId/records/bulk
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && segments[3] === 'bulk' && req.method === 'POST') {
      return await handleBulkCreateRecords(supabase, segments[1], body);
    }
    
    // Route: DELETE /forms/:formId/records/bulk
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && segments[3] === 'bulk' && req.method === 'DELETE') {
      return await handleBulkDeleteRecords(supabase, segments[1], body);
    }
    
    // Route: POST /forms/:formId/validate
    if (segments.length === 3 && segments[0] === 'forms' && segments[2] === 'validate' && req.method === 'POST') {
      return await handleValidateData(supabase, segments[1], body);
    }
    
    // Route: GET /forms/:formId/records/:recordId
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'GET') {
      return await handleGetRecord(supabase, segments[1], segments[3]);
    }
    
    // Route: PUT /forms/:formId/records/:recordId
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'PUT') {
      return await handleUpdateRecord(supabase, segments[1], segments[3], body, false);
    }
    
    // Route: PATCH /forms/:formId/records/:recordId
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'PATCH') {
      return await handleUpdateRecord(supabase, segments[1], segments[3], body, true);
    }
    
    // Route: DELETE /forms/:formId/records/:recordId
    if (segments.length === 4 && segments[0] === 'forms' && segments[2] === 'records' && req.method === 'DELETE') {
      return await handleDeleteRecord(supabase, segments[1], segments[3]);
    }
    
    // Route: PATCH /forms/:formId/records/:recordId/fields/:fieldId
    if (segments.length === 6 && segments[0] === 'forms' && segments[2] === 'records' && segments[4] === 'fields' && req.method === 'PATCH') {
      return await handleUpdateField(supabase, segments[1], segments[3], segments[5], body);
    }
    
    // 404 for unknown routes
    return errorResponse('NOT_FOUND', `Route ${req.method} ${path} not found`, 404);
    
  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'An unexpected error occurred', 500);
  }
});

