
import { FieldType } from '@/types/form';

export function getFieldDefaults(fieldType: FieldType): Record<string, any> {
  // Common defaults for all fields
  const commonDefaults = {
    weightage: 1, // Default weightage for all fields
  };

  const defaults: Record<FieldType, Record<string, any>> = {
    // Text fields
    'text': {
      ...commonDefaults,
      autoTrim: true,
      spellCheck: true,
    },
    'textarea': {
      ...commonDefaults,
      rows: 4,
      autoTrim: true,
      spellCheck: true,
    },
    'email': {
      ...commonDefaults,
      autoTrim: true,
    },
    'password': {
      ...commonDefaults,
      showStrength: false,
    },
    'url': {
      ...commonDefaults,
      protocolRestriction: 'any',
    },

    // Number fields
    'number': {
      ...commonDefaults,
      step: 1,
      precision: 0,
    },
    'currency': {
      ...commonDefaults,
      defaultCurrency: 'USD',
      showSymbol: true,
    },
    'slider': {
      ...commonDefaults,
      min: 0,
      max: 100,
      step: 1,
    },

    // Date/Time fields
    'date': {
      ...commonDefaults,
      format: 'YYYY-MM-DD',
      autoPopulate: false,
    },
    'time': {
      ...commonDefaults,
      format: '24h',
      showSeconds: false,
    },
    'datetime': {
      ...commonDefaults,
      format: 'YYYY-MM-DD HH:mm',
      autoPopulate: false,
    },

    // Selection fields
    'select': {
      ...commonDefaults,
      searchable: false,
      clearable: true,
    },
    'multi-select': {
      ...commonDefaults,
      maxSelections: undefined,
      searchable: true,
    },
    'radio': {
      ...commonDefaults,
      orientation: 'vertical',
    },
    'checkbox': {
      ...commonDefaults,
      orientation: 'vertical',
    },
    'toggle-switch': {
      ...commonDefaults,
      showLabels: true,
    },

    // File fields
    'file': {
      ...commonDefaults,
      maxFiles: 1,
      maxFileSizeMB: 10,
      acceptedTypes: '',
    },
    'image': {
      ...commonDefaults,
      maxFiles: 1,
      maxFileSizeMB: 5,
      cropAspectRatio: '',
      thumbnailSize: 'medium',
    },

    // Location fields
    'address': {
      ...commonDefaults,
      addressFields: ['street', 'city', 'state', 'zip', 'country'],
      defaultCountry: 'US',
    },
    'geo-location': {
      ...commonDefaults,
      defaultLocation: '',
      zoomLevel: 10,
      allowManualEntry: true,
    },
    'country': {
      ...commonDefaults,
      allowedCountries: [],
      preferred: [],
    },
    'phone': {
      ...commonDefaults,
      defaultCountry: 'US',
      format: 'international',
    },

    // Rating and feedback
    'rating': {
      ...commonDefaults,
      ratingScale: 5,
      allowHalfStars: false,
    },

    // Advanced fields
    'record-table': {
      ...commonDefaults,
      targetFormId: '',
      displayColumns: [],
      enableSorting: true,
      enableSearch: true,
      pageSize: 10,
      filters: [],
    },
    'matrix-grid': {
      ...commonDefaults,
      targetFormId: '',
      displayColumns: [],
      joinField: '',
      includeMetadata: false,
    },
    'cross-reference': {
      ...commonDefaults,
      targetFormId: '',
      displayField: '',
      valueField: 'id',
      filters: [],
    },
    'child-cross-reference': {
      ...commonDefaults,
      targetFormId: '',
      displayField: '',
      valueField: 'id',
      filters: [],
      isChildField: true,
      parentFormId: '',
      parentFieldId: '',
      parentFormName: '',
    },
    'dynamic-dropdown': {
      ...commonDefaults,
      dataSource: 'form',
      sourceFormId: '',
      displayField: '',
      valueField: 'id',
    },
    'calculated': {
      ...commonDefaults,
      formula: '',
      calculateOn: 'change',
      showFormula: false,
      decimalPlaces: 2,
    },
    'conditional-section': {
      ...commonDefaults,
      conditions: [],
      logic: 'AND',
    },
    'lookup': {
      ...commonDefaults,
      targetFormId: '',
      displayField: '',
      valueField: 'id',
      allowMultiple: false,
    },

    // Display fields
    'header': {
      ...commonDefaults,
      level: 'h2',
      alignment: 'left',
      color: '#000000',
    },
    'description': {
      ...commonDefaults,
      content: '',
      collapsible: false,
      startCollapsed: false,
    },
    'section-break': {
      ...commonDefaults,
      title: '',
      description: '',
      backgroundColor: '#f8f9fa',
      collapsible: false,
    },
    'horizontal-line': {
      ...commonDefaults,
      thickness: 1,
      color: '#e0e0e0',
      margin: 'medium',
    },
    'rich-text': {
      ...commonDefaults,
      content: '',
      allowFormatting: true,
    },
    'full-width-container': {
      ...commonDefaults,
      backgroundColor: '#ffffff',
      padding: 'medium',
    },

    // User/Group fields
    'user-picker': {
      ...commonDefaults,
      maxSelections: 1,
      roleFilter: '',
      searchDelay: 300,
    },
    'group-picker': {
      ...commonDefaults,
      maxSelections: 1,
      includeSubgroups: false,
    },

    // Other fields
    'tags': {
      ...commonDefaults,
      maxTags: 10,
      autocompleteSource: '',
    },
    'signature': {
      ...commonDefaults,
      penColor: '#000000',
      showTimestamp: true,
      clearOnDoubleTap: true,
    },
    'color': {
      ...commonDefaults,
      allowTransparency: false,
      format: 'hex',
    },
    'barcode': {
      ...commonDefaults,
      scanOnFocus: true,
      supportedFormats: ['qr', 'code128'],
    },
    'approval': {
      ...commonDefaults,
      requiredSignatures: 1,
      approverRoles: ['admin'],
    },
    'workflow-trigger': {
      ...commonDefaults,
      triggerEvent: 'submit',
      workflowId: '',
    },
    'ip-address': {
      ...commonDefaults,
      version: 'both',
      validateFormat: true,
    },
    'submission-access': {
      ...commonDefaults,
      accessLevel: 'view',
      accessDuration: undefined,
      notificationMessage: '',
      requireConfirmation: false,
      sendNotification: true,
      allowMultiple: false,
      logAccess: true,
    },
    'query-field': {
      ...commonDefaults,
      query: '',
      savedQueryId: '',
      displayMode: 'data',
      executeOn: 'load',
      targetFieldId: '',
      refreshInterval: 0,
      showResults: true,
      maxResults: 100,
    },
  };

  return defaults[fieldType] || commonDefaults;
}
