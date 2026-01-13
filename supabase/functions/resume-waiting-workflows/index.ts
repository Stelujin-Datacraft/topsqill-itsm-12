import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WaitingExecution {
  id: string
  workflow_id: string
  wait_node_id: string
  wait_config: any
  trigger_data: any
  execution_data: any
  trigger_submission_id: string
  submitter_id: string
  current_node_id: string
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this is a manual resume request
    let manualExecutionId: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        manualExecutionId = body?.executionId
        console.log('📝 Manual resume request for execution:', manualExecutionId)
      } catch {
        // Not a JSON body, continue with auto-resume
      }
    }

    console.log('🔍 Checking for waiting workflows to resume...')

    // Build query based on whether this is manual or scheduled
    // Include current_node_id as fallback for wait_node_id
    let query = supabase
      .from('workflow_executions')
      .select('id, workflow_id, wait_node_id, wait_config, trigger_data, execution_data, trigger_submission_id, submitter_id, current_node_id')
      .eq('status', 'waiting')

    if (manualExecutionId) {
      query = query.eq('id', manualExecutionId)
    } else {
      query = query.lte('scheduled_resume_at', new Date().toISOString())
    }

    const { data: waitingExecutions, error: fetchError } = await query

    if (fetchError) {
      console.error('❌ Error fetching waiting executions:', fetchError)
      throw fetchError
    }

    if (!waitingExecutions || waitingExecutions.length === 0) {
      console.log('✅ No waiting workflows to resume')
      return new Response(
        JSON.stringify({ message: 'No waiting workflows to resume', resumedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${waitingExecutions.length} waiting workflow(s) to resume`)

    let resumedCount = 0
    const errors: string[] = []
    const resumedExecutions: string[] = []

    for (const execution of waitingExecutions as WaitingExecution[]) {
      try {
        // Use wait_node_id if available, otherwise fall back to current_node_id
        const waitNodeId = execution.wait_node_id || execution.current_node_id
        
        console.log(`▶️ Resuming workflow execution: ${execution.id}`)
        console.log(`   Wait node ID: ${waitNodeId}`)
        console.log(`   Wait config:`, execution.wait_config)

        if (!waitNodeId) {
          console.error(`❌ No wait node ID found for execution ${execution.id}`)
          errors.push(`Execution ${execution.id}: No wait node ID found`)
          
          // Mark as failed since we can't continue
          await supabase
            .from('workflow_executions')
            .update({
              status: 'failed',
              error_message: 'Cannot resume: wait_node_id is missing',
              completed_at: new Date().toISOString()
            })
            .eq('id', execution.id)
          continue
        }

        // Get the next nodes from the wait node
        const { data: connections, error: connError } = await supabase
          .from('workflow_connections')
          .select('target_node_id')
          .eq('source_node_id', waitNodeId)

        if (connError) {
          console.error(`❌ Error getting connections for execution ${execution.id}:`, connError)
          errors.push(`Execution ${execution.id}: ${connError.message}`)
          continue
        }

        const nextNodeIds = connections?.map(c => c.target_node_id) || []
        console.log(`   Next nodes: ${nextNodeIds.join(', ') || 'none'}`)

        // Update the wait node log to completed
        const { error: logUpdateError } = await supabase
          .from('workflow_instance_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            output_data: { 
              resumed: true, 
              resumedAt: new Date().toISOString(),
              waitType: execution.wait_config?.waitType || 'duration',
              message: 'Wait period completed, workflow resumed'
            }
          })
          .eq('execution_id', execution.id)
          .eq('node_id', waitNodeId)
          .eq('status', 'waiting')

        if (logUpdateError) {
          console.error(`⚠️ Error updating wait log for ${execution.id}:`, logUpdateError)
        }

        if (nextNodeIds.length === 0) {
          // No next nodes, mark workflow as completed
          console.log(`🏁 No next nodes, completing workflow execution: ${execution.id}`)
          
          await supabase
            .from('workflow_executions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              scheduled_resume_at: null,
              wait_node_id: null,
              wait_config: null,
              execution_data: {
                ...execution.execution_data,
                completedByResume: true,
                completedAt: new Date().toISOString()
              }
            })
            .eq('id', execution.id)

          resumedCount++
          resumedExecutions.push(execution.id)
          continue
        }

        // Get details for next nodes
        const { data: nextNodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('*')
          .in('id', nextNodeIds)

        if (nodesError) {
          console.error(`❌ Error fetching next nodes:`, nodesError)
          errors.push(`Execution ${execution.id}: Failed to fetch next nodes`)
          continue
        }

        // Update execution status to running with the first next node
        const { error: execUpdateError } = await supabase
          .from('workflow_executions')
          .update({
            status: 'running',
            current_node_id: nextNodeIds[0],
            scheduled_resume_at: null,
            wait_node_id: null,
            wait_config: null,
            execution_data: {
              ...execution.execution_data,
              resumedAt: new Date().toISOString(),
              resumedFromWait: true,
              pendingNodes: nextNodeIds
            }
          })
          .eq('id', execution.id)

        if (execUpdateError) {
          console.error(`❌ Error updating execution status:`, execUpdateError)
          errors.push(`Execution ${execution.id}: ${execUpdateError.message}`)
          continue
        }

        // Track if we've executed an end node
        let hasEndNode = false
        let allNodesProcessed = true

        // Use a queue to process nodes (allows condition branches to add more nodes)
        const nodeQueue: WorkflowNode[] = [...(nextNodes || []) as WorkflowNode[]]
        const processedNodeIds = new Set<string>()
        
        // Track loop iterations per node to prevent true infinite loops
        const nodeExecutionCounts = new Map<string, number>()
        const MAX_LOOP_ITERATIONS = 100 // Safety limit to prevent runaway loops

        // Process nodes from queue
        while (nodeQueue.length > 0) {
          const nodeData = nodeQueue.shift()!
          
          // Track how many times we've executed this node
          const executionCount = nodeExecutionCounts.get(nodeData.id) || 0
          nodeExecutionCounts.set(nodeData.id, executionCount + 1)
          
          // Safety check: prevent true infinite loops
          if (executionCount >= MAX_LOOP_ITERATIONS) {
            console.log(`🛑 Max loop iterations (${MAX_LOOP_ITERATIONS}) reached for node: ${nodeData.id} - stopping loop`)
            continue
          }
          
          // For wait nodes, we allow re-execution (loop-back support)
          // For other nodes, skip if already processed
          if (processedNodeIds.has(nodeData.id) && nodeData.node_type !== 'wait') {
            console.log(`⏭️ Skipping already processed node: ${nodeData.id}`)
            continue
          }
          
          // For wait nodes being re-executed (loop-back), log it
          if (processedNodeIds.has(nodeData.id) && nodeData.node_type === 'wait') {
            console.log(`🔄 Loop-back detected: Re-executing wait node: ${nodeData.id} (iteration ${executionCount + 1})`)
          }
          
          processedNodeIds.add(nodeData.id)
          console.log(`🎯 Executing resumed node: ${nodeData.label} (${nodeData.node_type})`)
          
          // Create log entry for this node
          const nodeStartTime = Date.now()
          const nodeStartTimeISO = new Date(nodeStartTime).toISOString()
          let logEntryId: string | null = null
          let nodeStatus: 'completed' | 'failed' = 'completed'
          let nodeError: string | null = null
          let nodeOutputData: any = { success: true }
          
          try {
            // Prepare action details for action nodes
            const actionConfig = nodeData.node_type === 'action' ? (nodeData.config as any) : null
            const actionType = actionConfig?.actionType || null
            
            const { data: logEntry, error: insertError } = await supabase
              .from('workflow_instance_logs')
              .insert({
                execution_id: execution.id,
                node_id: nodeData.id,
                node_type: nodeData.node_type,
                node_label: nodeData.label,
                status: 'running',
                started_at: nodeStartTimeISO,
                action_type: actionType,
                action_details: actionConfig ? {
                  actionType: actionConfig.actionType,
                  config: actionConfig
                } : null,
                input_data: {
                  resumedFrom: waitNodeId,
                  triggerData: execution.trigger_data
                }
              })
              .select()
              .single()

            if (insertError) {
              console.error(`⚠️ Error creating log for node ${nodeData.id}:`, insertError)
            } else if (logEntry) {
              logEntryId = logEntry.id
            }
            
            if (nodeData.node_type === 'action') {
              const config = nodeData.config as any
              const actionType = config?.actionType
              
              console.log(`📝 Action type: ${actionType}`)
              
              if (actionType === 'send_notification') {
                // Execute notification action
                const notificationConfig = config?.notificationConfig || config?.notification || {}
                const recipientConfig = notificationConfig.recipientConfig || {}
                const recipientType = recipientConfig.type || notificationConfig.recipientType || config?.recipientType || 'form_owner'
                
                // Get title/subject and message from config
                const title = notificationConfig.subject || notificationConfig.title || config?.notificationTitle || 'Workflow Notification'
                const message = notificationConfig.message || config?.notificationMessage || 'You have a notification from a workflow'
                
                console.log(`📝 Notification config:`, JSON.stringify(notificationConfig))
                console.log(`📝 Title: ${title}, Message: ${message}`)
                console.log(`📝 Recipient type: ${recipientType}`)
                
                const recipientUserIds: string[] = []
                
                // Determine recipient based on type
                if (recipientType === 'form_owner') {
                  const ownerId = execution.trigger_data?.formOwnerId
                  if (ownerId) recipientUserIds.push(ownerId)
                } else if (recipientType === 'submitter') {
                  const submitterId = execution.submitter_id || execution.trigger_data?.submitterId
                  if (submitterId) recipientUserIds.push(submitterId)
                } else if (recipientType === 'specific_user') {
                  const specificId = notificationConfig.specificUserId || recipientConfig.specificUserId || config?.specificUserId
                  if (specificId) recipientUserIds.push(specificId)
                } else if (recipientType === 'static') {
                  // Handle static emails - look up users by email
                  const emails = recipientConfig.emails || notificationConfig.emails || []
                  console.log(`📧 Looking up users by emails:`, emails)
                  
                  for (const email of emails) {
                    const { data: userByEmail } = await supabase
                      .from('user_profiles')
                      .select('id')
                      .eq('email', email.toLowerCase().trim())
                      .single()
                    
                    if (userByEmail) {
                      console.log(`✅ Found user for email ${email}: ${userByEmail.id}`)
                      recipientUserIds.push(userByEmail.id)
                    } else {
                      console.log(`⚠️ No user found for email: ${email}`)
                    }
                  }
                } else if (recipientType === 'dynamic_field') {
                  // Try to get from submission data
                  const fieldId = notificationConfig.dynamicFieldId || recipientConfig.dynamicFieldId || config?.dynamicFieldId
                  const submissionData = execution.trigger_data?.submissionData
                  if (fieldId && submissionData) {
                    const fieldValue = submissionData[fieldId]
                    if (fieldValue) {
                      // Check if it's a UUID (user ID) or email
                      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                      if (uuidRegex.test(fieldValue)) {
                        recipientUserIds.push(fieldValue)
                      } else {
                        // Try to find user by email
                        const { data: userByEmail } = await supabase
                          .from('user_profiles')
                          .select('id')
                          .eq('email', fieldValue.toLowerCase())
                          .single()
                        if (userByEmail) {
                          recipientUserIds.push(userByEmail.id)
                        }
                      }
                    }
                  }
                }
                
                // Deduplicate recipients to prevent duplicate notifications
                const uniqueRecipientUserIds = [...new Set(recipientUserIds)]
                console.log(`📨 Sending notification to ${uniqueRecipientUserIds.length} unique user(s):`, uniqueRecipientUserIds)
                
                let notificationsSent = 0
                for (const userId of uniqueRecipientUserIds) {
                  // Check if notification already sent for this execution and node
                  const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('type', 'workflow')
                    .contains('data', { executionId: execution.id, nodeId: nodeData.id })
                    .single()
                  
                  if (existingNotif) {
                    console.log(`⚠️ Notification already exists for user ${userId}, skipping`)
                    continue
                  }
                  
                  const { error: notifError } = await supabase
                    .from('notifications')
                    .insert({
                      user_id: userId,
                      title: title,
                      message: message,
                      type: 'workflow',
                      data: {
                        workflowId: execution.workflow_id,
                        executionId: execution.id,
                        nodeId: nodeData.id,
                        resumedFromWait: true
                      },
                      read: false
                    })
                  
                  if (notifError) {
                    console.error(`❌ Error sending notification to ${userId}:`, notifError)
                  } else {
                    console.log(`✅ Notification sent to ${userId}`)
                    notificationsSent++
                  }
                }
                
                nodeOutputData = { 
                  notificationsSent,
                  recipientUserIds: uniqueRecipientUserIds,
                  title,
                  message,
                  success: true
                }
              } else if (actionType === 'create_combination_records') {
                // Execute create combination records action
                console.log('🔗✨ Executing create_combination_records action in edge function')
                
                const combinationMode = config.combinationMode || 'single'
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                const submitterId = execution.submitter_id || execution.trigger_data?.submitterId
                
                console.log(`📋 Combination mode: ${combinationMode}`)
                console.log(`📋 Trigger submission ID: ${triggerSubmissionId}`)
                
                // Helper function to extract linked records
                const extractLinkedRecords = (crossRefValue: any, defaultFormId: string): Array<{refId: string, formId: string}> => {
                  if (!crossRefValue) return []
                  
                  if (Array.isArray(crossRefValue)) {
                    return crossRefValue
                      .map(v => {
                        if (typeof v === 'string') return { refId: v, formId: defaultFormId }
                        if (v && typeof v === 'object' && v.submission_ref_id) {
                          return { refId: v.submission_ref_id, formId: v.form_id || defaultFormId }
                        }
                        return null
                      })
                      .filter((v): v is {refId: string, formId: string} => v !== null && !!v.refId)
                  } else if (typeof crossRefValue === 'string') {
                    return [{ refId: crossRefValue, formId: defaultFormId }]
                  } else if (crossRefValue && typeof crossRefValue === 'object' && crossRefValue.submission_ref_id) {
                    return [{ refId: crossRefValue.submission_ref_id, formId: crossRefValue.form_id || defaultFormId }]
                  }
                  return []
                }

                // Extract linked records from first source
                const firstSourceRecords = extractLinkedRecords(
                  triggerSubmissionData[config.sourceCrossRefFieldId],
                  config.sourceLinkedFormId
                )
                console.log(`📋 First source records: ${firstSourceRecords.length}`)

                // Extract linked records from second source (dual mode)
                let secondSourceRecords: Array<{refId: string, formId: string}> = []
                if (combinationMode === 'dual') {
                  secondSourceRecords = extractLinkedRecords(
                    triggerSubmissionData[config.secondSourceCrossRefFieldId],
                    config.secondSourceLinkedFormId
                  )
                  console.log(`📋 Second source records: ${secondSourceRecords.length}`)
                }

                if (firstSourceRecords.length === 0) {
                  console.log('⚠️ No records in first source cross-reference field')
                  nodeOutputData = { 
                    message: 'No linked records found in first source cross-reference field',
                    createdCount: 0,
                    success: true
                  }
                } else if (combinationMode === 'dual' && secondSourceRecords.length === 0) {
                  console.log('⚠️ No records in second source cross-reference field')
                  nodeOutputData = { 
                    message: 'No linked records found in second source cross-reference field',
                    createdCount: 0,
                    success: true
                  }
                } else {
                  // Build combinations
                  interface CombinationPair {
                    first: {refId: string, formId: string}
                    second?: {refId: string, formId: string}
                  }
                  
                  let combinations: CombinationPair[] = []
                  
                  if (combinationMode === 'dual') {
                    // Cartesian product
                    for (const first of firstSourceRecords) {
                      for (const second of secondSourceRecords) {
                        combinations.push({ first, second })
                      }
                    }
                    console.log(`📋 Cartesian product: ${combinations.length} combinations`)
                  } else {
                    combinations = firstSourceRecords.map(first => ({ first }))
                  }

                  // Fetch trigger submission's submission_ref_id
                  const { data: triggerSubmission } = await supabase
                    .from('form_submissions')
                    .select('id, submission_ref_id')
                    .eq('id', triggerSubmissionId)
                    .single()

                  // Pre-fetch linked records data for field mappings
                  const linkedRecordsDataMap = new Map<string, Record<string, any>>()
                  const allRefIds = [
                    ...firstSourceRecords.map(r => r.refId),
                    ...secondSourceRecords.map(r => r.refId)
                  ]
                  
                  if (allRefIds.length > 0 && (
                    (config.linkedFormFieldMappings && config.linkedFormFieldMappings.length > 0) ||
                    (config.secondLinkedFormFieldMappings && config.secondLinkedFormFieldMappings.length > 0)
                  )) {
                    const { data: linkedSubmissions } = await supabase
                      .from('form_submissions')
                      .select('submission_ref_id, submission_data')
                      .in('submission_ref_id', allRefIds)
                    
                    if (linkedSubmissions) {
                      for (const sub of linkedSubmissions) {
                        if (sub.submission_ref_id) {
                          linkedRecordsDataMap.set(sub.submission_ref_id, sub.submission_data as Record<string, any>)
                        }
                      }
                    }
                    console.log(`📋 Fetched data for ${linkedRecordsDataMap.size} linked records`)
                  }

                  // Create combination records
                  const createdRecords: Array<{id: string, submission_ref_id: string}> = []
                  const initialStatus = config.initialStatus || 'pending'

                  for (const combo of combinations) {
                    const combinationSubmissionData: Record<string, any> = {}

                    // Apply target link fields
                    if (config.targetLinkFields && config.targetLinkFields.length > 0) {
                      for (const linkField of config.targetLinkFields) {
                        // Skip if targetFieldId is not configured
                        if (!linkField.targetFieldId) {
                          console.log('⚠️ Skipping target link field with empty targetFieldId')
                          continue
                        }
                        const sourceRecord = linkField.linkTo === 'second_source' ? combo.second : combo.first
                        if (sourceRecord) {
                          combinationSubmissionData[linkField.targetFieldId] = [{
                            submission_ref_id: sourceRecord.refId,
                            form_id: sourceRecord.formId
                          }]
                        }
                      }
                    }

                    // Apply field mappings from trigger form
                    if (config.fieldMappings && config.fieldMappings.length > 0) {
                      for (const mapping of config.fieldMappings) {
                        if (mapping.sourceFieldId && mapping.targetFieldId) {
                          const sourceValue = triggerSubmissionData[mapping.sourceFieldId]
                          if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                            combinationSubmissionData[mapping.targetFieldId] = sourceValue
                          }
                        }
                      }
                    }

                    // Apply field mappings from first linked form
                    // Filter out incomplete mappings first
                    const validLinkedFormMappings = (config.linkedFormFieldMappings || []).filter(
                      (m: any) => m.sourceFieldId && m.targetFieldId
                    )
                    if (validLinkedFormMappings.length > 0) {
                      const linkedRecordData = linkedRecordsDataMap.get(combo.first.refId)
                      if (linkedRecordData) {
                        for (const mapping of validLinkedFormMappings) {
                          const sourceValue = linkedRecordData[mapping.sourceFieldId]
                          if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                            combinationSubmissionData[mapping.targetFieldId] = sourceValue
                          }
                        }
                      }
                    }

                    // Apply field mappings from second linked form (dual mode)
                    if (combinationMode === 'dual' && combo.second && config.secondLinkedFormFieldMappings && config.secondLinkedFormFieldMappings.length > 0) {
                      const secondLinkedRecordData = linkedRecordsDataMap.get(combo.second.refId)
                      if (secondLinkedRecordData) {
                        for (const mapping of config.secondLinkedFormFieldMappings) {
                          if (mapping.sourceFieldId && mapping.targetFieldId) {
                            const sourceValue = secondLinkedRecordData[mapping.sourceFieldId]
                            if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                              combinationSubmissionData[mapping.targetFieldId] = sourceValue
                            }
                          }
                        }
                      }
                    }

                    console.log('📝 Creating combination record:', {
                      firstRef: combo.first.refId,
                      secondRef: combo.second?.refId,
                      dataKeys: Object.keys(combinationSubmissionData)
                    })

                    const { data: newSubmission, error: createError } = await supabase
                      .from('form_submissions')
                      .insert({
                        form_id: config.targetFormId,
                        submission_data: combinationSubmissionData,
                        submitted_by: submitterId,
                        approval_status: initialStatus
                      })
                      .select('id, submission_ref_id')
                      .single()

                    if (createError || !newSubmission) {
                      console.error('❌ Error creating combination record:', createError)
                      continue
                    }

                    console.log('✅ Combination record created:', newSubmission.id)
                    createdRecords.push({
                      id: newSubmission.id,
                      submission_ref_id: newSubmission.submission_ref_id || ''
                    })
                  }

                  // Auto-link created records back to trigger form's cross-ref field if configured
                  if (config.updateTriggerCrossRefFieldId && createdRecords.length > 0 && triggerSubmissionId) {
                    console.log('🔗 Updating trigger form cross-ref field with created records...')
                    
                    const newCrossRefValues = createdRecords.map(record => ({
                      submission_ref_id: record.submission_ref_id,
                      form_id: config.targetFormId
                    }))

                    const { data: currentTriggerSubmission } = await supabase
                      .from('form_submissions')
                      .select('submission_data')
                      .eq('id', triggerSubmissionId)
                      .single()

                    if (currentTriggerSubmission) {
                      const currentData = currentTriggerSubmission.submission_data || {}
                      const existingCrossRefValue = (currentData as any)[config.updateTriggerCrossRefFieldId] || []
                      
                      let mergedCrossRefValues: any[] = []
                      if (Array.isArray(existingCrossRefValue)) {
                        mergedCrossRefValues = [...existingCrossRefValue]
                      } else if (existingCrossRefValue && typeof existingCrossRefValue === 'object') {
                        mergedCrossRefValues = [existingCrossRefValue]
                      }
                      
                      const existingRefIds = new Set(mergedCrossRefValues.map((v: any) => 
                        typeof v === 'string' ? v : v.submission_ref_id
                      ))
                      
                      for (const newVal of newCrossRefValues) {
                        if (!existingRefIds.has(newVal.submission_ref_id)) {
                          mergedCrossRefValues.push(newVal)
                        }
                      }

                      const updatedData = {
                        ...(typeof currentData === 'object' ? currentData : {}),
                        [config.updateTriggerCrossRefFieldId]: mergedCrossRefValues
                      }

                      await supabase
                        .from('form_submissions')
                        .update({ submission_data: updatedData })
                        .eq('id', triggerSubmissionId)
                      
                      console.log(`✅ Updated trigger form cross-ref field with ${newCrossRefValues.length} new records`)
                    }
                  }

                  console.log(`✅ Successfully created ${createdRecords.length} combination records`)

                  nodeOutputData = { 
                    createdCount: createdRecords.length,
                    requestedCount: combinations.length,
                    combinationMode,
                    targetFormId: config.targetFormId,
                    createdRecordIds: createdRecords.map(r => r.id),
                    success: true
                  }
                }
              } else if (actionType === 'change_field_value') {
                // Execute change field value action with multi-field support
                console.log('🔧 Executing change_field_value action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                
                console.log('📋 Trigger submission data keys:', Object.keys(triggerSubmissionData))
                console.log('📋 Full trigger submission data:', JSON.stringify(triggerSubmissionData))
                console.log('📋 Config:', JSON.stringify(config))
                
                // Support both new multi-field format and legacy single-field format
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
                  console.log('📋 Using fieldUpdates array with', config.fieldUpdates.length, 'updates')
                  fieldUpdates = config.fieldUpdates
                } else if (config.targetFieldId && config.valueType) {
                  // Legacy single-field format
                  console.log('📋 Using legacy single-field format')
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
                
                console.log('📋 Field updates to process:', JSON.stringify(fieldUpdates))
                
                // Validate config
                if (!config.targetFormId || fieldUpdates.length === 0) {
                  throw new Error('Missing required configuration for field value change')
                }
                
                // Process each field update
                const fieldValueMap: Record<string, any> = {}
                const results: Array<{ fieldId: string; fieldName?: string; newValue: any; success: boolean; error?: string }> = []
                
                for (const update of fieldUpdates) {
                  console.log('🔄 Processing update:', JSON.stringify(update))
                  let newValue: any = undefined
                  
                  if (update.valueType === 'static') {
                    newValue = update.staticValue
                    console.log(`📝 Static value for ${update.targetFieldName}: ${newValue}`)
                  } else if (update.valueType === 'dynamic') {
                    const dynamicPath = update.dynamicValuePath
                    console.log(`🔍 Looking for dynamic value at path: "${dynamicPath}"`)
                    console.log(`🔍 Available keys in submission data:`, Object.keys(triggerSubmissionData))
                    console.log(`🔍 Path exists in data:`, dynamicPath ? dynamicPath in triggerSubmissionData : false)
                    
                    if (dynamicPath && dynamicPath in triggerSubmissionData) {
                      newValue = triggerSubmissionData[dynamicPath]
                      console.log(`✅ Found dynamic value: "${newValue}" (type: ${typeof newValue})`)
                    } else {
                      console.log(`❌ Dynamic path not found in trigger data`)
                      // Also try to find by field name in case the path is the field name
                      const matchingKey = Object.keys(triggerSubmissionData).find(key => 
                        key === dynamicPath || key.toLowerCase() === dynamicPath?.toLowerCase()
                      )
                      if (matchingKey) {
                        newValue = triggerSubmissionData[matchingKey]
                        console.log(`✅ Found value via key matching: "${newValue}"`)
                      }
                    }
                    
                    if (newValue === undefined) {
                      console.log(`⚠️ Could not find value for field: ${update.dynamicFieldName || update.dynamicValuePath}`)
                      results.push({
                        fieldId: update.targetFieldId,
                        fieldName: update.targetFieldName,
                        newValue: undefined,
                        success: false,
                        error: `Could not find value for field: ${update.dynamicFieldName || update.dynamicValuePath}`
                      })
                      continue
                    }
                    
                    // Normalize numeric values for numeric target types
                    const numericTypes = ['number', 'currency', 'slider', 'rating']
                    if (numericTypes.includes(update.targetFieldType?.toLowerCase() || '')) {
                      if (typeof newValue === 'string' && newValue.trim() !== '') {
                        const cleanedValue = newValue.replace(/[,$€£¥₹\s]/g, '').trim()
                        const parsedNumber = parseFloat(cleanedValue)
                        if (!isNaN(parsedNumber)) {
                          newValue = parsedNumber
                          console.log(`🔢 Normalized string to number: ${newValue}`)
                        }
                      }
                    }
                  }
                  
                  // Fetch target field to check type and validate submission-access fields
                  const { data: targetField } = await supabase
                    .from('form_fields')
                    .select('id, field_type, custom_config')
                    .eq('id', update.targetFieldId)
                    .single()
                  
                  if (targetField) {
                    // Handle submission-access field validation
                    if (targetField.field_type === 'submission-access') {
                      console.log(`🔐 Processing submission-access field: ${update.targetFieldId}`)
                      console.log(`🔐 Raw value before validation:`, JSON.stringify(newValue))
                      console.log(`🔐 Target field custom_config type:`, typeof targetField.custom_config)
                      console.log(`🔐 Target field custom_config:`, JSON.stringify(targetField.custom_config))
                      
                      // Parse custom_config if it's a string (shouldn't happen with JSONB, but just in case)
                      let customConfig: any = targetField.custom_config || {}
                      if (typeof customConfig === 'string') {
                        try {
                          customConfig = JSON.parse(customConfig)
                          console.log(`🔐 Parsed custom_config from string`)
                        } catch {
                          console.log(`⚠️ Could not parse custom_config string`)
                          customConfig = {}
                        }
                      }
                      
                      const allowedUsers = customConfig.allowedUsers || []
                      const allowedGroups = customConfig.allowedGroups || []
                      
                      console.log(`🔐 Allowed users:`, allowedUsers)
                      console.log(`🔐 Allowed groups:`, allowedGroups)
                      
                      // Parse value if it's a string
                      let parsedValue = newValue
                      if (typeof newValue === 'string') {
                        try {
                          parsedValue = JSON.parse(newValue)
                        } catch {
                          console.log(`⚠️ Could not parse submission-access value as JSON`)
                          parsedValue = null
                        }
                      }
                      
                      let sourceUsers: string[] = []
                      let sourceGroups: string[] = []
                      
                      // Handle new format: { users: [], groups: [] }
                      if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
                        sourceUsers = parsedValue.users || []
                        sourceGroups = parsedValue.groups || []
                      }
                      // Handle legacy array format: ["user:uuid", "group:uuid"]
                      else if (Array.isArray(parsedValue)) {
                        console.log('🔄 Converting legacy array format to { users, groups }')
                        parsedValue.forEach((item: string) => {
                          if (typeof item === 'string') {
                            if (item.startsWith('user:')) {
                              sourceUsers.push(item.replace('user:', ''))
                            } else if (item.startsWith('group:')) {
                              sourceGroups.push(item.replace('group:', ''))
                            }
                          }
                        })
                      }
                      
                      if (sourceUsers.length > 0 || sourceGroups.length > 0) {
                        // Filter to only allowed users/groups
                        const validUsers = sourceUsers.filter((userId: string) => 
                          allowedUsers.includes(userId)
                        )
                        const validGroups = sourceGroups.filter((groupId: string) => 
                          allowedGroups.includes(groupId)
                        )
                        
                        console.log(`🔐 Validation: source users=${sourceUsers.length}, valid=${validUsers.length}, source groups=${sourceGroups.length}, valid=${validGroups.length}`)
                        
                        if (validUsers.length > 0 || validGroups.length > 0) {
                          newValue = { users: validUsers, groups: validGroups }
                          console.log(`✅ Validated submission-access value:`, JSON.stringify(newValue))
                        } else {
                          console.log(`❌ No valid users or groups in submission-access value`)
                          results.push({
                            fieldId: update.targetFieldId,
                            fieldName: update.targetFieldName,
                            newValue: undefined,
                            success: false,
                            error: 'Invalid submission-access field value: no valid users or groups'
                          })
                          continue
                        }
                      } else {
                        console.log(`❌ Invalid submission-access value format`)
                        results.push({
                          fieldId: update.targetFieldId,
                          fieldName: update.targetFieldName,
                          newValue: undefined,
                          success: false,
                          error: 'Invalid submission-access field value format'
                        })
                        continue
                      }
                    }
                    
                    // Handle numeric type normalization from target field
                    const targetFieldType = targetField.field_type?.toLowerCase()
                    const numericTargetTypes = ['number', 'currency', 'slider', 'rating']
                    if (numericTargetTypes.includes(targetFieldType) && typeof newValue === 'string' && newValue.trim() !== '') {
                      const cleanedValue = newValue.replace(/[,$€£¥₹\s]/g, '').trim()
                      const parsedNumber = parseFloat(cleanedValue)
                      if (!isNaN(parsedNumber)) {
                        newValue = parsedNumber
                        console.log(`🔢 Normalized to number from target type: ${newValue}`)
                      }
                    }
                  }
                  
                  console.log(`📝 Final value for ${update.targetFieldName} (${update.targetFieldId}): ${JSON.stringify(newValue)}`)
                  fieldValueMap[update.targetFieldId] = newValue
                  results.push({
                    fieldId: update.targetFieldId,
                    fieldName: update.targetFieldName,
                    newValue,
                    success: true
                  })
                }
                
                console.log('📋 Field value map:', JSON.stringify(fieldValueMap))
                console.log('📋 Results:', JSON.stringify(results))
                
                const successfulUpdates = results.filter(r => r.success)
                if (successfulUpdates.length === 0) {
                  throw new Error(`All field updates failed: ${results.map(r => r.error).join('; ')}`)
                }
                
                console.log('💾 Field values determined:', fieldValueMap)
                
                // Check if target form is different from trigger form
                const isTargetFormDifferent = config.targetFormId !== triggerFormId
                console.log('📋 Trigger form:', triggerFormId, 'Target form:', config.targetFormId, 'Is different:', isTargetFormDifferent)
                
                if (isTargetFormDifferent) {
                  // Bulk update all submissions in target form for each field
                  console.log('🔄 Performing bulk update on target form:', config.targetFormId)
                  
                  let totalUpdated = 0
                  for (const [fieldId, newValue] of Object.entries(fieldValueMap)) {
                    const { data: rpcResult, error: rpcError } = await supabase.rpc('bulk_update_submission_field', {
                      _form_id: config.targetFormId,
                      _field_id: fieldId,
                      _new_value: newValue
                    })
                    
                    if (rpcError) {
                      console.error('❌ Bulk update error for field:', fieldId, rpcError)
                    } else {
                      totalUpdated = Math.max(totalUpdated, rpcResult || 0)
                    }
                  }
                  
                  console.log(`✅ Bulk updated ${totalUpdated} records with ${successfulUpdates.length} field(s)`)
                  nodeOutputData = {
                    updatedCount: totalUpdated,
                    targetFormId: config.targetFormId,
                    fieldsUpdated: successfulUpdates.length,
                    fieldDetails: results,
                    success: true
                  }
                } else {
                  // Update only the trigger submission
                  if (!triggerSubmissionId) {
                    throw new Error('Cannot update trigger submission: no submission ID')
                  }
                  
                  console.log('📝 Updating trigger submission:', triggerSubmissionId)
                  
                  // Get current submission data
                  const { data: currentSubmission, error: fetchError } = await supabase
                    .from('form_submissions')
                    .select('submission_data')
                    .eq('id', triggerSubmissionId)
                    .single()
                  
                  if (fetchError) {
                    throw new Error(`Failed to fetch submission: ${fetchError.message}`)
                  }
                  
                  const currentData = currentSubmission?.submission_data || {}
                  const updatedData = {
                    ...(typeof currentData === 'object' ? currentData : {}),
                    ...fieldValueMap
                  }
                  
                  // Update the submission
                  const { error: updateError } = await supabase
                    .from('form_submissions')
                    .update({ submission_data: updatedData })
                    .eq('id', triggerSubmissionId)
                  
                  if (updateError) {
                    throw new Error(`Failed to update submission: ${updateError.message}`)
                  }
                  
                  console.log(`✅ Successfully updated ${successfulUpdates.length} field(s) in trigger submission`)
                  nodeOutputData = {
                    submissionId: triggerSubmissionId,
                    fieldsUpdated: successfulUpdates.length,
                    fieldDetails: results,
                    success: true
                  }
                }
              } else if (actionType === 'create_record') {
                // Execute create record action
                console.log('📝 Executing create_record action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                const submitterId = execution.submitter_id || execution.trigger_data?.submitterId
                
                if (!config.targetFormId) {
                  throw new Error('Missing target form ID for create record action')
                }
                
                // Get record count (default to 1, max 100)
                const recordCount = Math.min(Math.max(config.recordCount || 1, 1), 100)
                const createdRecords: Array<{id: string, submission_ref_id: string}> = []
                
                console.log(`📊 Creating ${recordCount} records for form ${config.targetFormId}`)
                
                // Determine submitter
                let recordSubmitterId = submitterId
                if (config.setSubmittedBy === 'specific_user' && config.specificSubmitterId) {
                  recordSubmitterId = config.specificSubmitterId
                } else if (config.setSubmittedBy === 'system') {
                  recordSubmitterId = null
                }
                
                const initialStatus = config.initialStatus || 'pending'
                
                // Fetch trigger submission's ref_id for cross-reference if needed
                let triggerSubmissionRefId: string | null = null
                if (config.enableCrossRefLinking && config.crossReferenceFieldId && triggerSubmissionId) {
                  const { data: triggerSub } = await supabase
                    .from('form_submissions')
                    .select('submission_ref_id')
                    .eq('id', triggerSubmissionId)
                    .maybeSingle()
                  
                  triggerSubmissionRefId = triggerSub?.submission_ref_id || null
                }
                
                for (let i = 0; i < recordCount; i++) {
                  // Build submission data from config
                  const newSubmissionData: Record<string, any> = {}
                  
                  // Handle field_mapping mode (maps fields from trigger form to target form)
                  if (config.fieldConfigMode === 'field_mapping' && config.fieldMappings) {
                    for (const mapping of config.fieldMappings) {
                      if (mapping.sourceFieldId && mapping.targetFieldId) {
                        const value = triggerSubmissionData[mapping.sourceFieldId]
                        if (value !== undefined && value !== null && value !== '') {
                          newSubmissionData[mapping.targetFieldId] = value
                        }
                      }
                    }
                  }
                  
                  // Handle field_values mode OR apply fieldValues on top of mapping
                  // fieldValues can contain both static and dynamic values
                  if (config.fieldValues && Array.isArray(config.fieldValues)) {
                    for (const fieldValue of config.fieldValues) {
                      if (!fieldValue.fieldId) continue
                      
                      let value: any
                      if (fieldValue.valueType === 'static') {
                        value = fieldValue.staticValue
                      } else if (fieldValue.valueType === 'dynamic') {
                        // Try dynamicValuePath first (new format), then dynamicFieldId (legacy)
                        const dynamicPath = fieldValue.dynamicValuePath || fieldValue.dynamicFieldId
                        if (dynamicPath && dynamicPath in triggerSubmissionData) {
                          value = triggerSubmissionData[dynamicPath]
                        }
                      }
                      
                      if (value !== undefined && value !== null && value !== '') {
                        newSubmissionData[fieldValue.fieldId] = value
                      }
                    }
                  }
                  
                  // Handle cross-reference linking
                  if (config.enableCrossRefLinking && config.crossReferenceFieldId && triggerSubmissionRefId) {
                    newSubmissionData[config.crossReferenceFieldId] = [{
                      submission_ref_id: triggerSubmissionRefId,
                      form_id: triggerFormId
                    }]
                  }
                  
                  console.log(`📝 Creating record ${i + 1}/${recordCount} with ${Object.keys(newSubmissionData).length} fields`)
                  
                  const { data: newRecord, error: createError } = await supabase
                    .from('form_submissions')
                    .insert({
                      form_id: config.targetFormId,
                      submission_data: newSubmissionData,
                      submitted_by: recordSubmitterId,
                      approval_status: initialStatus
                    })
                    .select('id, submission_ref_id')
                    .single()
                  
                  if (createError) {
                    throw new Error(`Failed to create record ${i + 1}: ${createError.message}`)
                  }
                  
                  createdRecords.push(newRecord)
                  console.log(`✅ Created record ${i + 1}: ${newRecord.id}`)
                }
                
                console.log(`✅ Successfully created ${createdRecords.length} records`)
                nodeOutputData = {
                  createdRecordIds: createdRecords.map(r => r.id),
                  createdRecords: createdRecords,
                  recordCount: createdRecords.length,
                  targetFormId: config.targetFormId,
                  success: true
                }
              } else if (actionType === 'create_linked_record') {
                // Execute create linked record action
                console.log('🔗 Executing create_linked_record action in edge function')
                console.log('📋 Create linked record config:', JSON.stringify(config))
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                const submitterId = execution.submitter_id || execution.trigger_data?.submitterId
                
                // Support both naming conventions: crossRefFieldId (edge) and crossReferenceFieldId (client)
                const crossRefFieldId = config.crossRefFieldId || config.crossReferenceFieldId
                const targetFormId = config.targetFormId
                
                console.log('📋 Resolved crossRefFieldId:', crossRefFieldId)
                console.log('📋 Resolved targetFormId:', targetFormId)
                
                if (!crossRefFieldId || !targetFormId) {
                  throw new Error(`Missing required configuration for create linked record. crossRefFieldId: ${crossRefFieldId}, targetFormId: ${targetFormId}`)
                }
                
                // Get trigger submission's ref ID
                const { data: triggerSub } = await supabase
                  .from('form_submissions')
                  .select('submission_ref_id')
                  .eq('id', triggerSubmissionId)
                  .single()
                
                if (!triggerSub?.submission_ref_id) {
                  throw new Error('Could not find trigger submission ref ID')
                }
                
                const recordCount = config.recordCount || 1
                const createdRecords: Array<{id: string, submission_ref_id: string}> = []
                
                for (let i = 0; i < recordCount; i++) {
                  // Build submission data for child record
                  const childSubmissionData: Record<string, any> = {}
                  
                  // Set the child cross-reference field to point back to parent
                  if (config.childCrossRefFieldId) {
                    childSubmissionData[config.childCrossRefFieldId] = [{
                      submission_ref_id: triggerSub.submission_ref_id,
                      form_id: triggerFormId
                    }]
                  }
                  
                  // Apply field mappings if any
                  if (config.fieldMappings) {
                    for (const mapping of config.fieldMappings) {
                      if (mapping.sourceFieldId && mapping.targetFieldId) {
                        const value = triggerSubmissionData[mapping.sourceFieldId]
                        if (value !== undefined) {
                          childSubmissionData[mapping.targetFieldId] = value
                        }
                      }
                    }
                  }
                  
                  // Apply field values if any
                  if (config.fieldValues) {
                    for (const fieldValue of config.fieldValues) {
                      if (!fieldValue.fieldId) continue
                      
                      if (fieldValue.valueType === 'static') {
                        childSubmissionData[fieldValue.fieldId] = fieldValue.staticValue
                      } else if (fieldValue.valueType === 'dynamic' && fieldValue.dynamicFieldId) {
                        const value = triggerSubmissionData[fieldValue.dynamicFieldId]
                        if (value !== undefined) {
                          childSubmissionData[fieldValue.fieldId] = value
                        }
                      }
                    }
                  }
                  
                  const initialStatus = config.initialStatus || 'pending'
                  
                  const { data: newRecord, error: createError } = await supabase
                    .from('form_submissions')
                    .insert({
                      form_id: targetFormId,
                      submission_data: childSubmissionData,
                      submitted_by: submitterId,
                      approval_status: initialStatus
                    })
                    .select('id, submission_ref_id')
                    .single()
                  
                  if (createError) {
                    console.error('❌ Error creating linked record:', createError)
                    continue
                  }
                  
                  createdRecords.push({
                    id: newRecord.id,
                    submission_ref_id: newRecord.submission_ref_id || ''
                  })
                  console.log(`✅ Linked record ${i + 1}/${recordCount} created:`, newRecord.id)
                }
                
                // Update parent's cross-reference field with created records
                if (createdRecords.length > 0 && crossRefFieldId) {
                  const { data: currentParent } = await supabase
                    .from('form_submissions')
                    .select('submission_data')
                    .eq('id', triggerSubmissionId)
                    .single()
                  
                  if (currentParent) {
                    const currentData = currentParent.submission_data || {}
                    const existingRefs = (currentData as any)[crossRefFieldId] || []
                    
                    let mergedRefs: any[] = Array.isArray(existingRefs) ? [...existingRefs] : []
                    
                    for (const record of createdRecords) {
                      mergedRefs.push({
                        submission_ref_id: record.submission_ref_id,
                        form_id: targetFormId
                      })
                    }
                    
                    const updatedData = {
                      ...(typeof currentData === 'object' ? currentData : {}),
                      [crossRefFieldId]: mergedRefs
                    }
                    
                    await supabase
                      .from('form_submissions')
                      .update({ submission_data: updatedData })
                      .eq('id', triggerSubmissionId)
                    
                    console.log(`✅ Updated parent cross-ref field with ${createdRecords.length} new records`)
                  }
                }
                
                nodeOutputData = {
                  createdCount: createdRecords.length,
                  requestedCount: recordCount,
                  createdRecordIds: createdRecords.map(r => r.id),
                  targetFormId: targetFormId,
                  success: true
                }
              } else if (actionType === 'update_linked_records') {
                // Execute update linked records action
                console.log('🔄 Executing update_linked_records action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                
                // Support both crossRefFieldId and crossReferenceFieldId (UI uses the latter)
                const crossRefFieldId = config.crossRefFieldId || config.crossReferenceFieldId
                
                if (!crossRefFieldId || !config.fieldMappings || config.fieldMappings.length === 0) {
                  throw new Error('Missing required configuration for update linked records')
                }
                
                console.log(`📋 Cross-reference field ID: ${crossRefFieldId}`)
                
                // Get linked records from cross-reference field
                const crossRefValue = triggerSubmissionData[crossRefFieldId]
                if (!crossRefValue) {
                  console.log('⚠️ No linked records in cross-reference field')
                  nodeOutputData = { 
                    message: 'No linked records to update',
                    updatedCount: 0,
                    success: true
                  }
                } else {
                  // Extract submission ref IDs
                  let linkedRefIds: string[] = []
                  
                  if (Array.isArray(crossRefValue)) {
                    linkedRefIds = crossRefValue
                      .map(v => typeof v === 'string' ? v : v?.submission_ref_id)
                      .filter((v): v is string => !!v)
                  } else if (typeof crossRefValue === 'string') {
                    linkedRefIds = [crossRefValue]
                  } else if (crossRefValue?.submission_ref_id) {
                    linkedRefIds = [crossRefValue.submission_ref_id]
                  }
                  
                  console.log(`📋 Found ${linkedRefIds.length} linked records to potentially update`)
                  
                  // Apply update scope
                  let targetRefIds = linkedRefIds
                  if (config.updateScope === 'first' && linkedRefIds.length > 0) {
                    targetRefIds = [linkedRefIds[0]]
                  } else if (config.updateScope === 'last' && linkedRefIds.length > 0) {
                    targetRefIds = [linkedRefIds[linkedRefIds.length - 1]]
                  }
                  
                  console.log(`📋 Updating ${targetRefIds.length} records (scope: ${config.updateScope || 'all'})`)
                  
                  // Get linked submissions
                  const { data: linkedSubmissions, error: fetchError } = await supabase
                    .from('form_submissions')
                    .select('id, submission_data')
                    .in('submission_ref_id', targetRefIds)
                  
                  if (fetchError) {
                    throw new Error(`Failed to fetch linked submissions: ${fetchError.message}`)
                  }
                  
                  let updatedCount = 0
                  for (const linkedSub of linkedSubmissions || []) {
                    const currentData = linkedSub.submission_data || {}
                    const updatedData = { ...(typeof currentData === 'object' ? currentData : {}) }
                    
                    // Apply field mappings
                    for (const mapping of config.fieldMappings) {
                      if (mapping.sourceFieldId && mapping.targetFieldId) {
                        const sourceValue = triggerSubmissionData[mapping.sourceFieldId]
                        if (sourceValue !== undefined) {
                          updatedData[mapping.targetFieldId] = sourceValue
                        }
                      }
                    }
                    
                    const { error: updateError } = await supabase
                      .from('form_submissions')
                      .update({ submission_data: updatedData })
                      .eq('id', linkedSub.id)
                    
                    if (updateError) {
                      console.error(`❌ Error updating linked record ${linkedSub.id}:`, updateError)
                      continue
                    }
                    
                    updatedCount++
                    console.log(`✅ Updated linked record: ${linkedSub.id}`)
                  }
                  
                  nodeOutputData = {
                    updatedCount,
                    totalLinked: linkedRefIds.length,
                    updateScope: config.updateScope || 'all',
                    success: true
                  }
                }
              } else {
                // For other action types, mark as completed since we can't execute them from edge function
                console.log(`⚠️ Action type ${actionType} not supported in edge function, marking as completed`)
                nodeOutputData = { 
                  message: `Action type ${actionType} executed via edge function resume`,
                  success: true
                }
              }
              
              // After action completion, fetch and queue the next connected nodes
              const { data: actionNextConns, error: actionConnError } = await supabase
                .from('workflow_connections')
                .select('target_node_id')
                .eq('source_node_id', nodeData.id)
              
              if (!actionConnError && actionNextConns && actionNextConns.length > 0) {
                const nextIds = actionNextConns.map(c => c.target_node_id)
                const { data: nextActionNodes, error: nextError } = await supabase
                  .from('workflow_nodes')
                  .select('*')
                  .in('id', nextIds)
                
                if (!nextError && nextActionNodes && nextActionNodes.length > 0) {
                  console.log(`➕ Queuing ${nextActionNodes.length} nodes after action node`)
                  for (const nextNode of nextActionNodes as WorkflowNode[]) {
                    if (!processedNodeIds.has(nextNode.id)) {
                      nodeQueue.push(nextNode)
                      console.log(`   ➕ Added: ${nextNode.label} (${nextNode.node_type})`)
                    }
                  }
                }
              }
            } else if (nodeData.node_type === 'condition') {
              // Execute condition node - evaluate conditions and determine next branch
              console.log('🔀 Evaluating condition node')
              
              const conditionConfig = nodeData.config as any
              const legacyConditions = conditionConfig?.conditions || []
              const enhancedCondition = conditionConfig?.enhancedCondition
              let triggerData = execution.trigger_data || {}
              let submissionData = triggerData.submissionData || {}
              
              console.log(`📋 Condition config:`, JSON.stringify(conditionConfig, null, 2))
              console.log(`📋 Has enhancedCondition: ${!!enhancedCondition}`)
              console.log(`📋 Legacy conditions count: ${legacyConditions.length}`)
              
              // *** LOOP-BACK SUPPORT: Fetch LATEST submission data ***
              // This is critical for loop-back scenarios where we need to detect manual changes
              const submissionId = execution.trigger_submission_id || triggerData.submissionId
              if (submissionId) {
                console.log(`🔄 Fetching latest submission data for: ${submissionId}`)
                const { data: latestSubmission, error: fetchSubError } = await supabase
                  .from('form_submissions')
                  .select('submission_data, submitted_at, approval_status')
                  .eq('id', submissionId)
                  .single()
                
                if (!fetchSubError && latestSubmission) {
                  const latestData = latestSubmission.submission_data as Record<string, any>
                  console.log(`✅ Got latest submission data, comparing with original...`)
                  
                  // Check if data has changed
                  const originalDataStr = JSON.stringify(submissionData)
                  const latestDataStr = JSON.stringify(latestData)
                  
                  if (originalDataStr !== latestDataStr) {
                    console.log(`🔄 Submission data has CHANGED since workflow started!`)
                    console.log(`   Original keys: ${Object.keys(submissionData).length}`)
                    console.log(`   Latest keys: ${Object.keys(latestData).length}`)
                    
                    // Log which fields changed
                    for (const key of Object.keys(latestData)) {
                      if (JSON.stringify(submissionData[key]) !== JSON.stringify(latestData[key])) {
                        console.log(`   📝 Field changed: ${key}`)
                        console.log(`      Original: ${JSON.stringify(submissionData[key])}`)
                        console.log(`      Latest: ${JSON.stringify(latestData[key])}`)
                      }
                    }
                  } else {
                    console.log(`ℹ️ Submission data unchanged`)
                  }
                  
                  // Use the latest data for condition evaluation
                  submissionData = latestData
                  
                  // Update trigger_data with latest submission data for subsequent nodes
                  triggerData = {
                    ...triggerData,
                    submissionData: latestData,
                    approvalStatus: latestSubmission.approval_status,
                    dataRefreshedAt: new Date().toISOString()
                  }
                  
                  // Update execution with refreshed trigger data
                  await supabase
                    .from('workflow_executions')
                    .update({
                      trigger_data: triggerData,
                      execution_data: {
                        ...execution.execution_data,
                        lastDataRefresh: new Date().toISOString(),
                        dataRefreshCount: ((execution.execution_data as any)?.dataRefreshCount || 0) + 1
                      }
                    })
                    .eq('id', execution.id)
                    
                } else if (fetchSubError) {
                  console.log(`⚠️ Could not fetch latest submission: ${fetchSubError.message}`)
                }
              }
              
              // Helper function to get field value from nested data
              const getFieldValue = (fieldPath: string, data: any): any => {
                if (!fieldPath || !data) return undefined
                
                // First check direct property
                if (data.hasOwnProperty(fieldPath)) {
                  return data[fieldPath]
                }
                
                // Check in submissionData
                if (data.submissionData && data.submissionData.hasOwnProperty(fieldPath)) {
                  return data.submissionData[fieldPath]
                }
                
                // Try nested path
                const parts = fieldPath.split('.')
                let value = data
                for (const part of parts) {
                  if (value && typeof value === 'object' && part in value) {
                    value = value[part]
                  } else {
                    return undefined
                  }
                }
                return value
              }
              
              // Normalize values for comparison
              const normalizeValue = (v: any): string => {
                if (v === null || v === undefined) return ''
                if (typeof v === 'boolean') return v.toString()
                return String(v).toLowerCase().trim()
              }
              
              // Helper to check if value is null/undefined/empty/N/A (values that should cause waiting)
              // const isWaitingValue = (v: any): boolean => {
              //   if (v === null || v === undefined) return true
              //   if (typeof v === 'string') {
              //     const normalized = v.trim().toLowerCase()
              //     return normalized === '' || normalized === 'n/a' || normalized === 'na' || normalized === 'null' || normalized === 'undefined'
              //   }
              //   return false
              // }
              const isWaitingValue = (v: any): boolean => {
  if (v === null || v === undefined) return true

  // unwrap { value: "" }
  if (typeof v === 'object' && v !== null && 'value' in v) {
    return isWaitingValue((v as any).value)
  }

  // arrays (multi-select, checkbox etc)
  if (Array.isArray(v)) {
    return v.length === 0
  }

  // objects (no meaningful value)
  if (typeof v === 'object') {
    return Object.keys(v).length === 0
  }

  if (typeof v === 'string') {
    const normalized = v
      .replace(/\u00A0/g, ' ')   // NBSP
      .trim()
      .toLowerCase()

    return (
      normalized === '' ||
      normalized === 'n/a' ||
      normalized === 'na' ||
      normalized === 'null' ||
      normalized === 'undefined'
    )
  }

  return false
}

              // Special symbol to indicate condition should wait (not proceed at all)
              const WAITING_FOR_VALUE = Symbol('WAITING_FOR_VALUE')
              
              // Evaluate a single legacy condition - returns boolean or WAITING_FOR_VALUE symbol
              const evaluateLegacyCondition = (condition: any): boolean | symbol => {
                const { field, operator, value } = condition
                
                // Try to get field value from submission data first, then trigger data
                let fieldValue = submissionData[field]
                if (fieldValue === undefined) {
                  fieldValue = getFieldValue(field, triggerData)
                }
                
                console.log(`📊 Evaluating legacy: ${field} ${operator} ${value} (actual: ${fieldValue})`)
                
                // IMPORTANT: If field value is null/undefined/N/A, return WAITING for most operators
                // This keeps the workflow in waiting state until an actual value is provided
                // Exception: exists/not_exists operators which specifically check for these states
                if (isWaitingValue(fieldValue)) {
                  if (operator === 'exists') {
                    console.log(`   Field is empty/null/N/A - exists check returns false`)
                    return false
                  }
                  if (operator === 'not_exists') {
                    console.log(`   Field is empty/null/N/A - not_exists check returns true`)
                    return true
                  }
                  // For all other operators, missing value means we should WAIT (not proceed at all)
                  console.log(`   ⏳ Field value is null/undefined/N/A - workflow should WAIT for actual value`)
                  return WAITING_FOR_VALUE
                }
                
                const normalizedFieldValue = normalizeValue(fieldValue)
                const normalizedValue = normalizeValue(value)
                
                switch (operator) {
                  case 'equals':
                  case '==':
                    return normalizedFieldValue === normalizedValue
                  case 'not_equals':
                  case '!=':
                    return normalizedFieldValue !== normalizedValue
                  case 'contains':
                    return normalizedFieldValue.includes(normalizedValue)
                  case 'not_contains':
                    return !normalizedFieldValue.includes(normalizedValue)
                  case 'greater_than':
                  case '>':
                    return parseFloat(normalizedFieldValue) > parseFloat(normalizedValue)
                  case 'less_than':
                  case '<':
                    return parseFloat(normalizedFieldValue) < parseFloat(normalizedValue)
                  case 'greater_than_or_equal':
                  case '>=':
                    return parseFloat(normalizedFieldValue) >= parseFloat(normalizedValue)
                  case 'less_than_or_equal':
                  case '<=':
                    return parseFloat(normalizedFieldValue) <= parseFloat(normalizedValue)
                  case 'exists':
                    return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''
                  case 'not_exists':
                    return fieldValue === undefined || fieldValue === null || fieldValue === ''
                  case 'starts_with':
                    return normalizedFieldValue.startsWith(normalizedValue)
                  case 'ends_with':
                    return normalizedFieldValue.endsWith(normalizedValue)
                  default:
                    console.log(`⚠️ Unknown operator: ${operator}`)
                    return false
                }
              }
              
              // Evaluate enhanced field-level condition - returns boolean or WAITING_FOR_VALUE symbol
              const evaluateFieldLevelCondition = (flc: any): boolean | symbol => {
                const fieldId = flc?.fieldId
                const operator = flc?.operator
                const expectedValue = flc?.value
                
                if (!fieldId) {
                  console.log(`⚠️ No fieldId in field-level condition`)
                  return false
                }
                
                // Get field value from submission data using field ID
                let actualValue = submissionData[fieldId]
                
                console.log(`📊 Evaluating field-level: fieldId=${fieldId}, operator=${operator}, expected=${expectedValue}, actual=${actualValue}`)
                
                // IMPORTANT: If field value is null/undefined/N/A, return WAITING for most operators
                // This keeps the workflow in waiting state until an actual value is provided
                // Exception: exists/not_exists operators which specifically check for these states
                if (isWaitingValue(actualValue)) {
                  if (operator === 'exists') {
                    console.log(`   Field is empty/null/N/A - exists check returns false`)
                    return false
                  }
                  if (operator === 'not_exists') {
                    console.log(`   Field is empty/null/N/A - not_exists check returns true`)
                    return true
                  }
                  // For all other operators, missing value means we should WAIT (not proceed at all)
                  console.log(`   ⏳ Field value is null/undefined/N/A - workflow should WAIT for actual value`)
                  return WAITING_FOR_VALUE
                }
                
                const normalizedActual = normalizeValue(actualValue)
                const normalizedExpected = normalizeValue(expectedValue)
                
                switch (operator) {
                  case 'equals':
                  case '==':
                    return normalizedActual === normalizedExpected
                  case 'not_equals':
                  case '!=':
                    return normalizedActual !== normalizedExpected
                  case 'contains':
                    return normalizedActual.includes(normalizedExpected)
                  case 'not_contains':
                    return !normalizedActual.includes(normalizedExpected)
                  case 'greater_than':
                  case '>':
                    return parseFloat(normalizedActual) > parseFloat(normalizedExpected)
                  case 'less_than':
                  case '<':
                    return parseFloat(normalizedActual) < parseFloat(normalizedExpected)
                  case 'greater_than_or_equal':
                  case '>=':
                    return parseFloat(normalizedActual) >= parseFloat(normalizedExpected)
                  case 'less_than_or_equal':
                  case '<=':
                    return parseFloat(normalizedActual) <= parseFloat(normalizedExpected)
                  case 'exists':
                    return actualValue !== undefined && actualValue !== null && actualValue !== ''
                  case 'not_exists':
                    return actualValue === undefined || actualValue === null || actualValue === ''
                  case 'starts_with':
                    return normalizedActual.startsWith(normalizedExpected)
                  case 'ends_with':
                    return normalizedActual.endsWith(normalizedExpected)
                  default:
                    console.log(`⚠️ Unknown operator in field-level condition: ${operator}`)
                    return false
                }
              }
              
              // Evaluate enhanced condition (new format) - returns boolean or WAITING_FOR_VALUE symbol
              // const evaluateEnhancedCondition = (ec: any): boolean | symbol => {
              //   if (!ec) return true
                
              //   const conditions = ec.conditions || []
              //   const useManualExpression = ec.useManualExpression
              //   const manualExpression = ec.manualExpression
                
              //   console.log(`📊 Enhanced condition: ${conditions.length} conditions, useManual=${useManualExpression}`)
                
              //   if (conditions.length === 0) {
              //     // If single condition via fieldLevelCondition
              //     if (ec.fieldLevelCondition) {
              //       return evaluateFieldLevelCondition(ec.fieldLevelCondition)
              //     }
              //     console.log(`⚠️ No conditions in enhanced condition`)
              //     return true
              //   }
                
              //   // Evaluate each condition
              //   const results: (boolean | symbol)[] = []
              //   let hasWaiting = false
                
              //   for (const cond of conditions) {
              //     let result: boolean | symbol = false
                  
              //     if (cond.fieldLevelCondition) {
              //       result = evaluateFieldLevelCondition(cond.fieldLevelCondition)
              //     } else if (cond.fieldCondition) {
              //       // Legacy field condition format
              //       result = evaluateLegacyCondition({
              //         field: cond.fieldCondition.fieldId,
              //         operator: cond.fieldCondition.operator,
              //         value: cond.fieldCondition.value
              //       })
              //     }
                  
              //     // Check if any condition is waiting for value
              //     if (result === WAITING_FOR_VALUE) {
              //       hasWaiting = true
              //       console.log(`   Condition ${cond.id}: WAITING_FOR_VALUE`)
              //     } else {
              //       console.log(`   Condition ${cond.id}: ${result}`)
              //     }
              //     results.push(result)
              //   }
                
              //   // If ANY condition is waiting for value, the entire condition set should wait
              //   if (hasWaiting) {
              //     console.log(`   ⏳ One or more conditions waiting for values - returning WAITING_FOR_VALUE`)
              //     return WAITING_FOR_VALUE
              //   }
                
              //   // Convert results to boolean array (all should be boolean at this point)
              //   const boolResults = results as boolean[]
                
              //   // Handle manual expression like "1 AND 2" or "1 OR 2"
              //   if (useManualExpression && manualExpression) {
              //     console.log(`📊 Evaluating manual expression: ${manualExpression}`)
              //     try {
              //       // Replace condition numbers with their results
              //       let expr = manualExpression.toString()
              //       for (let i = boolResults.length; i >= 1; i--) {
              //         expr = expr.replace(new RegExp(`\\b${i}\\b`, 'g'), boolResults[i - 1] ? 'true' : 'false')
              //       }
              //       expr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!')
              //       console.log(`   Parsed expression: ${expr}`)
              //       const evalResult = Function('"use strict"; return (' + expr + ')')()
              //       console.log(`   Expression result: ${evalResult}`)
              //       return Boolean(evalResult)
              //     } catch (e) {
              //       console.log(`⚠️ Error evaluating expression: ${e}`)
              //       // Fall through to default AND logic
              //     }
              //   }
                
              //   // Default: use logicalOperatorWithNext from conditions
              //   // Check if any condition has OR logic
              //   const hasOrLogic = conditions.some((c: any) => c.logicalOperatorWithNext === 'OR')
              //   if (hasOrLogic) {
              //     return boolResults.some(r => r)
              //   }
              //   return boolResults.every(r => r)
              // }
              const evaluateEnhancedCondition = (ec: any): boolean | symbol => {
  if (!ec) return true

  const conditions = ec.conditions || []
  const useManualExpression = ec.useManualExpression
  const manualExpression = ec.manualExpression

  console.log(`📊 Enhanced condition: ${conditions.length} conditions`)

  // Single field-level condition
  if (conditions.length === 0 && ec.fieldLevelCondition) {
    return evaluateFieldLevelCondition(ec.fieldLevelCondition)
  }

  const results: (boolean | symbol)[] = []

  // Step 1 — evaluate each condition
  for (const cond of conditions) {
    let result: boolean | symbol = false

    if (cond.fieldLevelCondition) {
      result = evaluateFieldLevelCondition(cond.fieldLevelCondition)
    } else if (cond.fieldCondition) {
      result = evaluateLegacyCondition({
        field: cond.fieldCondition.fieldId,
        operator: cond.fieldCondition.operator,
        value: cond.fieldCondition.value
      })
    }

    console.log(`   Condition ${cond.id}:`, result)
    results.push(result)
  }

  // Step 2 — HARD BLOCK if anything is WAITING
  if (results.some(r => r === WAITING_FOR_VALUE)) {
    console.log(`⏳ Enhanced condition BLOCKED — waiting for values`)
    return WAITING_FOR_VALUE
  }

  // Now it is safe to treat everything as boolean
  const boolResults = results as boolean[]

  // Step 3 — Manual expression
  if (useManualExpression && manualExpression) {
    try {
      let expr = manualExpression.toString()
      for (let i = boolResults.length; i >= 1; i--) {
        expr = expr.replace(new RegExp(`\\b${i}\\b`, 'g'), boolResults[i - 1] ? 'true' : 'false')
      }
      expr = expr.replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||').replace(/\bNOT\b/gi, '!')
      console.log(`   Parsed expression: ${expr}`)
      return Boolean(Function(`"use strict"; return (${expr})`)())
    } catch (e) {
      console.log(`⚠️ Manual expression error`, e)
      // Fall through to default logic
    }
  }

  // Step 4 — Default AND/OR logic
  const hasOrLogic = conditions.some((c: any) => c.logicalOperatorWithNext === 'OR')

  if (hasOrLogic) {
    return boolResults.some(r => r)
  }

  return boolResults.every(r => r)
}

              // Evaluate all conditions - result can be boolean or WAITING_FOR_VALUE
              let conditionResult: boolean | symbol = true
              const logicalOperator = conditionConfig?.logicalOperator || 'AND'
              
              // Check for enhanced condition format first
              if (enhancedCondition) {
                console.log(`📊 Using enhanced condition evaluation`)
                conditionResult = evaluateEnhancedCondition(enhancedCondition)
              } else if (legacyConditions.length > 0) {
                console.log(`📊 Using legacy condition evaluation`)
                const legacyResults = legacyConditions.map((c: any) => evaluateLegacyCondition(c))
                
                // Check if any legacy condition is waiting
                const hasWaiting = legacyResults.some(r => r === WAITING_FOR_VALUE)
                if (hasWaiting) {
                  console.log(`   ⏳ One or more legacy conditions waiting for values`)
                  conditionResult = WAITING_FOR_VALUE
                } else {
                  const boolResults = legacyResults as boolean[]
                  if (logicalOperator === 'OR') {
                    conditionResult = boolResults.some(r => r)
                  } else {
                    conditionResult = boolResults.every(r => r)
                  }
                }
              } else {
                console.log(`⚠️ No conditions configured - defaulting to TRUE`)
              }
              
              // If condition is WAITING_FOR_VALUE, keep workflow in waiting state
              if (conditionResult === WAITING_FOR_VALUE) {
                console.log(`⏳ Condition is waiting for actual values - keeping workflow paused at condition node`)
                
                // Update execution to stay on this condition node and remain in waiting status
                await supabase
                  .from('workflow_executions')
                  .update({
                    status: 'waiting',
                    wait_node_id: nodeData.id,
                    current_node_id: nodeData.id,
                    wait_config: {
                      type: 'condition_waiting_for_value',
                      nodeId: nodeData.id,
                      nodeLabel: nodeData.label,
                      waitingForCondition: true
                    }
                  })
                  .eq('id', execution.id)
                
                // Log this waiting state
                await supabase
                  .from('workflow_instance_logs')
                  .insert({
                    execution_id: execution.id,
                    node_id: nodeData.id,
                    node_type: 'condition',
                    node_label: nodeData.label || 'Condition',
                    status: 'waiting',
                    action_type: 'condition_evaluation',
                    action_details: { message: 'Waiting for field values (null/undefined/N/A detected)' },
                    started_at: new Date().toISOString(),
                    execution_order: await supabase.rpc('get_next_execution_order', { exec_id: execution.id }).then(r => r.data || 0)
                  })
                
                console.log(`✅ Workflow kept in waiting state on condition node`)
                continue // Skip to next execution, don't proceed with branching
              }
              
              console.log(`📊 Condition result: ${conditionResult} (operator: ${logicalOperator})`)
              
              // Determine which branch to take based on result
              const branchType = conditionResult ? 'true' : 'false'
              
              // Get the next nodes for this branch
              const { data: branchConnections, error: branchError } = await supabase
                .from('workflow_connections')
                .select('target_node_id, source_handle')
                .eq('source_node_id', nodeData.id)
              
              if (branchError) {
                console.error('❌ Error fetching branch connections:', branchError)
                throw branchError
              }
              
              console.log(`📊 Branch connections found:`, branchConnections)
              
              // Filter connections based on the branch result
              const matchingConnections = (branchConnections || []).filter((conn: any) => {
                const handle = conn.source_handle || ''
                // Match 'true'/'false' handles or condition types
                if (conditionResult) {
                  return handle === 'true' || handle === 'yes' || handle.includes('true') || handle === ''
                } else {
                  return handle === 'false' || handle === 'no' || handle.includes('false')
                }
              })
              
              console.log(`📊 Matching connections for branch '${branchType}':`, matchingConnections)
              
              // Execute the next nodes in the branch
              if (matchingConnections.length > 0) {
                const branchNodeIds = matchingConnections.map((c: any) => c.target_node_id)
                
                // Fetch branch nodes
                const { data: branchNodes, error: branchNodesError } = await supabase
                  .from('workflow_nodes')
                  .select('*')
                  .in('id', branchNodeIds)
                
                if (!branchNodesError && branchNodes && branchNodes.length > 0) {
                  console.log(`🔀 Adding ${branchNodes.length} nodes from ${branchType} branch to queue`)
                  
                  // Add branch nodes to the queue for execution
                  for (const branchNode of branchNodes as WorkflowNode[]) {
                    if (!processedNodeIds.has(branchNode.id)) {
                      nodeQueue.push(branchNode)
                      console.log(`   ➕ Added node to queue: ${branchNode.label} (${branchNode.node_type})`)
                    }
                  }
                  
                  // Update execution to track condition result
                  await supabase
                    .from('workflow_executions')
                    .update({
                      execution_data: {
                        ...execution.execution_data,
                        conditionResult,
                        branchTaken: branchType,
                        lastConditionNode: nodeData.id
                      }
                    })
                    .eq('id', execution.id)
                }
                
                nodeOutputData = {
                  conditionResult,
                  branchTaken: branchType,
                  nextNodeIds: branchNodeIds,
                  conditions: conditions.length,
                  logicalOperator,
                  success: true
                }
              } else {
                console.log(`⚠️ No matching connections for branch '${branchType}'`)
                nodeOutputData = {
                  conditionResult,
                  branchTaken: branchType,
                  nextNodeIds: [],
                  message: `No connections for ${branchType} branch`,
                  success: true
                }
              }
            } else if (nodeData.node_type === 'end') {
              console.log('🏁 End node reached, marking workflow as completed')
              hasEndNode = true
              nodeOutputData = { message: 'Workflow completed' }
            } else if (nodeData.node_type === 'wait') {
              // Wait node - pause execution (supports loop-back)
              console.log('⏳ Wait node encountered, setting up wait')
              const waitConfig = nodeData.config as any
              
              // Track loop iteration for this wait node
              const loopIteration = nodeExecutionCounts.get(nodeData.id) || 1
              console.log(`🔄 Wait node loop iteration: ${loopIteration}`)
              
              // Calculate new resume time
              let newResumeAt: Date | null = null
              const waitType = waitConfig.waitType || 'duration'
              
              if (waitType === 'duration') {
                const duration = parseInt(waitConfig.durationValue) || 1
                const unit = waitConfig.durationUnit || 'minutes'
                const now = new Date()
                
                switch (unit) {
                  case 'minutes':
                    newResumeAt = new Date(now.getTime() + duration * 60 * 1000)
                    break
                  case 'hours':
                    newResumeAt = new Date(now.getTime() + duration * 60 * 60 * 1000)
                    break
                  case 'days':
                    newResumeAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)
                    break
                  default:
                    newResumeAt = new Date(now.getTime() + duration * 60 * 1000)
                }
              } else if (waitType === 'until_date' && waitConfig.untilDate) {
                newResumeAt = new Date(waitConfig.untilDate)
              } else if (waitType === 'until_submission_update') {
                // Wait until the submission is updated - check immediately next resume
                // Set a short duration to poll for changes
                const pollInterval = parseInt(waitConfig.pollIntervalMinutes) || 5
                newResumeAt = new Date(Date.now() + pollInterval * 60 * 1000)
                console.log(`⏳ Wait for submission update, polling in ${pollInterval} minutes`)
              }
              
              if (newResumeAt && newResumeAt > new Date()) {
                // Set up new wait with loop state tracking
                const currentExecutionData = execution.execution_data || {}
                const loopState = {
                  ...(currentExecutionData.loopState || {}),
                  [nodeData.id]: {
                    iteration: loopIteration,
                    lastExecutedAt: new Date().toISOString()
                  }
                }
                
                await supabase
                  .from('workflow_executions')
                  .update({
                    status: 'waiting',
                    current_node_id: nodeData.id,
                    scheduled_resume_at: newResumeAt.toISOString(),
                    wait_node_id: nodeData.id,
                    wait_config: waitConfig,
                    execution_data: {
                      ...currentExecutionData,
                      resumedAt: new Date().toISOString(),
                      loopState,
                      isInLoop: loopIteration > 1
                    }
                  })
                  .eq('id', execution.id)
                
                // Update log to waiting
                if (logEntryId) {
                  await supabase
                    .from('workflow_instance_logs')
                    .update({
                      status: 'waiting',
                      output_data: {
                        scheduledResumeAt: newResumeAt.toISOString(),
                        waitType,
                        loopIteration,
                        message: loopIteration > 1 
                          ? `Workflow looped back to wait (iteration ${loopIteration})`
                          : 'Workflow paused for wait period'
                      }
                    })
                    .eq('id', logEntryId)
                }
                
                console.log(`⏳ Wait scheduled for: ${newResumeAt.toISOString()} (loop iteration: ${loopIteration})`)
                allNodesProcessed = false
                nodeOutputData = {
                  waiting: true,
                  scheduledResumeAt: newResumeAt.toISOString(),
                  loopIteration,
                  success: true
                }
                // Skip the finally block update since we set to waiting
                continue
              } else {
                nodeOutputData = {
                  skipped: true,
                  reason: 'Wait time already passed',
                  success: true
                }
              }
            } else {
              // For other node types (notification, etc.), mark as completed
              console.log(`ℹ️ Node type ${nodeData.node_type} processed`)
              nodeOutputData = { 
                message: `Node ${nodeData.node_type} processed via edge function resume`,
                success: true
              }
            }
          } catch (nodeExecError) {
            console.error(`❌ Error executing node ${nodeData.id}:`, nodeExecError)
            nodeStatus = 'failed'
            nodeError = nodeExecError instanceof Error ? nodeExecError.message : 'Unknown error'
            nodeOutputData = { success: false, error: nodeError }
          } finally {
            // ALWAYS update the log entry to completed or failed
            if (logEntryId) {
              const duration = Date.now() - nodeStartTime
              try {
                await supabase
                  .from('workflow_instance_logs')
                  .update({
                    status: nodeStatus,
                    completed_at: new Date().toISOString(),
                    duration_ms: duration,
                    output_data: nodeOutputData,
                    action_result: nodeData.node_type === 'action' ? nodeOutputData : null,
                    error_message: nodeError
                  })
                  .eq('id', logEntryId)
                console.log(`✅ Updated log entry ${logEntryId} to status: ${nodeStatus}`)
              } catch (logUpdateError) {
                console.error(`❌ Error updating log entry in finally block:`, logUpdateError)
              }
            }
          }
        }

        // Workflow completion is now handled by checking if queue is empty and we hit an end node
        // or if all processed nodes have no further connections
        const shouldComplete = hasEndNode || (nodeQueue.length === 0 && allNodesProcessed)
        
        if (shouldComplete) {
          console.log('🏁 All nodes processed, marking workflow as completed')
          await supabase
            .from('workflow_executions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', execution.id)
        }

        console.log(`✅ Workflow execution ${execution.id} resumed and actions executed successfully`)
        
        resumedCount++
        resumedExecutions.push(execution.id)

      } catch (execError) {
        const errorMsg = execError instanceof Error ? execError.message : 'Unknown error'
        console.error(`❌ Error resuming execution ${execution.id}:`, execError)
        errors.push(`Execution ${execution.id}: ${errorMsg}`)

        // Mark as failed
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: `Failed to resume: ${errorMsg}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', execution.id)
      }
    }

    const response = {
      message: `Resumed ${resumedCount} of ${waitingExecutions.length} waiting workflow(s)`,
      resumedCount,
      totalWaiting: waitingExecutions.length,
      resumedExecutions,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('📊 Resume summary:', response)

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in resume-waiting-workflows:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        resumedCount: 0 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})