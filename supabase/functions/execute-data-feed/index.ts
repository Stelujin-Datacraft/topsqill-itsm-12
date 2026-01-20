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
  sourceType?: 'direct' | 'cross_reference';
  crossRefFieldId?: string;
  crossRefFieldName?: string;
  crossRefSourceFieldId?: string;
  crossRefSourceFieldName?: string;
}

interface MatchingRule {
  id?: string;
  sourceFieldId: string;
  targetFieldId: string;
}

interface SourceFilter {
  id?: string;
  fieldId: string;
  fieldName?: string;
  operator: string;
  value: string;
}

interface DataFeed {
  id: string;
  name: string;
  source_form_id: string;
  target_form_id: string;
  matching_type: 'cross_reference' | 'field_matching';
  cross_reference_field_id?: string;
  matching_rules: MatchingRule[];
  matching_logic?: string;
  source_filters?: SourceFilter[];
  source_filter_logic?: string;
  field_mappings: FieldMapping[];
  no_match_behavior: 'skip' | 'create';
  created_by: string;
}

interface RunStats {
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsFiltered: number;
  errors: number;
}

interface FieldChange {
  fieldId: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
}

// Helper to format display value for history
function formatDisplayValue(value: any): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return JSON.stringify(value);
  }
  return String(value);
}

// Log field changes to record_field_history
async function logRecordFieldChanges(
  supabase: any,
  submissionId: string,
  changes: FieldChange[],
  changedBy: string,
  changeType: 'created' | 'updated' | 'deleted' = 'updated'
): Promise<void> {
  try {
    if (changes.length === 0) return;

    const historyRecords = changes.map(change => ({
      submission_id: submissionId,
      field_id: change.fieldId,
      field_label: change.fieldLabel,
      old_value: change.oldValue,
      new_value: change.newValue,
      changed_by: changedBy,
      change_type: changeType
    }));

    const { error } = await supabase
      .from('record_field_history')
      .insert(historyRecords);

    if (error) {
      console.error('Error logging record field changes:', error);
    } else {
      console.log(`✅ Logged ${changes.length} field changes to history`);
    }
  } catch (e) {
    console.error('Exception logging record field changes:', e);
  }
}

