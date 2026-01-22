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
  // For selecting which linked record to use when multiple are linked
  crossRefMatchType?: 'first' | 'static_value' | 'source_field';
  crossRefMatchFieldId?: string;
  crossRefMatchFieldName?: string;
  crossRefMatchValue?: string;
  crossRefMatchSourceFieldId?: string;
  crossRefMatchSourceFieldName?: string;
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

interface CrossRefMatchRule {
  id?: string;
  linkedFieldId: string;
  linkedFieldName?: string;
  matchType: 'static_value' | 'source_field';
  staticValue?: string;
  sourceFieldId?: string;
  sourceFieldName?: string;
}

// Nested mapping interfaces for creating/updating records in linked forms
interface NestedFieldMapping {
  sourceFieldId: string;
  sourceFieldName?: string;
  linkedFieldId: string;
  linkedFieldName?: string;
}

interface NestedCrossRefConfig {
  targetCrossRefFieldId: string;
  targetCrossRefFieldName?: string;
  linkedFormId: string;
  linkedFormName?: string;
  behavior: 'create' | 'update_or_create';
  matchingFieldId?: string;
  matchingSourceFieldId?: string;
  fieldMappings: NestedFieldMapping[];
}

interface DataFeed {
  id: string;
  name: string;
  source_form_id: string;
  target_form_id: string;
  matching_type: 'cross_reference' | 'field_matching';
  cross_reference_field_id?: string;
  cross_ref_record_selection?: 'all' | 'first' | 'match_by_field';
  cross_ref_match_rules?: CrossRefMatchRule[];
  cross_ref_match_logic?: string;
  matching_rules: MatchingRule[];
  matching_logic?: string;
  source_filters?: SourceFilter[];
  source_filter_logic?: string;
  field_mappings: FieldMapping[];
  nested_cross_ref_mappings?: NestedCrossRefConfig[];
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

// Process nested cross-reference mappings - creates/updates records in linked forms
async function processNestedCrossRefMappings(
  supabase: any,
  nestedMappings: NestedCrossRefConfig[],
  sourceData: Record<string, any>,
  changedBy: string,
  runLog: any[]
): Promise<Record<string, string | null>> {
  const linkedRecordIds: Record<string, string | null> = {};
  
  if (!nestedMappings || nestedMappings.length === 0) {
    return linkedRecordIds;
  }

  for (const config of nestedMappings) {
    if (!config.fieldMappings || config.fieldMappings.length === 0) {
      console.log(`⏭️ Skipping nested mapping for ${config.targetCrossRefFieldName} - no field mappings`);
      continue;
    }

    try {
      // Build the data for the linked record
      const linkedData: Record<string, any> = {};
      const fieldLabels: Record<string, string> = {};
      
      for (const mapping of config.fieldMappings) {
        const sourceValue = sourceData[mapping.sourceFieldId];
        if (sourceValue !== undefined) {
          linkedData[mapping.linkedFieldId] = sourceValue;
          fieldLabels[mapping.linkedFieldId] = mapping.linkedFieldName || mapping.linkedFieldId;
        }
      }

      if (Object.keys(linkedData).length === 0) {
        console.log(`⏭️ Skipping nested mapping for ${config.targetCrossRefFieldName} - no data to map`);
        continue;
      }

      let linkedRecordId: string | null = null;

      if (config.behavior === 'update_or_create' && config.matchingFieldId && config.matchingSourceFieldId) {
        // Try to find existing record to update
        const matchValue = sourceData[config.matchingSourceFieldId];
        
        if (matchValue !== undefined && matchValue !== null) {
          const { data: existingRecords } = await supabase
            .from('form_submissions')
            .select('id, submission_data')
            .eq('form_id', config.linkedFormId);

          // Find matching record
          const existingRecord = existingRecords?.find((rec: any) => {
            const recValue = rec.submission_data?.[config.matchingFieldId!];
            return String(recValue).toLowerCase().trim() === String(matchValue).toLowerCase().trim();
          });

          if (existingRecord) {
            // Update existing record
            const oldData = existingRecord.submission_data || {};
            const updatedData = { ...oldData, ...linkedData };
            
            const { error: updateError } = await supabase
              .from('form_submissions')
              .update({ submission_data: updatedData })
              .eq('id', existingRecord.id);

            if (updateError) {
              console.error(`❌ Failed to update nested record:`, updateError);
              runLog.push({ type: 'error', message: `Failed to update nested record in ${config.linkedFormName}: ${updateError.message}`, timestamp: new Date().toISOString() });
            } else {
              linkedRecordId = existingRecord.id;
              console.log(`✅ Updated nested record ${existingRecord.id} in ${config.linkedFormName}`);
              runLog.push({ type: 'success', message: `Updated nested record in ${config.linkedFormName}`, timestamp: new Date().toISOString() });
              
              // Log changes
              const changes = detectRecordChanges(oldData, updatedData, fieldLabels);
              if (changes.length > 0) {
                await logRecordFieldChanges(supabase, existingRecord.id, changes, changedBy, 'updated');
              }
            }
          }
        }
      }

      // Create new record if not found or behavior is 'create'
      if (!linkedRecordId) {
        const { data: insertedRecord, error: insertError } = await supabase
          .from('form_submissions')
          .insert({
            form_id: config.linkedFormId,
            submission_data: linkedData,
            approval_status: 'pending'
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`❌ Failed to create nested record:`, insertError);
          runLog.push({ type: 'error', message: `Failed to create nested record in ${config.linkedFormName}: ${insertError.message}`, timestamp: new Date().toISOString() });
        } else {
          linkedRecordId = insertedRecord.id;
          console.log(`✅ Created nested record ${insertedRecord.id} in ${config.linkedFormName}`);
          runLog.push({ type: 'success', message: `Created nested record in ${config.linkedFormName}`, timestamp: new Date().toISOString() });
          
          // Log changes for new record
          const changes = detectRecordChanges({}, linkedData, fieldLabels);
          if (changes.length > 0) {
            await logRecordFieldChanges(supabase, insertedRecord.id, changes, changedBy, 'created');
          }
        }
      }

      linkedRecordIds[config.targetCrossRefFieldId] = linkedRecordId;
    } catch (error) {
      console.error(`❌ Error processing nested mapping for ${config.targetCrossRefFieldName}:`, error);
      runLog.push({ type: 'error', message: `Error processing nested mapping for ${config.targetCrossRefFieldName}: ${String(error)}`, timestamp: new Date().toISOString() });
    }
  }

  return linkedRecordIds;
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
  
  // Boolean operators
  if (filter.operator === 'is_true') {
    return fieldValue === true || fieldValue === 'true' || fieldValue === '1' || fieldValue === 1;
  }
  if (filter.operator === 'is_false') {
    return fieldValue === false || fieldValue === 'false' || fieldValue === '0' || fieldValue === 0 ||
           fieldValue === undefined || fieldValue === null;
  }
  
  // Selection "in" and "not_in" operators - compare against comma-separated list
  if (filter.operator === 'in' || filter.operator === 'not_in') {
    const compareValues = compareValue.split(',').map(v => v.toLowerCase().trim());
    let matches = false;
    
    if (Array.isArray(fieldValue)) {
      // Multi-select field: check if any selected value is in the compare list
      matches = fieldValue.some(v => compareValues.includes(String(v).toLowerCase().trim()));
    } else {
      // Single value: check if it's in the compare list
      matches = compareValues.includes(String(fieldValue ?? '').toLowerCase().trim());
    }
    
    return filter.operator === 'in' ? matches : !matches;
  }
  
  // Date/time operators
  if (['before', 'after', 'on_or_before', 'on_or_after'].includes(filter.operator)) {
    const fieldDate = new Date(fieldValue);
    const compareDate = new Date(compareValue);
    
    if (isNaN(fieldDate.getTime()) || isNaN(compareDate.getTime())) {
      console.warn(`Date comparison failed: invalid date - field: ${fieldValue}, compare: ${compareValue}`);
      return false;
    }
    
    switch (filter.operator) {
      case 'before':
        return fieldDate < compareDate;
      case 'after':
        return fieldDate > compareDate;
      case 'on_or_before':
        return fieldDate <= compareDate;
      case 'on_or_after':
        return fieldDate >= compareDate;
    }
  }
  
  // Numeric operators
  if (['greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(filter.operator)) {
    const numField = parseFloat(String(fieldValue ?? ''));
    const numCompare = parseFloat(compareValue);
    
    if (isNaN(numField) || isNaN(numCompare)) {
      console.warn(`Numeric comparison failed: invalid number - field: ${fieldValue}, compare: ${compareValue}`);
      return false;
    }
    
    switch (filter.operator) {
      case 'greater_than':
        return numField > numCompare;
      case 'less_than':
        return numField < numCompare;
      case 'greater_than_or_equal':
        return numField >= numCompare;
      case 'less_than_or_equal':
        return numField <= numCompare;
    }
  }
  
  // Text-based operators (string comparison)
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
    default:
      console.warn(`Unknown filter operator: ${filter.operator}`);
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

// Find the matching linked record based on crossRefMatchType
function findMatchingLinkedRecord(
  crossRefValue: any,
  crossRefCache: Record<string, Record<string, any>>,
  mapping: FieldMapping,
  sourceData: Record<string, any>
): string | null {
  if (!crossRefValue) return null;
  
  // Get all linked record IDs
  const linkedIds: string[] = [];
  
  if (Array.isArray(crossRefValue)) {
    for (const item of crossRefValue) {
      let id: string | null = null;
      if (typeof item === 'object' && item !== null) {
        id = item.id || item.submission_ref_id || String(item);
      } else {
        id = String(item);
      }
      if (id && crossRefCache[id]) {
        linkedIds.push(id);
      }
    }
  } else if (typeof crossRefValue === 'object' && crossRefValue !== null) {
    const id = crossRefValue.id || crossRefValue.submission_ref_id || String(crossRefValue);
    if (id && crossRefCache[id]) {
      linkedIds.push(id);
    }
  } else {
    const id = String(crossRefValue);
    if (id && crossRefCache[id]) {
      linkedIds.push(id);
    }
  }
  
  if (linkedIds.length === 0) return null;
  
  const matchType = mapping.crossRefMatchType || 'first';
  
  // First record - just use the first one
  if (matchType === 'first') {
    console.log(`🔗 Using first linked record: ${linkedIds[0]}`);
    return linkedIds[0];
  }
  
  // Need a match field to proceed with matching
  if (!mapping.crossRefMatchFieldId) {
    console.log(`⚠️ No match field configured, falling back to first record: ${linkedIds[0]}`);
    return linkedIds[0];
  }
  
  // Static value matching - find record where linkedRecord[matchFieldId] === matchValue
  if (matchType === 'static_value' && mapping.crossRefMatchValue !== undefined) {
    const targetValue = String(mapping.crossRefMatchValue).toLowerCase().trim();
    
    for (const id of linkedIds) {
      const linkedData = crossRefCache[id];
      const fieldValue = String(linkedData[mapping.crossRefMatchFieldId] ?? '').toLowerCase().trim();
      
      if (fieldValue === targetValue) {
        console.log(`🔗 Found matching linked record by static value: ${id} (${mapping.crossRefMatchFieldId} = "${targetValue}")`);
        return id;
      }
    }
    
    console.log(`⚠️ No linked record matched static value "${targetValue}" for field ${mapping.crossRefMatchFieldId}, falling back to first`);
    return linkedIds[0];
  }
  
  // Source field comparison - find record where linkedRecord[matchFieldId] === sourceRecord[sourceFieldId]
  if (matchType === 'source_field' && mapping.crossRefMatchSourceFieldId) {
    const sourceValue = String(sourceData[mapping.crossRefMatchSourceFieldId] ?? '').toLowerCase().trim();
    
    for (const id of linkedIds) {
      const linkedData = crossRefCache[id];
      const fieldValue = String(linkedData[mapping.crossRefMatchFieldId] ?? '').toLowerCase().trim();
      
      if (fieldValue === sourceValue) {
        console.log(`🔗 Found matching linked record by source field: ${id} (${mapping.crossRefMatchFieldId} = "${sourceValue}" from source.${mapping.crossRefMatchSourceFieldId})`);
        return id;
      }
    }
    
    console.log(`⚠️ No linked record matched source field value "${sourceValue}" for field ${mapping.crossRefMatchFieldId}, falling back to first`);
    return linkedIds[0];
  }
  
  // Fallback
  console.log(`⚠️ Unknown match type "${matchType}", falling back to first record: ${linkedIds[0]}`);
  return linkedIds[0];
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
              
              // Get all matching targets first
              let allMatchedTargets = (targetSubmissions || []).filter(target => 
                refIds.includes(target.id) || refIds.includes(target.submission_ref_id)
              );

              // Apply record selection rules
              const recordSelection = feed.cross_ref_record_selection || 'all';
              const matchRules = feed.cross_ref_match_rules || [];
              const matchLogic = feed.cross_ref_match_logic || '';

              if (recordSelection === 'first' && allMatchedTargets.length > 0) {
                // Only use first record
                matchedTargets = [allMatchedTargets[0]];
                console.log(`🔗 Record selection: first - using 1 of ${allMatchedTargets.length}`);
              } else if (recordSelection === 'match_by_field' && matchRules.length > 0) {
                // Filter by field match rules
                matchedTargets = allMatchedTargets.filter(target => {
                  const targetData = target.submission_data as Record<string, any>;
                  
                  const ruleResults: Record<string, boolean> = {};
                  matchRules.forEach((rule, idx) => {
                    const ruleId = rule.id || String(idx + 1);
                    const linkedValue = targetData[rule.linkedFieldId];
                    let compareValue: any;
                    
                    if (rule.matchType === 'static_value') {
                      compareValue = rule.staticValue;
                    } else if (rule.matchType === 'source_field' && rule.sourceFieldId) {
                      compareValue = sourceData[rule.sourceFieldId];
                    }
                    
                    const match = String(linkedValue || '').trim().toLowerCase() === String(compareValue || '').trim().toLowerCase();
                    console.log(`🔍 CrossRef Rule ${ruleId}: linked[${rule.linkedFieldId}]="${linkedValue}" vs "${compareValue}" = ${match}`);
                    ruleResults[ruleId] = match;
                  });

                  return evaluateLogicExpression(matchLogic || '', ruleResults);
                });
                console.log(`🔗 Record selection: match_by_field - ${matchedTargets.length} of ${allMatchedTargets.length} matched rules`);
              } else {
                // Use all records
                matchedTargets = allMatchedTargets;
                console.log(`🔗 Record selection: all - using ${matchedTargets.length} records`);
              }
            }
          }

          console.log(`📎 Found ${matchedTargets.length} matching target(s) for source ${sourceSubmission.submission_ref_id || sourceSubmission.id}`);

          if (matchedTargets.length > 0) {
            // Process nested cross-reference mappings first (create/update linked records)
            const nestedMappings = (feed.nested_cross_ref_mappings || []) as NestedCrossRefConfig[];
            const linkedRecordIds = await processNestedCrossRefMappings(
              supabase,
              nestedMappings,
              sourceData,
              `datafeed:${feed.created_by}`,
              runLog
            );

            // Update matched target submissions
            for (const target of matchedTargets) {
              const oldData = target.submission_data as Record<string, any>;
              const updatedData = { ...oldData };
              
              for (const mapping of fieldMappings) {
                let sourceValue: any;
                
                if (mapping.sourceType === 'cross_reference' && mapping.crossRefFieldId && mapping.crossRefSourceFieldId) {
                  // Cross-reference field mapping - use matching logic to find the right linked record
                  const crossRefValue = sourceData[mapping.crossRefFieldId];
                  const refId = findMatchingLinkedRecord(crossRefValue, crossRefCache, mapping, sourceData);
                  
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

              // Add linked record IDs to target's cross-reference fields
              for (const [crossRefFieldId, linkedId] of Object.entries(linkedRecordIds)) {
                if (linkedId) {
                  // Store as array format for cross-reference compatibility
                  updatedData[crossRefFieldId] = [{ id: linkedId, submission_ref_id: linkedId }];
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
                // Cross-reference field mapping - use matching logic
                const crossRefValue = sourceData[mapping.crossRefFieldId];
                const refId = findMatchingLinkedRecord(crossRefValue, crossRefCache, mapping, sourceData);
                
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
