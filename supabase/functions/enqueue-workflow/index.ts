 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface EnqueueRequest {
   workflow_id: string;
   submission_id?: string;
   trigger_data?: Record<string, any>;
   trigger_source?: 'form_submission' | 'manual' | 'api' | 'bulk' | 'scheduled';
   trigger_ref?: string; // For deduplication
   priority?: number; // 1-10, lower = higher priority
   organization_id?: string;
   project_id?: string;
 }
 
 interface EnqueueResponse {
   success: boolean;
   queue_id?: string;
   message?: string;
   error?: string;
   deduplicated?: boolean; // True if a duplicate was found and skipped
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
       priority: body.priority || 5
     });
     
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