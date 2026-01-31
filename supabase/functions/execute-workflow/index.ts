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
            console.log('🔍 Condition node')
            const conditionResult = await evaluateCondition(supabase, currentNode, triggerData, submissionId)
            outputData = { conditionResult, evaluated: true }
            
            // Get connections for condition node
            const { data: condConnections } = await supabase
              .from('workflow_connections')
              .select('target_node_id, connection_type')
              .eq('source_node_id', currentNode.id)

            if (condConnections) {
              for (const conn of condConnections) {
                const isTrue = conn.connection_type === 'true' || conn.connection_type === 'yes'
                const isFalse = conn.connection_type === 'false' || conn.connection_type === 'no'
                
                if ((conditionResult && isTrue) || (!conditionResult && isFalse) || 
                    (!conn.connection_type || conn.connection_type === 'default')) {
                  if ((conditionResult && isTrue) || (!conditionResult && isFalse)) {
                    nextNodeIds.push(conn.target_node_id)
                  }
                }
              }
            }
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
      return { emailQueued: true, message: 'Email action triggered' }
    case 'send_notification':
      return await executeNotification(supabase, config, triggerData, submitterId)
    default:
      return { executed: true, actionType }
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
  const title = notificationConfig.subject || notificationConfig.title || 'Workflow Notification'
  const message = notificationConfig.message || 'You have a notification from a workflow'
  const recipientType = notificationConfig.recipientType || config?.recipientType || 'submitter'

  let recipientId = submitterId
  if (recipientType === 'specific_user') {
    recipientId = notificationConfig.specificUserId || config?.specificUserId
  }

  if (!recipientId) {
    return { success: false, error: 'No recipient found' }
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

  return { success: true, recipientId, title }
}

async function executeNotificationNode(supabase: any, node: WorkflowNode, executionId: string, triggerData: any, submitterId?: string): Promise<any> {
  const config = node.config as any
  return await executeNotification(supabase, config, triggerData, submitterId)
}

async function evaluateCondition(supabase: any, node: WorkflowNode, triggerData: any, submissionId?: string): Promise<boolean> {
  const config = node.config as any
  const conditions = config?.conditions || []
  
  if (!submissionId || conditions.length === 0) {
    return true // Default to true if no conditions
  }

  // Get submission data
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('submission_data')
    .eq('id', submissionId)
    .single()

  if (!submission) {
    return false
  }

  const submissionData = submission.submission_data || {}

  // Evaluate conditions
  for (const condition of conditions) {
    const fieldValue = submissionData[condition.fieldId]
    const targetValue = condition.value
    const operator = condition.operator || 'equals'

    let result = false
    switch (operator) {
      case 'equals':
        result = fieldValue === targetValue
        break
      case 'not_equals':
        result = fieldValue !== targetValue
        break
      case 'contains':
        result = String(fieldValue).includes(String(targetValue))
        break
      case 'greater_than':
        result = Number(fieldValue) > Number(targetValue)
        break
      case 'less_than':
        result = Number(fieldValue) < Number(targetValue)
        break
      default:
        result = fieldValue === targetValue
    }

    if (!result) {
      return false
    }
  }

  return true
}
