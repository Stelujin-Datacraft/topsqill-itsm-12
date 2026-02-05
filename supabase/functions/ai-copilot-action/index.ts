 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface ActionRequest {
   action: string;
   params: Record<string, any>;
   userId: string;
   projectId: string;
   organizationId?: string;
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     const { action, params, userId, projectId, organizationId }: ActionRequest = await req.json();
 
     console.log(`AI Copilot Action: ${action}`, { params, userId, projectId });
 
     let result: any = null;
     let message = '';
 
     switch (action) {
       case 'create_form': {
         let { name, description, fields } = params;
         
         // Parse fields if it's a string (from AI response)
         if (typeof fields === 'string') {
           try {
             fields = JSON.parse(fields);
           } catch (e) {
             console.error('Failed to parse fields JSON:', e);
             throw new Error('Invalid fields format');
           }
         }
         
         // Ensure fields is an array
         if (!Array.isArray(fields)) {
           fields = [];
         }
         
         // Create form
         const { data: form, error: formError } = await supabase
           .from('forms')
           .insert({
             name,
             description,
             project_id: projectId,
             created_by: userId,
             status: 'draft',
             organization_id: organizationId
           })
           .select()
           .single();
 
         if (formError) throw formError;
 
         // Create fields if provided
         if (fields && fields.length > 0) {
           const formFields = fields.map((f: any, idx: number) => ({
             form_id: form.id,
             field_type: f.type || 'text',
             label: f.label,
             placeholder: f.placeholder,
             required: f.required || false,
             field_order: idx + 1,
             options: f.options ? JSON.stringify(f.options) : null,
             tooltip: f.tooltip
           }));
 
           await supabase.from('form_fields').insert(formFields);
         }
 
         result = { formId: form.id, formName: form.name };
         message = `Created form "${name}" successfully!`;
         break;
       }
 
       case 'trigger_workflow': {
         const { workflowId, triggerData } = params;
         
         // Get workflow
         const { data: workflow, error: wfError } = await supabase
           .from('workflows')
           .select('*')
           .eq('id', workflowId)
           .single();
 
         if (wfError) throw new Error(`Workflow not found: ${workflowId}`);
 
         // Create execution
         const { data: execution, error: execError } = await supabase
           .from('workflow_executions')
           .insert({
             workflow_id: workflowId,
             status: 'running',
             trigger_type: 'manual',
             trigger_data: triggerData || {},
             started_at: new Date().toISOString(),
             started_by: userId
           })
           .select()
           .single();
 
         if (execError) throw execError;
 
         result = { executionId: execution.id, workflowName: workflow.name };
         message = `Triggered workflow "${workflow.name}"!`;
         break;
       }
 
       case 'create_submission': {
         const { formId, data: submissionData } = params;
         
         const { data: form } = await supabase
           .from('forms')
           .select('name')
           .eq('id', formId)
           .single();
 
         const { data: submission, error: subError } = await supabase
           .from('form_submissions')
           .insert({
             form_id: formId,
             submission_data: submissionData,
             submitted_by: userId,
             submitted_at: new Date().toISOString()
           })
           .select()
           .single();
 
         if (subError) throw subError;
 
         result = { submissionId: submission.id, formName: form?.name };
         message = `Created submission for "${form?.name}"!`;
         break;
       }
 
       case 'create_dashboard': {
         const { name, description } = params;
         
         const { data: dashboard, error: dashError } = await supabase
           .from('dashboards')
           .insert({
             name,
             description,
             project_id: projectId,
             created_by: userId,
             organization_id: organizationId,
             layout: { widgets: [] }
           })
           .select()
           .single();
 
         if (dashError) throw dashError;
 
         result = { dashboardId: dashboard.id };
         message = `Created dashboard "${name}"!`;
         break;
       }
 
       case 'create_workflow': {
         const { name, description, triggerFormId } = params;
         
         const { data: workflow, error: wfError } = await supabase
           .from('workflows')
           .insert({
             name,
             description,
             project_id: projectId,
             created_by: userId,
             organization_id: organizationId,
             status: 'draft',
             trigger_type: triggerFormId ? 'form_submission' : 'manual',
             trigger_form_id: triggerFormId || null,
             nodes: [],
             connections: []
           })
           .select()
           .single();
 
         if (wfError) throw wfError;
 
         result = { workflowId: workflow.id };
         message = `Created workflow "${name}"!`;
         break;
       }
 
       case 'send_notification': {
         const { targetUserId, title, notificationMessage, type } = params;
         
         const { error: notifError } = await supabase
           .from('notifications')
           .insert({
             user_id: targetUserId,
             title,
             message: notificationMessage,
             type: type || 'info',
             read: false
           });
 
         if (notifError) throw notifError;
 
         message = `Notification sent!`;
         break;
       }
 
       case 'get_sla_predictions': {
         // Call the predict-sla-breach function
         const predictionResponse = await fetch(`${supabaseUrl}/functions/v1/predict-sla-breach`, {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${supabaseKey}`,
             'Content-Type': 'application/json'
           }
         });
 
         const predictionData = await predictionResponse.json();
         result = predictionData;
         message = `Found ${predictionData.summary?.total_active || 0} active SLAs. ${predictionData.summary?.critical || 0} critical, ${predictionData.summary?.high || 0} high risk.`;
         break;
       }
 
       case 'get_form_stats': {
         const { formId } = params;
         
         const { data: submissions, error } = await supabase
           .from('form_submissions')
           .select('id, submitted_at, approval_status')
           .eq('form_id', formId);
 
         if (error) throw error;
 
         const stats = {
           total: submissions?.length || 0,
           pending: submissions?.filter(s => s.approval_status === 'pending').length || 0,
           approved: submissions?.filter(s => s.approval_status === 'approved').length || 0,
           rejected: submissions?.filter(s => s.approval_status === 'rejected').length || 0,
           today: submissions?.filter(s => {
             const d = new Date(s.submitted_at);
             const today = new Date();
             return d.toDateString() === today.toDateString();
           }).length || 0
         };
 
         result = stats;
         message = `Form has ${stats.total} submissions (${stats.today} today)`;
         break;
       }
 
       case 'update_submission_status': {
         const { submissionId, status, notes } = params;
         
         const { error } = await supabase
           .from('form_submissions')
           .update({
             approval_status: status,
             approval_notes: notes,
             approval_timestamp: new Date().toISOString(),
             approved_by: userId
           })
           .eq('id', submissionId);
 
         if (error) throw error;
 
         message = `Submission ${status}!`;
         break;
       }
 
       default:
         throw new Error(`Unknown action: ${action}`);
     }
 
     // Log the action
     await supabase.from('audit_logs').insert({
       user_id: userId,
       event_type: 'ai_copilot_action',
       event_category: 'ai',
       description: `AI Copilot executed: ${action}`,
       metadata: { action, params, result }
     });
 
     return new Response(JSON.stringify({
       success: true,
       action,
       result,
       message
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('AI Copilot action error:', error);
     return new Response(JSON.stringify({
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error'
     }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });