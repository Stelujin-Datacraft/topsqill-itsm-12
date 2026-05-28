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
            // Support both legacy (duration/unit) and current UI (durationValue/durationUnit) keys
            const waitDuration = Number(
              waitConfig.durationValue ?? waitConfig.duration ?? 1
            )
            const waitUnit = waitConfig.durationUnit || waitConfig.unit || 'minutes'
            console.log(`⏱️ Wait config parsed: ${waitDuration} ${waitUnit}`, waitConfig)
            
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
              case 'weeks':
                resumeTime.setDate(resumeTime.getDate() + waitDuration * 7)
                break
              default:
                console.warn(`⚠️ Unknown wait unit "${waitUnit}", defaulting to minutes`)
                resumeTime.setMinutes(resumeTime.getMinutes() + waitDuration)
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

      // Get next nodes if not already set (for non-condition nodes).
      // IMPORTANT: condition nodes manage their own branching above. If a
      // condition evaluated to false and no false-branch connection exists,
      // nextNodeIds will be empty on purpose — do NOT fall back to following
      // every outgoing connection, or the true branch would run regardless.
      if (
        nextNodeIds.length === 0 &&
        currentNode.node_type !== 'end' &&
        currentNode.node_type !== 'condition'
      ) {
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
    case 'create_record':
      return await executeCreateRecord(supabase, config, triggerData, submissionId, submitterId)
    case 'create_linked_record':
      return await executeCreateLinkedRecord(supabase, config, triggerData, submissionId, submitterId)
    case 'update_linked_records':
      return await executeUpdateLinkedRecords(supabase, config, triggerData)
    case 'create_combination_records':
      return await executeCreateCombinationRecords(supabase, config, triggerData, submissionId, submitterId)
    default:
      return { success: false, error: `Unsupported action type: ${actionType}`, actionType }
  }
}

async function executeCreateRecord(
  supabase: any,
  config: any,
  triggerData: any,
  _submissionId?: string,
  submitterId?: string
): Promise<any> {
  console.log('➕ Executing create_record action')

  if (!config?.targetFormId) {
    return { success: false, error: 'Missing target form ID for record creation' }
  }

  const recordCount = Math.min(Math.max(config.recordCount || 1, 1), 100)
  const fieldValues = Array.isArray(config.fieldValues) ? config.fieldValues : []
  const fieldMappings = Array.isArray(config.fieldMappings) ? config.fieldMappings : []
  const createdRecords: string[] = []
  const triggerSubmissionData = triggerData?.submissionData || triggerData || {}

  const { data: targetFormFields, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, field_type, custom_config')
    .eq('form_id', config.targetFormId)

  if (fieldsError) {
    console.error('❌ Error fetching target form fields:', fieldsError)
  }

  const submissionAccessFieldConfigs: Record<string, { allowedUsers: string[]; allowedGroups: string[] }> = {}
  for (const field of targetFormFields || []) {
    if (field.field_type === 'submission-access') {
      const customConfig = typeof field.custom_config === 'string'
        ? (() => { try { return JSON.parse(field.custom_config) } catch { return {} } })()
        : (field.custom_config || {})

      submissionAccessFieldConfigs[field.id] = {
        allowedUsers: customConfig.allowedUsers || [],
        allowedGroups: customConfig.allowedGroups || []
      }
    }
  }

  let createdBy: string | null = null
  if (config.setSubmittedBy === 'specific_user' && config.specificSubmitterId) {
    createdBy = config.specificSubmitterId
  } else if (config.setSubmittedBy === 'system') {
    createdBy = null
  } else {
    createdBy = submitterId || triggerData?.submitterId || triggerData?.submittedBy || null
  }

  const initialStatus = config.initialStatus || 'pending'

  for (let i = 0; i < recordCount; i++) {
    const submissionData: Record<string, any> = {}

    if (config.fieldConfigMode === 'field_mapping') {
      for (const mapping of fieldMappings) {
        const sourceValue = triggerSubmissionData?.[mapping.sourceFieldId]
        if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
          const accessConfig = submissionAccessFieldConfigs[mapping.targetFieldId]
          submissionData[mapping.targetFieldId] = accessConfig
            ? validateSubmissionAccessValue(sourceValue, accessConfig) || undefined
            : sourceValue

          if (submissionData[mapping.targetFieldId] === undefined) {
            delete submissionData[mapping.targetFieldId]
          }
        }
      }
    }

    for (const fieldValue of fieldValues) {
      if (!fieldValue?.fieldId) continue

      let value: any = undefined
      if (fieldValue.valueType === 'static') {
        value = fieldValue.staticValue
      } else if (fieldValue.valueType === 'dynamic') {
        const dynamicPath = fieldValue.dynamicValuePath
        if (dynamicPath && dynamicPath in triggerSubmissionData) {
          value = triggerSubmissionData[dynamicPath]
        } else {
          value = getNestedValue(triggerData, dynamicPath)
        }
      }

      if (value !== undefined && value !== null && value !== '') {
        const accessConfig = submissionAccessFieldConfigs[fieldValue.fieldId]
        if (accessConfig) {
          const validated = validateSubmissionAccessValue(value, accessConfig)
          if (validated && (validated.users.length > 0 || validated.groups.length > 0)) {
            submissionData[fieldValue.fieldId] = validated
          }
        } else {
          submissionData[fieldValue.fieldId] = value
        }
      }
    }

    const { data: newSubmission, error: insertError } = await supabase
      .from('form_submissions')
      .insert({
        form_id: config.targetFormId,
        submission_data: submissionData,
        submitted_by: createdBy,
        approval_status: initialStatus
      })
      .select('id')
      .single()

    if (insertError) {
      return { success: false, error: `Failed to create record ${i + 1}: ${insertError.message}` }
    }

    if (newSubmission?.id) {
      createdRecords.push(newSubmission.id)
    }
  }

  return {
    success: true,
    createdRecordIds: createdRecords,
    recordCount: createdRecords.length,
    targetFormId: config.targetFormId
  }
}

