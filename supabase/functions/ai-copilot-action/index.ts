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
 
       case 'create_form_with_sla': {
         let { formName, formDescription, fields, lifecycleFieldLabel, slaTemplateId, slaTemplateName, escalationChainId, escalationChainName, createNewSlaTemplate, newSlaConfig, createNewEscalationChain, newEscalationConfig } = params;
         
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
         
         // 2. Create form fields including lifecycle field
         let lifecycleFieldId: string | null = null;
         const formFields = fields.map((f: any, idx: number) => ({
           form_id: form.id,
           field_type: f.type || 'text',
           label: f.label,
           placeholder: f.placeholder,
           required: f.required || false,
           field_order: idx + 1,
           options: f.options ? JSON.stringify(f.options) : null,
           tooltip: f.tooltip,
           custom_config: f.customConfig || null
         }));
         
         // Add lifecycle status field if specified
         if (lifecycleFieldLabel) {
           const lifecycleOptions = [
             { id: crypto.randomUUID(), value: 'pending', label: 'Pending' },
             { id: crypto.randomUUID(), value: 'in_progress', label: 'In Progress' },
             { id: crypto.randomUUID(), value: 'completed', label: 'Completed' }
           ];
           formFields.push({
             form_id: form.id,
             field_type: 'select',
             label: lifecycleFieldLabel,
             placeholder: 'Select status',
             required: false,
             field_order: formFields.length + 1,
             options: JSON.stringify(lifecycleOptions),
             tooltip: 'Lifecycle status for SLA tracking',
             custom_config: JSON.stringify({ isLifecycleStatusBar: true })
           });
         }
         
         const { data: insertedFields } = await supabase.from('form_fields').insert(formFields).select();
         
         // Find lifecycle field ID
         if (insertedFields && lifecycleFieldLabel) {
           const lifecycleField = insertedFields.find((f: any) => f.label === lifecycleFieldLabel);
           if (lifecycleField) lifecycleFieldId = lifecycleField.id;
         }
         
         // 3. Handle SLA template - create new or use existing
         let finalSlaTemplateId = slaTemplateId;
         let finalSlaTemplateName = slaTemplateName;
         
         if (createNewSlaTemplate && newSlaConfig) {
           if (typeof newSlaConfig === 'string') {
             try {
               newSlaConfig = JSON.parse(newSlaConfig);
             } catch (e) {
               console.error('Failed to parse SLA config:', e);
             }
           }
           
           const { data: newTemplate, error: slaError } = await supabase
             .from('sla_templates')
             .insert({
               name: newSlaConfig.name || `${formName} SLA`,
               description: newSlaConfig.description,
               organization_id: organizationId,
               project_id: projectId,
               created_by: userId,
               warning_threshold_hours: newSlaConfig.warningThresholdHours || 4,
               breach_threshold_hours: newSlaConfig.breachThresholdHours || 8,
               business_hours_start: newSlaConfig.businessHoursStart || '09:00',
               business_hours_end: newSlaConfig.businessHoursEnd || '17:00',
               business_days: newSlaConfig.businessDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
               priority_multipliers: newSlaConfig.priorityMultipliers || { low: 1.5, normal: 1.0, high: 0.5, urgent: 0.25 },
               is_active: true
             })
             .select()
             .single();
           
           if (!slaError && newTemplate) {
             finalSlaTemplateId = newTemplate.id;
             finalSlaTemplateName = newTemplate.name;
           }
         } else if (slaTemplateName && !slaTemplateId) {
           // Lookup existing template by name
           const { data: existingTemplate } = await supabase
             .from('sla_templates')
             .select('id, name')
             .eq('organization_id', organizationId)
             .ilike('name', `%${slaTemplateName}%`)
             .limit(1)
             .single();
           
           if (existingTemplate) {
             finalSlaTemplateId = existingTemplate.id;
             finalSlaTemplateName = existingTemplate.name;
           }
         }
         
         // 4. Handle escalation chain - create new or use existing
         let finalEscalationChainId = escalationChainId;
         let finalEscalationChainName = escalationChainName;
         
         if (createNewEscalationChain && newEscalationConfig) {
           if (typeof newEscalationConfig === 'string') {
             try {
               newEscalationConfig = JSON.parse(newEscalationConfig);
             } catch (e) {
               console.error('Failed to parse escalation config:', e);
             }
           }
           
           const { data: newChain, error: chainError } = await supabase
             .from('escalation_chains')
             .insert({
               name: newEscalationConfig.name || `${formName} Escalation`,
               description: newEscalationConfig.description,
               organization_id: organizationId,
               project_id: projectId,
               created_by: userId,
               is_active: true
             })
             .select()
             .single();
           
           if (!chainError && newChain) {
             finalEscalationChainId = newChain.id;
             finalEscalationChainName = newChain.name;
             
             // Create escalation levels if provided
             if (newEscalationConfig.levels && Array.isArray(newEscalationConfig.levels)) {
               const levels = newEscalationConfig.levels.map((level: any, idx: number) => ({
                 chain_id: newChain.id,
                 level: level.level || ['L1', 'L2', 'L3', 'L4'][idx] || 'L1',
                 level_order: idx + 1,
                 hours_after_breach: level.hoursAfterBreach || (idx + 1) * 2,
                 send_email: level.sendEmail ?? true,
                 send_notification: level.sendNotification ?? true,
                 send_sms: level.sendSms ?? false,
                 custom_message: level.customMessage
               }));
               
               await supabase.from('escalation_levels').insert(levels);
             }
           }
         } else if (escalationChainName && !escalationChainId) {
           // Lookup existing chain by name
           const { data: existingChain } = await supabase
             .from('escalation_chains')
             .select('id, name')
             .eq('organization_id', organizationId)
             .ilike('name', `%${escalationChainName}%`)
             .limit(1)
             .single();
           
           if (existingChain) {
             finalEscalationChainId = existingChain.id;
             finalEscalationChainName = existingChain.name;
           }
         }
         
         // 5. Create form_field_sla_config to link everything
         if (lifecycleFieldId && finalSlaTemplateId) {
           await supabase
             .from('form_field_sla_config')
             .insert({
               form_id: form.id,
               field_id: lifecycleFieldId,
               template_id: finalSlaTemplateId,
               chain_id: finalEscalationChainId,
               is_active: true
             });
         }
 
         result = { 
           formId: form.id, 
           formName: form.name,
           lifecycleFieldId,
           slaTemplateId: finalSlaTemplateId,
           slaTemplateName: finalSlaTemplateName,
           escalationChainId: finalEscalationChainId,
           escalationChainName: finalEscalationChainName
         };
         message = `Created form "${formName}" with SLA tracking${finalSlaTemplateName ? ` using "${finalSlaTemplateName}" template` : ''}${finalEscalationChainName ? ` and "${finalEscalationChainName}" escalation chain` : ''}!`;
         break;
       }
 
       case 'create_form_with_email_template': {
         let { formName, formDescription, fields, emailTemplateName, emailSubject, emailBody, emailRecipientType, createNewTemplate, existingTemplateId, existingTemplateName } = params;
         
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
         
         // 3. Handle email template - create new or link existing
         let finalTemplateId = existingTemplateId;
         let finalTemplateName = existingTemplateName;
         
         if (createNewTemplate !== false && emailTemplateName) {
           // Build recipient config
           const recipientConfig: any = { to: [], cc: [], bcc: [] };
           if (emailRecipientType === 'submitter') {
             recipientConfig.to = [{ type: 'parameter', parameterType: 'submitter_email', fieldId: null }];
           } else if (emailRecipientType === 'form_owner') {
             recipientConfig.to = [{ type: 'parameter', parameterType: 'form_owner_email', fieldId: null }];
           }
           
           const { data: newTemplate, error: templateError } = await supabase
             .from('email_templates')
             .insert({
               name: emailTemplateName,
               description: `Auto-generated template for ${formName}`,
               subject: emailSubject || `New submission for ${formName}`,
               html_content: emailBody || `<p>A new submission has been received for <strong>${formName}</strong>.</p><p>Please review the submission details.</p>`,
               project_id: projectId,
               created_by: userId,
               is_active: true,
               recipients: recipientConfig,
               template_variables: [],
               custom_params: {}
             })
             .select()
             .single();
           
           if (!templateError && newTemplate) {
             finalTemplateId = newTemplate.id;
             finalTemplateName = newTemplate.name;
           }
         } else if (existingTemplateName && !existingTemplateId) {
           // Lookup existing template by name
           const { data: existingTemplate } = await supabase
             .from('email_templates')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${existingTemplateName}%`)
             .limit(1)
             .single();
           
           if (existingTemplate) {
             finalTemplateId = existingTemplate.id;
             finalTemplateName = existingTemplate.name;
           }
         }
         
         // 4. Create a form rule to trigger email on submission
         if (finalTemplateId) {
           const formRules = [{
             id: crypto.randomUUID(),
             name: `Send email on submission`,
             conditions: [],
             actions: [{
               type: 'sendEmail',
               config: { templateId: finalTemplateId }
             }],
             isActive: true,
             ruleType: 'submission'
           }];
           
           await supabase
             .from('forms')
             .update({ form_rules: formRules })
             .eq('id', form.id);
         }
 
         result = { 
           formId: form.id, 
           formName: form.name,
           emailTemplateId: finalTemplateId,
           emailTemplateName: finalTemplateName
         };
         message = `Created form "${formName}"${finalTemplateName ? ` with email template "${finalTemplateName}"` : ''}!`;
         break;
       }
 
       case 'add_email_action_to_workflow': {
         let { workflowId, workflowName, emailTemplateId, emailTemplateName, actionLabel, position, createNewTemplate, newTemplateConfig } = params;
         
         // Find workflow by ID or name
         let targetWorkflowId = workflowId;
         let targetWorkflowName = workflowName;
         
         if (!targetWorkflowId && workflowName) {
           const { data: workflow } = await supabase
             .from('workflows')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${workflowName}%`)
             .limit(1)
             .single();
           
           if (workflow) {
             targetWorkflowId = workflow.id;
             targetWorkflowName = workflow.name;
           } else {
             throw new Error(`Workflow "${workflowName}" not found`);
           }
         }
         
         if (!targetWorkflowId) {
           throw new Error('Workflow ID or name required');
         }
         
         // Find or create email template
         let finalTemplateId = emailTemplateId;
         let finalTemplateName = emailTemplateName;
         
         if (createNewTemplate && newTemplateConfig) {
           if (typeof newTemplateConfig === 'string') {
             try {
               newTemplateConfig = JSON.parse(newTemplateConfig);
             } catch (e) {
               console.error('Failed to parse template config:', e);
             }
           }
           
           const { data: newTemplate, error: templateError } = await supabase
             .from('email_templates')
             .insert({
               name: newTemplateConfig.name || 'Workflow Email',
               description: newTemplateConfig.description,
               subject: newTemplateConfig.subject || 'Workflow Notification',
               html_content: newTemplateConfig.htmlContent || '<p>Workflow action triggered.</p>',
               project_id: projectId,
               created_by: userId,
               is_active: true,
               recipients: newTemplateConfig.recipients || { to: [], cc: [], bcc: [] },
               template_variables: [],
               custom_params: {}
             })
             .select()
             .single();
           
           if (!templateError && newTemplate) {
             finalTemplateId = newTemplate.id;
             finalTemplateName = newTemplate.name;
           }
         } else if (emailTemplateName && !emailTemplateId) {
           const { data: existingTemplate } = await supabase
             .from('email_templates')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${emailTemplateName}%`)
             .limit(1)
             .single();
           
           if (existingTemplate) {
             finalTemplateId = existingTemplate.id;
             finalTemplateName = existingTemplate.name;
           }
         }
         
         // Get existing nodes to determine position
         const { data: existingNodes } = await supabase
           .from('workflow_nodes')
           .select('*')
           .eq('workflow_id', targetWorkflowId)
           .order('position_y', { ascending: false });
         
         const maxY = existingNodes?.length ? Math.max(...existingNodes.map((n: any) => n.position_y)) : 0;
         const newNodeId = crypto.randomUUID();
         
         // Create action node with email configuration
         const { data: newNode, error: nodeError } = await supabase
           .from('workflow_nodes')
           .insert({
             id: newNodeId,
             workflow_id: targetWorkflowId,
             node_type: 'action',
             label: actionLabel || 'Send Email',
             position_x: position?.x || 250,
             position_y: position?.y || maxY + 150,
             config: {
               actionType: 'send_notification',
               notificationConfig: {
                 type: 'email',
                 templateId: finalTemplateId,
                 templateName: finalTemplateName
               }
             }
           })
           .select()
           .single();
         
         if (nodeError) throw nodeError;
 
         result = { 
           workflowId: targetWorkflowId, 
           workflowName: targetWorkflowName,
           nodeId: newNodeId,
           emailTemplateId: finalTemplateId,
           emailTemplateName: finalTemplateName
         };
         message = `Added email action node to workflow "${targetWorkflowName}"${finalTemplateName ? ` using template "${finalTemplateName}"` : ''}!`;
         break;
       }
 
       case 'link_form_to_workflow': {
         let { formId, formName, workflowId, workflowName, createTrigger } = params;
         
         // Find form by ID or name
         let targetFormId = formId;
         let targetFormName = formName;
         
         if (!targetFormId && formName) {
           const { data: form } = await supabase
             .from('forms')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${formName}%`)
             .limit(1)
             .single();
           
           if (form) {
             targetFormId = form.id;
             targetFormName = form.name;
           } else {
             throw new Error(`Form "${formName}" not found`);
           }
         }
         
         // Find workflow by ID or name
         let targetWorkflowId = workflowId;
         let targetWorkflowName = workflowName;
         
         if (!targetWorkflowId && workflowName) {
           const { data: workflow } = await supabase
             .from('workflows')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${workflowName}%`)
             .limit(1)
             .single();
           
           if (workflow) {
             targetWorkflowId = workflow.id;
             targetWorkflowName = workflow.name;
           } else {
             throw new Error(`Workflow "${workflowName}" not found`);
           }
         }
         
         if (!targetFormId || !targetWorkflowId) {
           throw new Error('Both form and workflow are required');
         }
         
         // Create workflow trigger
         if (createTrigger !== false) {
           await supabase
             .from('workflow_triggers')
             .insert({
               organization_id: organizationId,
               trigger_id: `trigger_${targetWorkflowId}_${targetFormId}`,
               target_workflow_id: targetWorkflowId,
               trigger_type: 'form_submission',
               source_form_id: targetFormId,
               is_active: true,
               created_by: userId
             });
         }
 
         result = { 
           formId: targetFormId, 
           formName: targetFormName,
           workflowId: targetWorkflowId,
           workflowName: targetWorkflowName
         };
         message = `Linked form "${targetFormName}" to workflow "${targetWorkflowName}"!`;
         break;
       }
 
       case 'link_form_to_sla': {
         let { formId, formName, lifecycleFieldId, lifecycleFieldLabel, slaTemplateId, slaTemplateName, escalationChainId, escalationChainName } = params;
         
         // Find form by ID or name
         let targetFormId = formId;
         
         if (!targetFormId && formName) {
           const { data: form } = await supabase
             .from('forms')
             .select('id, name')
             .eq('project_id', projectId)
             .ilike('name', `%${formName}%`)
             .limit(1)
             .single();
           
           if (form) {
             targetFormId = form.id;
           } else {
             throw new Error(`Form "${formName}" not found`);
           }
         }
         
         // Find lifecycle field by label if not provided
         let targetFieldId = lifecycleFieldId;
         
         if (!targetFieldId && lifecycleFieldLabel) {
           const { data: field } = await supabase
             .from('form_fields')
             .select('id, label')
             .eq('form_id', targetFormId)
             .ilike('label', `%${lifecycleFieldLabel}%`)
             .limit(1)
             .single();
           
           if (field) {
             targetFieldId = field.id;
           }
         }
         
         // Find SLA template by name if not provided
         let targetSlaTemplateId = slaTemplateId;
         let targetSlaTemplateName = slaTemplateName;
         
         if (!targetSlaTemplateId && slaTemplateName) {
           const { data: template } = await supabase
             .from('sla_templates')
             .select('id, name')
             .eq('organization_id', organizationId)
             .ilike('name', `%${slaTemplateName}%`)
             .limit(1)
             .single();
           
           if (template) {
             targetSlaTemplateId = template.id;
             targetSlaTemplateName = template.name;
           } else {
             throw new Error(`SLA template "${slaTemplateName}" not found`);
           }
         }
         
         // Find escalation chain by name if not provided
         let targetChainId = escalationChainId;
         let targetChainName = escalationChainName;
         
         if (!targetChainId && escalationChainName) {
           const { data: chain } = await supabase
             .from('escalation_chains')
             .select('id, name')
             .eq('organization_id', organizationId)
             .ilike('name', `%${escalationChainName}%`)
             .limit(1)
             .single();
           
           if (chain) {
             targetChainId = chain.id;
             targetChainName = chain.name;
           }
         }
         
         if (!targetFormId || !targetFieldId || !targetSlaTemplateId) {
           throw new Error('Form, lifecycle field, and SLA template are required');
         }
         
         // Create SLA config
         await supabase
           .from('form_field_sla_config')
           .upsert({
             form_id: targetFormId,
             field_id: targetFieldId,
             template_id: targetSlaTemplateId,
             chain_id: targetChainId,
             is_active: true
           }, { onConflict: 'form_id,field_id' });
 
         result = { 
           formId: targetFormId,
           fieldId: targetFieldId,
           slaTemplateId: targetSlaTemplateId,
           slaTemplateName: targetSlaTemplateName,
           escalationChainId: targetChainId,
           escalationChainName: targetChainName
         };
         message = `Linked SLA template "${targetSlaTemplateName}" to form${targetChainName ? ` with escalation chain "${targetChainName}"` : ''}!`;
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