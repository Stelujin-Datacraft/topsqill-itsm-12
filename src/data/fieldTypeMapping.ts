
export const fieldTypeMapping: Record<string, string> = {
  text: 'text',
  email: 'email',
  number: 'number',
  select: 'select',
  textarea: 'text',
  checkbox: 'boolean',
  radio: 'select',
  date: 'date',
  file: 'file',
  'submission-access': 'text'
};

export const getFieldType = (fieldType: string): string => {
  return fieldTypeMapping[fieldType] || 'text';
};
