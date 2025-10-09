
import { FieldType } from '@/types/form';
import { FieldConfiguration } from '../hooks/useFieldConfiguration';

export function validateConfiguration(fieldType: FieldType, config: FieldConfiguration): Record<string, string> {
  const errors: Record<string, string> = {};

  // Basic validation
  if (!config.label?.trim()) {
    errors.label = 'Field label is required';
  }

  // Field-specific validation
  switch (fieldType) {
    case 'select':
    case 'multi-select':
    case 'radio':
    case 'checkbox':
      if (!config.options || config.options.length === 0) {
        errors.options = 'At least one option is required';
      }
      break;

    case 'record-table':
    case 'matrix-grid':
    case 'cross-reference':
      if (!config.customConfig?.targetFormId) {
        errors.targetForm = 'Target form is required';
      }
      break;

    case 'text':
    case 'textarea':
      if (config.validation?.minLength && config.validation?.maxLength) {
        if (config.validation.minLength > config.validation.maxLength) {
          errors.validation = 'Minimum length cannot be greater than maximum length';
        }
      }
      break;

    case 'number':
      if (config.validation?.min !== undefined && config.validation?.max !== undefined) {
        if (config.validation.min > config.validation.max) {
          errors.validation = 'Minimum value cannot be greater than maximum value';
        }
      }
      break;
  }

  // Validate unique field setting (applicable to most field types)
  if (config.validation?.unique) {
    const unsupportedTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'full-width-container'];
    if (unsupportedTypes.includes(fieldType)) {
      errors.unique = 'Unique validation is not supported for this field type';
    }
  }

  return errors;
}
