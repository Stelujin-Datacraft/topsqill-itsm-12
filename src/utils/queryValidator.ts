/**
 * Validation result for SQL queries
 */
export interface QueryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate SQL query syntax and structure
 */
export function validateQuery(query: string): QueryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!query || !query.trim()) {
    errors.push('Query cannot be empty');
    return { isValid: false, errors, warnings };
  }

  const trimmedQuery = query.trim().toUpperCase();

  // Check for dangerous operations (excluding INSERT and UPDATE which are now supported)
  const dangerousOperations = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE'];
  for (const op of dangerousOperations) {
    if (trimmedQuery.includes(op)) {
      errors.push(`Dangerous operation detected: ${op}. Only SELECT, INSERT, and UPDATE queries are allowed.`);
    }
  }

  // Must start with SELECT, INSERT, UPDATE, or WITH (for CTEs)
  if (!trimmedQuery.startsWith('SELECT') && 
      !trimmedQuery.startsWith('INSERT') && 
      !trimmedQuery.startsWith('UPDATE') &&
      !trimmedQuery.startsWith('WITH')) {
    errors.push('Query must start with SELECT, INSERT, UPDATE, or WITH (for CTEs)');
  }

  // If query starts with WITH, validate that it contains a valid main query after the CTE
  if (trimmedQuery.startsWith('WITH')) {
    const hasValidMainQuery = trimmedQuery.includes('SELECT') || 
                              trimmedQuery.includes('INSERT') || 
                              trimmedQuery.includes('UPDATE');
    if (!hasValidMainQuery) {
      errors.push('CTE (WITH clause) must be followed by a SELECT, INSERT, or UPDATE statement');
    }
  }

  // Check for basic SQL structure - only SELECT queries need FROM clause
  if (trimmedQuery.startsWith('SELECT') && !trimmedQuery.includes('FROM')) {
    errors.push('SELECT query must include FROM clause');
  }

  // Check for unclosed quotes
  const singleQuotes = (query.match(/'/g) || []).length;
  const doubleQuotes = (query.match(/"/g) || []).length;
  
  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote detected');
  }
  
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote detected');
  }

  // Check for unclosed parentheses
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    errors.push('Unclosed parenthesis detected');
  }

  // Warnings for performance - only for SELECT queries
  if (trimmedQuery.startsWith('SELECT')) {
    if (!trimmedQuery.includes('LIMIT')) {
      warnings.push('Consider adding LIMIT to improve performance');
    }

    if (trimmedQuery.includes('SELECT *')) {
      warnings.push('Consider selecting specific columns instead of using SELECT *');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate FIELD() and FORM() function usage
 */
export function validateFieldFunctions(query: string): QueryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check FIELD() usage
  const fieldMatches = query.match(/FIELD\s*\(\s*"[^"]+"\s*\)/gi);
  if (fieldMatches) {
    for (const match of fieldMatches) {
      const fieldId = match.match(/"([^"]+)"/)?.[1];
      if (!fieldId) {
        errors.push(`Invalid FIELD() syntax: ${match}`);
      }
    }
  }

  // Check FORM() usage
  const formMatches = query.match(/FORM\s*\(\s*"[^"]+"\s*\)/gi);
  if (formMatches) {
    for (const match of formMatches) {
      const formId = match.match(/"([^"]+)"/)?.[1];
      if (!formId) {
        errors.push(`Invalid FORM() syntax: ${match}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
