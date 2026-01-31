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
