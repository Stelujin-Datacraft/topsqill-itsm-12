 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
// Re-enrollment check result
interface EnrollmentCheck {
  allowed: boolean;
  reason?: string;
  lastExecutionId?: string;
  lastExecutionStatus?: string;
  lastExecutionTime?: string;
}

 interface EnqueueRequest {
   workflow_id: string;
   submission_id?: string;
   trigger_data?: Record<string, any>;
   trigger_source?: 'form_submission' | 'manual' | 'api' | 'bulk' | 'scheduled';
   trigger_ref?: string; // For deduplication
   priority?: number; // 1-10, lower = higher priority
   organization_id?: string;
   project_id?: string;
  skip_enrollment_check?: boolean; // For manual/bulk triggers to bypass re-enrollment rules
 }
 
 interface EnqueueResponse {
   success: boolean;
   queue_id?: string;
   message?: string;
   error?: string;
   deduplicated?: boolean; // True if a duplicate was found and skipped
  enrollment_blocked?: boolean; // True if blocked by re-enrollment rules
  enrollment_reason?: string; // Reason for blocking
 }
 
/**
 * Check if a submission is allowed to enroll in a workflow based on enrollment_mode
 */
async function checkEnrollmentAllowed(
  supabase: any,
  workflowId: string,
  submissionId: string | null | undefined
): Promise<EnrollmentCheck> {
  // If no submission ID, always allow (manual triggers without submission)
  if (!submissionId) {
    return { allowed: true };
  }

  // Get workflow's enrollment settings
  const { data: workflow, error: workflowError } = await supabase
    .from('workflows')
    .select('enrollment_mode, enrollment_cooldown_hours')
    .eq('id', workflowId)
    .single();

  if (workflowError || !workflow) {
    console.log(`[enqueue-workflow] Could not fetch workflow settings, allowing enrollment`);
    return { allowed: true };
  }

  const { enrollment_mode, enrollment_cooldown_hours } = workflow;

  // Default mode: allow always
  if (enrollment_mode === 'allow_always' || !enrollment_mode) {
    return { allowed: true };
  }

  // Check for existing executions for this workflow + submission
  const { data: existingExecutions, error: execError } = await supabase
    .from('workflow_executions')
    .select('id, status, started_at, completed_at')
    .eq('workflow_id', workflowId)
    .eq('trigger_submission_id', submissionId)
    .in('status', ['completed', 'running', 'waiting'])
    .order('started_at', { ascending: false })
    .limit(1);

  if (execError) {
    console.error(`[enqueue-workflow] Error checking enrollment history:`, execError);
    return { allowed: true }; // Allow on error to avoid blocking
  }

  if (!existingExecutions || existingExecutions.length === 0) {
    // No previous execution, allow enrollment
    return { allowed: true };
  }

  const lastExecution = existingExecutions[0];

  // Mode: once_per_record - never re-enroll
  if (enrollment_mode === 'once_per_record') {
    return {
      allowed: false,
      reason: `Record already enrolled in this workflow (execution: ${lastExecution.id.slice(0, 8)}...)`,
      lastExecutionId: lastExecution.id,
      lastExecutionStatus: lastExecution.status,
      lastExecutionTime: lastExecution.started_at
    };
  }

  // Mode: cooldown - check time since last execution
  if (enrollment_mode === 'cooldown') {
    const cooldownHours = enrollment_cooldown_hours || 24;
    const lastTime = new Date(lastExecution.completed_at || lastExecution.started_at).getTime();
    const now = Date.now();
    const hoursSinceLastRun = (now - lastTime) / (1000 * 60 * 60);

    if (hoursSinceLastRun < cooldownHours) {
      const remainingHours = Math.ceil(cooldownHours - hoursSinceLastRun);
      return {
        allowed: false,
        reason: `Cooldown period active (${remainingHours}h remaining of ${cooldownHours}h cooldown)`,
        lastExecutionId: lastExecution.id,
        lastExecutionStatus: lastExecution.status,
        lastExecutionTime: lastExecution.started_at
      };
    }

    // Cooldown expired, allow enrollment
    return { allowed: true };
  }

  // Unknown mode, allow by default
  return { allowed: true };
}

 serve(async (req) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   const startTime = Date.now();
   
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     
     // Use service role for queue management
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
     
     const body: EnqueueRequest = await req.json();
     
     // Validate required fields
     if (!body.workflow_id) {
       return new Response(JSON.stringify({
         success: false,
         error: 'workflow_id is required'
       } as EnqueueResponse), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
     
     console.log(`[enqueue-workflow] Enqueuing workflow ${body.workflow_id}`, {
       submission_id: body.submission_id,
       trigger_source: body.trigger_source || 'form_submission',
       trigger_ref: body.trigger_ref,
      priority: body.priority || 5,
      skip_enrollment_check: body.skip_enrollment_check || false
     });
     
    // Check re-enrollment rules (unless explicitly skipped for manual/bulk triggers)
    if (!body.skip_enrollment_check && body.submission_id) {
      const enrollmentCheck = await checkEnrollmentAllowed(
        supabase,
        body.workflow_id,
        body.submission_id
      );

      if (!enrollmentCheck.allowed) {
        console.log(`[enqueue-workflow] Enrollment blocked: ${enrollmentCheck.reason}`);
        return new Response(JSON.stringify({
          success: false,
          error: enrollmentCheck.reason,
          enrollment_blocked: true,
          enrollment_reason: enrollmentCheck.reason
        } as EnqueueResponse), {
          status: 200, // Return 200 since this is not an error, just a policy block
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

     // Check for duplicate if trigger_ref is provided
     if (body.trigger_ref) {
       const { data: existing } = await supabase
         .from('workflow_queue')
         .select('id, status')
         .eq('trigger_ref', body.trigger_ref)
         .in('status', ['pending', 'processing'])
         .maybeSingle();
       
       if (existing) {
         console.log(`[enqueue-workflow] Duplicate found for trigger_ref: ${body.trigger_ref}, queue_id: ${existing.id}`);
         return new Response(JSON.stringify({
           success: true,
           queue_id: existing.id,
           message: 'Workflow already queued',
           deduplicated: true
         } as EnqueueResponse), {
           status: 200,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
     }
     
     // Get workflow details to populate org/project if not provided
     let orgId = body.organization_id;
     let projId = body.project_id;
     
     if (!orgId || !projId) {
       const { data: workflow } = await supabase
         .from('workflows')
         .select('organization_id, project_id')
         .eq('id', body.workflow_id)
         .single();
       
       if (workflow) {
         orgId = orgId || workflow.organization_id;
         projId = projId || workflow.project_id;
       }
     }
     
      // Validate project_id exists if set (to avoid FK constraint errors)
      if (projId) {
        const { data: projectExists } = await supabase
          .from('projects')
          .select('id')
          .eq('id', projId)
          .maybeSingle();
        
        if (!projectExists) {
          console.warn(`[enqueue-workflow] Project ${projId} not found, setting to null`);
          projId = null;
        }
      }
      
      // Validate organization_id exists if set
      if (orgId) {
        const { data: orgExists } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', orgId)
          .maybeSingle();
        
        if (!orgExists) {
          console.warn(`[enqueue-workflow] Organization ${orgId} not found, setting to null`);
          orgId = null;
        }
      }

     // Insert into queue
     const { data: queueItem, error: insertError } = await supabase
       .from('workflow_queue')
       .insert({
         workflow_id: body.workflow_id,
         submission_id: body.submission_id || null,
         trigger_data: body.trigger_data || {},
         trigger_source: body.trigger_source || 'form_submission',
         trigger_ref: body.trigger_ref || null,
         priority: Math.min(10, Math.max(1, body.priority || 5)),
          organization_id: orgId || null,
          project_id: projId || null,
         status: 'pending'
       })
       .select('id')
       .single();
     
     if (insertError) {
       console.error(`[enqueue-workflow] Insert error:`, insertError);
       throw insertError;
     }
     
     const duration = Date.now() - startTime;
     console.log(`[enqueue-workflow] Successfully queued workflow, queue_id: ${queueItem.id}, duration: ${duration}ms`);
     
     return new Response(JSON.stringify({
       success: true,
       queue_id: queueItem.id,
       message: 'Workflow queued successfully'
     } as EnqueueResponse), {
       status: 200,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
     
   } catch (error) {
     const duration = Date.now() - startTime;
     console.error(`[enqueue-workflow] Error after ${duration}ms:`, error);
     
     return new Response(JSON.stringify({
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error'
     } as EnqueueResponse), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
 });