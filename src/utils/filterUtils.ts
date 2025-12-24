/**
 * Utility functions for filtering and searching across all field types
 */

import { ExpressionEvaluator, EvaluationContext } from './expressionEvaluator';

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

// Country list for mapping codes to names
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' }, { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' }, { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' }, { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' }, { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' }, { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' }, { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' }, { code: 'CD', name: 'Congo, Democratic Republic' },
  { code: 'CR', name: 'Costa Rica' }, { code: 'CI', name: "Côte d'Ivoire" }, { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' }, { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' }, { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' }, { code: 'KP', name: 'North Korea' }, { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macao' },
  { code: 'MK', name: 'North Macedonia' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' }, { code: 'MH', name: 'Marshall Islands' }, { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' }, { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' }, { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' }, { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine' }, { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' }, { code: 'RW', name: 'Rwanda' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' }, { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' }, { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' }, { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'SS', name: 'South Sudan' }, { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' }, { code: 'SR', name: 'Suriname' },
  { code: 'SZ', name: 'Eswatini' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' }, { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' }, { code: 'ZW', name: 'Zimbabwe' },
];

/**
 * Helper to parse options from various formats
 */
const parseFieldOptions = (options: any): Array<{ value: string; label: string }> => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Get option label from value for select/dropdown/radio fields
 */
const getOptionLabel = (value: string, options: any): string => {
  const parsedOptions = parseFieldOptions(options);
  const option = parsedOptions.find((opt: any) => opt.value === value);
  return option?.label || value;
};

/**
 * Extract a comparable string value from any field type
 * Now accepts optional field configuration for proper label resolution
 */
