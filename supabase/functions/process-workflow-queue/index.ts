 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 // Configuration
 const BATCH_SIZE = 5; // Process 5 items at a time
 const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - consider stuck if processing longer
 const MAX_RETRIES = 3;
 
 // Exponential backoff delays (in minutes)
 const RETRY_DELAYS = [1, 5, 15]; // 1 min, 5 min, 15 min
 
 interface QueueItem {
   id: string;
   workflow_id: string;
   submission_id: string | null;
   trigger_data: Record<string, any>;
   trigger_source: string;
   status: string;
   priority: number;
   retry_count: number;
   max_retries: number;
   organization_id: string | null;
   project_id: string | null;
   created_at: string;
   started_at: string | null;
 }
 
 interface ProcessResult {
   processed: number;
   succeeded: number;
   failed: number;
   retrying: number;
   errors: string[];
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   const startTime = Date.now();
   const result: ProcessResult = {
     processed: 0,
     succeeded: 0,
     failed: 0,
     retrying: 0,
     errors: []
   };
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     console.log(`[process-queue] Starting queue processing...`);
 
     // Step 1: Reset stuck items (processing for too long)
     const stuckThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
     const { data: stuckItems } = await supabase
       .from('workflow_queue')
       .update({ 
         status: 'pending',
         started_at: null 
       })
       .eq('status', 'processing')
       .lt('started_at', stuckThreshold)
       .select('id');
     
     if (stuckItems && stuckItems.length > 0) {
       console.log(`[process-queue] Reset ${stuckItems.length} stuck items`);
     }
 
     // Step 2: Check for items ready to retry
     const now = new Date().toISOString();
     const { data: retryItems } = await supabase
       .from('workflow_queue')
       .update({ status: 'pending' })
       .eq('status', 'failed')
       .lt('next_retry_at', now)
       .lt('retry_count', MAX_RETRIES)
       .select('id');
     
     if (retryItems && retryItems.length > 0) {
       console.log(`[process-queue] Moved ${retryItems.length} items to retry`);
     }
 
     // Step 3: Fetch pending items (ordered by priority, then created_at)
     const { data: pendingItems, error: fetchError } = await supabase
       .from('workflow_queue')
       .select('*')
       .eq('status', 'pending')
       .order('priority', { ascending: true })
       .order('created_at', { ascending: true })
       .limit(BATCH_SIZE);
 
     if (fetchError) {
       throw fetchError;
     }
 
     if (!pendingItems || pendingItems.length === 0) {
       console.log(`[process-queue] No pending items found`);
       return new Response(JSON.stringify({
         success: true,
         message: 'No pending items',
         ...result
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     console.log(`[process-queue] Found ${pendingItems.length} pending items`);
 
     // Step 4: Process each item
     for (const item of pendingItems as QueueItem[]) {
       result.processed++;
       
       try {
         // Mark as processing
         await supabase
           .from('workflow_queue')
           .update({ 
             status: 'processing',
             started_at: new Date().toISOString()
           })
           .eq('id', item.id)
           .eq('status', 'pending'); // Optimistic lock
 
         console.log(`[process-queue] Processing queue item ${item.id} for workflow ${item.workflow_id}`);
 
         // Create workflow execution record
         const { data: execution, error: execError } = await supabase
           .from('workflow_executions')
           .insert({
             workflow_id: item.workflow_id,
             status: 'running',
             trigger_data: item.trigger_data,
            trigger_submission_id: item.submission_id,
            form_submission_id: item.submission_id,
            submitter_id: item.trigger_data?.submitter_id || null
           })
           .select('id')
           .single();
 
         if (execError) {
           throw new Error(`Failed to create execution: ${execError.message}`);
         }
 
         // Update queue item with execution ID
         await supabase
           .from('workflow_queue')
           .update({ execution_id: execution.id })
           .eq('id', item.id);
 
         // Call execute-workflow function
         const executeResponse = await fetch(
           `${supabaseUrl}/functions/v1/execute-workflow`,
           {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${supabaseServiceKey}`
             },
             body: JSON.stringify({
               workflowId: item.workflow_id,
               executionId: execution.id,
               triggerData: item.trigger_data,
               submissionId: item.submission_id,
               submitterId: item.trigger_data?.submitter_id || null
             })
           }
         );
 
         if (!executeResponse.ok) {
           const errorText = await executeResponse.text();
           throw new Error(`execute-workflow failed: ${executeResponse.status} - ${errorText}`);
         }
 
         // Mark as completed
         await supabase
           .from('workflow_queue')
           .update({ 
             status: 'completed',
             completed_at: new Date().toISOString()
           })
           .eq('id', item.id);
 
         console.log(`[process-queue] ✅ Successfully processed queue item ${item.id}`);
         result.succeeded++;
 
       } catch (itemError) {
         const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
         console.error(`[process-queue] ❌ Error processing item ${item.id}:`, errorMessage);
         result.errors.push(`${item.id}: ${errorMessage}`);
 
         // Calculate retry
         const newRetryCount = item.retry_count + 1;
         const canRetry = newRetryCount < MAX_RETRIES;
 
         if (canRetry) {
           // Calculate next retry time with exponential backoff
           const delayMinutes = RETRY_DELAYS[Math.min(newRetryCount - 1, RETRY_DELAYS.length - 1)];
           const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
 
           await supabase
             .from('workflow_queue')
             .update({ 
               status: 'failed',
               retry_count: newRetryCount,
               last_error: errorMessage,
               next_retry_at: nextRetryAt,
               started_at: null
             })
             .eq('id', item.id);
 
           console.log(`[process-queue] Item ${item.id} scheduled for retry ${newRetryCount}/${MAX_RETRIES} at ${nextRetryAt}`);
           result.retrying++;
         } else {
           // Max retries exceeded - mark as permanently failed
           await supabase
             .from('workflow_queue')
             .update({ 
               status: 'failed',
               retry_count: newRetryCount,
               last_error: `Max retries exceeded: ${errorMessage}`,
               started_at: null
             })
             .eq('id', item.id);
 
           console.log(`[process-queue] Item ${item.id} permanently failed after ${MAX_RETRIES} retries`);
           result.failed++;
         }
       }
     }
 
     const duration = Date.now() - startTime;
     console.log(`[process-queue] Completed in ${duration}ms:`, result);
 
     return new Response(JSON.stringify({
       success: true,
       duration_ms: duration,
       ...result
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
 
   } catch (error) {
     const duration = Date.now() - startTime;
     console.error(`[process-queue] Fatal error after ${duration}ms:`, error);
 
     return new Response(JSON.stringify({
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error',
       duration_ms: duration,
       ...result
     }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
 });