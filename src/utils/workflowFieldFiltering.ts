/**
 * Centralized utility for workflow field type filtering and compatibility
 * 
 * This module provides:
 * 1. Static/layout field filtering - removes non-data fields from selections
 * 2. Type compatibility matching - ensures source and target field types are compatible
 */

// Field types that don't hold data and should be excluded from workflow selections
export const STATIC_LAYOUT_FIELD_TYPES = [
  'header',
  'description', 
  'section-break',
  'horizontal-line',
  'rich-text',
  'full-width-container'
] as const;

// Additional display-only field types that may not be suitable for all contexts
export const DISPLAY_ONLY_FIELD_TYPES = [
  ...STATIC_LAYOUT_FIELD_TYPES,
  'query', // Read-only calculated/display field
] as const;

/**
 * Check if a field type is a static/layout field that shouldn't be in workflow selections
 */
export function isStaticField(fieldType: string): boolean {
  return STATIC_LAYOUT_FIELD_TYPES.includes(fieldType as any);
}

/**
 * Check if a field type is display-only (static + query fields)
 */
export function isDisplayOnlyField(fieldType: string): boolean {
  return DISPLAY_ONLY_FIELD_TYPES.includes(fieldType as any);
}

/**
 * Filter out static/layout fields from a list of fields
 */
export function filterDataFields<T extends { type?: string; field_type?: string }>(
  fields: T[],
  excludeDisplayOnly = false
): T[] {
  const excludeList = excludeDisplayOnly ? DISPLAY_ONLY_FIELD_TYPES : STATIC_LAYOUT_FIELD_TYPES;
  return fields.filter(field => {
    const fieldType = field.type || field.field_type || '';
    return !excludeList.includes(fieldType as any);
  });
}

/**
 * Type compatibility groups for dynamic field mapping
 * Each key maps to an array of compatible types
 */
const TYPE_COMPATIBILITY_GROUPS: Record<string, string[]> = {
  // Text-based fields
  text: ['text', 'short-answer', 'textarea', 'long-text', 'paragraph', 'email', 'url', 'phone', 'password'],
  'short-answer': ['text', 'short-answer', 'textarea', 'long-text', 'paragraph', 'email', 'url', 'phone'],
  textarea: ['text', 'short-answer', 'textarea', 'long-text', 'paragraph'],
  'long-text': ['text', 'short-answer', 'textarea', 'long-text', 'paragraph'],
  paragraph: ['text', 'short-answer', 'textarea', 'long-text', 'paragraph'],
  
  // Email
  email: ['email', 'text', 'short-answer'],
  
  // URL
  url: ['url', 'text', 'short-answer'],
  
  // Phone
  phone: ['phone', 'text', 'short-answer'],
  
  // Password (special - only maps to itself)
  password: ['password', 'text'],
  
  // Number-based fields
  number: ['number', 'slider', 'rating', 'star-rating', 'currency'],
  slider: ['number', 'slider', 'rating', 'star-rating'],
  rating: ['number', 'slider', 'rating', 'star-rating'],
  'star-rating': ['number', 'slider', 'rating', 'star-rating'],
  currency: ['currency', 'number'],
  
  // Date/Time fields
  date: ['date', 'datetime'],
  time: ['time', 'datetime'],
  datetime: ['date', 'time', 'datetime'],
  
  // Boolean/Toggle fields
  toggle: ['toggle', 'switch', 'checkbox', 'yes-no'],
  switch: ['toggle', 'switch', 'checkbox', 'yes-no'],
  'yes-no': ['toggle', 'switch', 'checkbox', 'yes-no'],
  'toggle-switch': ['toggle', 'switch', 'checkbox', 'yes-no', 'toggle-switch'],
  
  // Select/Option fields
  select: ['select', 'radio', 'dropdown', 'multi-select', 'dynamic-dropdown'],
  radio: ['select', 'radio', 'dropdown'],
  dropdown: ['select', 'radio', 'dropdown', 'dynamic-dropdown'],
  'dynamic-dropdown': ['select', 'radio', 'dropdown', 'dynamic-dropdown'],
  'multi-select': ['multi-select', 'checkbox', 'tags'],
  checkbox: ['checkbox', 'multi-select', 'toggle', 'switch', 'yes-no'],
  
  // Tags
  tags: ['tags', 'multi-select'],
  
  // Country
  country: ['country', 'select', 'dropdown', 'text'],
  
  // User/Access fields
  'user-picker': ['user-picker', 'email', 'submission-access', 'assignee'],
  'submission-access': ['submission-access', 'user-picker', 'group-picker'],
  'group-picker': ['group-picker', 'submission-access'],
  assignee: ['assignee', 'user-picker', 'email'],
  
  // File fields
  file: ['file', 'image', 'attachment'],
  image: ['file', 'image', 'attachment', 'signature'],
  attachment: ['file', 'image', 'attachment'],
  
  // Signature
  signature: ['signature', 'image'],
  
  // Color
  color: ['color', 'text'],
  
  // Address/Geographic
  address: ['address', 'text', 'textarea'],
  'geo-location': ['geo-location'],
  
  // Barcode
  barcode: ['barcode', 'text'],
  
  // IP Address
  'ip-address': ['ip-address', 'text'],
  
  // Calculated (read-only but may need to be referenced)
  calculated: ['calculated', 'number', 'text'],
  
  // Approval status
  approval: ['approval', 'select', 'text'],
  
  // Cross-reference fields (special handling)
  'cross-reference': ['cross-reference'],
  'record-table': ['record-table'],
  'matrix-grid': ['matrix-grid'],
};