async function executeCreateLinkedRecord(
  supabase: any,
  config: any,
  triggerData: any,
  submissionId?: string,
  submitterId?: string
): Promise<any> {
  console.log('🔗 Executing create_linked_record action')

  const crossRefFieldId = config.crossRefFieldId || config.crossReferenceFieldId
  const childCrossRefFieldId = config.childCrossRefFieldId
  const targetFormId = config.targetFormId
  const triggerSubmissionId = triggerData?.submissionId || submissionId
  const triggerFormId = triggerData?.formId
  const triggerSubmissionData = triggerData?.submissionData || {}

  if (!crossRefFieldId || !targetFormId || !triggerSubmissionId) {
    return { success: false, error: 'Missing required configuration for linked record creation' }
  }

  const { data: triggerSub, error: triggerSubError } = await supabase
    .from('form_submissions')
    .select('submission_ref_id')
    .eq('id', triggerSubmissionId)
    .single()

  if (triggerSubError || !triggerSub?.submission_ref_id) {
    return { success: false, error: 'Could not find trigger submission reference ID' }
  }

  const recordCount = Math.min(Math.max(config.recordCount || 1, 1), 100)
  const createdRecords: Array<{ id: string; submission_ref_id: string }> = []

  for (let i = 0; i < recordCount; i++) {
    const childSubmissionData: Record<string, any> = {}

    if (childCrossRefFieldId) {
      childSubmissionData[childCrossRefFieldId] = [{
        submission_ref_id: triggerSub.submission_ref_id,
        form_id: triggerFormId
      }]
    }

    if (Array.isArray(config.fieldMappings)) {
      for (const mapping of config.fieldMappings) {
        const value = triggerSubmissionData?.[mapping.sourceFieldId]
        if (value !== undefined) {
          childSubmissionData[mapping.targetFieldId] = value
        }
      }
    }

    if (Array.isArray(config.fieldValues)) {
      for (const fieldValue of config.fieldValues) {
        if (!fieldValue?.fieldId) continue

        if (fieldValue.valueType === 'static') {
          childSubmissionData[fieldValue.fieldId] = fieldValue.staticValue
        } else if (fieldValue.valueType === 'dynamic') {
          const dynamicPath = fieldValue.dynamicValuePath || fieldValue.dynamicFieldId
          const value = dynamicPath && dynamicPath in triggerSubmissionData
            ? triggerSubmissionData[dynamicPath]
            : getNestedValue(triggerData, dynamicPath)
          if (value !== undefined) {
            childSubmissionData[fieldValue.fieldId] = value
          }
        }
      }
    }

    const { data: newRecord, error: createError } = await supabase
      .from('form_submissions')
      .insert({
        form_id: targetFormId,
        submission_data: childSubmissionData,
        submitted_by: submitterId || triggerData?.submitterId || null,
        approval_status: config.initialStatus || 'pending'
      })
      .select('id, submission_ref_id')
      .single()

    if (createError) {
      return { success: false, error: `Failed to create linked record ${i + 1}: ${createError.message}` }
    }

    createdRecords.push(newRecord)
  }

  const { data: currentParent, error: parentError } = await supabase
    .from('form_submissions')
    .select('submission_data')
    .eq('id', triggerSubmissionId)
    .single()

  if (parentError) {
    return { success: false, error: `Created linked records, but failed to update parent link field: ${parentError.message}` }
  }

  const currentData = currentParent?.submission_data || {}
  const existingRefs = (currentData as any)?.[crossRefFieldId] || []
  const mergedRefs = Array.isArray(existingRefs) ? [...existingRefs] : []

  for (const record of createdRecords) {
    mergedRefs.push({
      submission_ref_id: record.submission_ref_id,
      form_id: targetFormId
    })
  }

  const { error: updateParentError } = await supabase
    .from('form_submissions')
    .update({
      submission_data: {
        ...(typeof currentData === 'object' ? currentData : {}),
        [crossRefFieldId]: mergedRefs
      }
    })
    .eq('id', triggerSubmissionId)

  if (updateParentError) {
    return { success: false, error: `Created linked records, but failed to sync parent references: ${updateParentError.message}` }
  }

  return {
    success: true,
    createdCount: createdRecords.length,
    createdRecordIds: createdRecords.map(record => record.id),
    targetFormId
  }
}

