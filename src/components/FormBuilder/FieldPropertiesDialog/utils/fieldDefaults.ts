
import { FieldType } from '@/types/form';

export function getFieldDefaults(fieldType: FieldType): Record<string, any> {
  const defaults: Record<FieldType, Record<string, any>> = {
    // Text fields
    'text': {
      autoTrim: true,
      spellCheck: true,
    },
    'textarea': {
      rows: 4,
      autoTrim: true,
      spellCheck: true,
    },
    'email': {
      autoTrim: true,
    },
    'password': {
      showStrength: false,
    },
    'url': {
      protocolRestriction: 'any',
    },

    // Number fields
    'number': {
      step: 1,
      precision: 0,
    },
    'currency': {
      defaultCurrency: 'USD',
      showSymbol: true,
    },
    'slider': {
      min: 0,
      max: 100,
      step: 1,
    },

    // Date/Time fields
    'date': {
      format: 'YYYY-MM-DD',
      autoPopulate: false,
    },
    'time': {
      format: '24h',
      showSeconds: false,
    },
    'datetime': {
      format: 'YYYY-MM-DD HH:mm',
      autoPopulate: false,
    },

    // Selection fields
    'select': {
      searchable: false,
      clearable: true,
    },
    'multi-select': {
      maxSelections: undefined,
      searchable: true,
    },
    'radio': {
      orientation: 'vertical',
    },
    'checkbox': {
      orientation: 'vertical',
    },
    'toggle-switch': {
      showLabels: true,
    },

    // File fields
    'file': {
      maxFiles: 1,
      maxFileSizeMB: 10,
      acceptedTypes: '',
    },
    'image': {
      maxFiles: 1,
      maxFileSizeMB: 5,
      cropAspectRatio: '',
      thumbnailSize: 'medium',
    },

    // Location fields
    'address': {
      addressFields: ['street', 'city', 'state', 'zip', 'country'],
      defaultCountry: 'US',
    },
    'geo-location': {
      defaultLocation: '',
      zoomLevel: 10,
      allowManualEntry: true,
    },
    'country': {
      allowedCountries: [],
      preferred: [],
    },
    'phone': {
      defaultCountry: 'US',
      format: 'international',
    },

    // Rating and feedback
    'rating': {
      ratingScale: 5,
      allowHalfStars: false,
    },

    // Advanced fields
    'record-table': {
      targetFormId: '',
      displayColumns: [],
      enableSorting: true,
      enableSearch: true,
      pageSize: 10,
      filters: [],
    },
    'matrix-grid': {
      targetFormId: '',
      displayColumns: [],
      joinField: '',
      includeMetadata: false,
    },
    'cross-reference': {
      targetFormId: '',
      displayField: '',
      valueField: 'id',
      filters: [],
    },
    'child-cross-reference': {
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
      dataSource: 'form',
      sourceFormId: '',
      displayField: '',
      valueField: 'id',
    },
    'calculated': {
      formula: '',
      calculateOn: 'change',
      showFormula: false,
      decimalPlaces: 2,
    },
    'conditional-section': {
      conditions: [],
      logic: 'AND',
    },
    'lookup': {
      targetFormId: '',
      displayField: '',
      valueField: 'id',
      allowMultiple: false,
    },

    // Display fields
    'header': {
      level: 'h2',
      alignment: 'left',
      color: '#000000',
    },
    'description': {
      content: '',
      collapsible: false,
      startCollapsed: false,
    },
    'section-break': {
      title: '',
      description: '',
      backgroundColor: '#f8f9fa',
      collapsible: false,
    },
    'horizontal-line': {
      thickness: 1,
      color: '#e0e0e0',
      margin: 'medium',
    },
    'rich-text': {
      content: '',
      allowFormatting: true,
    },
    'full-width-container': {
      backgroundColor: '#ffffff',
      padding: 'medium',
    },

    // User/Group fields
    'user-picker': {
      maxSelections: 1,
      roleFilter: '',
      searchDelay: 300,
    },
    'group-picker': {
      maxSelections: 1,
      includeSubgroups: false,
    },

    // Other fields
    'tags': {
      maxTags: 10,
      autocompleteSource: '',
    },
    'signature': {
      penColor: '#000000',
      showTimestamp: true,
      clearOnDoubleTap: true,
    },
    'color': {
      allowTransparency: false,
      format: 'hex',
    },
    'barcode': {
      scanOnFocus: true,
      supportedFormats: ['qr', 'code128'],
    },
    'approval': {
      requiredSignatures: 1,
      approverRoles: ['admin'],
    },
    'workflow-trigger': {
      triggerEvent: 'submit',
      workflowId: '',
    },
    'ip-address': {
      version: 'both',
      validateFormat: true,
    },
    'submission-access': {
      accessLevel: 'view',
      accessDuration: undefined,
      notificationMessage: '',
      requireConfirmation: false,
      sendNotification: true,
      allowMultiple: false,
      logAccess: true,
    },
  };

  return defaults[fieldType] || {};
}
