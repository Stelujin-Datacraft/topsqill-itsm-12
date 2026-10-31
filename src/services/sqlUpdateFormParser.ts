import type { ParseResult } from './sqlParser';

/**
 * Parse custom UPDATE FORM syntax with arithmetic and CASE WHEN support
 * Expected format: UPDATE FORM 'form_id' SET FIELD('field_id') = value WHERE submission_id = 'submission_id'
 * 
 * Supported value syntaxes:
 * 1. FIELD("source-field-id") - Copy value from another field
 * 2. VALUE_OF("source-field-id") - Alternative syntax for copying field value  
 * 3. 'static text' - Set a static text value
 * 4. FIELD("field-id") + 10 - Arithmetic with field values
 * 5. UPPER(FIELD("field-id")) - Functions applied to field values
 * 6. CASE WHEN ... - Conditional logic
 */
export function parseUpdateFormQuery(input: string): ParseResult {
  const errors: string[] = []

  console.log('📝 UPDATE Parser - Input query:', input);

  // Parse the UPDATE FORM syntax with flexible WHERE clause
  // Supports both: WHERE submission_ref_id = 'id' and WHERE FIELD('field_id') operator 'value'
  // Also supports subqueries with multiple lines and boolean literals (TRUE/FALSE)
  // Strategy: Find the LAST WHERE that's not inside parentheses using iterative search (avoids regex backtracking)
  
  // First, extract form ID and field ID with a simple non-greedy pattern
  const headerMatch = input.match(
    /^UPDATE\s+FORM\s+['""]([0-9a-fA-F\-]{36})['"\"]\s+SET\s+FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*=\s*/im
  );
  
  if (!headerMatch) {
    errors.push('Invalid UPDATE FORM syntax. Expected: UPDATE FORM \'form_id\' SET FIELD(\'field_id\') = value WHERE condition');
    return { errors };
  }
  
  // Find the last WHERE outside of parentheses
  const afterHeader = input.substring(headerMatch[0].length);
  let lastWhereIndex = -1;
  let parenDepth = 0;
  
  for (let i = 0; i < afterHeader.length - 5; i++) {
    if (afterHeader[i] === '(') parenDepth++;
    else if (afterHeader[i] === ')') parenDepth--;
    else if (parenDepth === 0 && afterHeader.substring(i, i + 6).toUpperCase() === 'WHERE ') {
      lastWhereIndex = i;
    }
  }
  
  if (lastWhereIndex === -1) {
    errors.push('Invalid UPDATE FORM syntax. Missing WHERE clause.');
    return { errors };
  }
  
  const valueExpression = afterHeader.substring(0, lastWhereIndex).trim();
  const whereClause = afterHeader.substring(lastWhereIndex + 6).replace(/[\s;]*$/, '').trim();
  
  // Validate WHERE clause format
  const whereValid = /^(?:submission_id|submission_ref_id)\s*(?:=|!=)\s*['"]?[^'";\s]+['"]?$|^TRUE$|^FALSE$/i.test(whereClause);
  if (!whereValid) {
    errors.push('Invalid WHERE clause. Expected: submission_id = value, submission_ref_id = value, TRUE, or FALSE');
    return { errors };
  }
  
  const formId = headerMatch[1];
  const fieldId = headerMatch[2];

  console.log('📝 UPDATE Parser - Parsed components:');
  console.log('  - Form ID:', formId);
  console.log('  - Target Field ID:', fieldId);
  console.log('  - Value Expression (raw):', valueExpression);
  console.log('  - Where Clause:', whereClause);

  // Transform value expression to handle FIELD() syntax, functions, arithmetic, CASE WHEN, and SUBQUERIES
  let transformedValue = valueExpression.trim()
  
  console.log('🔍 UPDATE Parser - Processing value expression:', transformedValue);
  console.log('🔍 UPDATE Parser - Value length:', transformedValue.length);
  console.log('🔍 UPDATE Parser - Value char codes:', [...transformedValue.slice(0, 20)].map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
  
  // Check for subquery (SELECT statement wrapped in parentheses)
  const hasSubquery = /^\s*\(\s*SELECT\s+/i.test(transformedValue);
  
  // Check for CASE WHEN expressions
  const hasCaseWhen = /CASE\s+WHEN/i.test(transformedValue);
  
  // Check for arithmetic expressions (e.g., FIELD('id') + 1, value * 2)
  // Use operators surrounded by whitespace to avoid matching hyphens inside UUIDs
  const hasArithmetic = /\s[+\-*\/]\s/.test(transformedValue) && !/\s+AND\s+|\s+OR\s+/i.test(transformedValue);

  // Store function metadata for UPDATE query execution
  const functionPattern = /^(UPPER|LOWER|CONCAT|REPLACE|TRIM|LTRIM|RTRIM|ROUND|CEIL|FLOOR|ABS|COALESCE|NOW|CURRENT_TIMESTAMP|IF|LEFT|RIGHT|SUBSTRING|IFNULL|CASE)\s*\(/i;
  const hasFunction = functionPattern.test(transformedValue);
  
  console.log('🔍 UPDATE Parser - Expression analysis:');
  console.log('  - Has Subquery:', hasSubquery);
  console.log('  - Has CASE WHEN:', hasCaseWhen);
  console.log('  - Has Arithmetic:', hasArithmetic);
  console.log('  - Has Function:', hasFunction);
  
  if (hasSubquery) {
    // Store the subquery for later execution
    transformedValue = `SUBQUERY::${transformedValue}`;
    console.log('✅ UPDATE Parser - Storing as SUBQUERY for runtime evaluation:', transformedValue);
  } else if (hasCaseWhen || hasFunction || hasArithmetic) {
    // Store the original expression with FIELD() references for later evaluation
    transformedValue = `FUNC::${transformedValue}`;
    console.log('✅ UPDATE Parser - Storing as FUNC for runtime evaluation:', transformedValue);
  } else {
    // Handle FIELD() or VALUE_OF() references for simple assignments
    console.log('🔍 UPDATE Parser - Looking for FIELD() or VALUE_OF() references');
    console.log('  - Original value:', transformedValue);
    
    // Permissive pattern to match VALUE_OF() or FIELD() with any quote type (including curly quotes)
    // Matches: VALUE_OF("uuid"), VALUE_OF('uuid'), FIELD("uuid"), FIELD('uuid'), and curly quote variants
    const fieldRefPattern = /(?:VALUE_OF|FIELD)\s*\(\s*['"""]([0-9a-fA-F-]{36})['"""\s]*\)/gi;
    
    const testMatch = transformedValue.match(fieldRefPattern);
    console.log('  - Pattern test result:', testMatch);
    
    if (testMatch && testMatch.length > 0) {
      console.log('✅ Found field reference patterns:', testMatch);
      
      // Replace VALUE_OF() or FIELD() with FIELD_REF:: prefix
      transformedValue = transformedValue.replace(
        fieldRefPattern,
        (fullMatch, uuid) => {
          console.log('  - Replacing:', fullMatch, '-> FIELD_REF::' + uuid);
          return `FIELD_REF::${uuid}`;
        }
      );
      
      console.log('✅ Transformed value:', transformedValue);
    } else {
      console.log('ℹ️ No field references found - treating as static value');
      console.log('  - To copy a field value, use: VALUE_OF("field-id") or FIELD("field-id")');
    }
  }

  // Parse WHERE clause
  let sqlWhereClause = ''
  
  // Check for boolean literals (true, false, 1, 0)
  const trimmedWhere = whereClause.trim();
  if (/^(true|false|1|0)$/i.test(trimmedWhere)) {
    const boolValue = trimmedWhere.toLowerCase();
    if (boolValue === 'true' || boolValue === '1') {
      sqlWhereClause = 'TRUE';  // Match all records
    } else {
      sqlWhereClause = 'FALSE';  // Match no records
    }
  } else if (whereClause.match(/(submission_id|submission_ref_id)\s*(=|!=)\s*['""]?([^'"\s]+)['""]?/i)) {
    // Check if it's a submission_id or submission_ref_id condition
    const submissionIdMatch = whereClause.match(/(submission_id|submission_ref_id)\s*(=|!=)\s*['""]?([^'"\s]+)['""]?/i)
    const operator = submissionIdMatch[2]
    const submissionId = submissionIdMatch[3]
    sqlWhereClause = `submission_ref_id ${operator} '${submissionId}'`
  } else {
    // Parse FIELD() condition
    const fieldConditionMatch = whereClause.match(
      /FIELD\(\s*['""]([0-9a-fA-F\-]{36})['"\"]\s*\)\s*(=|!=|>|<|>=|<=|LIKE|ILIKE)\s*['""]?([^'"]+?)['""]?$/i
    )
    
    if (fieldConditionMatch) {
      const conditionFieldId = fieldConditionMatch[1]
      const operator = fieldConditionMatch[2].toUpperCase()
      const conditionValue = fieldConditionMatch[3].trim()
      
      // Build SQL condition based on operator
      if (operator === 'LIKE' || operator === 'ILIKE') {
        sqlWhereClause = `submission_data ->> '${conditionFieldId}' ${operator} '${conditionValue}'`
      } else if (operator === '>' || operator === '<' || operator === '>=' || operator === '<=') {
        sqlWhereClause = `(submission_data ->> '${conditionFieldId}')::numeric ${operator} ${conditionValue}`
      } else {
      sqlWhereClause = `submission_data ->> '${conditionFieldId}' ${operator} '${conditionValue}'`
      }
    } else {
      errors.push('Invalid WHERE clause. Use: WHERE true OR WHERE submission_id/submission_ref_id = \'id\' OR WHERE FIELD(\'field_id\') operator \'value\'')
      return { errors }
    }
  }

  // Build the final SQL - store metadata for batch update using unique delimiter
  const sql = `UPDATE||BATCH||${formId}||${fieldId}||${transformedValue}||${sqlWhereClause}`

  return { sql, errors }
}
