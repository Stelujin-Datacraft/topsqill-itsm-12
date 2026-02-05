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
         let { name, description, triggerFormId, nodes: nodeDefinitions } = params;
         
         // Parse nodes if it's a string
         if (typeof nodeDefinitions === 'string') {
           try {
             nodeDefinitions = JSON.parse(nodeDefinitions);
           } catch (e) {
             console.error('Failed to parse nodes JSON:', e);
             nodeDefinitions = [];
           }
         }
         
         const { data: workflow, error: wfError } = await supabase
           .from('workflows')
           .insert({
             name,
             description,
             project_id: projectId,
             created_by: userId,
             organization_id: organizationId,
             status: 'draft'
           })
           .select()
           .single();
 
         if (wfError) throw wfError;
         
         // Create workflow trigger if form is specified
         if (triggerFormId) {
           await supabase
             .from('workflow_triggers')
             .insert({
               organization_id: organizationId,
               trigger_id: `trigger_${workflow.id}`,
               target_workflow_id: workflow.id,
               trigger_type: 'form_submission',
               source_form_id: triggerFormId,
               is_active: true,
               created_by: userId
             });
         }
         
         // Create nodes if provided
         if (Array.isArray(nodeDefinitions) && nodeDefinitions.length > 0) {
           const nodeIdMap: Record<string, string> = {};
           const nodesToInsert = [];
           
           for (let i = 0; i < nodeDefinitions.length; i++) {
             const nodeDef = nodeDefinitions[i];
             const tempId = nodeDef.tempId || `node_${i}`;
             const nodeId = crypto.randomUUID();
             nodeIdMap[tempId] = nodeId;
             
             nodesToInsert.push({
               id: nodeId,
               workflow_id: workflow.id,
               node_type: nodeDef.type || 'action',
               label: nodeDef.label || `Node ${i + 1}`,
               position_x: nodeDef.positionX || 250,
               position_y: nodeDef.positionY || 100 + (i * 150),
               config: nodeDef.config || {}
             });
           }
           
           await supabase.from('workflow_nodes').insert(nodesToInsert);
           
           // Create connections between nodes
           const connectionsToInsert = [];
           for (let i = 0; i < nodeDefinitions.length; i++) {
             const nodeDef = nodeDefinitions[i];
             const connections = nodeDef.connections || [];
             
             for (const conn of connections) {
               const sourceId = nodeIdMap[nodeDef.tempId || `node_${i}`];
               const targetId = nodeIdMap[conn.to];
               
               if (sourceId && targetId) {
                 connectionsToInsert.push({
                   workflow_id: workflow.id,
                   source_node_id: sourceId,
                   target_node_id: targetId,
                   source_handle: conn.sourceHandle || 'bottom',
                   target_handle: conn.targetHandle || 'top',
                   condition_type: conn.conditionType || null
                 });
               }
             }
           }
           
           if (connectionsToInsert.length > 0) {
             await supabase.from('workflow_connections').insert(connectionsToInsert);
           }
         }
 
         result = { workflowId: workflow.id };
         message = `Created workflow "${name}"!`;
         break;
       }
       
       case 'create_form_with_workflow': {
         let { formName, formDescription, fields, workflowName, workflowDescription, workflowNodes } = params;
         
         // Parse fields if string
         if (typeof fields === 'string') {
           try {
             fields = JSON.parse(fields);
           } catch (e) {
             console.error('Failed to parse fields JSON:', e);
             fields = [];
           }
         }
         if (!Array.isArray(fields)) fields = [];
         
         // Parse workflow nodes if string
         if (typeof workflowNodes === 'string') {
           try {
             workflowNodes = JSON.parse(workflowNodes);
           } catch (e) {
             console.error('Failed to parse workflowNodes JSON:', e);
             workflowNodes = [];
           }
         }
         if (!Array.isArray(workflowNodes)) workflowNodes = [];
         
         // 1. Create the form
         const { data: form, error: formError } = await supabase
           .from('forms')
           .insert({
             name: formName,
             description: formDescription,
             project_id: projectId,
             created_by: userId,
             status: 'draft',
             organization_id: organizationId
           })
           .select()
           .single();
 
         if (formError) throw formError;
         
         // 2. Create form fields
         if (fields.length > 0) {
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
         
         // 3. Create the workflow
         const { data: workflow, error: wfError } = await supabase
           .from('workflows')
           .insert({
             name: workflowName || `${formName} Workflow`,
             description: workflowDescription || `Automated workflow for ${formName}`,
             project_id: projectId,
             created_by: userId,
             organization_id: organizationId,
             status: 'draft'
           })
           .select()
           .single();
 
         if (wfError) throw wfError;
         
         // 4. Create workflow trigger linked to form
         await supabase
           .from('workflow_triggers')
           .insert({
             organization_id: organizationId,
             trigger_id: `trigger_${workflow.id}`,
             target_workflow_id: workflow.id,
             trigger_type: 'form_submission',
             source_form_id: form.id,
             is_active: true,
             created_by: userId
           });
         
         // 5. Create workflow nodes
         if (workflowNodes.length > 0) {
           const nodeIdMap: Record<string, string> = {};
           const nodesToInsert = [];
           
           for (let i = 0; i < workflowNodes.length; i++) {
             const nodeDef = workflowNodes[i];
             const tempId = nodeDef.tempId || `node_${i}`;
             const nodeId = crypto.randomUUID();
             nodeIdMap[tempId] = nodeId;
             
             nodesToInsert.push({
               id: nodeId,
               workflow_id: workflow.id,
               node_type: nodeDef.type || 'action',
               label: nodeDef.label || `Node ${i + 1}`,
               position_x: nodeDef.positionX || 250,
               position_y: nodeDef.positionY || 100 + (i * 150),
               config: nodeDef.config || {}
             });
           }
           
           await supabase.from('workflow_nodes').insert(nodesToInsert);
           
           // Create connections
           const connectionsToInsert = [];
           for (let i = 0; i < workflowNodes.length; i++) {
             const nodeDef = workflowNodes[i];
             const connections = nodeDef.connections || [];
             
             for (const conn of connections) {
               const sourceId = nodeIdMap[nodeDef.tempId || `node_${i}`];
               const targetId = nodeIdMap[conn.to];
               
               if (sourceId && targetId) {
                 connectionsToInsert.push({
                   workflow_id: workflow.id,
                   source_node_id: sourceId,
                   target_node_id: targetId,
                   source_handle: conn.sourceHandle || 'bottom',
                   target_handle: conn.targetHandle || 'top',
                   condition_type: conn.conditionType || null
                 });
               }
             }
           }
           
           if (connectionsToInsert.length > 0) {
             await supabase.from('workflow_connections').insert(connectionsToInsert);
           }
         } else {
           // Create basic start and end nodes if no nodes specified
           const startNodeId = crypto.randomUUID();
           const endNodeId = crypto.randomUUID();
           
           await supabase.from('workflow_nodes').insert([
             {
               id: startNodeId,
               workflow_id: workflow.id,
               node_type: 'start',
               label: 'Start',
               position_x: 250,
               position_y: 100,
               config: {}
             },
             {
               id: endNodeId,
               workflow_id: workflow.id,
               node_type: 'end',
               label: 'End',
               position_x: 250,
               position_y: 400,
               config: {}
             }
           ]);
           
           await supabase.from('workflow_connections').insert({
             workflow_id: workflow.id,
             source_node_id: startNodeId,
             target_node_id: endNodeId,
             source_handle: 'bottom',
             target_handle: 'top'
           });
         }
 
         result = { 
           formId: form.id, 
           formName: form.name,
           workflowId: workflow.id,
           workflowName: workflow.name
         };
         message = `Created form "${formName}" with linked workflow "${workflow.name}"!`;
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