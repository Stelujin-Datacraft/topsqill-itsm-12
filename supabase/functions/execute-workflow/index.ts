import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkflowNode {
  id: string
  workflow_id: string
  node_type: string
  label: string
  config: any
  position_x: number
  position_y: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { workflowId, executionId, triggerData, submissionId, submitterId } = body

    if (!workflowId || !executionId) {
      return new Response(
        JSON.stringify({ error: 'workflowId and executionId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🚀 Starting workflow execution: ${executionId} for workflow: ${workflowId}`)

    // Find the start node
    const { data: startNodes, error: startError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('node_type', 'start')
      .limit(1)

    if (startError || !startNodes || startNodes.length === 0) {
      console.error('❌ No start node found:', startError)
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: 'No start node found in workflow',
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId)

      return new Response(
        JSON.stringify({ error: 'No start node found in workflow' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startNode = startNodes[0] as WorkflowNode

    // Update execution with current node
    await supabase
      .from('workflow_executions')
      .update({ 
        current_node_id: startNode.id,
        started_at: new Date().toISOString()
      })
      .eq('id', executionId)

    // Process nodes starting from the start node
    const nodeQueue: WorkflowNode[] = [startNode]
    const processedNodeIds = new Set<string>()
    let hasEndNode = false
    let allNodesProcessed = true

    while (nodeQueue.length > 0) {
      const currentNode = nodeQueue.shift()!

      if (processedNodeIds.has(currentNode.id) && currentNode.node_type !== 'wait') {
        console.log(`⏭️ Skipping already processed node: ${currentNode.id}`)
        continue
      }

      processedNodeIds.add(currentNode.id)
      console.log(`🎯 Executing node: ${currentNode.label} (${currentNode.node_type})`)

      // Update current node in execution
      await supabase
        .from('workflow_executions')
        .update({ current_node_id: currentNode.id })
        .eq('id', executionId)

      // Get next execution order
      const { data: orderData } = await supabase.rpc('get_next_execution_order', { exec_id: executionId })
      const executionOrder = orderData || 1
      const nodeStartTime = new Date().toISOString()

      // Create log entry
      const config = currentNode.config as any
      const actionType = currentNode.node_type === 'action' ? config?.actionType : null

      const { data: logEntry, error: logError } = await supabase
        .from('workflow_instance_logs')
        .insert({
          execution_id: executionId,
          node_id: currentNode.id,
          node_type: currentNode.node_type,
          node_label: currentNode.label,
          status: 'running',
          started_at: nodeStartTime,
          execution_order: executionOrder,
          action_type: actionType,
          input_data: triggerData || {}
        })
        .select()
        .single()

      if (logError) {
        console.error(`⚠️ Error creating log entry:`, logError)
      }

      let nodeStatus: 'completed' | 'failed' | 'waiting' = 'completed'
      let nodeError: string | null = null
      let outputData: any = { success: true }
      let nextNodeIds: string[] = []

      try {
        // Execute node based on type
        switch (currentNode.node_type) {
          case 'start':
            console.log('▶️ Start node executed')
            outputData = { triggered: true, triggerData }
            break

          case 'end':
            console.log('🏁 End node reached')
            hasEndNode = true
            outputData = { completed: true }
            break

          case 'wait':
            console.log('⏱️ Wait node - setting workflow to waiting state')
            const waitConfig = config || {}
            const waitDuration = waitConfig.duration || 1
            const waitUnit = waitConfig.unit || 'minutes'
            
            let resumeTime = new Date()
            switch (waitUnit) {
              case 'seconds':
                resumeTime.setSeconds(resumeTime.getSeconds() + waitDuration)
                break
              case 'minutes':
                resumeTime.setMinutes(resumeTime.getMinutes() + waitDuration)
                break
              case 'hours':
                resumeTime.setHours(resumeTime.getHours() + waitDuration)
                break
              case 'days':
                resumeTime.setDate(resumeTime.getDate() + waitDuration)
                break
            }

            await supabase
              .from('workflow_executions')
              .update({
                status: 'waiting',
                wait_node_id: currentNode.id,
                wait_config: waitConfig,
                scheduled_resume_at: resumeTime.toISOString()
              })
              .eq('id', executionId)

            nodeStatus = 'waiting'
            outputData = { waiting: true, resumeAt: resumeTime.toISOString() }
            break

          case 'action':
            console.log(`🎯 Action node: ${actionType}`)
            outputData = await executeActionNode(supabase, currentNode, executionId, triggerData, submissionId, submitterId)
            break

          case 'notification':
            console.log('🔔 Notification node')
            outputData = await executeNotificationNode(supabase, currentNode, executionId, triggerData, submitterId)
            break

          case 'condition':
            console.log('🔍 Condition node - evaluating...')
            const conditionResult = await evaluateCondition(supabase, currentNode, triggerData, submissionId)
            console.log(`📊 Condition evaluation result: ${conditionResult}`)
            outputData = { conditionResult, evaluated: true }
            
            // Get connections for condition node - note: column is 'condition_type' and 'source_handle'
            const { data: condConnections } = await supabase
              .from('workflow_connections')
              .select('target_node_id, condition_type, source_handle')
              .eq('source_node_id', currentNode.id)

            console.log(`📊 Found ${condConnections?.length || 0} connections from condition node`)
            
            if (condConnections) {
              for (const conn of condConnections) {
                // Use source_handle for true/false branching, fallback to condition_type
                const handleType = (conn.source_handle || conn.condition_type || '').toLowerCase()
                console.log(`   📊 Connection: source_handle="${conn.source_handle}", condition_type="${conn.condition_type}", target="${conn.target_node_id}"`)
                const connType = handleType
                const isTrue = connType === 'true' || connType === 'yes' || connType === 'default-true'
                const isFalse = connType === 'false' || connType === 'no' || connType === 'default-false'
                
                // Only follow the appropriate branch based on condition result
                if (conditionResult && isTrue) {
                  console.log(`   ✅ Following TRUE branch to ${conn.target_node_id}`)
                  nextNodeIds.push(conn.target_node_id)
                } else if (!conditionResult && isFalse) {
                  console.log(`   ❌ Following FALSE branch to ${conn.target_node_id}`)
                  nextNodeIds.push(conn.target_node_id)
                } else if (!isTrue && !isFalse) {
                  // Handle default/unlabeled connections - follow based on condition result
                  console.log(`   ➡️ Unlabeled connection, treating as default`)
                  // Default connections typically go to true path
                  if (conditionResult) {
                    nextNodeIds.push(conn.target_node_id)
                  }
                }
              }
            }
            
            console.log(`📊 Next nodes to execute: ${nextNodeIds.join(', ') || 'none'}`)
            break

          default:
            console.log(`⚠️ Unknown node type: ${currentNode.node_type}`)
            outputData = { skipped: true, reason: 'Unknown node type' }
        }
      } catch (execError) {
        console.error(`❌ Node execution error:`, execError)
        nodeStatus = 'failed'
        nodeError = execError instanceof Error ? execError.message : 'Unknown error'
        allNodesProcessed = false
      }

      // Update log entry
      if (logEntry) {
        await supabase
          .from('workflow_instance_logs')
          .update({
            status: nodeStatus,
            completed_at: nodeStatus !== 'waiting' ? new Date().toISOString() : null,
            output_data: outputData,
            error_message: nodeError,
            duration_ms: Date.now() - new Date(nodeStartTime).getTime()
          })
          .eq('id', logEntry.id)
      }

      // If waiting, stop processing
      if (nodeStatus === 'waiting') {
        console.log('⏸️ Workflow paused, waiting for resume')
        return new Response(
          JSON.stringify({ 
            success: true, 
            executionId, 
            status: 'waiting',
            message: 'Workflow paused at wait node'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If failed, stop and mark workflow as failed
      if (nodeStatus === 'failed') {
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: nodeError,
            completed_at: new Date().toISOString()
          })
          .eq('id', executionId)

        return new Response(
          JSON.stringify({ success: false, executionId, error: nodeError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get next nodes if not already set (for non-condition nodes)
      if (nextNodeIds.length === 0 && currentNode.node_type !== 'end') {
        const { data: connections } = await supabase
          .from('workflow_connections')
          .select('target_node_id')
          .eq('source_node_id', currentNode.id)

        if (connections) {
          nextNodeIds = connections.map(c => c.target_node_id)
        }
      }

      // Add next nodes to queue
      if (nextNodeIds.length > 0) {
        const { data: nextNodes } = await supabase
          .from('workflow_nodes')
          .select('*')
          .in('id', nextNodeIds)

        if (nextNodes) {
          nodeQueue.push(...(nextNodes as WorkflowNode[]))
        }
      }
    }

    // Mark workflow as completed
    await supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_node_id: null
      })
      .eq('id', executionId)

    console.log(`✅ Workflow execution completed: ${executionId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        executionId, 
        status: 'completed',
        message: 'Workflow executed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Workflow execution error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to execute action nodes
async function executeActionNode(
  supabase: any, 
  node: WorkflowNode, 
  executionId: string,
  triggerData: any,
  submissionId?: string,
  submitterId?: string
): Promise<any> {
  const config = node.config as any
  const actionType = config?.actionType

  switch (actionType) {
    case 'update_field':
      return await executeUpdateField(supabase, config, submissionId, triggerData)
    case 'send_email':
      return await executeNotification(supabase, { ...config, notificationConfig: { ...config.notificationConfig, type: 'email' } }, triggerData, submitterId)
    case 'send_notification':
      return await executeNotification(supabase, config, triggerData, submitterId)
    case 'change_field_value':
      return await executeChangeFieldValue(supabase, config, triggerData, submissionId)
    case 'change_record_status':
      return await executeChangeRecordStatus(supabase, config, triggerData, submissionId)
    default:
      return { executed: true, actionType }
  }
}

async function executeChangeFieldValue(supabase: any, config: any, triggerData: any, submissionId?: string): Promise<any> {
  console.log('🔧 Executing change_field_value action')
  
  const triggerSubmissionData = triggerData?.submissionData || triggerData || {}
  const triggerSubmissionId = triggerData?.submissionId || submissionId
  const triggerFormId = triggerData?.formId

  // Support both multi-field and legacy single-field format
  interface FieldUpdate {
    targetFieldId: string
    targetFieldName?: string
    targetFieldType?: string
    valueType: 'static' | 'dynamic'
    staticValue?: any
    dynamicValuePath?: string
    dynamicFieldName?: string
    dynamicFieldType?: string
  }

  let fieldUpdates: FieldUpdate[] = []

  if (config.fieldUpdates && Array.isArray(config.fieldUpdates) && config.fieldUpdates.length > 0) {
    fieldUpdates = config.fieldUpdates
  } else if (config.targetFieldId && config.valueType) {
    fieldUpdates = [{
      targetFieldId: config.targetFieldId,
      targetFieldName: config.targetFieldName,
      targetFieldType: config.targetFieldType,
      valueType: config.valueType,
      staticValue: config.staticValue,
      dynamicValuePath: config.dynamicValuePath,
      dynamicFieldName: config.dynamicFieldName,
      dynamicFieldType: config.dynamicFieldType
    }]
  }

  if (!config.targetFormId || fieldUpdates.length === 0) {
    return { success: false, error: 'Missing required configuration for field value change' }
  }

  const fieldValueMap: Record<string, any> = {}
  const results: Array<{ fieldId: string; fieldName?: string; newValue: any; success: boolean; error?: string }> = []

  for (const update of fieldUpdates) {
    let newValue: any = undefined

    if (update.valueType === 'static') {
      newValue = update.staticValue
      console.log(`📝 Static value for ${update.targetFieldName}: ${newValue}`)
    } else if (update.valueType === 'dynamic') {
      const dynamicPath = update.dynamicValuePath
      if (dynamicPath && dynamicPath in triggerSubmissionData) {
        newValue = triggerSubmissionData[dynamicPath]
      } else {
        const matchingKey = Object.keys(triggerSubmissionData).find(key =>
          key === dynamicPath || key.toLowerCase() === dynamicPath?.toLowerCase()
        )
        if (matchingKey) newValue = triggerSubmissionData[matchingKey]
      }

      if (newValue === undefined) {
        console.log(`⚠️ Could not find value for: ${update.dynamicFieldName || update.dynamicValuePath}`)
        results.push({ fieldId: update.targetFieldId, fieldName: update.targetFieldName, newValue: undefined, success: false, error: `Value not found for: ${update.dynamicFieldName || update.dynamicValuePath}` })
        continue
      }

      // Normalize numeric values
      const numericTypes = ['number', 'currency', 'slider', 'rating']
      if (numericTypes.includes(update.targetFieldType?.toLowerCase() || '') && typeof newValue === 'string' && newValue.trim() !== '') {
        const parsed = parseFloat(newValue.replace(/[,$€£¥₹\s]/g, '').trim())
        if (!isNaN(parsed)) newValue = parsed
      }
    }

    // Fetch target field for type validation
    const { data: targetField } = await supabase
      .from('form_fields')
      .select('id, field_type, custom_config')
      .eq('id', update.targetFieldId)
      .single()

    if (targetField) {
      // Handle submission-access field
      if (targetField.field_type === 'submission-access') {
        let parsedValue = typeof newValue === 'string' ? (() => { try { return JSON.parse(newValue) } catch { return null } })() : newValue
        let sourceUsers: string[] = []
        let sourceGroups: string[] = []
        const customConfig = typeof targetField.custom_config === 'string' ? (() => { try { return JSON.parse(targetField.custom_config) } catch { return {} } })() : (targetField.custom_config || {})
        const allowedUsers = customConfig.allowedUsers || []
        const allowedGroups = customConfig.allowedGroups || []

        if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
          sourceUsers = parsedValue.users || []
          sourceGroups = parsedValue.groups || []
        } else if (Array.isArray(parsedValue)) {
          parsedValue.forEach((item: string) => {
            if (typeof item === 'string') {
              if (item.startsWith('user:')) sourceUsers.push(item.replace('user:', ''))
              else if (item.startsWith('group:')) sourceGroups.push(item.replace('group:', ''))
            }
          })
        }

        const validUsers = sourceUsers.filter((u: string) => allowedUsers.includes(u))
        const validGroups = sourceGroups.filter((g: string) => allowedGroups.includes(g))

        if (validUsers.length > 0 || validGroups.length > 0) {
          newValue = { users: validUsers, groups: validGroups }
        } else {
          results.push({ fieldId: update.targetFieldId, fieldName: update.targetFieldName, newValue: undefined, success: false, error: 'Invalid submission-access value' })
          continue
        }
      }

      // Handle numeric normalization from target field type
      const numericTargetTypes = ['number', 'currency', 'slider', 'rating']
      if (numericTargetTypes.includes(targetField.field_type?.toLowerCase()) && typeof newValue === 'string' && newValue.trim() !== '') {
        const parsed = parseFloat(newValue.replace(/[,$€£¥₹\s]/g, '').trim())
        if (!isNaN(parsed)) newValue = parsed
      }
    }

    console.log(`📝 Final value for ${update.targetFieldName} (${update.targetFieldId}): ${JSON.stringify(newValue)}`)
    fieldValueMap[update.targetFieldId] = newValue
    results.push({ fieldId: update.targetFieldId, fieldName: update.targetFieldName, newValue, success: true })
  }

  const successfulUpdates = results.filter(r => r.success)
  if (successfulUpdates.length === 0) {
    return { success: false, error: `All field updates failed: ${results.map(r => r.error).join('; ')}` }
  }

  const isTargetFormDifferent = config.targetFormId !== triggerFormId

  if (isTargetFormDifferent) {
    console.log('🔄 Bulk update on target form:', config.targetFormId)
    let totalUpdated = 0
    for (const [fieldId, newValue] of Object.entries(fieldValueMap)) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('bulk_update_submission_field', {
        _form_id: config.targetFormId,
        _field_id: fieldId,
        _new_value: newValue
      })
      if (rpcError) console.error('❌ Bulk update error:', fieldId, rpcError)
      else totalUpdated = Math.max(totalUpdated, rpcResult || 0)
    }
    console.log(`✅ Bulk updated ${totalUpdated} records`)
    return { updatedCount: totalUpdated, targetFormId: config.targetFormId, fieldsUpdated: successfulUpdates.length, fieldDetails: results, success: true }
  } else {
    if (!triggerSubmissionId) {
      return { success: false, error: 'Cannot update trigger submission: no submission ID' }
    }

    const { data: currentSubmission, error: fetchError } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('id', triggerSubmissionId)
      .single()

    if (fetchError) return { success: false, error: `Submission not found: ${fetchError.message}` }

    const currentData = currentSubmission?.submission_data || {}
    const updatedData = { ...(typeof currentData === 'object' ? currentData : {}), ...fieldValueMap }

    const { error: updateError } = await supabase
      .from('form_submissions')
      .update({ submission_data: updatedData })
      .eq('id', triggerSubmissionId)

    if (updateError) return { success: false, error: `Update failed: ${updateError.message}` }

    console.log(`✅ Updated ${successfulUpdates.length} field(s) in submission ${triggerSubmissionId}`)
    return { submissionId: triggerSubmissionId, fieldsUpdated: successfulUpdates.length, fieldDetails: results, success: true }
  }
}

async function executeChangeRecordStatus(supabase: any, config: any, triggerData: any, submissionId?: string): Promise<any> {
  console.log('🔧 Executing change_record_status action')
  
  const targetFormId = config?.targetFormId
  const newStatus = config?.newStatus
  const statusNotes = config?.statusNotes || ''
  const triggerSubmissionId = triggerData?.submissionId || submissionId

  if (!targetFormId || !newStatus) {
    return { success: false, error: 'Missing targetFormId or newStatus' }
  }

  const triggerFormId = triggerData?.formId
  const isTargetFormDifferent = targetFormId !== triggerFormId

  if (isTargetFormDifferent) {
    const { data, error } = await supabase
      .from('form_submissions')
      .update({ status: newStatus })
      .eq('form_id', targetFormId)
      .select('id')

    if (error) return { success: false, error: error.message }
    console.log(`✅ Updated status to "${newStatus}" for ${data?.length || 0} records`)
    return { success: true, updatedCount: data?.length || 0, newStatus }
  } else {
    if (!triggerSubmissionId) return { success: false, error: 'No submission ID for status update' }

    const { error } = await supabase
      .from('form_submissions')
      .update({ status: newStatus })
      .eq('id', triggerSubmissionId)

    if (error) return { success: false, error: error.message }
    console.log(`✅ Updated status to "${newStatus}" for submission ${triggerSubmissionId}`)
    return { success: true, submissionId: triggerSubmissionId, newStatus }
  }
}

async function executeUpdateField(supabase: any, config: any, submissionId?: string, triggerData?: any): Promise<any> {
  const fieldId = config?.fieldId
  const newValue = config?.value

  if (!submissionId || !fieldId) {
    return { success: false, error: 'Missing submissionId or fieldId' }
  }

  // Get current submission
  const { data: submission, error: fetchError } = await supabase
    .from('form_submissions')
    .select('submission_data')
    .eq('id', submissionId)
    .single()

  if (fetchError || !submission) {
    return { success: false, error: 'Submission not found' }
  }

  // Update the field
  const updatedData = { ...submission.submission_data, [fieldId]: newValue }
  
  const { error: updateError } = await supabase
    .from('form_submissions')
    .update({ submission_data: updatedData })
    .eq('id', submissionId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, fieldId, newValue }
}

async function executeNotification(supabase: any, config: any, triggerData: any, submitterId?: string): Promise<any> {
  const notificationConfig = config?.notificationConfig || {}
  const notificationType = notificationConfig.type || 'in_app'
  const title = notificationConfig.subject || notificationConfig.title || 'Workflow Notification'
  const message = notificationConfig.message || 'You have a notification from a workflow'
  const recipientType = notificationConfig.recipientType || config?.recipientType || 'submitter'

  console.log('🔔 executeNotification called with:', { notificationType, recipientType, title })

  // Resolve recipient(s)
  let recipientId = submitterId
  let recipientEmails: string[] = []

  if (recipientType === 'specific_user') {
    recipientId = notificationConfig.specificUserId || config?.specificUserId
  }

  // Resolve recipient emails from recipientConfig
  const recipientConfig = notificationConfig.recipientConfig
  if (recipientConfig) {
    console.log('📧 Resolving recipients from recipientConfig:', recipientConfig.type)
    
    if (recipientConfig.type === 'form_submitter' && submitterId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', submitterId)
        .single()
      if (profile?.email) {
        recipientEmails.push(profile.email)
        recipientId = submitterId
      }
    } else if (recipientConfig.type === 'static' && recipientConfig.emails?.length > 0) {
      recipientEmails = recipientConfig.emails.filter((e: string) => e && e.includes('@'))
      // Try to find user ID for the first email
      if (recipientEmails.length > 0 && !recipientId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', recipientEmails[0])
          .single()
        if (profile?.id) recipientId = profile.id
      }
    } else if (recipientConfig.type === 'dynamic' && recipientConfig.dynamicFieldPath) {
      const fieldValue = triggerData?.submissionData?.[recipientConfig.dynamicFieldPath]
      if (typeof fieldValue === 'string' && fieldValue.includes('@')) {
        recipientEmails.push(fieldValue)
      }
    }
  }

  // Fallback: get email from submitterId if no emails resolved
  if (recipientEmails.length === 0 && recipientId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', recipientId)
      .single()
    if (profile?.email) {
      recipientEmails.push(profile.email)
    }
  }

  console.log('📧 Resolved recipients:', { recipientId, recipientEmails, notificationType })

  // Handle EMAIL notification type
  if (notificationType === 'email') {
    console.log('📧 Sending EMAIL notification')
    
    const emailTemplateId = notificationConfig.emailTemplateId
    
    if (emailTemplateId) {
      // Use email template via send-template-email edge function
      console.log('📧 Using email template:', emailTemplateId)
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      const templateData = {
        ...(triggerData?.submissionData || {}),
        ...triggerData,
        timestamp: new Date().toISOString(),
      }
      
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-template-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          templateId: emailTemplateId,
          recipients: recipientEmails,
          templateData,
          triggerContext: {
            trigger_type: 'workflow_notification',
            notification_type: 'email'
          }
        })
      })

      const emailResult = await emailResponse.json()
      console.log('📧 Email send result:', emailResult)

      if (!emailResponse.ok) {
        console.error('❌ Email sending failed:', emailResult)
        return { success: false, error: emailResult.error || 'Email sending failed' }
      }

      return { 
        success: true, 
        recipientId, 
        recipientEmails,
        title, 
        notificationType: 'email',
        emailResult 
      }
    } else {
      // No template - send direct email via SMTP
      console.log('📧 No email template, sending direct SMTP email')
      
      if (recipientEmails.length === 0) {
        return { success: false, error: 'No recipient email found for email notification' }
      }

      // Get the organization's default SMTP config
      // First find the workflow to get project_id
      const { data: workflowData } = await supabase
        .from('workflows')
        .select('project_id')
        .eq('id', config?.workflowId || triggerData?.workflowId)
        .single()

      let orgId = null
      if (workflowData?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('organization_id')
          .eq('id', workflowData.project_id)
          .single()
        orgId = project?.organization_id
      }

      if (!orgId && submitterId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('organization_id')
          .eq('id', submitterId)
          .single()
        orgId = profile?.organization_id
      }

      if (!orgId) {
        return { success: false, error: 'Cannot determine organization for SMTP config' }
      }

      const { data: smtpConfig } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .single()

      if (!smtpConfig) {
        return { success: false, error: 'No active SMTP configuration found' }
      }

      console.log('📧 Using SMTP config:', smtpConfig.from_email)

      // Import SMTPClient and send email
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts")
      
      const useDirectTls = smtpConfig.port === 465;
      const client = new SMTPClient({
        connection: {
          hostname: smtpConfig.host,
          port: smtpConfig.port,
          tls: useDirectTls,
          auth: {
            username: smtpConfig.username,
            password: smtpConfig.password,
          },
        },
      })

      try {
        // Replace template variables in message
        let processedMessage = message
        let processedSubject = title
        const submissionData = triggerData?.submissionData || {}
        
        for (const [key, value] of Object.entries(submissionData)) {
          const regex = new RegExp(`{{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g')
          const strValue = typeof value === 'string' ? value : JSON.stringify(value)
          processedMessage = processedMessage.replace(regex, strValue)
          processedSubject = processedSubject.replace(regex, strValue)
        }

        await client.send({
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
            : smtpConfig.from_email,
          to: recipientEmails,
          subject: processedSubject,
          html: processedMessage,
        })
        
        await client.close()

        // Log the email
        for (const email of recipientEmails) {
          await supabase.from('email_logs').insert({
            organization_id: orgId,
            from_email: smtpConfig.from_email,
            to_email: email,
            subject: processedSubject,
            content: processedMessage,
            status: 'sent',
            sent_at: new Date().toISOString(),
            trigger_context: { trigger_type: 'workflow_notification' }
          })
        }

        console.log('✅ Email sent successfully to:', recipientEmails)
        return { success: true, recipientId, recipientEmails, title, notificationType: 'email' }
      } catch (smtpError) {
        console.error('❌ SMTP send failed:', smtpError)
        await client.close().catch(() => {})
        return { success: false, error: `SMTP send failed: ${smtpError.message}` }
      }
    }
  }

  // Handle IN-APP notification (default)
  if (!recipientId) {
    return { success: false, error: 'No recipient found for in-app notification' }
  }

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: recipientId,
      title,
      message,
      type: 'workflow',
      read: false
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, recipientId, title, notificationType: 'in_app' }
}

async function executeNotificationNode(supabase: any, node: WorkflowNode, executionId: string, triggerData: any, submitterId?: string): Promise<any> {
  const config = node.config as any
  return await executeNotification(supabase, config, triggerData, submitterId)
}

async function evaluateCondition(supabase: any, node: WorkflowNode, triggerData: any, submissionId?: string): Promise<boolean> {
  const config = node.config as any
  const legacyConditions = config?.conditions || []
  const enhancedCondition = config?.enhancedCondition
  
  console.log(`📋 Condition config:`, JSON.stringify(config, null, 2))
  console.log(`📋 Has enhancedCondition: ${!!enhancedCondition}`)
  console.log(`📋 Legacy conditions count: ${legacyConditions.length}`)

  // Get submission data
  let submissionData: Record<string, any> = triggerData?.submissionData || {}
  
  if (submissionId) {
    const { data: submission } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('id', submissionId)
      .single()

    if (submission) {
      submissionData = submission.submission_data || {}
    }
  }

  console.log(`📋 Submission data keys: ${Object.keys(submissionData).join(', ')}`)

  // Helper: normalize a value for comparison
  const normalizeValue = (v: any): string => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v.toString()
    if (typeof v === 'object' && !Array.isArray(v)) {
      if ('value' in v) return String(v.value).toLowerCase().trim()
      if ('id' in v) return String(v.id).toLowerCase().trim()
      return JSON.stringify(v).toLowerCase()
    }
    return String(v).toLowerCase().trim()
  }

  // Helper: check if value is array-like
  const isArrayField = (v: any): boolean => {
    if (Array.isArray(v)) return true
    if (typeof v === 'object' && v !== null && ('users' in v || 'groups' in v)) return true
    return false
  }

  // Helper: get array values (handles arrays and submission-access objects)
  const getArrayValues = (v: any): string[] => {
    if (Array.isArray(v)) {
      return v.map(item => {
        if (typeof item === 'object' && item !== null) {
          if ('value' in item) return String(item.value).toLowerCase().trim()
          if ('id' in item) return String(item.id).toLowerCase().trim()
        }
        const strVal = String(item).toLowerCase().trim()
        if (strVal.startsWith('user:')) return strVal.substring(5)
        if (strVal.startsWith('group:')) return strVal.substring(6)
        return strVal
      })
    }
    if (typeof v === 'object' && v !== null) {
      const results: string[] = []
      if ('users' in v && Array.isArray(v.users)) {
        results.push(...v.users.map((u: any) => normalizeValue(u)))
      }
      if ('groups' in v && Array.isArray(v.groups)) {
        results.push(...v.groups.map((g: any) => normalizeValue(g)))
      }
      if (results.length > 0) return results
    }
    const strVal = normalizeValue(v)
    if (strVal.startsWith('user:')) return [strVal.substring(5)]
    if (strVal.startsWith('group:')) return [strVal.substring(6)]
    return [strVal]
  }

  // Helper: compare values with proper array handling
  const compareValues = (left: any, right: any, operator: string): boolean => {
    const isLeftArray = isArrayField(left)
    
    // Parse right operand if it's a JSON string
    let parsedRight = right
    if (typeof right === 'string' && (right.startsWith('[') || right.startsWith('{'))) {
      try {
        parsedRight = JSON.parse(right)
      } catch {
        // Keep as string
      }
    }
    const isRightArray = isArrayField(parsedRight)
    const rightStr = normalizeValue(right)

    console.log(`   🔍 compareValues: operator=${operator}, isLeftArray=${isLeftArray}, isRightArray=${isRightArray}`)
    console.log(`   🔍 Left: ${JSON.stringify(left)}, Right: ${JSON.stringify(parsedRight)}`)

    switch (operator) {
      case 'equals':
      case '==':
        if (isLeftArray && isRightArray) {
          const leftValues = getArrayValues(left)
          const rightValues = getArrayValues(parsedRight)
          console.log(`   🔍 Array comparison: left=${JSON.stringify(leftValues)}, right=${JSON.stringify(rightValues)}`)
          if (leftValues.length !== rightValues.length) return false
          return rightValues.every(rv => leftValues.includes(rv))
        }
        if (isLeftArray) {
          const leftValues = getArrayValues(left)
          return leftValues.length === 1 && leftValues.includes(rightStr)
        }
        if (isRightArray) {
          const rightValues = getArrayValues(parsedRight)
          return rightValues.length === 1 && rightValues.includes(normalizeValue(left))
        }
        return normalizeValue(left) === rightStr

      case 'not_equals':
      case '!=':
        if (isLeftArray && isRightArray) {
          const leftValues = getArrayValues(left)
          const rightValues = getArrayValues(parsedRight)
          if (leftValues.length !== rightValues.length) return true
          return !rightValues.every(rv => leftValues.includes(rv))
        }
        if (isLeftArray) {
          const leftValues = getArrayValues(left)
          return leftValues.length !== 1 || !leftValues.includes(rightStr)
        }
        if (isRightArray) {
          const rightValues = getArrayValues(parsedRight)
          return rightValues.length !== 1 || !rightValues.includes(normalizeValue(left))
        }
        return normalizeValue(left) !== rightStr

      case 'contains':
      case 'includes':
        if (isLeftArray) {
          const leftValues = getArrayValues(left)
          if (isRightArray) {
            const rightValues = getArrayValues(parsedRight)
            return rightValues.some(rv => leftValues.includes(rv))
          }
          return leftValues.includes(rightStr)
        }
        return normalizeValue(left).includes(rightStr)

      case 'not_contains':
      case 'excludes':
        if (isLeftArray) {
          const leftValues = getArrayValues(left)
          if (isRightArray) {
            const rightValues = getArrayValues(parsedRight)
            return !rightValues.some(rv => leftValues.includes(rv))
          }
          return !leftValues.includes(rightStr)
        }
        return !normalizeValue(left).includes(rightStr)

      case 'greater_than':
      case '>':
        return parseFloat(String(left)) > parseFloat(String(right))

      case 'less_than':
      case '<':
        return parseFloat(String(left)) < parseFloat(String(right))

      case 'greater_than_or_equals':
      case '>=':
        return parseFloat(String(left)) >= parseFloat(String(right))

      case 'less_than_or_equals':
      case '<=':
        return parseFloat(String(left)) <= parseFloat(String(right))

      case 'exists':
        return left !== undefined && left !== null && left !== ''

      case 'not_exists':
        return left === undefined || left === null || left === ''

      default:
        console.log(`⚠️ Unknown operator: ${operator}`)
        return normalizeValue(left) === rightStr
    }
  }

  // Evaluate field-level condition
  const evaluateFieldLevelCondition = (flc: any): boolean => {
    const fieldId = flc?.fieldId
    const operator = flc?.operator
    const expectedValue = flc?.value
    
    if (!fieldId) {
      console.log(`⚠️ No fieldId in field-level condition`)
      return false
    }
    
    const actualValue = submissionData[fieldId]
    console.log(`📊 Evaluating field-level: fieldId=${fieldId}, operator=${operator}`)
    console.log(`   Expected: ${JSON.stringify(expectedValue)}, Actual: ${JSON.stringify(actualValue)}`)
    
    const result = compareValues(actualValue, expectedValue, operator)
    console.log(`   Result: ${result}`)
    return result
  }

  // Evaluate enhanced condition format
  const evaluateEnhancedCondition = (ec: any): boolean => {
    if (!ec) return true
    
    const conditions = ec.conditions || []
    const useManualExpression = ec.useManualExpression
    const manualExpression = ec.manualExpression
    
    console.log(`📊 Enhanced condition: ${conditions.length} conditions, useManual=${useManualExpression}`)
    
    if (conditions.length === 0) {
      if (ec.fieldLevelCondition) {
        return evaluateFieldLevelCondition(ec.fieldLevelCondition)
      }
      return true
    }
    
    const results: boolean[] = []
    for (const cond of conditions) {
      let condResult = false
      if (cond.fieldLevelCondition) {
        condResult = evaluateFieldLevelCondition(cond.fieldLevelCondition)
      } else if (cond.fieldCondition) {
        const fieldValue = submissionData[cond.fieldCondition.fieldId]
        condResult = compareValues(fieldValue, cond.fieldCondition.value, cond.fieldCondition.operator)
      }
      console.log(`   Condition ${cond.id}: result=${condResult}`)
      results.push(condResult)
    }
    
    // Handle manual expression like "1 AND 2" or "(1 AND 2) OR 3"
    if (useManualExpression && manualExpression) {
      console.log(`📊 Evaluating manual expression: ${manualExpression}`)
      try {
        let expr = manualExpression.toString()
        for (let i = results.length; i >= 1; i--) {
          expr = expr.replace(new RegExp(`\\b${i}\\b`, 'g'), results[i - 1] ? 'true' : 'false')
        }
        expr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!')
        console.log(`   Parsed expression: ${expr}`)
        const evalResult = Function('"use strict"; return (' + expr + ')')()
        console.log(`   Expression result: ${evalResult}`)
        return Boolean(evalResult)
      } catch (e) {
        console.log(`⚠️ Error evaluating expression: ${e}`)
      }
    }
    
    // Default logic based on logicalOperatorWithNext
    const hasOrLogic = conditions.some((c: any) => c.logicalOperatorWithNext === 'OR')
    if (hasOrLogic) {
      return results.some(r => r)
    }
    return results.every(r => r)
  }

  // Evaluate legacy condition
  const evaluateLegacyCondition = (condition: any): boolean => {
    const fieldValue = submissionData[condition.fieldId || condition.field]
    const targetValue = condition.value
    const operator = condition.operator || 'equals'
    
    console.log(`📊 Evaluating legacy: field=${condition.fieldId || condition.field}, operator=${operator}`)
    console.log(`   Target: ${JSON.stringify(targetValue)}, Actual: ${JSON.stringify(fieldValue)}`)
    
    return compareValues(fieldValue, targetValue, operator)
  }

  // Main evaluation logic
  let conditionResult = true
  
  // Check enhanced condition first (new format)
  if (enhancedCondition) {
    console.log(`📊 Using enhanced condition evaluation`)
    conditionResult = evaluateEnhancedCondition(enhancedCondition)
    console.log(`📊 Enhanced condition result: ${conditionResult}`)
  } else if (legacyConditions.length > 0) {
    // Fall back to legacy conditions
    console.log(`📊 Using legacy condition evaluation`)
    for (const condition of legacyConditions) {
      if (!evaluateLegacyCondition(condition)) {
        conditionResult = false
        break
      }
    }
    console.log(`📊 Legacy condition result: ${conditionResult}`)
  }

  console.log(`📊 Final condition result: ${conditionResult}`)
  return conditionResult
}
