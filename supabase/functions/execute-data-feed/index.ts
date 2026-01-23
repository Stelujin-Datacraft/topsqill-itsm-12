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

interface NestedCrossRefFieldMapping {
  sourceFieldId: string;
  sourceFieldName?: string;
  linkedFieldId: string;
  linkedFieldName?: string;
}

interface NestedCrossRefMapping {
  id: string;
  targetCrossRefFieldId: string;
  targetCrossRefFieldName?: string;
  linkedFormId: string;
  linkedFormName?: string;
  fieldMappings: NestedCrossRefFieldMapping[];
  linkToTarget: boolean;
  operation: 'create' | 'update' | 'create_or_update' | 'skip'; // 'skip' = pass through to chain only
  matchingRules?: MatchingRule[];
  matchingLogic?: string;
  // Chain support: nested mappings within this mapping (for Form A → Form B → Form C chains)
  chainMappings?: NestedCrossRefMapping[];
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
  nested_cross_ref_mappings?: NestedCrossRefMapping[];
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

// Process nested cross-reference mappings - create/update records in linked forms
async function processNestedCrossRefMappings(
  supabase: any,
  nestedMappings: NestedCrossRefMapping[],
  sourceData: Record<string, any>,
  targetRecordId: string,
  feedCreatedBy: string,
  runLog: { type: string; message: string; timestamp: string }[],
  chainDepth: number = 0,
  maxChainDepth: number = 10
): Promise<{ nestedCreated: number; nestedUpdated: number; nestedErrors: number }> {
  const result = { nestedCreated: 0, nestedUpdated: 0, nestedErrors: 0 };

  if (!nestedMappings || nestedMappings.length === 0) {
    return result;
  }

  // Prevent infinite recursion
  if (chainDepth >= maxChainDepth) {
    console.warn(`⚠️ Max chain depth (${maxChainDepth}) reached, stopping nested processing`);
    runLog.push({ type: 'warning', message: `Max chain depth (${maxChainDepth}) reached`, timestamp: new Date().toISOString() });
    return result;
  }

  const depthPrefix = chainDepth > 0 ? `${'  '.repeat(chainDepth)}[L${chainDepth + 1}] ` : '';
  console.log(`${depthPrefix}🔗 Processing ${nestedMappings.length} nested cross-reference mappings at depth ${chainDepth}`);

  for (const nestedMapping of nestedMappings) {
    try {
      const { linkedFormId, fieldMappings, linkToTarget, operation, targetCrossRefFieldId } = nestedMapping;

      if (!linkedFormId || !fieldMappings || fieldMappings.length === 0) {
        console.log(`⚠️ Skipping nested mapping - missing linkedFormId or fieldMappings`);
        continue;
      }

      // Build the data for the linked form record
      const linkedFormData: Record<string, any> = {};
      for (const fm of fieldMappings) {
        const sourceValue = sourceData[fm.sourceFieldId];
        if (sourceValue !== undefined && sourceValue !== null) {
          linkedFormData[fm.linkedFieldId] = sourceValue;
        }
      }

      console.log(`📝 Nested mapping for form ${linkedFormId}:`, linkedFormData);

      let linkedRecordId: string | null = null;

      if (operation === 'skip') {
        // Skip operation - don't create/update at this level, but find existing record for chain processing
        console.log(`${depthPrefix}⏭️ Skip operation - passing through to chain mappings only`);
        runLog.push({ type: 'info', message: `Skipping ${nestedMapping.linkedFormName || linkedFormId} level - processing chain only`, timestamp: new Date().toISOString() });
        
        // Try to find existing linked record to use as target for chain mappings
        if (linkToTarget && targetCrossRefFieldId) {
          const { data: targetRecord } = await supabase
            .from('form_submissions')
            .select('submission_data')
            .eq('id', targetRecordId)
            .single();
          
          if (targetRecord) {
            const targetData = targetRecord.submission_data as Record<string, any>;
            const crossRefValue = targetData[targetCrossRefFieldId];
            
            if (Array.isArray(crossRefValue) && crossRefValue.length > 0) {
              linkedRecordId = crossRefValue[0]?.id || crossRefValue[0];
            } else if (crossRefValue && typeof crossRefValue === 'object') {
              linkedRecordId = crossRefValue.id || null;
            } else if (typeof crossRefValue === 'string') {
              linkedRecordId = crossRefValue;
            }
          }
        }
        
        // If no existing record found and there are chain mappings, we can't proceed with chain
        if (!linkedRecordId && nestedMapping.chainMappings && nestedMapping.chainMappings.length > 0) {
          console.warn(`${depthPrefix}⚠️ No existing record found to pass through for chain mappings`);
          runLog.push({ type: 'warning', message: `No existing record at ${nestedMapping.linkedFormName || linkedFormId} to chain through`, timestamp: new Date().toISOString() });
        }
        
        // Don't continue to create/update logic - just proceed to chain processing below
      } else if (operation === 'create') {
        // Always create a new record
        const { data: createdRecord, error: createError } = await supabase
          .from('form_submissions')
          .insert({
            form_id: linkedFormId,
            submission_data: linkedFormData,
            approval_status: 'pending'
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`❌ Failed to create nested record:`, createError);
          result.nestedErrors++;
          runLog.push({ type: 'error', message: `Failed to create nested record in linked form: ${createError.message}`, timestamp: new Date().toISOString() });
          continue;
        }

        linkedRecordId = createdRecord.id;
        result.nestedCreated++;
        runLog.push({ type: 'success', message: `Created nested record in linked form ${linkedFormId}`, timestamp: new Date().toISOString() });
      } else if (operation === 'update' || operation === 'create_or_update') {
        // For update operations, find existing records in the linked form
        // If linkToTarget is enabled, look for records already linked to the target
        let existingRecordId: string | null = null;
        
        // Try to find existing linked record through the target's cross-reference field
        if (linkToTarget && targetCrossRefFieldId) {
          const { data: targetRecord } = await supabase
            .from('form_submissions')
            .select('submission_data')
            .eq('id', targetRecordId)
            .single();
          
          if (targetRecord) {
            const targetData = targetRecord.submission_data as Record<string, any>;
            const crossRefValue = targetData[targetCrossRefFieldId];
            
            // Get the first linked record ID
            if (Array.isArray(crossRefValue) && crossRefValue.length > 0) {
              existingRecordId = crossRefValue[0]?.id || crossRefValue[0];
            } else if (crossRefValue && typeof crossRefValue === 'object') {
              existingRecordId = crossRefValue.id || null;
            } else if (typeof crossRefValue === 'string') {
              existingRecordId = crossRefValue;
            }
          }
        }
        
        // If we have matching rules in the nested mapping, use them to find a record
        const matchingRules = nestedMapping.matchingRules || [];
        if (!existingRecordId && matchingRules.length > 0) {
          // Build query based on matching rules
          let query = supabase
            .from('form_submissions')
            .select('id, submission_data')
            .eq('form_id', linkedFormId);
          
          // We can't directly filter on JSONB in a loop, so fetch and filter
          const { data: candidates } = await query;
          
          if (candidates && candidates.length > 0) {
            // Find matching record
            for (const candidate of candidates) {
              const candidateData = candidate.submission_data as Record<string, any>;
              let matches = true;
              
              for (const rule of matchingRules) {
                const sourceValue = sourceData[rule.sourceFieldId];
                const targetValue = candidateData[rule.targetFieldId];
                
                if (String(sourceValue) !== String(targetValue)) {
                  matches = false;
                  break;
                }
              }
              
              if (matches) {
                existingRecordId = candidate.id;
                break;
              }
            }
          }
        }
        
        if (existingRecordId) {
          // Update existing record
          const { data: existingRecord } = await supabase
            .from('form_submissions')
            .select('submission_data')
            .eq('id', existingRecordId)
            .single();
          
          const existingData = (existingRecord?.submission_data as Record<string, any>) || {};
          const updatedLinkedData = { ...existingData, ...linkedFormData };
          
          const { error: updateError } = await supabase
            .from('form_submissions')
            .update({ submission_data: updatedLinkedData })
            .eq('id', existingRecordId);
          
          if (updateError) {
            console.error(`❌ Failed to update nested record:`, updateError);
            result.nestedErrors++;
            runLog.push({ type: 'error', message: `Failed to update nested record: ${updateError.message}`, timestamp: new Date().toISOString() });
            continue;
          }
          
          linkedRecordId = existingRecordId;
          result.nestedUpdated = (result.nestedUpdated || 0) + 1;
          runLog.push({ type: 'success', message: `Updated nested record in ${nestedMapping.linkedFormName || linkedFormId}`, timestamp: new Date().toISOString() });
          console.log(`✅ Updated nested record ${existingRecordId}`);
        } else if (operation === 'create_or_update') {
          // No existing record found, create new one
          const { data: createdRecord, error: createError } = await supabase
            .from('form_submissions')
            .insert({
              form_id: linkedFormId,
              submission_data: linkedFormData,
              approval_status: 'pending'
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`❌ Failed to create nested record:`, createError);
            result.nestedErrors++;
            runLog.push({ type: 'error', message: `Failed to create nested record: ${createError.message}`, timestamp: new Date().toISOString() });
            continue;
          }

          linkedRecordId = createdRecord.id;
          result.nestedCreated++;
          runLog.push({ type: 'success', message: `Created nested record in ${nestedMapping.linkedFormName || linkedFormId} (no existing found)`, timestamp: new Date().toISOString() });
          console.log(`✅ Created nested record ${createdRecord.id} (create_or_update, no match)`);
        } else {
          // operation === 'update' but no existing record found
          console.log(`⚠️ No existing nested record found to update in ${linkedFormId}`);
          runLog.push({ type: 'info', message: `No existing nested record found to update in ${nestedMapping.linkedFormName || linkedFormId}`, timestamp: new Date().toISOString() });
          continue;
        }
      }

      // Link the created/updated record to the target record if enabled
      if (linkToTarget && linkedRecordId && targetCrossRefFieldId) {
        console.log(`🔗 Linking nested record ${linkedRecordId} to target via field ${targetCrossRefFieldId}`);

        // Get current target record data
        const { data: targetRecord, error: fetchError } = await supabase
          .from('form_submissions')
          .select('submission_data')
          .eq('id', targetRecordId)
          .single();

        if (fetchError) {
          console.error(`❌ Failed to fetch target record for linking:`, fetchError);
          continue;
        }

        const currentData = (targetRecord?.submission_data as Record<string, any>) || {};
        const currentCrossRefValue = currentData[targetCrossRefFieldId];

        // Append the new linked record ID to the cross-reference field
        let newCrossRefValue: any[];
        if (Array.isArray(currentCrossRefValue)) {
          newCrossRefValue = [...currentCrossRefValue, { id: linkedRecordId }];
        } else if (currentCrossRefValue && typeof currentCrossRefValue === 'object') {
          newCrossRefValue = [currentCrossRefValue, { id: linkedRecordId }];
        } else if (currentCrossRefValue) {
          newCrossRefValue = [{ id: currentCrossRefValue }, { id: linkedRecordId }];
        } else {
          newCrossRefValue = [{ id: linkedRecordId }];
        }

        // Update the target record with the linked reference
        const { error: linkError } = await supabase
          .from('form_submissions')
          .update({
            submission_data: {
              ...currentData,
              [targetCrossRefFieldId]: newCrossRefValue
            }
          })
          .eq('id', targetRecordId);

        if (linkError) {
          console.error(`❌ Failed to link nested record to target:`, linkError);
          runLog.push({ type: 'error', message: `Failed to link nested record to target: ${linkError.message}`, timestamp: new Date().toISOString() });
        } else {
          console.log(`✅ Successfully linked nested record to target`);
          runLog.push({ type: 'success', message: `Linked nested record to target via ${nestedMapping.targetCrossRefFieldName || targetCrossRefFieldId}`, timestamp: new Date().toISOString() });
        }
      }

      // Process chain mappings recursively if this nested record was successfully created/updated
      if (linkedRecordId && nestedMapping.chainMappings && nestedMapping.chainMappings.length > 0) {
        console.log(`${depthPrefix}🔗 Processing ${nestedMapping.chainMappings.length} chain mappings at depth ${chainDepth + 1}`);
        runLog.push({ 
          type: 'info', 
          message: `Processing chain level ${chainDepth + 2} with ${nestedMapping.chainMappings.length} mapping(s)`, 
          timestamp: new Date().toISOString() 
        });

        const chainResult = await processNestedCrossRefMappings(
          supabase,
          nestedMapping.chainMappings,
          sourceData, // Pass the original source data to chain levels
          linkedRecordId, // The record we just created/updated becomes the target for chain mappings
          feedCreatedBy,
          runLog,
          chainDepth + 1,
          maxChainDepth
        );

        // Aggregate chain results
        result.nestedCreated += chainResult.nestedCreated;
        result.nestedUpdated += chainResult.nestedUpdated;
        result.nestedErrors += chainResult.nestedErrors;
      }
    } catch (nestedError) {
      console.error(`❌ Error processing nested mapping:`, nestedError);
      result.nestedErrors++;
      runLog.push({ type: 'error', message: `Nested mapping error: ${String(nestedError)}`, timestamp: new Date().toISOString() });
    }
  }

  return result;
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

                // Process nested cross-reference mappings for this target record
                const nestedMappings = feed.nested_cross_ref_mappings || [];
                if (nestedMappings.length > 0) {
                  const nestedResult = await processNestedCrossRefMappings(
                    supabase,
                    nestedMappings,
                    sourceData,
                    target.id,
                    feed.created_by,
                    runLog,
                    0, // Start at chain depth 0
                    10 // Max chain depth
                  );
                  console.log(`🔗 Nested mappings result for target ${target.id}:`, nestedResult);
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

                // Process nested cross-reference mappings for this newly created record
                const nestedMappings = feed.nested_cross_ref_mappings || [];
                if (nestedMappings.length > 0) {
                  const nestedResult = await processNestedCrossRefMappings(
                    supabase,
                    nestedMappings,
                    sourceData,
                    insertedRecord.id,
                    feed.created_by,
                    runLog,
                    0, // Start at chain depth 0
                    10 // Max chain depth
                  );
                  console.log(`🔗 Nested mappings result for new record ${insertedRecord.id}:`, nestedResult);
                }
              }
            }
          } else {
            // Even when skipping the main target, still process nested cross-ref mappings
            // if they have standalone operation (create) that doesn't depend on a target record
            const nestedMappings = feed.nested_cross_ref_mappings || [];
            let nestedProcessed = false;
            
            for (const nestedMapping of nestedMappings) {
              // Only process nested mappings that are set to "create" and DON'T require linking to target
              if (nestedMapping.operation === 'create' && !nestedMapping.linkToTarget) {
                const { linkedFormId, fieldMappings } = nestedMapping;
                
                if (!linkedFormId || !fieldMappings || fieldMappings.length === 0) {
                  continue;
                }
                
                // Build the data for the linked form record
                const linkedFormData: Record<string, any> = {};
                for (const fm of fieldMappings) {
                  const sourceValue = sourceData[fm.sourceFieldId];
                  if (sourceValue !== undefined && sourceValue !== null) {
                    linkedFormData[fm.linkedFieldId] = sourceValue;
                  }
                }
                
                if (Object.keys(linkedFormData).length === 0) {
                  console.log(`⚠️ No data to create for nested mapping in form ${linkedFormId}`);
                  continue;
                }
                
                const { data: createdRecord, error: createError } = await supabase
                  .from('form_submissions')
                  .insert({
                    form_id: linkedFormId,
                    submission_data: linkedFormData,
                    approval_status: 'pending'
                  })
                  .select('id')
                  .single();
                
                if (createError) {
                  console.error(`❌ Failed to create standalone nested record:`, createError);
                  runLog.push({ type: 'error', message: `Failed to create nested record in form ${nestedMapping.linkedFormName || linkedFormId}: ${createError.message}`, timestamp: new Date().toISOString() });
                } else {
                  nestedProcessed = true;
                  runLog.push({ type: 'success', message: `Created nested record in ${nestedMapping.linkedFormName || linkedFormId} (standalone, no target match)`, timestamp: new Date().toISOString() });
                  console.log(`✅ Created standalone nested record ${createdRecord.id} in form ${linkedFormId}`);
                  
                  // Process chain mappings for this standalone record
                  if (nestedMapping.chainMappings && nestedMapping.chainMappings.length > 0) {
                    const chainResult = await processNestedCrossRefMappings(
                      supabase,
                      nestedMapping.chainMappings,
                      sourceData,
                      createdRecord.id,
                      feed.created_by,
                      runLog,
                      1, // Start at depth 1 since we're already one level deep
                      10
                    );
                    console.log(`🔗 Chain mappings result for standalone record:`, chainResult);
                  }
                }
              }
            }
            
            if (!nestedProcessed) {
              stats.recordsSkipped++;
              runLog.push({ type: 'info', message: `Skipped source ${sourceSubmission.submission_ref_id || sourceSubmission.id} - no match found`, timestamp: new Date().toISOString() });
            } else {
              stats.recordsProcessed++;
              runLog.push({ type: 'info', message: `Source ${sourceSubmission.submission_ref_id || sourceSubmission.id} - no target match, but nested records created`, timestamp: new Date().toISOString() });
            }
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
