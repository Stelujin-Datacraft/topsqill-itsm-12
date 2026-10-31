import { evaluateExpression } from './sqlFunctions';

/**
 * Serialize field values properly for display in query results
 */
export function serializeFieldValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle arrays (like cross-reference field values)
  if (Array.isArray(value)) {
    // If it's an array of primitives, join with commas
    if (value.length === 0) return null;
    if (typeof value[0] === 'string' || typeof value[0] === 'number') {
      return value.join(', ');
    }
    
    // If it's an array of cross-reference objects, format them nicely
    if (typeof value[0] === 'object' && value[0] !== null) {
      const formatted = value.map(item => {
        // Create a new object with submission_ref_id and form_id first, remove id, and flatten displayData
        const result: any = {};
        
        // Add submission_ref_id first if it exists
        if (item.submission_ref_id) {
          result.submission_ref_id = item.submission_ref_id;
        }
        
        // Add form_id after submission_ref_id
        if (item.form_id) {
          result.form_id = item.form_id;
        }
        
        // Flatten displayData into the main object (field values)
        if (item.displayData && typeof item.displayData === 'object') {
          Object.assign(result, item.displayData);
        }
        
        // Add any other properties except 'id', 'displayData', 'submission_ref_id', and 'form_id'
        Object.keys(item).forEach(key => {
          if (key !== 'id' && key !== 'displayData' && key !== 'submission_ref_id' && key !== 'form_id') {
            result[key] = item[key];
          }
        });
        
        return result;
      });
      
      // Return as formatted JSON string
      return JSON.stringify(formatted, null, 2);
    }
    
    // Otherwise stringify the array
    return JSON.stringify(value);
  }
  
  // Handle objects (like structured data)
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  // Return primitive values as-is
  return value;
}

/**
 * Evaluate SELECT expression for a row with CASE WHEN support
 */
