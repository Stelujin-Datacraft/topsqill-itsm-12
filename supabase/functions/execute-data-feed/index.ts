import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FieldMapping {
  sourceFieldId: string;
  targetFieldId: string;
  sourceFieldName?: string;
  targetFieldName?: string;
}

interface MatchingRule {
  id?: string;
  sourceFieldId: string;
  targetFieldId: string;
}

interface DataFeed {
  id: string;
  name: string;
  source_form_id: string;
  target_form_id: string;
  matching_type: 'cross_reference' | 'field_matching';
  cross_reference_field_id?: string;
  matching_rules: MatchingRule[];
  matching_logic?: string; // Logic expression e.g. "1 AND 2", "(1 OR 2) AND 3"
  field_mappings: FieldMapping[];
  no_match_behavior: 'skip' | 'create';
}

interface RunStats {
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsSkipped: number;
  errors: number;
}

// Simple expression evaluator for matching logic
function evaluateLogicExpression(expression: string, context: Record<string, boolean>): boolean {
  if (!expression || expression.trim() === '') {
    // Default: AND all conditions
    return Object.values(context).every(v => v);
  }

  try {
    // Tokenize
    const tokens = expression.toUpperCase()
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    // Convert to postfix (Shunting Yard)
    const output: string[] = [];
    const operators: string[] = [];
    const precedence: Record<string, number> = { 'NOT': 3, 'AND': 2, 'OR': 1 };

    for (const token of tokens) {
      if (token === '(') {
        operators.push(token);
      } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          output.push(operators.pop()!);
        }
        operators.pop(); // Remove '('
      } else if (token in precedence) {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          (precedence[operators[operators.length - 1]] || 0) >= precedence[token]
        ) {
          output.push(operators.pop()!);
        }
        operators.push(token);
      } else {
        output.push(token);
      }
    }
    while (operators.length > 0) {
      output.push(operators.pop()!);
    }

    // Evaluate postfix
    const stack: boolean[] = [];
    for (const token of output) {
      if (token === 'AND') {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(a && b);
      } else if (token === 'OR') {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(a || b);
      } else if (token === 'NOT') {
        const a = stack.pop()!;
        stack.push(!a);
      } else {
        // It's a condition ID
        const value = context[token] ?? context[token.toLowerCase()] ?? false;
        stack.push(value);
      }
    }

    return stack.length === 1 ? stack[0] : false;
  } catch (e) {
    console.error('Error evaluating logic expression:', e);
    // Fallback to AND logic
    return Object.values(context).every(v => v);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { feedId, triggeredBy = 'manual' } = await req.json();

    if (!feedId) {
      return new Response(
        JSON.stringify({ error: 'feedId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Starting data feed execution: ${feedId}`);

    // Fetch the data feed configuration
    const { data: feed, error: feedError } = await supabase
      .from('data_feeds')
      .select('*')
      .eq('id', feedId)
      .single();

    if (feedError || !feed) {
      console.error('❌ Feed not found:', feedError);
      return new Response(
        JSON.stringify({ error: 'Data feed not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a run record
    const { data: runRecord, error: runError } = await supabase
      .from('data_feed_runs')
      .insert({
        data_feed_id: feedId,
        status: 'running',
        triggered_by: triggeredBy
      })
      .select()
      .single();

    if (runError) {
      console.error('❌ Failed to create run record:', runError);
      return new Response(
        JSON.stringify({ error: 'Failed to create run record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const runId = runRecord.id;
    const runLog: any[] = [];
    const stats: RunStats = {
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: 0
    };

    try {
      // Fetch source form submissions
      const { data: sourceSubmissions, error: sourceError } = await supabase
        .from('form_submissions')
        .select('id, submission_data, submission_ref_id')
        .eq('form_id', feed.source_form_id);

      if (sourceError) {
        throw new Error(`Failed to fetch source submissions: ${sourceError.message}`);
      }

      console.log(`📥 Found ${sourceSubmissions?.length || 0} source submissions`);
      runLog.push({ type: 'info', message: `Found ${sourceSubmissions?.length || 0} source submissions`, timestamp: new Date().toISOString() });

      // Fetch target form submissions for matching
      const { data: targetSubmissions, error: targetError } = await supabase
        .from('form_submissions')
        .select('id, submission_data, submission_ref_id')
        .eq('form_id', feed.target_form_id);

      if (targetError) {
        throw new Error(`Failed to fetch target submissions: ${targetError.message}`);
      }

      console.log(`📤 Found ${targetSubmissions?.length || 0} target submissions`);
      runLog.push({ type: 'info', message: `Found ${targetSubmissions?.length || 0} target submissions`, timestamp: new Date().toISOString() });

      const fieldMappings = (feed.field_mappings || []) as FieldMapping[];
      const matchingRules = (feed.matching_rules || []) as MatchingRule[];
      const matchingLogic = feed.matching_logic as string | undefined;

      // Process each source submission
      for (const sourceSubmission of sourceSubmissions || []) {
        stats.recordsProcessed++;
        const sourceData = sourceSubmission.submission_data as Record<string, any>;

        try {
          // Find matching target submission(s)
          let matchedTargets: any[] = [];

          if (feed.matching_type === 'field_matching' && matchingRules.length > 0) {
            // Field-based matching with logic expression support
            matchedTargets = (targetSubmissions || []).filter(target => {
              const targetData = target.submission_data as Record<string, any>;
              
              // Build context: evaluate each rule and store result by ID
              const ruleResults: Record<string, boolean> = {};
              
              matchingRules.forEach((rule, idx) => {
                const ruleId = rule.id || String(idx + 1);
                const sourceValue = sourceData[rule.sourceFieldId];
                const targetValue = targetData[rule.targetFieldId];
                
                // Skip rule if source value is undefined/null/empty
                if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
                  console.log(`⚠️ Source field ${rule.sourceFieldId} is empty for rule ${ruleId}`);
                  ruleResults[ruleId] = false;
                  return;
                }
                
                // Compare as strings for consistency
                const match = String(sourceValue).trim().toLowerCase() === String(targetValue || '').trim().toLowerCase();
                console.log(`🔍 Rule ${ruleId}: source[${rule.sourceFieldId}]="${sourceValue}" vs target[${rule.targetFieldId}]="${targetValue}" = ${match}`);
                ruleResults[ruleId] = match;
              });

              // Evaluate using logic expression or default AND
              const result = evaluateLogicExpression(matchingLogic || '', ruleResults);
              console.log(`📐 Logic evaluation (${matchingLogic || 'default AND'}): ${JSON.stringify(ruleResults)} = ${result}`);
              return result;
            });
          } else if (feed.matching_type === 'cross_reference' && feed.cross_reference_field_id) {
            // Cross-reference matching - uses existing linked records
            const crossRefValue = sourceData[feed.cross_reference_field_id];
            console.log(`🔗 Cross-ref field ${feed.cross_reference_field_id} value:`, crossRefValue);
            
            if (crossRefValue) {
              // Handle both single value and array of cross-reference values
              let refIds: string[] = [];
              
              if (Array.isArray(crossRefValue)) {
                // Could be array of IDs or array of objects with id property
                refIds = crossRefValue.map(item => 
                  typeof item === 'object' && item !== null ? (item.id || item.submission_ref_id || String(item)) : String(item)
                );
              } else if (typeof crossRefValue === 'object' && crossRefValue !== null) {
                refIds = [crossRefValue.id || crossRefValue.submission_ref_id || String(crossRefValue)];
              } else {
                refIds = [String(crossRefValue)];
              }
              
              console.log(`🔗 Looking for target records with IDs:`, refIds);
              
              matchedTargets = (targetSubmissions || []).filter(target => 
                refIds.includes(target.id) || refIds.includes(target.submission_ref_id)
              );
            }
          }

          console.log(`📎 Found ${matchedTargets.length} matching target(s) for source ${sourceSubmission.submission_ref_id || sourceSubmission.id}`);

          if (matchedTargets.length > 0) {
            // Update matched target submissions
            for (const target of matchedTargets) {
              const updatedData = { ...(target.submission_data as Record<string, any>) };
              
              for (const mapping of fieldMappings) {
                if (sourceData[mapping.sourceFieldId] !== undefined) {
                  updatedData[mapping.targetFieldId] = sourceData[mapping.sourceFieldId];
                }
              }

              const { error: updateError } = await supabase
                .from('form_submissions')
                .update({ submission_data: updatedData })
                .eq('id', target.id);

              if (updateError) {
                console.error(`❌ Failed to update target ${target.id}:`, updateError);
                stats.errors++;
                runLog.push({ type: 'error', message: `Failed to update target ${target.id}: ${updateError.message}`, timestamp: new Date().toISOString() });
              } else {
                stats.recordsUpdated++;
                runLog.push({ type: 'success', message: `Updated target record ${target.submission_ref_id || target.id}`, timestamp: new Date().toISOString() });
              }
            }
          } else if (feed.no_match_behavior === 'create') {
            // Create new target record
            const newData: Record<string, any> = {};
            
            for (const mapping of fieldMappings) {
              if (sourceData[mapping.sourceFieldId] !== undefined) {
                newData[mapping.targetFieldId] = sourceData[mapping.sourceFieldId];
              }
            }

            const { error: insertError } = await supabase
              .from('form_submissions')
              .insert({
                form_id: feed.target_form_id,
                submission_data: newData,
                approval_status: 'pending'
              });

            if (insertError) {
              console.error(`❌ Failed to create target record:`, insertError);
              stats.errors++;
              runLog.push({ type: 'error', message: `Failed to create target record: ${insertError.message}`, timestamp: new Date().toISOString() });
            } else {
              stats.recordsCreated++;
              runLog.push({ type: 'success', message: `Created new target record from source ${sourceSubmission.submission_ref_id || sourceSubmission.id}`, timestamp: new Date().toISOString() });
            }
          } else {
            stats.recordsSkipped++;
            runLog.push({ type: 'info', message: `Skipped source ${sourceSubmission.submission_ref_id || sourceSubmission.id} - no match found`, timestamp: new Date().toISOString() });
          }
        } catch (processError) {
          console.error(`❌ Error processing source ${sourceSubmission.id}:`, processError);
          stats.errors++;
          runLog.push({ type: 'error', message: `Error processing source ${sourceSubmission.id}: ${String(processError)}`, timestamp: new Date().toISOString() });
        }
      }

      // Update run record with success
      const runStatus = stats.errors > 0 ? (stats.recordsUpdated > 0 || stats.recordsCreated > 0 ? 'partial' : 'failed') : 'completed';
      
      await supabase
        .from('data_feed_runs')
        .update({
          status: runStatus,
          completed_at: new Date().toISOString(),
          records_processed: stats.recordsProcessed,
          records_updated: stats.recordsUpdated,
          records_created: stats.recordsCreated,
          records_skipped: stats.recordsSkipped,
          errors_count: stats.errors,
          run_log: runLog
        })
        .eq('id', runId);

      // Update data feed with last run info
      await supabase
        .from('data_feeds')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: runStatus,
          last_run_stats: stats
        })
        .eq('id', feedId);

      console.log(`✅ Data feed execution completed: ${JSON.stringify(stats)}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          runId,
          stats,
          status: runStatus
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (executionError) {
      console.error('❌ Execution error:', executionError);
      
      // Update run record with failure
      await supabase
        .from('data_feed_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { message: String(executionError) },
          run_log: [...runLog, { type: 'error', message: String(executionError), timestamp: new Date().toISOString() }]
        })
        .eq('id', runId);

      await supabase
        .from('data_feeds')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed'
        })
        .eq('id', feedId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: String(executionError),
          runId
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