export const extractComparableValue = (value: any, fieldType?: string, fieldConfig?: any): string => {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle country field - include both code and full name
  if (fieldType === 'country' && typeof value === 'string') {
    const country = COUNTRIES.find(c => c.code === value);
    if (country) {
      return `${country.code} ${country.name}`;
    }
    return value;
  }

  // Handle select/dropdown/radio fields - include both value and label
  if (['select', 'dropdown', 'radio'].includes(fieldType || '') && typeof value === 'string' && fieldConfig?.options) {
    const label = getOptionLabel(value, fieldConfig.options);
    // Return both value and label so search finds either
    return label !== value ? `${value} ${label}` : value;
  }

  // Handle arrays (multi-select, tags, checkbox groups)
  if (Array.isArray(value)) {
    // For multi-select, map values to labels
    if (['multi-select', 'checkbox'].includes(fieldType || '') && fieldConfig?.options) {
      return value.map(v => {
        const label = getOptionLabel(String(v), fieldConfig.options);
        return label !== String(v) ? `${v} ${label}` : String(v);
      }).join(', ');
    }
    return value.map(v => extractComparableValue(v, fieldType, fieldConfig)).join(', ');
  }

  // Handle objects
  if (typeof value === 'object') {
    // Address field
    if ('street' in value || 'city' in value || 'state' in value || 'country' in value || 'zipCode' in value || 'postalCode' in value || 'postal' in value) {
      const countryValue = value.country;
      const country = countryValue ? COUNTRIES.find(c => c.code === countryValue) : null;
      return [
        value.street,
        value.street2,
        value.city,
        value.state,
        country ? country.name : countryValue,
        value.zipCode || value.postalCode || value.postal
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
    if ('countryCode' in value || 'number' in value || 'phoneNumber' in value || 'code' in value) {
      const code = value.countryCode || value.dialCode || value.code || '';
      const number = value.number || value.phoneNumber || '';
      return `${code} ${number}`.trim();
    }

    // Name field (e.g., { firstName, lastName, middleName, prefix, suffix })
    if ('firstName' in value || 'lastName' in value) {
      return [value.prefix, value.firstName, value.middleName, value.lastName, value.suffix].filter(Boolean).join(' ');
    }

    // Status field
    if ('status' in value && typeof value.status === 'string') {
      return String(value.status);
    }

    // Date range (e.g., { start, end } or { from, to })
    if ('start' in value || 'end' in value || 'from' in value || 'to' in value) {
      const start = value.start || value.from || '';
      const end = value.end || value.to || '';
      return `${start} - ${end}`;
    }

    // File upload field (e.g., { name, url, size })
    if ('url' in value || ('name' in value && 'size' in value)) {
      return value.name || value.url || '[File]';
    }

    // Rating object (e.g., { value: 4, max: 5 })
    if ('value' in value && 'max' in value) {
      return `${value.value}/${value.max}`;
    }

    // Slider object (e.g., { value: 50, min: 0, max: 100 })
    if ('value' in value && ('min' in value || 'max' in value)) {
      return String(value.value);
    }

    // Time field object (e.g., { hours, minutes, period })
    if ('hours' in value || 'minutes' in value) {
      const hours = value.hours || '00';
      const minutes = value.minutes || '00';
      const period = value.period || '';
      return `${hours}:${minutes}${period ? ' ' + period : ''}`;
    }

    // Signature field (skip - contains base64 data)
    if ('dataUrl' in value || 'signature' in value) {
      return '[Signature]';
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

  // Handle phone string format (e.g., "+1 1234567890")
  if (fieldType === 'phone' || fieldType === 'phone-number') {
    return String(value);
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value ? 'Yes True' : 'No False';
  }

  // Handle dates
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'date-time') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString() + (fieldType !== 'date' ? ' ' + date.toLocaleTimeString() : '');
    }
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
export const valueContainsSearch = (value: any, searchTerm: string, fieldType?: string, fieldConfig?: any): boolean => {
  const comparableValue = extractComparableValue(value, fieldType, fieldConfig).toLowerCase();
  return comparableValue.includes(searchTerm.toLowerCase());
};

/**
 * Check if a value equals a filter value (handles all field types)
 */
export const valueEquals = (value: any, filterValue: string, fieldType?: string, fieldConfig?: any): boolean => {
  if (value === null || value === undefined) {
    return filterValue === '' || filterValue.toLowerCase() === 'null' || filterValue.toLowerCase() === 'undefined';
  }

  // Handle submission-access objects {users: [...], groups: [...]}
  if (typeof value === 'object' && !Array.isArray(value) && ('users' in value || 'groups' in value)) {
    const filterValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    if (filterValues.length === 0) return false;
    
    // Combine users and groups into a single array for comparison
    const allIds: string[] = [];
    if (Array.isArray(value.users)) allIds.push(...value.users.map((u: string) => u.toLowerCase()));
    if (Array.isArray(value.groups)) allIds.push(...value.groups.map((g: string) => g.toLowerCase()));
    
    // Check if any filter value matches any user/group ID
    return filterValues.some(fv => allIds.includes(fv));
  }

  // Handle arrays (multiselect, etc.) - check if ANY filter value matches ANY value in the array
  if (Array.isArray(value)) {
    // Split filter value by comma to support multiple selected filter values
    const filterValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    
    // If no filter values, no match
    if (filterValues.length === 0) return false;
    
    // Check if any value in the data array matches any of the filter values
    return value.some(v => {
      const normalizedValue = extractComparableValue(v, fieldType, fieldConfig).toLowerCase();
      return filterValues.some(fv => normalizedValue === fv);
    });
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    const boolFilter = filterValue.toLowerCase();
    return (value && (boolFilter === 'true' || boolFilter === 'yes' || boolFilter === 'on' || boolFilter === 'checked')) ||
           (!value && (boolFilter === 'false' || boolFilter === 'no' || boolFilter === 'off' || boolFilter === 'unchecked'));
  }

  // For non-array values, also check if filterValue is comma-separated and match any
  const filterValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const comparableValue = extractComparableValue(value, fieldType, fieldConfig).toLowerCase();
  
  // If single filter value, do exact match; if multiple, check if value matches any
  if (filterValues.length === 1) {
    return comparableValue === filterValues[0];
  }
  return filterValues.includes(comparableValue);
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
    case 'equals': {
      // For currency and numeric fields, use numeric comparison for equals
      if (fieldType === 'currency' || fieldType === 'number' || fieldType === 'rating' || fieldType === 'slider') {
        const numValue = extractNumericValue(value);
        const numFilter = parseFloat(filterValue);
        if (numValue !== null && !isNaN(numFilter)) {
          return numValue === numFilter;
        }
      }
      return valueEquals(value, filterValue, fieldType);
    }
    
    case 'not_equals': {
      // For currency and numeric fields, use numeric comparison for not equals
      if (fieldType === 'currency' || fieldType === 'number' || fieldType === 'rating' || fieldType === 'slider') {
        const numValue = extractNumericValue(value);
        const numFilter = parseFloat(filterValue);
        if (numValue !== null && !isNaN(numFilter)) {
          return numValue !== numFilter;
        }
      }
      return !valueEquals(value, filterValue, fieldType);
    }
    
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
      const listValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
      
      // Handle submission-access objects {users: [...], groups: [...]}
      if (typeof value === 'object' && !Array.isArray(value) && ('users' in value || 'groups' in value)) {
        const allIds: string[] = [];
        if (Array.isArray(value.users)) allIds.push(...value.users.map((u: string) => u.toLowerCase()));
        if (Array.isArray(value.groups)) allIds.push(...value.groups.map((g: string) => g.toLowerCase()));
        return listValues.some(fv => allIds.includes(fv));
      }
      
      if (Array.isArray(value)) {
        return value.some(v => listValues.includes(extractComparableValue(v, fieldType).toLowerCase()));
      }
      return listValues.includes(comparableValue);
    }
    
    case 'not_in': {
      const listValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
      
      // Handle submission-access objects {users: [...], groups: [...]}
      if (typeof value === 'object' && !Array.isArray(value) && ('users' in value || 'groups' in value)) {
        const allIds: string[] = [];
        if (Array.isArray(value.users)) allIds.push(...value.users.map((u: string) => u.toLowerCase()));
        if (Array.isArray(value.groups)) allIds.push(...value.groups.map((g: string) => g.toLowerCase()));
        return !listValues.some(fv => allIds.includes(fv));
      }
      
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
      
      // Try numeric comparison first
      const numValue = extractNumericValue(value);
      if (numValue !== null) {
        const numStart = parseFloat(start);
        const numEnd = parseFloat(end);
        if (!isNaN(numStart) && !isNaN(numEnd)) {
          return numValue >= numStart && numValue <= numEnd;
        }
      }
      
      // Try time comparison (format HH:MM or HH:MM:SS)
      const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
      if (timePattern.test(String(value)) && timePattern.test(start) && timePattern.test(end)) {
        const normalizeTime = (t: string) => {
          const parts = t.split(':').map(p => p.padStart(2, '0'));
          return parts.join(':');
        };
        const timeValue = normalizeTime(String(value));
        const timeStart = normalizeTime(start);
        const timeEnd = normalizeTime(end);
        return timeValue >= timeStart && timeValue <= timeEnd;
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
    
    case 'last_days': {
      // filterValue is the number of days
      const days = parseInt(filterValue, 10);
      if (isNaN(days) || days <= 0) return false;
      
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      
      return dateValue >= startDate && dateValue <= now;
    }
    
    case 'next_days': {
      // filterValue is the number of days
      const days = parseInt(filterValue, 10);
      if (isNaN(days) || days <= 0) return false;
      
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + days);
      endDate.setHours(23, 59, 59, 999);
      
      return dateValue >= now && dateValue <= endDate;
    }
    
    case 'current_day': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      return dateValue >= startOfDay && dateValue <= endOfDay;
    }
    
    case 'last_day': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      
      return dateValue >= startOfDay && dateValue <= endOfDay;
    }
    
    case 'current_month': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      return dateValue >= startOfMonth && dateValue <= endOfMonth;
    }
    
    case 'last_month': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      return dateValue >= startOfLastMonth && dateValue <= endOfLastMonth;
    }
    
    case 'current_year': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      return dateValue >= startOfYear && dateValue <= endOfYear;
    }
    
    case 'last_year': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      
      return dateValue >= startOfLastYear && dateValue <= endOfLastYear;
    }
    
    case 'current_quarter': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
      const endOfQuarter = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999);
      
      return dateValue >= startOfQuarter && dateValue <= endOfQuarter;
    }
    
    case 'last_quarter': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      let lastQuarterStart: Date;
      let lastQuarterEnd: Date;
      
      if (currentQuarter === 0) {
        // If current quarter is Q1, last quarter is Q4 of previous year
        lastQuarterStart = new Date(now.getFullYear() - 1, 9, 1, 0, 0, 0, 0);
        lastQuarterEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      } else {
        lastQuarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1, 0, 0, 0, 0);
        lastQuarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 0, 23, 59, 59, 999);
      }
      
      return dateValue >= lastQuarterStart && dateValue <= lastQuarterEnd;
    }
    
    case 'next_quarter': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) return false;
      
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      let nextQuarterStart: Date;
      let nextQuarterEnd: Date;
      
      if (currentQuarter === 3) {
        // If current quarter is Q4, next quarter is Q1 of next year
        nextQuarterStart = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
        nextQuarterEnd = new Date(now.getFullYear() + 1, 2, 31, 23, 59, 59, 999);
      } else {
        nextQuarterStart = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1, 0, 0, 0, 0);
        nextQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 2) * 3, 0, 23, 59, 59, 999);
      }
      
      return dateValue >= nextQuarterStart && dateValue <= nextQuarterEnd;
    }
    
    default:
      return true;
  }
};

