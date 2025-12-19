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

        console.log(`✅ Workflow execution ${execution.id} resumed successfully`)
        console.log(`   Status set to 'running'`)
        console.log(`   Next nodes marked as pending: ${nextNodeIds.join(', ')}`)
        
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