async function executeUpdateLinkedRecords(
  supabase: any,
  config: any,
  triggerData: any
): Promise<any> {
  console.log('🔄 Executing update_linked_records action')

  const crossRefFieldId = config.crossRefFieldId || config.crossReferenceFieldId
  const triggerSubmissionData = triggerData?.submissionData || {}

  if (!crossRefFieldId || !Array.isArray(config.fieldMappings) || config.fieldMappings.length === 0) {
    return { success: false, error: 'Missing required configuration for update linked records' }
  }

  const crossRefValue = triggerSubmissionData[crossRefFieldId]
  if (!crossRefValue) {
    return { success: true, updatedCount: 0, message: 'No linked records to update' }
  }

  let linkedRefIds: string[] = []
  if (Array.isArray(crossRefValue)) {
    linkedRefIds = crossRefValue
      .map((item: any) => typeof item === 'string' ? item : item?.submission_ref_id)
      .filter(Boolean)
  } else if (typeof crossRefValue === 'string') {
    linkedRefIds = [crossRefValue]
  } else if (crossRefValue?.submission_ref_id) {
    linkedRefIds = [crossRefValue.submission_ref_id]
  }

  let targetRefIds = linkedRefIds
  if (config.updateScope === 'first' && linkedRefIds.length > 0) {
    targetRefIds = [linkedRefIds[0]]
  } else if (config.updateScope === 'last' && linkedRefIds.length > 0) {
    targetRefIds = [linkedRefIds[linkedRefIds.length - 1]]
  }

  const { data: linkedSubmissions, error: fetchError } = await supabase
    .from('form_submissions')
    .select('id, submission_data')
    .in('submission_ref_id', targetRefIds)

  if (fetchError) {
    return { success: false, error: `Failed to fetch linked submissions: ${fetchError.message}` }
  }

  let updatedCount = 0
  for (const linkedSub of linkedSubmissions || []) {
    const currentData = linkedSub.submission_data || {}
    const updatedData = { ...(typeof currentData === 'object' ? currentData : {}) }

    for (const mapping of config.fieldMappings) {
      const sourceValue = triggerSubmissionData?.[mapping.sourceFieldId]
      if (sourceValue !== undefined) {
        updatedData[mapping.targetFieldId] = sourceValue
      }
    }

    const { error: updateError } = await supabase
      .from('form_submissions')
      .update({ submission_data: updatedData })
      .eq('id', linkedSub.id)

    if (!updateError) {
      updatedCount += 1
    }
  }

  return {
    success: true,
    updatedCount,
    totalLinked: linkedRefIds.length,
    updateScope: config.updateScope || 'all'
  }
}