export function evaluateSelectExpression(expr: string, row: any, fieldMetadata?: Record<string, any>): any {
  // Handle WEIGHTED_VALUE with single field reference
  const weightedSingleMatch = expr.match(/WEIGHTED_VALUE\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)/i);
  if (weightedSingleMatch) {
    const fieldId = weightedSingleMatch[1];
    const fieldValue = row[fieldId] ?? 0;
    const weightage = fieldMetadata?.[fieldId]?.weightage || 1;
    
    console.log('=== WEIGHTED_VALUE Debug ===');
    console.log('Field ID:', fieldId);
    console.log('Field Value from row:', fieldValue);
    console.log('Field Metadata:', fieldMetadata?.[fieldId]);
    console.log('Weightage:', weightage);
    console.log('Calculation:', fieldValue, 'x', weightage, '=', (parseFloat(fieldValue) || 0) * weightage);
    console.log('Row keys:', Object.keys(row));
    
    return (parseFloat(fieldValue) || 0) * weightage;
  }
  
  // Handle FIELD_WEIGHTAGE function
  const weightageMatch = expr.match(/FIELD_WEIGHTAGE\s*\(\s*FIELD\s*\(\s*['""]([^'"\"]+)['"\"]\s*\)\s*\)/i);
  if (weightageMatch) {
    const fieldId = weightageMatch[1];
    const weightage = fieldMetadata?.[fieldId]?.weightage || 1;
    
    console.log('=== FIELD_WEIGHTAGE Debug ===');
    console.log('Field ID:', fieldId);
    console.log('Field Metadata:', fieldMetadata?.[fieldId]);
    console.log('Weightage:', weightage);
    
    return weightage;
  }
  
  // Handle CASE WHEN expressions
  const caseMatch = expr.match(/CASE\s+WHEN\s+(.+?)\s+THEN\s+(.+?)(?:\s+WHEN\s+(.+?)\s+THEN\s+(.+?))*(?:\s+ELSE\s+(.+?))?\s+END/i);
  if (caseMatch) {
    return evaluateCaseExpression(expr, row);
  }
  
  // Handle FIELD() references - support straight and curly quotes
  expr = expr.replace(/FIELD\s*\(\s*(['""''])([^'""'']+)(['""''])\s*\)/gi, (_, openQuote, fieldId) => {
    return `${fieldId}`;
  });
  
  // Handle system columns
  if (expr === 'submission_id') return row.submission_id;
  if (expr === 'submitted_by') return row.submitted_by;
  if (expr === 'submitted_at') return row.submitted_at;
  
  if (/^-?\d+(?:\.\d+)?$/.test(expr)) return Number(expr);

  // Check if it's a simple field reference
  if (/^[a-zA-Z0-9_-]+$/.test(expr)) {
    const value = row[expr] ?? null;
    return serializeFieldValue(value);
  }
  
  // Evaluate complex expressions with functions (pass fieldMetadata)
  try {
    return evaluateExpression(expr, row, fieldMetadata);
  } catch (e) {
    console.error('Expression evaluation error:', e);
    return null;
  }
}

/**
 * Evaluate CASE WHEN expressions
 */
export function evaluateCaseExpression(caseExpr: string, row: any): any {
  try {
    // Extract all WHEN ... THEN ... clauses
    const whenMatches = [...caseExpr.matchAll(/WHEN\s+(.+?)\s+THEN\s+(.+?)(?=\s+WHEN|\s+ELSE|\s+END)/gi)];
    
    for (const match of whenMatches) {
      const condition = match[1].trim();
      const value = match[2].trim();
      
      // Evaluate condition
      if (evaluateWhereCondition(condition, row)) {
        // Evaluate and return the value
        return evaluateSelectExpression(value, row);
      }
    }
    
    // Check for ELSE clause
    const elseMatch = caseExpr.match(/ELSE\s+(.+?)\s+END/i);
    if (elseMatch) {
      const elseValue = elseMatch[1].trim();
      return evaluateSelectExpression(elseValue, row);
    }
    
    return null;
  } catch (e) {
    console.error('CASE expression evaluation error:', e);
    return null;
  }
}

/**
 * Evaluate WHERE/HAVING condition with enhanced operator support
 */
export function evaluateWhereCondition(condition: string, row: any): boolean {
  // Replace FIELD() with actual values - support straight and curly quotes
  // Pattern supports: FIELD("uuid"), FIELD('uuid'), FIELD("uuid"), FIELD('uuid')
  let processedCondition = condition.replace(/FIELD\s*\(\s*(['""''])([^'""'']+)(['""''])\s*\)/gi, (match, openQuote, fieldId) => {
    const value = row[fieldId];
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    return String(value);
  });
  
  // Handle system columns
  processedCondition = processedCondition.replace(/\bsubmission_id\b/gi, () => {
    return `'${row.submission_id}'`;
  });
  processedCondition = processedCondition.replace(/\bsubmission_ref_id\b/gi, () => {
    return `'${row.submission_ref_id}'`;
  });
  
  try {
    // Handle IS NULL / IS NOT NULL
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IS\s+NOT\s+NULL/gi, (match, field) => {
      const cleanField = field.replace(/'/g, '');
      const value = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      return value !== null && value !== undefined ? 'true' : 'false';
    });
    
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IS\s+NULL/gi, (match, field) => {
      const cleanField = field.replace(/'/g, '');
      const value = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      return value === null || value === undefined ? 'true' : 'false';
    });
    
    // Handle IN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+IN\s*\(([^)]+)\)/gi, (match, field, list) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      const values = list.split(',').map((v: string) => {
        const trimmed = v.trim();
        return trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;
      });
      return values.includes(String(fieldValue)) ? 'true' : 'false';
    });
    
    // Handle NOT IN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+')\s+NOT\s+IN\s*\(([^)]+)\)/gi, (match, field, list) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = field.startsWith("'") ? field.slice(1, -1) : row[cleanField];
      const values = list.split(',').map((v: string) => {
        const trimmed = v.trim();
        return trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;
      });
      return !values.includes(String(fieldValue)) ? 'true' : 'false';
    });
    
    // Handle BETWEEN operator
    processedCondition = processedCondition.replace(/(\w+|'[^']+'|\d+)\s+BETWEEN\s+([^\s]+)\s+AND\s+([^\s]+)/gi, (match, field, min, max) => {
      const cleanField = field.replace(/'/g, '');
      const fieldValue = parseFloat(field.startsWith("'") ? field.slice(1, -1) : (row[cleanField] ?? field));
      const minVal = parseFloat(min.replace(/'/g, ''));
      const maxVal = parseFloat(max.replace(/'/g, ''));
      return (fieldValue >= minVal && fieldValue <= maxVal) ? 'true' : 'false';
    });
    
    // Handle LIKE operator
    processedCondition = processedCondition.replace(/([^\s]+)\s+LIKE\s+'([^']+)'/gi, (match, field, pattern) => {
      const fieldValue = String(row[field] ?? '');
      const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      return regex.test(fieldValue) ? 'true' : 'false';
    });
    
    // Handle NOT LIKE operator
    processedCondition = processedCondition.replace(/([^\s]+)\s+NOT\s+LIKE\s+'([^']+)'/gi, (match, field, pattern) => {
      const fieldValue = String(row[field] ?? '');
      const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      return !regex.test(fieldValue) ? 'true' : 'false';
    });
    
    // Handle NOT operator (before converting other operators)
    processedCondition = processedCondition.replace(/\bNOT\s+\(/gi, '!(');
    
    // Convert SQL operators to JavaScript
    processedCondition = processedCondition.replace(/\s+AND\s+/gi, ' && ');
    processedCondition = processedCondition.replace(/\s+OR\s+/gi, ' || ');
    processedCondition = processedCondition.replace(/\s*<>\s*/g, ' !== ');
    processedCondition = processedCondition.replace(/\s*!=\s*/g, ' !== ');
    processedCondition = processedCondition.replace(/\s*(?<![<>!=])=(?!=)\s*/g, ' === ');
    
    // Safely evaluate
    const result = new Function('return ' + processedCondition)();
    return result;
  } catch (e) {
    console.error('Condition evaluation error:', e, 'Condition:', processedCondition);
    return false;
  }
}

