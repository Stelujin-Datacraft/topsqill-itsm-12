/**
 * Utility functions for filtering and searching across all field types
 */

/**
 * Extract a comparable string value from any field type
 */
export const extractComparableValue = (value: any, fieldType?: string): string => {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle arrays (multi-select, tags, checkbox groups)
  if (Array.isArray(value)) {
    return value.map(v => extractComparableValue(v, fieldType)).join(', ');
  }

  // Handle objects
  if (typeof value === 'object') {
    // Address field
    if ('street' in value || 'city' in value || 'state' in value || 'country' in value || 'zipCode' in value || 'postalCode' in value) {
      return [
        value.street,
        value.street2,
        value.city,
        value.state,
        value.country,
        value.zipCode || value.postalCode
      ].filter(Boolean).join(', ');
    }

    // Currency field (e.g., { amount: 100, code: "USD" } or { value: 100, currency: "USD" })
    if ('amount' in value || ('value' in value && 'currency' in value)) {
      const amount = value.amount ?? value.value ?? '';
      const code = value.code ?? value.currency ?? '';
      return code ? `${code} ${amount}` : String(amount);
    }

    // Submission-access field
    if ('users' in value || 'groups' in value) {
      const users = Array.isArray(value.users) ? value.users.join(', ') : '';
      const groups = Array.isArray(value.groups) ? value.groups.join(', ') : '';
      return [users, groups].filter(Boolean).join('; ');
    }

    // Phone field (e.g., { countryCode: "+1", number: "1234567890" })
    if ('countryCode' in value || 'number' in value) {
      return `${value.countryCode || ''} ${value.number || ''}`.trim();
    }

    // Name field (e.g., { firstName, lastName })
    if ('firstName' in value || 'lastName' in value) {
      return `${value.firstName || ''} ${value.lastName || ''}`.trim();
    }

    // Status field
    if ('status' in value) {
      return String(value.status);
    }

    // Date range (e.g., { start, end })
    if ('start' in value || 'end' in value) {
      return `${value.start || ''} - ${value.end || ''}`;
    }

    // Generic object - try to stringify meaningful content
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  // Handle currency string format (e.g., "USD:100")
  if (typeof value === 'string' && /^[A-Z]{3}:[0-9.]+$/.test(value)) {
    const [code, amount] = value.split(':');
    return `${code} ${amount}`;
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
};

/**
 * Extract numeric value from any field for numeric comparisons
 */
export const extractNumericValue = (value: any): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Currency object
  if (typeof value === 'object' && ('amount' in value || 'value' in value)) {
    const numValue = Number(value.amount ?? value.value);
    return isNaN(numValue) ? null : numValue;
  }

  // Currency string (e.g., "USD:100")
  if (typeof value === 'string' && /^[A-Z]{3}:[0-9.]+$/.test(value)) {
    const [, amount] = value.split(':');
    const numValue = Number(amount);
    return isNaN(numValue) ? null : numValue;
  }

  // Rating/slider
  if (typeof value === 'string') {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? null : numValue;
  }

  return null;
};

/**
 * Check if a value contains a search term (handles all field types)
 */
export const valueContainsSearch = (value: any, searchTerm: string, fieldType?: string): boolean => {
  const comparableValue = extractComparableValue(value, fieldType).toLowerCase();
  return comparableValue.includes(searchTerm.toLowerCase());
};

/**
 * Check if a value equals a filter value (handles all field types)
 */
export const valueEquals = (value: any, filterValue: string, fieldType?: string): boolean => {
  if (value === null || value === undefined) {
    return filterValue === '' || filterValue.toLowerCase() === 'null' || filterValue.toLowerCase() === 'undefined';
  }

  // Handle arrays - check if filter value is in array
  if (Array.isArray(value)) {
    const normalizedFilter = filterValue.toLowerCase();
    return value.some(v => extractComparableValue(v, fieldType).toLowerCase() === normalizedFilter);
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    const boolFilter = filterValue.toLowerCase();
    return (value && (boolFilter === 'true' || boolFilter === 'yes' || boolFilter === 'on' || boolFilter === 'checked')) ||
           (!value && (boolFilter === 'false' || boolFilter === 'no' || boolFilter === 'off' || boolFilter === 'unchecked'));
  }

  const comparableValue = extractComparableValue(value, fieldType).toLowerCase();
  return comparableValue === filterValue.toLowerCase();
};

/**
 * Evaluate a filter condition against a value
 */
export const evaluateFilterCondition = (
  value: any,
  operator: string,
  filterValue: string,
  fieldType?: string
): boolean => {
  const comparableValue = extractComparableValue(value, fieldType).toLowerCase();
  const normalizedFilterValue = filterValue.toLowerCase();

  switch (operator) {
    case 'equals':
      return valueEquals(value, filterValue, fieldType);
    
    case 'not_equals':
      return !valueEquals(value, filterValue, fieldType);
    
    case 'contains':
      // For arrays, check if any element contains the filter value
      if (Array.isArray(value)) {
        return value.some(v => extractComparableValue(v, fieldType).toLowerCase().includes(normalizedFilterValue));
      }
      return comparableValue.includes(normalizedFilterValue);
    
    case 'not_contains':
      if (Array.isArray(value)) {
        return !value.some(v => extractComparableValue(v, fieldType).toLowerCase().includes(normalizedFilterValue));
      }
      return !comparableValue.includes(normalizedFilterValue);
    
    case 'starts_with':
      return comparableValue.startsWith(normalizedFilterValue);
    
    case 'ends_with':
      return comparableValue.endsWith(normalizedFilterValue);
    
    case 'greater_than': {
      const numValue = extractNumericValue(value);
      const numFilter = parseFloat(filterValue);
      if (numValue === null || isNaN(numFilter)) return false;
      return numValue > numFilter;
    }
    
    case 'less_than': {
      const numValue = extractNumericValue(value);
      const numFilter = parseFloat(filterValue);
      if (numValue === null || isNaN(numFilter)) return false;
      return numValue < numFilter;
    }
    
    case 'greater_equal': {
      const numValue = extractNumericValue(value);
      const numFilter = parseFloat(filterValue);
      if (numValue === null || isNaN(numFilter)) return false;
      return numValue >= numFilter;
    }
    
    case 'less_equal': {
      const numValue = extractNumericValue(value);
      const numFilter = parseFloat(filterValue);
      if (numValue === null || isNaN(numFilter)) return false;
      return numValue <= numFilter;
    }
    
    case 'is_empty':
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return comparableValue === '' || comparableValue === 'n/a';
    
    case 'is_not_empty':
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return comparableValue !== '' && comparableValue !== 'n/a';
    
    case 'in': {
      // Check if value is in a comma-separated list
      const listValues = filterValue.split(',').map(v => v.trim().toLowerCase());
      if (Array.isArray(value)) {
        return value.some(v => listValues.includes(extractComparableValue(v, fieldType).toLowerCase()));
      }
      return listValues.includes(comparableValue);
    }
    
    case 'not_in': {
      const listValues = filterValue.split(',').map(v => v.trim().toLowerCase());
      if (Array.isArray(value)) {
        return !value.some(v => listValues.includes(extractComparableValue(v, fieldType).toLowerCase()));
      }
      return !listValues.includes(comparableValue);
    }
    
    case 'after': {
      // Date comparison
      const dateValue = new Date(value);
      const filterDate = new Date(filterValue);
      if (isNaN(dateValue.getTime()) || isNaN(filterDate.getTime())) return false;
      return dateValue > filterDate;
    }
    
    case 'before': {
      const dateValue = new Date(value);
      const filterDate = new Date(filterValue);
      if (isNaN(dateValue.getTime()) || isNaN(filterDate.getTime())) return false;
      return dateValue < filterDate;
    }
    
    case 'between': {
      // Expects filterValue in format "start,end"
      const [start, end] = filterValue.split(',').map(v => v.trim());
      const numValue = extractNumericValue(value);
      if (numValue !== null) {
        const numStart = parseFloat(start);
        const numEnd = parseFloat(end);
        if (!isNaN(numStart) && !isNaN(numEnd)) {
          return numValue >= numStart && numValue <= numEnd;
        }
      }
      // Try date comparison
      const dateValue = new Date(value);
      const dateStart = new Date(start);
      const dateEnd = new Date(end);
      if (!isNaN(dateValue.getTime()) && !isNaN(dateStart.getTime()) && !isNaN(dateEnd.getTime())) {
        return dateValue >= dateStart && dateValue <= dateEnd;
      }
      return false;
    }
    
    default:
      return true;
  }
};

/**
 * Check if a row passes search criteria (searches across all fields)
 */
export const rowPassesSearch = (
  row: any,
  searchTerm: string,
  fieldTypes?: Record<string, string>
): boolean => {
  if (!searchTerm) return true;
  
  const submissionData = row.submission_data || row;
  const normalizedSearch = searchTerm.toLowerCase();

  // Check all fields in submission data
  for (const [fieldId, value] of Object.entries(submissionData)) {
    const fieldType = fieldTypes?.[fieldId];
    if (valueContainsSearch(value, normalizedSearch, fieldType)) {
      return true;
    }
  }

  // Also check metadata fields
  const metadataFields = ['id', 'submitted_at', 'submitted_by', 'submission_ref_id'];
  for (const field of metadataFields) {
    if (row[field] && String(row[field]).toLowerCase().includes(normalizedSearch)) {
      return true;
    }
  }

  return false;
};