/**
 * Check if a row passes search criteria (searches across all fields)
 * Now accepts field configurations for proper option label resolution
 */
export const rowPassesSearch = (
  row: any,
  searchTerm: string,
  fieldTypes?: Record<string, string>,
  fieldConfigs?: Record<string, any>
): boolean => {
  if (!searchTerm) return true;
  
  const submissionData = row.submission_data || row;
  const normalizedSearch = searchTerm.toLowerCase();

  // Check all fields in submission data
  for (const [fieldId, value] of Object.entries(submissionData)) {
    const fieldType = fieldTypes?.[fieldId];
    const fieldConfig = fieldConfigs?.[fieldId];
    if (valueContainsSearchWithConfig(value, normalizedSearch, fieldType, fieldConfig)) {
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

/**
 * Check if a value contains search term with field config support
 */
export const valueContainsSearchWithConfig = (
  value: any, 
  searchTerm: string, 
  fieldType?: string,
  fieldConfig?: any
): boolean => {
  const comparableValue = extractComparableValue(value, fieldType, fieldConfig).toLowerCase();
  return comparableValue.includes(searchTerm.toLowerCase());
};

/**
 * Evaluate filters with optional expression-based logic
 * @param row - The data row to evaluate
 * @param filters - Array of filter conditions
 * @param useManualLogic - Whether to use manual expression logic
 * @param logicExpression - The logical expression (e.g., "(1 AND 2) OR 3")
 * @param getFieldValue - Function to extract field value from row
 * @param fieldTypes - Optional map of field IDs to field types
 */
export const evaluateFiltersWithExpression = (
  row: any,
  filters: FilterCondition[],
  useManualLogic: boolean,
  logicExpression: string,
  getFieldValue: (row: any, fieldId: string) => any,
  fieldTypes?: Record<string, string>
): boolean => {
  if (filters.length === 0) return true;

  // Evaluate each filter condition individually
  const conditionResults: EvaluationContext = {};
  filters.forEach((filter, index) => {
    const value = getFieldValue(row, filter.field);
    const fieldType = fieldTypes?.[filter.field] || '';
    const result = evaluateFilterCondition(value, filter.operator, filter.value, fieldType);
    conditionResults[String(index + 1)] = result;
  });

  // If using manual expression logic, evaluate the expression
  if (useManualLogic && logicExpression && logicExpression.trim()) {
    try {
      return ExpressionEvaluator.evaluate(logicExpression, conditionResults);
    } catch (error) {
      console.warn('Failed to evaluate filter expression, falling back to AND logic:', error);
      // Fall back to AND logic on error
      return Object.values(conditionResults).every(Boolean);
    }
  }

  // Default: AND logic
  return Object.values(conditionResults).every(Boolean);
};

/**
 * Simplified filter evaluation for submission data
 */
export const evaluateSubmissionFilters = (
  submissionData: any,
  filters: FilterCondition[],
  useManualLogic: boolean = false,
  logicExpression: string = '',
  fieldTypes?: Record<string, string>
): boolean => {
  return evaluateFiltersWithExpression(
    submissionData,
    filters,
    useManualLogic,
    logicExpression,
    (row, fieldId) => row[fieldId],
    fieldTypes
  );
};
