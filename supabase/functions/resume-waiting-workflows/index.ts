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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔍 Checking for waiting workflows to resume...')

    // Find all workflow executions that are waiting and past their scheduled resume time
    const { data: waitingExecutions, error: fetchError } = await supabase
      .from('workflow_executions')
      .select('id, workflow_id, wait_node_id, wait_config, trigger_data, execution_data, trigger_submission_id, submitter_id')
      .eq('status', 'waiting')
      .lte('scheduled_resume_at', new Date().toISOString())

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

    for (const execution of waitingExecutions as WaitingExecution[]) {
      try {
        console.log(`▶️ Resuming workflow execution: ${execution.id}`)

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

        // Update the wait node log to completed
        await supabase
          .from('workflow_instance_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            output_data: { resumed: true, resumedAt: new Date().toISOString() }
          })
          .eq('execution_id', execution.id)
          .eq('node_id', execution.wait_node_id)
          .eq('status', 'waiting')

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
              wait_config: null
            })
            .eq('id', execution.id)

          resumedCount++
          continue
        }

        // Update execution status to running
        await supabase
          .from('workflow_executions')
          .update({
            status: 'running',
            current_node_id: nextNodeIds[0],
            scheduled_resume_at: null,
            wait_node_id: null,
            wait_config: null
          })
          .eq('id', execution.id)

        // For each next node, create a log entry to trigger execution
        // The frontend orchestrator will pick up 'running' status and continue
        for (const nextNodeId of nextNodeIds) {
          // Get node details
          const { data: nodeData } = await supabase
            .from('workflow_nodes')
            .select('*')
            .eq('id', nextNodeId)
            .single()

          if (nodeData) {
            // Create a pending log for the next node
            await supabase
              .from('workflow_instance_logs')
              .insert({
                execution_id: execution.id,
                node_id: nextNodeId,
                node_type: nodeData.node_type,
                node_label: nodeData.label,
                status: 'pending',
                action_type: 'resume_from_wait',
                input_data: {
                  resumedFrom: execution.wait_node_id,
                  triggerData: execution.trigger_data
                }
              })
          }
        }

        console.log(`✅ Workflow execution ${execution.id} resumed, next nodes: ${nextNodeIds.join(', ')}`)
        resumedCount++

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