async function executeCreateCombinationRecords(
  supabase: any,
  config: any,
  triggerData: any,
  submissionId?: string,
  submitterId?: string
): Promise<any> {
  console.log('🔗✨ Executing create_combination_records action')

  const combinationMode = config.combinationMode || 'single'
  const triggerSubmissionData = triggerData?.submissionData || {}
  const triggerSubmissionId = triggerData?.submissionId || submissionId
  const triggerFormId = triggerData?.formId

  if (!config.targetFormId || !config.sourceCrossRefFieldId || !config.sourceLinkedFormId) {
    return { success: false, error: 'Missing required configuration for combination records' }
  }

  // Fetch trigger submission_ref_id (needed for legacy targetTriggerCrossRefFieldId link)
  let triggerSubmissionRefId: string | null = null
  if (triggerSubmissionId) {
    const { data: trig } = await supabase
      .from('form_submissions')
      .select('submission_ref_id')
      .eq('id', triggerSubmissionId)
      .single()
    triggerSubmissionRefId = trig?.submission_ref_id || null
  }

  const firstSourceRefsRaw = triggerSubmissionData[config.sourceCrossRefFieldId]
  const secondSourceRefsRaw = combinationMode === 'dual' ? triggerSubmissionData[config.secondSourceCrossRefFieldId] : null

  const normalizeRefs = (value: any): Array<{ submission_ref_id: string; form_id?: string }> => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value
        .map((item: any) => typeof item === 'string'
          ? { submission_ref_id: item }
          : { submission_ref_id: item?.submission_ref_id, form_id: item?.form_id })
        .filter((item: any) => item.submission_ref_id)
    }
    if (typeof value === 'string') return [{ submission_ref_id: value }]
    if (value?.submission_ref_id) return [{ submission_ref_id: value.submission_ref_id, form_id: value.form_id }]
    return []
  }

  const firstSourceRefs = normalizeRefs(firstSourceRefsRaw)
  const secondSourceRefs = combinationMode === 'dual'
    ? normalizeRefs(secondSourceRefsRaw)
    : [{ submission_ref_id: '', form_id: undefined as string | undefined }]

  if (firstSourceRefs.length === 0 || secondSourceRefs.length === 0) {
    return { success: true, createdCount: 0, message: 'No linked records available for combination' }
  }

  // Pre-fetch linked-form submission data for field mappings
  const linkedFormFieldMappings = Array.isArray(config.linkedFormFieldMappings)
    ? config.linkedFormFieldMappings.filter((m: any) => m.sourceFieldId && m.targetFieldId)
    : []
  const secondLinkedFormFieldMappings = Array.isArray(config.secondLinkedFormFieldMappings)
    ? config.secondLinkedFormFieldMappings.filter((m: any) => m.sourceFieldId && m.targetFieldId)
    : []

  const linkedRecordsDataMap = new Map<string, Record<string, any>>()
  const allRefIds = [
    ...firstSourceRefs.map(r => r.submission_ref_id),
    ...secondSourceRefs.map(r => r.submission_ref_id).filter(Boolean)
  ]
  if (allRefIds.length > 0 && (linkedFormFieldMappings.length > 0 || secondLinkedFormFieldMappings.length > 0)) {
    const { data: linkedSubs } = await supabase
      .from('form_submissions')
      .select('submission_ref_id, submission_data')
      .in('submission_ref_id', allRefIds)
    if (linkedSubs) {
      for (const sub of linkedSubs) {
        if (sub.submission_ref_id) {
          linkedRecordsDataMap.set(sub.submission_ref_id, (sub.submission_data || {}) as Record<string, any>)
        }
      }
    }
  }

  // Build duplicate-prevention set
  const preventDuplicates = !!config.preventDuplicates
  const existingCombinations = new Set<string>()
  if (preventDuplicates && Array.isArray(config.targetLinkFields) && config.targetLinkFields.length > 0) {
    const { data: existingRecords } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('form_id', config.targetFormId)
    if (existingRecords) {
      for (const rec of existingRecords) {
        const data = (rec.submission_data || {}) as Record<string, any>
        const keyParts: string[] = []
        for (const lf of config.targetLinkFields) {
          const v = data[lf.targetFieldId]
          let refId: string | null = null
          if (Array.isArray(v) && v[0]) refId = typeof v[0] === 'string' ? v[0] : v[0]?.submission_ref_id
          else if (typeof v === 'string') refId = v
          else if (v?.submission_ref_id) refId = v.submission_ref_id
          if (refId) keyParts.push(refId)
        }
        if (keyParts.length > 0) existingCombinations.add(keyParts.sort().join('|'))
      }
    }
  }

  const createdRecordIds: string[] = []
  const createdRecords: Array<{ id: string; submission_ref_id: string }> = []
  let skippedDuplicates = 0
  const initialStatus = config.initialStatus || 'pending'
  const fieldMappings = Array.isArray(config.fieldMappings) ? config.fieldMappings : []

  // ---- PER-USER EXPANSION SETUP ----
  const perUserCfg = config.perUserExpansion
  const perUserEnabled = !!perUserCfg?.enabled
  const expansionSource: 'first_source' | 'second_source' = perUserCfg?.source || 'first_source'
  const assignTo: 'submitted_by' | 'field' | 'both' = perUserCfg?.assignTo || 'both'

  // Ensure source records' submission data is fetched (for reading the access field)
  // and resolve the access field id if not explicitly provided.
  const expansionUsersByRef = new Map<string, string[]>()
  let perUserSkippedSources = 0

  // Detect if the per-user target field is a submission-access field so we can
  // write the correct value shape ({ users, groups } vs raw user id).
  let perUserTargetIsAccessField = false
  if (perUserEnabled && perUserCfg?.userFieldId && config.targetFormId) {
    const { data: tf } = await supabase
      .from('form_fields')
      .select('field_type')
      .eq('id', perUserCfg.userFieldId)
      .maybeSingle()
    if (tf?.field_type === 'submission-access') perUserTargetIsAccessField = true
  }

  if (perUserEnabled) {
    const sourceRefs = expansionSource === 'second_source' ? secondSourceRefs : firstSourceRefs
    const sourceFormId = expansionSource === 'second_source' ? config.secondSourceLinkedFormId : config.sourceLinkedFormId
    const sourceRefIds = sourceRefs.map(r => r.submission_ref_id).filter(Boolean)

    // Resolve access field id (auto-detect when not provided)
    let accessFieldId: string | null = perUserCfg?.sourceAccessFieldId || null
    let accessFieldType: string | null = null
    if (sourceFormId) {
      if (!accessFieldId) {
        const { data: fields } = await supabase
          .from('form_fields')
          .select('id, field_type')
          .eq('form_id', sourceFormId)
          .in('field_type', ['submission-access', 'group-picker'])
        if (fields && fields.length > 0) {
          const accessFirst = fields.find((f: any) => f.field_type === 'submission-access') || fields[0]
          accessFieldId = accessFirst.id
          accessFieldType = accessFirst.field_type
        }
      } else {
        const { data: f } = await supabase
          .from('form_fields')
          .select('field_type')
          .eq('id', accessFieldId)
          .maybeSingle()
        accessFieldType = f?.field_type || null
      }
    }

    // Fetch source submissions if missing from cache
    const missing = sourceRefIds.filter(rid => !linkedRecordsDataMap.has(rid))
    if (missing.length > 0) {
      const { data: extraSubs } = await supabase
        .from('form_submissions')
        .select('submission_ref_id, submission_data')
        .in('submission_ref_id', missing)
      if (extraSubs) {
        for (const sub of extraSubs) {
          if (sub.submission_ref_id) linkedRecordsDataMap.set(sub.submission_ref_id, (sub.submission_data || {}) as Record<string, any>)
        }
      }
    }

    // Parse value into { users, groups }
    const parseAccessValue = (raw: any): { users: string[]; groups: string[] } => {
      const users: string[] = []
      const groups: string[] = []
      if (!raw) return { users, groups }
      let v: any = raw
      if (typeof v === 'string') {
        try { v = JSON.parse(v) } catch { /* leave as string */ }
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') {
            if (item.startsWith('user:')) users.push(item.slice(5))
            else if (item.startsWith('group:')) groups.push(item.slice(6))
            else groups.push(item) // group-picker often stores raw IDs
          } else if (item && typeof item === 'object') {
            if (item.id) groups.push(item.id)
          }
        }
      } else if (v && typeof v === 'object') {
        if (Array.isArray(v.users)) users.push(...v.users)
        if (Array.isArray(v.groups)) groups.push(...v.groups)
      } else if (typeof v === 'string') {
        groups.push(v)
      }
      return { users, groups }
    }

    // Resolve group members in one batched call
    for (const rid of sourceRefIds) {
      const subData = linkedRecordsDataMap.get(rid) || {}
      let parsed = { users: [] as string[], groups: [] as string[] }
      if (accessFieldId) parsed = parseAccessValue(subData[accessFieldId])

      // Primary source: access field. If empty, fall back to scanning for any submission-access/group-picker value in the record.
      if (parsed.users.length === 0 && parsed.groups.length === 0) {
        for (const [, val] of Object.entries(subData)) {
          const tryParsed = parseAccessValue(val)
          if (tryParsed.users.length || tryParsed.groups.length) {
            // Only accept object-shaped access values (avoid false positives from arrays of refs)
            if (val && typeof val === 'object' && !Array.isArray(val) && ((val as any).users || (val as any).groups)) {
              parsed = tryParsed
              break
            }
          }
        }
      }

      const userSet = new Set<string>(parsed.users)
      if (parsed.groups.length > 0) {
        const { data: members } = await supabase
          .from('group_memberships')
          .select('member_id, member_type')
          .in('group_id', parsed.groups)
          .eq('member_type', 'user')
        if (members) {
          for (const m of members) if (m.member_id) userSet.add(m.member_id)
        }
      }

      const userList = Array.from(userSet)
      if (userList.length === 0) {
        perUserSkippedSources++
      } else {
        expansionUsersByRef.set(rid, userList)
      }
    }

    console.log(`👥 Per-user expansion: ${expansionUsersByRef.size} source(s) with users, ${perUserSkippedSources} skipped`)
  }

  for (const firstRef of firstSourceRefs) {
    for (const secondRef of secondSourceRefs) {
      // Resolve users for this iteration (per-user expansion)
      let userIterList: Array<string | null> = [null]
      if (perUserEnabled) {
        const expRef = expansionSource === 'second_source' ? secondRef.submission_ref_id : firstRef.submission_ref_id
        const users = expRef ? expansionUsersByRef.get(expRef) : undefined
        if (!users || users.length === 0) {
          // Skip — fallback policy: do NOT create record when no users
          continue
        }
        userIterList = users
      }

      for (const assignedUserId of userIterList) {
        // Duplicate check key (includes user when expanding)
        if (preventDuplicates) {
          const keyParts = [firstRef.submission_ref_id]
          if (combinationMode === 'dual' && secondRef.submission_ref_id) keyParts.push(secondRef.submission_ref_id)
          if (perUserEnabled && assignedUserId) keyParts.push(`u:${assignedUserId}`)
          const k = keyParts.sort().join('|')
          if (existingCombinations.has(k)) { skippedDuplicates++; continue }
          existingCombinations.add(k)
        }

        const submissionData: Record<string, any> = {}

      if (Array.isArray(config.targetLinkFields)) {
        for (const targetLinkField of config.targetLinkFields) {
          if (!targetLinkField.targetFieldId) continue
          if (targetLinkField.linkTo === 'first_source') {
            submissionData[targetLinkField.targetFieldId] = [{
              submission_ref_id: firstRef.submission_ref_id,
              form_id: firstRef.form_id || config.sourceLinkedFormId
            }]
          }

          if (targetLinkField.linkTo === 'second_source' && combinationMode === 'dual' && secondRef.submission_ref_id) {
            submissionData[targetLinkField.targetFieldId] = [{
              submission_ref_id: secondRef.submission_ref_id,
              form_id: secondRef.form_id || config.secondSourceLinkedFormId
            }]
          }
        }
      }

      // Legacy link fields (backward compatibility)
      if (config.targetLinkedCrossRefFieldId) {
        submissionData[config.targetLinkedCrossRefFieldId] = [{
          submission_ref_id: firstRef.submission_ref_id,
          form_id: firstRef.form_id || config.sourceLinkedFormId
        }]
      }
      if (config.targetTriggerCrossRefFieldId && triggerSubmissionRefId) {
        submissionData[config.targetTriggerCrossRefFieldId] = [{
          submission_ref_id: triggerSubmissionRefId,
          form_id: triggerFormId
        }]
      }

      // Field mappings from TRIGGER form
      for (const mapping of fieldMappings) {
        if (!mapping.sourceFieldId || !mapping.targetFieldId) continue
        const value = triggerSubmissionData?.[mapping.sourceFieldId]
        if (value !== undefined && value !== null && value !== '') {
          submissionData[mapping.targetFieldId] = value
        }
      }

      // Field mappings from FIRST LINKED form
      if (linkedFormFieldMappings.length > 0) {
        const linkedData = linkedRecordsDataMap.get(firstRef.submission_ref_id)
        if (linkedData) {
          for (const mapping of linkedFormFieldMappings) {
            const value = linkedData[mapping.sourceFieldId]
            if (value !== undefined && value !== null && value !== '') {
              submissionData[mapping.targetFieldId] = value
            }
          }
        }
      }

      // Field mappings from SECOND LINKED form (dual mode)
      if (combinationMode === 'dual' && secondRef.submission_ref_id && secondLinkedFormFieldMappings.length > 0) {
        const secondLinkedData = linkedRecordsDataMap.get(secondRef.submission_ref_id)
        if (secondLinkedData) {
          for (const mapping of secondLinkedFormFieldMappings) {
            const value = secondLinkedData[mapping.sourceFieldId]
            if (value !== undefined && value !== null && value !== '') {
              submissionData[mapping.targetFieldId] = value
            }
          }
        }
      }

        // Per-user assignment
        let recordSubmittedBy: string | null = submitterId || triggerData?.submitterId || null
        if (perUserEnabled && assignedUserId) {
          if (assignTo === 'submitted_by' || assignTo === 'both') {
            recordSubmittedBy = assignedUserId
          }
          if ((assignTo === 'field' || assignTo === 'both') && perUserCfg?.userFieldId) {
            // If the target field is a submission-access field, write the structured
            // { users, groups } shape it expects; otherwise write the raw user id.
            if (submissionAccessFieldConfigs[perUserCfg.userFieldId]) {
              submissionData[perUserCfg.userFieldId] = { users: [assignedUserId], groups: [] }
            } else {
              submissionData[perUserCfg.userFieldId] = assignedUserId
            }
          }
        }

        const { data: created, error: createError } = await supabase
          .from('form_submissions')
          .insert({
            form_id: config.targetFormId,
            submission_data: submissionData,
            submitted_by: recordSubmittedBy,
            approval_status: initialStatus
          })
          .select('id, submission_ref_id')
          .single()

        if (createError) {
          console.error('❌ Failed to create combination record:', createError)
          continue
        }

        createdRecordIds.push(created.id)
        createdRecords.push({ id: created.id, submission_ref_id: created.submission_ref_id || '' })
      }
    }
  }

  // Auto-link created records back to trigger form's cross-ref field
  let updatedTriggerCrossRef = false
  if (config.updateTriggerCrossRefFieldId && createdRecords.length > 0 && triggerSubmissionId) {
    const { data: currentTrigger } = await supabase
      .from('form_submissions')
      .select('submission_data')
      .eq('id', triggerSubmissionId)
      .single()

    if (currentTrigger) {
      const currentData = (currentTrigger.submission_data || {}) as Record<string, any>
      const existingVal = currentData[config.updateTriggerCrossRefFieldId]
      let merged: any[] = []
      if (Array.isArray(existingVal)) merged = [...existingVal]
      else if (existingVal && typeof existingVal === 'object') merged = [existingVal]

      const existingIds = new Set(merged.map((v: any) => typeof v === 'string' ? v : v?.submission_ref_id))
      for (const rec of createdRecords) {
        if (rec.submission_ref_id && !existingIds.has(rec.submission_ref_id)) {
          merged.push({
            id: rec.id,
            submission_ref_id: rec.submission_ref_id,
            form_id: config.targetFormId,
            displayData: {}
          })
        }
      }

      const updatedData = { ...currentData, [config.updateTriggerCrossRefFieldId]: merged }
      const { error: updErr } = await supabase
        .from('form_submissions')
        .update({ submission_data: updatedData })
        .eq('id', triggerSubmissionId)
      if (!updErr) updatedTriggerCrossRef = true
      else console.error('⚠️ Failed updating trigger cross-ref field:', updErr)
    }
  }

  return {
    success: true,
    createdCount: createdRecordIds.length,
    createdRecordIds,
    skippedDuplicates,
    perUserExpansion: perUserEnabled,
    perUserSkippedSources,
    updatedTriggerCrossRef,
    targetFormId: config.targetFormId,
    combinationMode
  }
}

