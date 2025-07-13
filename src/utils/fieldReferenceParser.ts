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
 * Creates a display text for a field reference using last 4 characters of field ID
 * @param formRefId The form reference ID
 * @param fieldRef The field reference
 * @param fieldId The actual field ID
 * @returns The display text in format: form_ref_id.field_ref_XXXX (last 4 chars of ID)
 */
export function createFieldDisplayText(formRefId: string, fieldRef: string, fieldId: string): string {
  const shortId = fieldId.slice(-4);
  return `${formRefId}.${fieldRef}_${shortId}`;
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
 * @param allFields Array of all available fields to match against
 * @returns Array of field IDs found in the expression
 */
export function extractFieldIdsFromExpression(
  expression: string,
  allFields: ParsedFieldReference[] = []
): string[] {
  // New format: formRef.fieldRef.<fullIdNoHyphens>_<last4>
  // e.g. rules_testing_form.number_input.2732a072fbea47238abeb898dd1a8f4e_8f4e
  const fieldRefPattern = /(\w+)\.(\w+)\.([0-9a-f]+_[0-9a-f]{4})/g;
  const fieldIds: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = fieldRefPattern.exec(expression)) !== null) {
    const formRef  = match[1];         // e.g. "rules_testing_form"
    const fieldRef = match[2];         // e.g. "number_input"
    const idToken  = match[3];         // e.g. "2732a072fbea47238abeb898dd1a8f4e_8f4e"

    // Find the matching ParsedFieldReference
    const matchingField = allFields.find(f => {
      // rebuild token from the stored fieldId:
      const noHyphens = f.fieldId.replace(/-/g, "");
      const suffix    = f.fieldId.slice(-4);
      return (
        f.formRefId === formRef &&
        f.fieldRef  === fieldRef &&
        `${noHyphens}_${suffix}` === idToken
      );
    });

    if (matchingField) {
      fieldIds.push(matchingField.fieldId);
    }
  }

  return fieldIds;
}


/**
 * Replaces field references in an expression with actual field IDs for calculation
 * @param expression The expression with field references
 * @param allFields Array of all available fields to match against
 * @returns Expression with field references replaced by #field_id
 */
export function replaceFieldReferencesInExpression(
  expression: string, 
  allFields: ParsedFieldReference[] = []
): string {
  let processedExpression = expression;
  
  // Replace form_ref.field_ref_XXXX with #field_id
  const fieldRefPattern = /(\w+)\.(\w+)_(\w{4})/g;
  processedExpression = processedExpression.replace(fieldRefPattern, (match, formRef, fieldRef, shortId) => {
    const matchingField = allFields.find(field => 
      field.formRefId === formRef && 
      field.fieldRef === fieldRef && 
      field.fieldId.slice(-4) === shortId
    );
    
    return matchingField ? `#${matchingField.fieldId}` : match;
  });
  
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