const FIELD_CALL = /FIELD\s*\(\s*(['""''])([^'""'']+)(['""''])\s*\)/gi;

function numericOrZero(value: unknown): number {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Top-level CASE ... END spans, skipping quoted text and nested CASE blocks. */
function topLevelCaseBlocks(expr: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let start = -1;
  let inQuote = false;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote || (i > 0 && /[\w"]/.test(expr[i - 1]))) continue;
    const keyword = /^(CASE|END)\b/i.exec(expr.slice(i))?.[1];
    if (!keyword) continue;
    if (keyword.toUpperCase() === 'CASE') {
      if (depth === 0) start = i;
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0) blocks.push({ start, end: i + keyword.length });
    }
    i += keyword.length - 1;
  }
  return blocks;
}

/**
 * Evaluates an UPDATE FORM value for one row.
 * A lone CASE keeps its own result type. CASE blocks joined with arithmetic, for example
 * CASE ... END + CASE ... END, are summed as numbers; blank or text results count as 0.
 */
export function evaluateUpdateFormula(expr: string, row: any): any {
  const trimmed = expr.trim();
  const blocks = topLevelCaseBlocks(trimmed);
  if (blocks.length === 1 && blocks[0].start === 0 && blocks[0].end === trimmed.length) {
    return evaluateCaseExpression(trimmed, row);
  }

  let reduced = '';
  let cursor = 0;
  for (const block of blocks) {
    reduced += trimmed.slice(cursor, block.start);
    reduced += String(numericOrZero(evaluateCaseExpression(trimmed.slice(block.start, block.end), row)));
    cursor = block.end;
  }
  reduced += trimmed.slice(cursor);
  reduced = reduced.replace(FIELD_CALL, (_match, _open, fieldId) => String(numericOrZero(row[fieldId])));
  return evaluateExpression(reduced, row);
}
