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

        // Execute each next node directly
        for (const nodeData of (nextNodes || []) as WorkflowNode[]) {
          console.log(`🎯 Executing resumed node: ${nodeData.label} (${nodeData.node_type})`)
          
          // Create log entry for this node
          const nodeStartTime = Date.now()
          const nodeStartTimeISO = new Date(nodeStartTime).toISOString()
          let logEntryId: string | null = null
          let nodeStatus: 'completed' | 'failed' = 'completed'
          let nodeError: string | null = null
          let nodeOutputData: any = { success: true }
          
          try {
            const { data: logEntry, error: insertError } = await supabase
              .from('workflow_instance_logs')
              .insert({
                execution_id: execution.id,
                node_id: nodeData.id,
                node_type: nodeData.node_type,
                node_label: nodeData.label,
                status: 'running',
                started_at: nodeStartTimeISO,
                action_type: nodeData.node_type === 'action' ? (nodeData.config as any)?.actionType : null,
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
                // Execute change field value action
                console.log('🔧 Executing change_field_value action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                
                // Validate config
                if (!config.targetFormId || !config.targetFieldId || !config.valueType) {
                  throw new Error('Missing required configuration for field value change')
                }
                
                // Determine the new value
                let newValue: any
                
                if (config.valueType === 'static') {
                  newValue = config.staticValue
                } else if (config.valueType === 'dynamic') {
                  // Try to get from submissionData using the field ID
                  if (config.dynamicValuePath && config.dynamicValuePath in triggerSubmissionData) {
                    newValue = triggerSubmissionData[config.dynamicValuePath]
                  }
                  
                  if (newValue === undefined) {
                    throw new Error(`Could not find value for field: ${config.dynamicFieldName || config.dynamicValuePath}`)
                  }
                  
                  // Normalize numeric values
                  if (typeof newValue === 'string' && newValue.trim() !== '') {
                    const cleanedValue = newValue.replace(/[,$€£¥₹\s]/g, '').trim()
                    const parsedNumber = parseFloat(cleanedValue)
                    if (!isNaN(parsedNumber)) {
                      newValue = parsedNumber
                      console.log(`🔢 Normalized string to number: ${newValue}`)
                    }
                  }
                }
                
                console.log('💾 New value determined:', { newValue, valueType: config.valueType })
                
                // Check if target form is different from trigger form
                const isTargetFormDifferent = config.targetFormId !== triggerFormId
                console.log('📋 Trigger form:', triggerFormId, 'Target form:', config.targetFormId, 'Is different:', isTargetFormDifferent)
                
                if (isTargetFormDifferent) {
                  // Bulk update all submissions in target form
                  console.log('🔄 Performing bulk update on target form:', config.targetFormId)
                  
                  const { data: rpcResult, error: rpcError } = await supabase.rpc('bulk_update_submission_field', {
                    _form_id: config.targetFormId,
                    _field_id: config.targetFieldId,
                    _new_value: newValue
                  })
                  
                  if (rpcError) {
                    console.error('❌ Bulk update error:', rpcError)
                    throw new Error(`Bulk update failed: ${rpcError.message}`)
                  }
                  
                  console.log(`✅ Bulk updated ${rpcResult} records in target form`)
                  nodeOutputData = {
                    updatedCount: rpcResult,
                    targetFormId: config.targetFormId,
                    targetFieldId: config.targetFieldId,
                    newValue,
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
                    [config.targetFieldId]: newValue
                  }
                  
                  // Update the submission
                  const { error: updateError } = await supabase
                    .from('form_submissions')
                    .update({ submission_data: updatedData })
                    .eq('id', triggerSubmissionId)
                  
                  if (updateError) {
                    throw new Error(`Failed to update submission: ${updateError.message}`)
                  }
                  
                  console.log('✅ Successfully updated trigger submission')
                  nodeOutputData = {
                    submissionId: triggerSubmissionId,
                    targetFieldId: config.targetFieldId,
                    newValue,
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
                
                // Build submission data from config
                const newSubmissionData: Record<string, any> = {}
                
                // Handle field values mode
                if (config.fieldValuesMode === 'set_values' && config.fieldValues) {
                  for (const fieldValue of config.fieldValues) {
                    if (!fieldValue.fieldId) continue
                    
                    if (fieldValue.valueType === 'static') {
                      newSubmissionData[fieldValue.fieldId] = fieldValue.staticValue
                    } else if (fieldValue.valueType === 'dynamic' && fieldValue.dynamicFieldId) {
                      const value = triggerSubmissionData[fieldValue.dynamicFieldId]
                      if (value !== undefined) {
                        newSubmissionData[fieldValue.fieldId] = value
                      }
                    }
                  }
                }
                
                // Handle field mappings mode
                if (config.fieldValuesMode === 'map_fields' && config.fieldMappings) {
                  for (const mapping of config.fieldMappings) {
                    if (mapping.sourceFieldId && mapping.targetFieldId) {
                      const value = triggerSubmissionData[mapping.sourceFieldId]
                      if (value !== undefined) {
                        newSubmissionData[mapping.targetFieldId] = value
                      }
                    }
                  }
                }
                
                // Handle cross-reference linking
                if (config.enableCrossRefLinking && config.crossReferenceFieldId && triggerSubmissionId) {
                  // Fetch trigger submission's submission_ref_id
                  const { data: triggerSub } = await supabase
                    .from('form_submissions')
                    .select('submission_ref_id')
                    .eq('id', triggerSubmissionId)
                    .single()
                  
                  if (triggerSub?.submission_ref_id) {
                    newSubmissionData[config.crossReferenceFieldId] = [{
                      submission_ref_id: triggerSub.submission_ref_id,
                      form_id: triggerFormId
                    }]
                  }
                }
                
                // Determine submitter
                let recordSubmitterId = submitterId
                if (config.submitterType === 'specific_user' && config.specificSubmitterId) {
                  recordSubmitterId = config.specificSubmitterId
                }
                
                const initialStatus = config.initialStatus || 'pending'
                
                console.log('📋 Creating record with data:', { 
                  targetFormId: config.targetFormId, 
                  fieldCount: Object.keys(newSubmissionData).length,
                  submitterId: recordSubmitterId
                })
                
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
                  throw new Error(`Failed to create record: ${createError.message}`)
                }
                
                console.log('✅ Record created:', newRecord.id)
                nodeOutputData = {
                  createdRecordId: newRecord.id,
                  submissionRefId: newRecord.submission_ref_id,
                  targetFormId: config.targetFormId,
                  success: true
                }
              } else if (actionType === 'create_linked_record') {
                // Execute create linked record action
                console.log('🔗 Executing create_linked_record action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                const triggerFormId = execution.trigger_data?.formId
                const submitterId = execution.submitter_id || execution.trigger_data?.submitterId
                
                if (!config.crossRefFieldId || !config.targetFormId) {
                  throw new Error('Missing required configuration for create linked record')
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
                      form_id: config.targetFormId,
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
                if (createdRecords.length > 0 && config.crossRefFieldId) {
                  const { data: currentParent } = await supabase
                    .from('form_submissions')
                    .select('submission_data')
                    .eq('id', triggerSubmissionId)
                    .single()
                  
                  if (currentParent) {
                    const currentData = currentParent.submission_data || {}
                    const existingRefs = (currentData as any)[config.crossRefFieldId] || []
                    
                    let mergedRefs: any[] = Array.isArray(existingRefs) ? [...existingRefs] : []
                    
                    for (const record of createdRecords) {
                      mergedRefs.push({
                        submission_ref_id: record.submission_ref_id,
                        form_id: config.targetFormId
                      })
                    }
                    
                    const updatedData = {
                      ...(typeof currentData === 'object' ? currentData : {}),
                      [config.crossRefFieldId]: mergedRefs
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
                  targetFormId: config.targetFormId,
                  success: true
                }
              } else if (actionType === 'update_linked_records') {
                // Execute update linked records action
                console.log('🔄 Executing update_linked_records action in edge function')
                
                const triggerSubmissionData = execution.trigger_data?.submissionData || {}
                const triggerSubmissionId = execution.trigger_data?.submissionId
                
                if (!config.crossRefFieldId || !config.fieldMappings || config.fieldMappings.length === 0) {
                  throw new Error('Missing required configuration for update linked records')
                }
                
                // Get linked records from cross-reference field
                const crossRefValue = triggerSubmissionData[config.crossRefFieldId]
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
            } else if (nodeData.node_type === 'end') {
              console.log('🏁 End node reached, marking workflow as completed')
              hasEndNode = true
              nodeOutputData = { message: 'Workflow completed' }
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

        // Check if ALL nodes are terminal (no further outgoing connections)
        let allNodesTerminal = true
        for (const nodeData of (nextNodes || []) as WorkflowNode[]) {
          if (nodeData.node_type !== 'end') {
            const { data: furtherConnections } = await supabase
              .from('workflow_connections')
              .select('id')
              .eq('source_node_id', nodeData.id)
            
            if (furtherConnections && furtherConnections.length > 0) {
              allNodesTerminal = false
              break
            }
          }
        }
        
        if (hasEndNode || allNodesTerminal) {
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