/**
 * Get compatible field types for a given target type
 */
export function getCompatibleTypes(targetType: string): string[] {
  const normalizedType = targetType?.toLowerCase().trim() || '';
  return TYPE_COMPATIBILITY_GROUPS[normalizedType] || [normalizedType];
}

/**
 * Check if two field types are compatible for mapping
 */
export function areTypesCompatible(sourceType: string, targetType: string): boolean {
  const normalizedSource = sourceType?.toLowerCase().trim() || '';
  const normalizedTarget = targetType?.toLowerCase().trim() || '';
  
  // Same type is always compatible
  if (normalizedSource === normalizedTarget) return true;
  
  // Check if source is in target's compatibility group
  const compatibleTypes = getCompatibleTypes(normalizedTarget);
  return compatibleTypes.includes(normalizedSource);
}

/**
 * Filter fields to only show those compatible with a target field type
 */
export function filterCompatibleFields<T extends { type?: string; field_type?: string }>(
  fields: T[],
  targetFieldType: string
): T[] {
  const compatibleTypes = getCompatibleTypes(targetFieldType);
  return fields.filter(field => {
    const fieldType = (field.type || field.field_type || '').toLowerCase().trim();
    return compatibleTypes.includes(fieldType);
  });
}

/**
 * Get fields suitable for workflow contexts (filtered for data fields and optionally by type)
 */
export function getWorkflowCompatibleFields<T extends { type?: string; field_type?: string }>(
  fields: T[],
  options?: {
    excludeDisplayOnly?: boolean;
    filterByTargetType?: string;
  }
): T[] {
  let result = filterDataFields(fields, options?.excludeDisplayOnly);
  
  if (options?.filterByTargetType) {
    result = filterCompatibleFields(result, options.filterByTargetType);
  }
  
  return result;
}

/**
 * Get a human-readable label for field type compatibility
 */
export function getTypeCompatibilityLabel(fieldType: string): string {
  const compatibleTypes = getCompatibleTypes(fieldType);
  if (compatibleTypes.length <= 1) {
    return fieldType;
  }
  
  // Show first few compatible types
  const displayTypes = compatibleTypes.slice(0, 4);
  const remaining = compatibleTypes.length - 4;
  
  let label = displayTypes.join(', ');
  if (remaining > 0) {
    label += ` (+${remaining} more)`;
  }
  
  return label;
}
