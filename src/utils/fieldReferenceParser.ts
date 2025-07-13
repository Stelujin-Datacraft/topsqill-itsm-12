import { FormField } from '@/types/form';

export interface ParsedFieldReference {
  formRefId: string;
  fieldRef: string;
  fieldId: string;
  displayText: string;
  originalField: FormField;
}

/**
 * Converts a field label to a field reference format
 * @param label The field label to convert
 * @returns The field reference (lowercase, underscores instead of spaces)
 */
export function createFieldRef(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Creates a display text for a field reference
 * @param formRefId The form reference ID
 * @param fieldRef The field reference
 * @param fieldId The actual field ID
 * @returns The display text in format: form_ref_id.field_ref(#field_id)
 */
export function createFieldDisplayText(formRefId: string, fieldRef: string, fieldId: string): string {
  return `${formRefId}.${fieldRef}(#${fieldId})`;
}

/**
 * Parses fields from a form into the new reference format
 * @param fields The form fields
 * @param formRefId The form reference ID or name as fallback
 * @returns Array of parsed field references
 */
export function parseFormFields(fields: FormField[], formRefId: string): ParsedFieldReference[] {
  return fields.map(field => {
    const fieldRef = createFieldRef(field.label);
    const displayText = createFieldDisplayText(formRefId, fieldRef, field.id);
    
    return {
      formRefId,
      fieldRef,
      fieldId: field.id,
      displayText,
      originalField: field
    };
  });
}

/**
 * Extracts field ID from a field reference in an expression
 * @param expression The expression containing field references
 * @returns Array of field IDs found in the expression
 */
export function extractFieldIdsFromExpression(expression: string): string[] {
  // Match patterns like form_ref.field_ref(#field_id) and extract field_id
  const fieldRefPattern = /\w+\.\w+\(#([^)]+)\)/g;
  const fieldIds: string[] = [];
  let match;
  
  while ((match = fieldRefPattern.exec(expression)) !== null) {
    fieldIds.push(match[1]);
  }
  
  return fieldIds;
}

/**
 * Replaces field references in an expression with actual field IDs for calculation
 * @param expression The expression with field references
 * @param fieldMap Map of field references to field IDs
 * @returns Expression with field references replaced by #field_id
 */
export function replaceFieldReferencesInExpression(
  expression: string, 
  fieldMap: Map<string, string>
): string {
  let processedExpression = expression;
  
  // Replace form_ref.field_ref(#field_id) with #field_id
  const fieldRefPattern = /(\w+)\.(\w+)\(#([^)]+)\)/g;
  processedExpression = processedExpression.replace(fieldRefPattern, '#$3');
  
  return processedExpression;
}

/**
 * Validates if a field reference exists in the available fields
 * @param fieldReference The field reference to validate
 * @param availableFields Array of available parsed field references
 * @returns True if the field reference is valid
 */
export function isValidFieldReference(
  fieldReference: string, 
  availableFields: ParsedFieldReference[]
): boolean {
  return availableFields.some(field => field.displayText === fieldReference);
}