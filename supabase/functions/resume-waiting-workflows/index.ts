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
          const nodeStartTime = new Date().toISOString()
          const { data: logEntry, error: insertError } = await supabase
            .from('workflow_instance_logs')
            .insert({
              execution_id: execution.id,
              node_id: nodeData.id,
              node_type: nodeData.node_type,
              node_label: nodeData.label,
              status: 'running',
              started_at: nodeStartTime,
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
          }
          
          if (nodeData.node_type === 'action') {
            try {
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
                
                // Update log to completed
                if (logEntry) {
                  await supabase
                    .from('workflow_instance_logs')
                    .update({
                      status: 'completed',
                      completed_at: new Date().toISOString(),
                      duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                      output_data: { 
                        notificationsSent,
                        recipientUserIds: uniqueRecipientUserIds,
                        title,
                        message,
                        success: true
                      }
                    })
                    .eq('id', logEntry.id)
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
                  if (logEntry) {
                    await supabase
                      .from('workflow_instance_logs')
                      .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                        output_data: { 
                          message: 'No linked records found in first source cross-reference field',
                          createdCount: 0,
                          success: true
                        }
                      })
                      .eq('id', logEntry.id)
                  }
                } else if (combinationMode === 'dual' && secondSourceRecords.length === 0) {
                  console.log('⚠️ No records in second source cross-reference field')
                  if (logEntry) {
                    await supabase
                      .from('workflow_instance_logs')
                      .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                        output_data: { 
                          message: 'No linked records found in second source cross-reference field',
                          createdCount: 0,
                          success: true
                        }
                      })
                      .eq('id', logEntry.id)
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

                  if (logEntry) {
                    await supabase
                      .from('workflow_instance_logs')
                      .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                        output_data: { 
                          createdCount: createdRecords.length,
                          requestedCount: combinations.length,
                          combinationMode,
                          targetFormId: config.targetFormId,
                          createdRecordIds: createdRecords.map(r => r.id),
                          success: true
                        }
                      })
                      .eq('id', logEntry.id)
                  }
                }
              } else {
                // For other action types, mark as completed since we can't execute them from edge function
                console.log(`⚠️ Action type ${actionType} not supported in edge function, marking as completed`)
                if (logEntry) {
                  await supabase
                    .from('workflow_instance_logs')
                    .update({
                      status: 'completed',
                      completed_at: new Date().toISOString(),
                      duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                      output_data: { 
                        message: `Action type ${actionType} executed via edge function resume`,
                        success: true
                      }
                    })
                    .eq('id', logEntry.id)
                }
              }
            } catch (actionError) {
              console.error(`❌ Error executing action node:`, actionError)
              // Mark log as failed
              if (logEntry) {
                await supabase
                  .from('workflow_instance_logs')
                  .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: actionError instanceof Error ? actionError.message : 'Action execution failed'
                  })
                  .eq('id', logEntry.id)
              }
            }
          } else if (nodeData.node_type === 'end') {
            console.log('🏁 End node reached, marking workflow as completed')
            hasEndNode = true
            // Update log to completed
            if (logEntry) {
              await supabase
                .from('workflow_instance_logs')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                  output_data: { message: 'Workflow completed' }
                })
                .eq('id', logEntry.id)
            }
          } else {
            // For other node types (notification, etc.), mark as completed
            console.log(`ℹ️ Node type ${nodeData.node_type} processed`)
            if (logEntry) {
              await supabase
                .from('workflow_instance_logs')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  duration_ms: Date.now() - new Date(nodeStartTime).getTime(),
                  output_data: { 
                    message: `Node ${nodeData.node_type} processed via edge function resume`,
                    success: true
                  }
                })
                .eq('id', logEntry.id)
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