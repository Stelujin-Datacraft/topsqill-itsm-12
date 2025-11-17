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

  // Check for dangerous operations
  const dangerousOperations = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE'];
  for (const op of dangerousOperations) {
    if (trimmedQuery.includes(op)) {
      errors.push(`Dangerous operation detected: ${op}. Only SELECT queries are allowed.`);
    }
  }

  // Must start with SELECT
  if (!trimmedQuery.startsWith('SELECT')) {
    errors.push('Query must start with SELECT');
  }

  // Check for basic SQL structure
  if (!trimmedQuery.includes('FROM')) {
    errors.push('Query must include FROM clause');
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

  // Warnings for performance
  if (!trimmedQuery.includes('LIMIT')) {
    warnings.push('Consider adding LIMIT to improve performance');
  }

  if (trimmedQuery.includes('SELECT *')) {
    warnings.push('Consider selecting specific columns instead of using SELECT *');
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
