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
    let query = supabase
      .from('workflow_executions')
      .select('id, workflow_id, wait_node_id, wait_config, trigger_data, execution_data, trigger_submission_id, submitter_id')
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
        console.log(`▶️ Resuming workflow execution: ${execution.id}`)
        console.log(`   Wait node: ${execution.wait_node_id}`)
        console.log(`   Wait config:`, execution.wait_config)

        // Get the next nodes from the wait node
        const { data: connections, error: connError } = await supabase
          .from('workflow_connections')
          .select('target_node_id')
          .eq('source_node_id', execution.wait_node_id)

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
          .eq('node_id', execution.wait_node_id)
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

        // Create running log entries for each next node
        // This allows the frontend to pick up and continue execution
        for (const nodeData of (nextNodes || []) as WorkflowNode[]) {
          const { error: insertError } = await supabase
            .from('workflow_instance_logs')
            .insert({
              execution_id: execution.id,
              node_id: nodeData.id,
              node_type: nodeData.node_type,
              node_label: nodeData.label,
              status: 'pending', // Mark as pending for frontend to execute
              action_type: 'resume_continuation',
              input_data: {
                resumedFrom: execution.wait_node_id,
                triggerData: execution.trigger_data,
                needsExecution: true // Flag to indicate frontend should execute this
              }
            })

          if (insertError) {
            console.error(`⚠️ Error creating log for node ${nodeData.id}:`, insertError)
          } else {
            console.log(`✅ Created pending log for node: ${nodeData.label} (${nodeData.node_type})`)
          }
        }

        // Also directly execute action nodes right here in the edge function
        // to ensure they run even without frontend intervention
        for (const nodeData of (nextNodes || []) as WorkflowNode[]) {
          console.log(`🎯 Executing resumed node: ${nodeData.label} (${nodeData.node_type})`)
          
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
                
                // Get title/subject and message from config - check multiple possible locations
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
                
                console.log(`📨 Sending notification to ${recipientUserIds.length} user(s):`, recipientUserIds)
                
                let notificationsSent = 0
                for (const userId of recipientUserIds) {
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
                await supabase
                  .from('workflow_instance_logs')
                  .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    output_data: { 
                      notificationsSent,
                      recipientUserIds,
                      title,
                      message
                    }
                  })
                  .eq('execution_id', execution.id)
                  .eq('node_id', nodeData.id)
              }
            } catch (actionError) {
              console.error(`❌ Error executing action node:`, actionError)
            }
          } else if (nodeData.node_type === 'end') {
            console.log('🏁 End node reached, marking workflow as completed')
            // Update log to completed
            await supabase
              .from('workflow_instance_logs')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                output_data: { message: 'Workflow completed' }
              })
              .eq('execution_id', execution.id)
              .eq('node_id', nodeData.id)
          }
        }

        // Check if all next nodes have been processed and mark workflow as completed
        // If there's an end node, or if there are no more connections from the action nodes
        const hasEndNode = (nextNodes || []).some((n: any) => n.node_type === 'end')
        
        // Also check if action nodes have no further connections (meaning they're terminal)
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