function getNestedValue(obj: any, path?: string): any {
  if (!path || !obj) return undefined
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function validateSubmissionAccessValue(
  value: any,
  config: { allowedUsers: string[]; allowedGroups: string[] }
): { users: string[]; groups: string[] } | null {
  try {
    let parsedValue = value
    if (typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value)
      } catch {
        return null
      }
    }

    if (!parsedValue) return null

    let sourceUsers: string[] = []
    let sourceGroups: string[] = []

    if (typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
      sourceUsers = parsedValue.users || []
      sourceGroups = parsedValue.groups || []
    } else if (Array.isArray(parsedValue)) {
      parsedValue.forEach((item: string) => {
        if (typeof item === 'string') {
          if (item.startsWith('user:')) sourceUsers.push(item.replace('user:', ''))
          if (item.startsWith('group:')) sourceGroups.push(item.replace('group:', ''))
        }
      })
    }

    return {
      users: sourceUsers.filter(userId => config.allowedUsers.includes(userId)),
      groups: sourceGroups.filter(groupId => config.allowedGroups.includes(groupId))
    }
  } catch {
    return null
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
        try {
          await client.close()
        } catch {
        }
        const smtpErrorMessage = smtpError instanceof Error ? smtpError.message : 'Unknown SMTP error'
        return { success: false, error: `SMTP send failed: ${smtpErrorMessage}` }
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
  const evaluateFieldLevelConditionSync = (flc: any): boolean => {
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

  // Evaluate against linked records via a cross-reference field on the source record.
  // Quantifiers: ANY (default) | ALL | NONE | COUNT_GTE
  const evaluateLinkedRecordsCondition = async (flc: any): Promise<boolean> => {
    const crossRefFieldId = flc?.crossRefFieldId
    const fieldId = flc?.fieldId
    const operator = flc?.operator
    const expectedValue = flc?.value
    const quantifier = (flc?.quantifier || 'ANY') as 'ALL' | 'ANY' | 'NONE' | 'COUNT_GTE'
    const quantifierCount = Number(flc?.quantifierCount ?? 1)

    if (!crossRefFieldId || !fieldId) {
      console.log(`⚠️ linkedRecords condition missing crossRefFieldId or fieldId`)
      return false
    }

    const rawRefs = submissionData[crossRefFieldId]
    let refs: any[] = []
    if (Array.isArray(rawRefs)) refs = rawRefs
    else if (rawRefs && typeof rawRefs === 'object') refs = [rawRefs]

    // Extract candidate submission identifiers (id preferred, fallback submission_ref_id)
    const submissionIds: string[] = []
    const submissionRefIds: string[] = []
    for (const r of refs) {
      if (!r) continue
      if (typeof r === 'string') { submissionIds.push(r); continue }
      if (r.id) submissionIds.push(String(r.id))
      else if (r.submission_ref_id) submissionRefIds.push(String(r.submission_ref_id))
    }

    console.log(`🔗 linkedRecords: crossRef=${crossRefFieldId}, refs=${refs.length}, ids=${submissionIds.length}, refIds=${submissionRefIds.length}, quantifier=${quantifier}`)

    if (submissionIds.length === 0 && submissionRefIds.length === 0) {
      // No linked records: ALL is vacuously true, NONE is true, ANY/COUNT false.
      if (quantifier === 'ALL' || quantifier === 'NONE') return true
      return false
    }

    let linkedRows: any[] = []
    if (submissionIds.length > 0) {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_data')
        .in('id', submissionIds)
      if (error) console.log(`⚠️ Error fetching linked by id: ${error.message}`)
      if (data) linkedRows.push(...data)
    }
    if (submissionRefIds.length > 0) {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submission_data, submission_ref_id')
        .in('submission_ref_id', submissionRefIds)
      if (error) console.log(`⚠️ Error fetching linked by ref: ${error.message}`)
      if (data) linkedRows.push(...data)
    }

    if (linkedRows.length === 0) {
      if (quantifier === 'ALL' || quantifier === 'NONE') return true
      return false
    }

    let matchCount = 0
    for (const row of linkedRows) {
      const sd = row?.submission_data || {}
      const actual = sd[fieldId]
      const ok = compareValues(actual, expectedValue, operator)
      if (ok) matchCount++
    }
    const total = linkedRows.length
    console.log(`🔗 linkedRecords matches: ${matchCount}/${total}`)

    switch (quantifier) {
      case 'ALL': return matchCount === total
      case 'NONE': return matchCount === 0
      case 'COUNT_GTE': return matchCount >= quantifierCount
      case 'ANY':
      default: return matchCount > 0
    }
  }

  // Synchronous wrapper kept for backward-compat call sites; routes to linked when needed.
  // For linked records we need async, so the main path below uses awaitable evaluation.
  const evaluateFieldLevelCondition = (flc: any): boolean => {
    // Linked-records path is async; not callable here. Returns false to be safe.
    if (flc?.source === 'linkedRecords') {
      console.log(`⚠️ evaluateFieldLevelCondition called synchronously for linkedRecords; use async path`)
      return false
    }
    return evaluateFieldLevelConditionSync(flc)
  }

  // Evaluate enhanced condition format (async to support linkedRecords)
  const evaluateEnhancedCondition = async (ec: any): Promise<boolean> => {
    if (!ec) return true
    
    const conditions = ec.conditions || []
    const useManualExpression = ec.useManualExpression
    const manualExpression = ec.manualExpression
    
    console.log(`📊 Enhanced condition: ${conditions.length} conditions, useManual=${useManualExpression}`)
    
    if (conditions.length === 0) {
      if (ec.fieldLevelCondition) {
        const flc = ec.fieldLevelCondition
        if (flc?.source === 'linkedRecords') return await evaluateLinkedRecordsCondition(flc)
        return evaluateFieldLevelConditionSync(flc)
      }
      return true
    }
    
    const results: boolean[] = []
    for (const cond of conditions) {
      let condResult = false
      if (cond.fieldLevelCondition) {
        const flc = cond.fieldLevelCondition
        condResult = flc?.source === 'linkedRecords'
          ? await evaluateLinkedRecordsCondition(flc)
          : evaluateFieldLevelConditionSync(flc)
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
    conditionResult = await evaluateEnhancedCondition(enhancedCondition)
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