// Detect changes between old and new data
function detectRecordChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldLabels: Record<string, string>
): FieldChange[] {
  const changes: FieldChange[] = [];
  
  for (const key of Object.keys(newData)) {
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    const oldStr = oldValue !== undefined && oldValue !== null ? JSON.stringify(oldValue) : null;
    const newStr = newValue !== undefined && newValue !== null ? JSON.stringify(newValue) : null;
    
    if (oldStr !== newStr) {
      changes.push({
        fieldId: key,
        fieldLabel: fieldLabels[key] || key,
        oldValue: formatDisplayValue(oldValue),
        newValue: formatDisplayValue(newValue)
      });
    }
  }
  
  return changes;
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

// Evaluate a single source filter condition
function evaluateSourceFilter(filter: SourceFilter, sourceData: Record<string, any>): boolean {
  const fieldValue = sourceData[filter.fieldId];
  const compareValue = filter.value;
  
  // Handle empty checks first
  if (filter.operator === 'is_empty') {
    return fieldValue === undefined || fieldValue === null || fieldValue === '' || 
           (Array.isArray(fieldValue) && fieldValue.length === 0);
  }
  if (filter.operator === 'is_not_empty') {
    return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
           (!Array.isArray(fieldValue) || fieldValue.length > 0);
  }
  
  // Convert to string for comparison
  const fieldStr = String(fieldValue ?? '').toLowerCase().trim();
  const compareStr = compareValue.toLowerCase().trim();
  
  switch (filter.operator) {
    case 'equals':
      return fieldStr === compareStr;
    case 'not_equals':
      return fieldStr !== compareStr;
    case 'contains':
      return fieldStr.includes(compareStr);
    case 'not_contains':
      return !fieldStr.includes(compareStr);
    case 'starts_with':
      return fieldStr.startsWith(compareStr);
    case 'ends_with':
      return fieldStr.endsWith(compareStr);
    case 'greater_than':
      const numField = parseFloat(fieldStr);
      const numCompare = parseFloat(compareStr);
      return !isNaN(numField) && !isNaN(numCompare) && numField > numCompare;
    case 'less_than':
      const numField2 = parseFloat(fieldStr);
      const numCompare2 = parseFloat(compareStr);
      return !isNaN(numField2) && !isNaN(numCompare2) && numField2 < numCompare2;
    default:
      return true;
  }
}

// Evaluate all source filters with logic expression
function passesSourceFilters(
  sourceData: Record<string, any>,
  filters: SourceFilter[],
  filterLogic: string
): boolean {
  if (!filters || filters.length === 0) {
    return true; // No filters = pass all
  }
  
  const filterResults: Record<string, boolean> = {};
  
  filters.forEach((filter, idx) => {
    const filterId = filter.id || String(idx + 1);
    const result = evaluateSourceFilter(filter, sourceData);
    console.log(`🔍 Filter ${filterId}: ${filter.fieldId} ${filter.operator} "${filter.value}" = ${result}`);
    filterResults[filterId] = result;
  });
  
  const finalResult = evaluateLogicExpression(filterLogic || '', filterResults);
  console.log(`📐 Filter logic evaluation (${filterLogic || 'default AND'}): ${JSON.stringify(filterResults)} = ${finalResult}`);
  return finalResult;
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
      recordsFiltered: 0,
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
      const sourceFilters = (feed.source_filters || []) as SourceFilter[];
      const sourceFilterLogic = feed.source_filter_logic as string | undefined;

      // Build a cache of cross-reference submissions for cross-ref field mappings
      const crossRefCache: Record<string, Record<string, any>> = {};
      
      // Get unique cross-ref field IDs from field mappings
      const crossRefFieldIds = new Set<string>();
      for (const mapping of fieldMappings) {
        if (mapping.sourceType === 'cross_reference' && mapping.crossRefFieldId) {
          crossRefFieldIds.add(mapping.crossRefFieldId);
        }
      }

      // Fetch referenced form data for cross-ref mappings if needed
      if (crossRefFieldIds.size > 0) {
        // Get the cross-ref field configs to find referenced form IDs
        const { data: crossRefFields } = await supabase
          .from('form_fields')
          .select('id, custom_config')
          .in('id', Array.from(crossRefFieldIds));

        if (crossRefFields) {
          for (const field of crossRefFields) {
            const config = field.custom_config as any;
            const referencedFormId = config?.referencedFormId;
            if (referencedFormId) {
              // Fetch all submissions from the referenced form
              const { data: refSubmissions } = await supabase
                .from('form_submissions')
                .select('id, submission_data, submission_ref_id')
                .eq('form_id', referencedFormId);

              if (refSubmissions) {
                for (const sub of refSubmissions) {
                  crossRefCache[sub.id] = sub.submission_data;
                  if (sub.submission_ref_id) {
                    crossRefCache[sub.submission_ref_id] = sub.submission_data;
                  }
                }
              }
            }
          }
        }
        console.log(`📚 Cached ${Object.keys(crossRefCache).length} cross-reference submissions`);
      }

      // Process each source submission
      for (const sourceSubmission of sourceSubmissions || []) {
        stats.recordsProcessed++;
        const sourceData = sourceSubmission.submission_data as Record<string, any>;

        try {
          // Apply source filters first
          if (!passesSourceFilters(sourceData, sourceFilters, sourceFilterLogic || '')) {
            stats.recordsFiltered++;
            runLog.push({ 
              type: 'info', 
              message: `Filtered source ${sourceSubmission.submission_ref_id || sourceSubmission.id} - did not match filter criteria`, 
              timestamp: new Date().toISOString() 
            });
            continue;
          }

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
              const oldData = target.submission_data as Record<string, any>;
              const updatedData = { ...oldData };
              
              for (const mapping of fieldMappings) {
                let sourceValue: any;
                
                if (mapping.sourceType === 'cross_reference' && mapping.crossRefFieldId && mapping.crossRefSourceFieldId) {
                  // Cross-reference field mapping - get value from linked record
                  const crossRefValue = sourceData[mapping.crossRefFieldId];
                  let refId: string | null = null;
                  
                  if (crossRefValue) {
                    if (Array.isArray(crossRefValue) && crossRefValue.length > 0) {
                      const firstItem = crossRefValue[0];
                      refId = typeof firstItem === 'object' && firstItem !== null 
                        ? (firstItem.id || firstItem.submission_ref_id || String(firstItem))
                        : String(firstItem);
                    } else if (typeof crossRefValue === 'object' && crossRefValue !== null) {
                      refId = crossRefValue.id || crossRefValue.submission_ref_id || String(crossRefValue);
                    } else {
                      refId = String(crossRefValue);
                    }
                  }
                  
                  if (refId && crossRefCache[refId]) {
                    sourceValue = crossRefCache[refId][mapping.crossRefSourceFieldId];
                    console.log(`🔗 Cross-ref mapping: ${mapping.crossRefFieldId}[${refId}].${mapping.crossRefSourceFieldId} = ${sourceValue}`);
                  }
                } else {
                  // Direct field mapping
                  sourceValue = sourceData[mapping.sourceFieldId];
                }
                
                if (sourceValue !== undefined) {
                  updatedData[mapping.targetFieldId] = sourceValue;
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

                // Log field changes to record_field_history
                const fieldLabels: Record<string, string> = {};
                for (const mapping of fieldMappings) {
                  fieldLabels[mapping.targetFieldId] = mapping.targetFieldName || mapping.targetFieldId;
                }

                const changes = detectRecordChanges(oldData, updatedData, fieldLabels);
                if (changes.length > 0) {
                  const changedBy = `datafeed:${feed.created_by}`;
                  await logRecordFieldChanges(supabase, target.id, changes, changedBy, 'updated');
                }
              }
            }
          } else if (feed.no_match_behavior === 'create') {
            // Create new target record
            const newData: Record<string, any> = {};
            
            for (const mapping of fieldMappings) {
              let sourceValue: any;
              
              if (mapping.sourceType === 'cross_reference' && mapping.crossRefFieldId && mapping.crossRefSourceFieldId) {
                // Cross-reference field mapping
                const crossRefValue = sourceData[mapping.crossRefFieldId];
                let refId: string | null = null;
                
                if (crossRefValue) {
                  if (Array.isArray(crossRefValue) && crossRefValue.length > 0) {
                    const firstItem = crossRefValue[0];
                    refId = typeof firstItem === 'object' && firstItem !== null 
                      ? (firstItem.id || firstItem.submission_ref_id || String(firstItem))
                      : String(firstItem);
                  } else if (typeof crossRefValue === 'object' && crossRefValue !== null) {
                    refId = crossRefValue.id || crossRefValue.submission_ref_id || String(crossRefValue);
                  } else {
                    refId = String(crossRefValue);
                  }
                }
                
                if (refId && crossRefCache[refId]) {
                  sourceValue = crossRefCache[refId][mapping.crossRefSourceFieldId];
                }
              } else {
                sourceValue = sourceData[mapping.sourceFieldId];
              }
              
              if (sourceValue !== undefined) {
                newData[mapping.targetFieldId] = sourceValue;
              }
            }

            const { data: insertedRecord, error: insertError } = await supabase
              .from('form_submissions')
              .insert({
                form_id: feed.target_form_id,
                submission_data: newData,
                approval_status: 'pending'
              })
              .select('id')
              .single();

            if (insertError) {
              console.error(`❌ Failed to create target record:`, insertError);
              stats.errors++;
              runLog.push({ type: 'error', message: `Failed to create target record: ${insertError.message}`, timestamp: new Date().toISOString() });
            } else {
              stats.recordsCreated++;
              runLog.push({ type: 'success', message: `Created new target record from source ${sourceSubmission.submission_ref_id || sourceSubmission.id}`, timestamp: new Date().toISOString() });

              // Log field changes for created record
              if (insertedRecord?.id) {
                const fieldLabels: Record<string, string> = {};
                for (const mapping of fieldMappings) {
                  fieldLabels[mapping.targetFieldId] = mapping.targetFieldName || mapping.targetFieldId;
                }

                const changes = detectRecordChanges({}, newData, fieldLabels);
                if (changes.length > 0) {
                  const changedBy = `datafeed:${feed.created_by}`;
                  await logRecordFieldChanges(supabase, insertedRecord.id, changes, changedBy, 'created');
                }
              }
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

      // Update the data feed's last run info
      await supabase
        .from('data_feeds')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: runStatus,
          last_run_stats: {
            recordsProcessed: stats.recordsProcessed,
            recordsUpdated: stats.recordsUpdated,
            recordsCreated: stats.recordsCreated,
            recordsSkipped: stats.recordsSkipped,
            recordsFiltered: stats.recordsFiltered,
            errors: stats.errors
          }
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

    } catch (execError) {
      console.error('❌ Execution error:', execError);
      
      // Update run record with failure
      await supabase
        .from('data_feed_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { message: String(execError) },
          run_log: runLog
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
        JSON.stringify({ error: String(execError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
