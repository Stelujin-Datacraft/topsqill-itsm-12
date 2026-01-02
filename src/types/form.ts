export interface ValidationRule {
  id: string;
  rule: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'number';
  value: string;
  message?: string;
}

export interface FieldRuleCondition {
  id: string;
  fieldId: string;
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=' | 'contains' | 'not contains' | 'startsWith' | 'endsWith' | 'in' | 'isEmpty' | 'isNotEmpty';
  value: string | number | boolean | string[];
  compareToField?: string;
}

export interface FieldRule {
  id: string;
  name: string;
  targetFieldId: string;
  conditions?: FieldRuleCondition[]; // Multiple conditions for new system
  condition?: FieldRuleCondition; // Legacy single condition (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional' | 'setRequired' | 'setOptional' | 'changeLabel' | 'changeOptions' | 'setDefault' | 'clearValue' | 'showTooltip' | 'showError' | 'filterOptions';
  actionValue?: string | number | boolean | any[];
  isActive: boolean;
}

export interface FormRuleCondition {
  id: string;
  type: 'single' | 'group';
  fieldId?: string;
  operator?: '==' | '!=' | '<' | '>' | '<=' | '>=' | 'contains' | 'not contains' | 'startsWith' | 'endsWith' | 'in' | 'isEmpty' | 'isNotEmpty';
  value?: string | number | boolean | string[];
  compareToField?: string;
  logic?: 'AND' | 'OR';
  conditions?: FormRuleCondition[];
}

export interface FormRule {
  id: string;
  name: string;
  conditions: FormRuleCondition[];
  rootLogic?: 'AND' | 'OR'; // Legacy logic (backward compatibility)
  logicExpression?: string; // New: logical expression (e.g., "1 AND (2 OR 3) AND NOT 4")
  action: 'approve' | 'disapprove' | 'notify' | 'sendEmail' | 'triggerWebhook' | 'startWorkflow' | 'assignForm' | 'redirect' | 'lockForm' | 'unlockForm' | 'autoFillFields' | 'changeFormHeader' | 'saveDraft' | 'allowSubmit' | 'preventSubmit' | 'showMessage' | 'redirectTo' | 'updateField' | 'reject' | 'showSuccessModal';
  actionValue?: string | any;
  isActive: boolean;
}

export type FieldType = 
  // Full-width components
  | 'header' | 'description' | 'section-break' | 'horizontal-line' | 'full-width-container'
  | 'rich-text' | 'record-table' | 'matrix-grid' | 'cross-reference' | 'child-cross-reference'
  | 'approval' | 'geo-location' | 'query-field' | 'workflow-trigger'
  // Standard components
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime'
  | 'select' | 'multi-select' | 'radio' | 'checkbox' | 'toggle-switch'
  | 'slider' | 'rating' | 'file' | 'image' | 'color'
  | 'country' | 'phone' | 'address' | 'currency' | 'email' | 'url' | 'password'
  | 'ip-address' | 'barcode' | 'user-picker' | 'group-picker'
  | 'signature' | 'tags' | 'dynamic-dropdown'
  | 'calculated' | 'conditional-section' | 'lookup'
  // New field types
  | 'submission-access' | 'query-field';

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'password' | 'select' | 'multi-select' | 
        'checkbox' | 'radio' | 'toggle-switch' | 'date' | 'time' | 'datetime' | 'file' | 
        'image' | 'url' | 'phone' | 'address' | 'currency' | 'rating' | 'slider' | 'color' |
        'signature' | 'tags' | 'lookup' | 'calculated' | 'header' | 'description' | 
        'section-break' | 'horizontal-line' | 'rich-text' | 'barcode' | 'user-picker' | 
        'geo-location' | 'workflow-trigger' | 'matrix-grid' | 'record-table' | 'cross-reference' |
        'child-cross-reference' | 'dynamic-dropdown' | 'conditional-section' | 'ip-address' | 
        'full-width-container' | 'country' | 'submission-access' | 'approval' | 'query-field';
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | boolean | string[];
  options?: Array<{ id: string; value: string; label: string; color?: string; image?: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
    unique?: boolean;
  };
  validationRules?: ValidationRule[];
  permissions?: {
    read: string[];
    write: string[];
  };
  triggers?: any[];
  isVisible?: boolean;
  isEnabled?: boolean;
  currentValue?: string;
  tooltip?: string;
  errorMessage?: string;
  pageId?: string;
  isFullWidth?: boolean;
  fieldCategory?: string;
  customConfig?: {
    // Header specific
    level?: 'h1' | 'h2' | 'h3' | 'h4';
    alignment?: 'left' | 'center' | 'right';
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    icon?: string;
    
    // Description specific
    content?: string;
    collapsible?: boolean;
    startCollapsed?: boolean;
    fontStyle?: string;
    fontFamily?: string;
    description?: string;
    
    // Section Break specific
    title?: string;
    backgroundColor?: string;
    borderStyle?: string;
    width?: string;
    breakType?: string;
    spacing?: string;
    
    // Horizontal Line specific
    thickness?: number;
    margin?: string;
    lineColor?: string;
    lineStyle?: string;
    
    // Address specific
    enableGPS?: boolean;
    postalAutoFill?: boolean;
    addressFields?: string[];
    
    // Validation specific
    realTimeValidation?: boolean;
    validationMessage?: string;
    
    // Rich Text specific
    editorToolbar?: string[];
    allowHtml?: boolean;
    maxContentLength?: number;
    
    // Full Width Container specific
    mediaType?: 'image' | 'video' | 'svg';
    mediaUrl?: string;
    mediaFile?: File;
    aspectRatio?: string;
    autoPlay?: boolean;
    
    // Number specific
    step?: number;
    unit?: string;
    precision?: number;
    
    // Text specific
    autoTrim?: boolean;
    spellCheck?: boolean;
    rows?: number;
    
    // Select/Multi-select specific
    maxSelections?: number;
    allowOther?: boolean;
    searchable?: boolean;
    clearable?: boolean;
    
    // Radio specific
    orientation?: 'vertical' | 'horizontal';
    
    // Rating specific
    ratingScale?: number;
    ratingStyle?: string;
    allowHalfStars?: boolean;
    allowClear?: boolean;
    
    // Date specific
    minDate?: string;
    maxDate?: string;
    autoPopulate?: boolean;
    format?: string;
    
    // File specific
    maxFiles?: number;
    maxFileSizeMB?: number;
    acceptedTypes?: string;
    allowDragDrop?: boolean;
    showPreview?: boolean;
    
    // Image specific
    enableCrop?: boolean;
    cropAspectRatio?: string;
    thumbnailSize?: string;
    
    // Color specific
    pickerType?: string;
    allowTransparency?: boolean;
    showInput?: boolean;
    
    // Password specific
    minLength?: number;
    maxLength?: number;
    showStrength?: boolean;
    showToggle?: boolean;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    
    // Country specific
    defaultCountry?: string;
    allowedCountries?: string[];
    preferred?: string[];
    showFlags?: boolean;
    
    // Phone specific
    showCountrySelector?: boolean;
    autoFormat?: boolean;
    validateFormat?: boolean;
    
    // Currency specific
    defaultCurrency?: string;
    currencyList?: string[];
    showSymbol?: boolean;
    showCurrencyCode?: boolean;
    allowCurrencyChange?: boolean;
    
    // Toggle Switch specific
    onLabel?: string;
    offLabel?: string;
    showLabels?: boolean;
    size?: string;
    
    // Slider specific
    min?: number;
    max?: number;
    showValue?: boolean;
    showTicks?: boolean;
    showRange?: boolean;
    tickStep?: number;
    
    // Checkbox specific
    checkboxStyle?: string;
    
    // Matrix Grid, Record Table, Cross Reference specific
    targetFormId?: string;
    targetFormName?: string;
    filters?: Array<{
      id: string;
      field: string;
      operator: string;
      value: string;
    }>;
    dynamicFieldMappings?: Array<{
      id: string;
      parentFieldId: string;
      parentFieldLabel?: string;
      childFieldId: string;
      childFieldLabel?: string;
      operator: string;
    }>;
    columnFilters?: string[];
    joinField?: string;
    displayColumns?: string[];
    tableDisplayFields?: string[]; // Multiple fields to display in cross-reference tables
    enableSorting?: boolean;
    enableSearch?: boolean;
    pageSize?: number;
    includeMetadata?: boolean;
    showOnlyUserRecords?: boolean;
    isParentReference?: boolean;
    
    // Dynamic Dropdown specific
    dataSource?: 'form' | 'api';
    sourceFormId?: string;
    displayField?: string;
    valueField?: string;
    apiEndpoint?: string;
    apiHeaders?: any;
    
    // Calculated Field specific
    formula?: string;
    calculateOn?: 'change' | 'submit' | 'load';
    showFormula?: boolean;
    decimalPlaces?: number;
    
    // Conditional Section specific
    conditions?: Array<{
      id: string;
      field: string;
      operator: string;
      value: string;
    }>;
    logic?: 'AND' | 'OR';
    
    // Common behavior
    readOnly?: boolean;
    visibleWhen?: string;
    weightage?: number; // Field weightage (1-100) for weighted calculations
    
    // Tags specific
    maxTags?: number;
    autocompleteSource?: string;
    
    // User Picker specific
    assignRole?: string;
    roleScope?: string;
    enableNotifications?: boolean;
    notificationMessage?: string;
    requireConfirmation?: boolean;
    allowSelfSelection?: boolean;
    showUserProfiles?: boolean;
    logAssignments?: boolean;
    
    // Other configurations
    textAlign?: 'left' | 'center' | 'right';
    headerSize?: 'h1' | 'h2' | 'h3' | 'h4';
    onlyShow?: string[];
    protocolRestriction?: string;
    version?: string;
    scanOnFocus?: boolean;
    supportedFormats?: string[];
    roleFilter?: string;
    searchDelay?: number;
    defaultSelected?: string[];
    approverRoles?: string[];
    requiredSignatures?: number;
    showTimestamp?: boolean;
    penColor?: string;
    undoEnabled?: boolean;
    clearOnDoubleTap?: boolean;
    cacheTTL?: number;
    targetForm?: string;
    lookupFields?: string[];
    displayAs?: string;
    allowMultiple?: boolean;
    autoCompute?: boolean;
    showWhen?: string;
    defaultLocation?: string;
    zoomLevel?: number;
    allowManualEntry?: boolean;
    mapOnly?: boolean;
    stateName?: string;
    initialValue?: string;
    updateOnEvent?: string;
    
    // Submission Access specific
    accessLevel?: 'view' | 'edit' | 'admin';
    accessDuration?: number;
    sendNotification?: boolean;
    logAccess?: boolean;
    
    // Signature specific
    canvasWidth?: number;
    canvasHeight?: number;
    
    // Matrix Grid specific
    matrixRows?: Array<{
      id: string;
      label: string;
      required?: boolean;
    }>;
    matrixColumns?: Array<{
      id: string;
      label: string;
      type: 'radio' | 'checkbox' | 'select';
      options?: Array<{ value: string; label: string }>;
    }>;
    matrixType?: 'radio' | 'checkbox' | 'select';
    requireAllRows?: boolean;
    showGridLines?: boolean;
    compactLayout?: boolean;
    
    // Approval specific
    approveCurrentSubmission?: boolean;
    crossReferenceFieldId?: string;
    approvalMessage?: string;
    requireComments?: boolean;
    sendNotifications?: boolean;
    
    // Child Cross-Reference specific
    isChildField?: boolean;
    parentFormId?: string;
    parentFieldId?: string;
    parentFormName?: string;
    
    // Query Field specific
    query?: string;
    savedQueryId?: string;
    displayMode?: 'query' | 'data';
    executeOn?: 'submit' | 'load' | 'field-change' | 'manual';
    targetFieldId?: string;
    refreshInterval?: number;
    showResults?: boolean;
    maxResults?: number;
    chartType?: 'bar' | 'line' | 'pie';
    enableValidation?: boolean;
    formId?: string;
    submissionId?: string;
  };
}

export interface FormPage {
  id: string;
  name: string;
  order: number;
  fields: string[];
}

export interface Form {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  projectId: string;
  status: 'draft' | 'active' | 'completed' | 'approved' | 'rejected' | 'pending_review' | 'in_progress' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isPublic: boolean;
  fields: FormField[];
  permissions: {
    view: string[];
    submit: string[];
    edit: string[];
  };
  fieldRules: FieldRule[];
  formRules: FormRule[];
  shareSettings: {
    allowPublicAccess: boolean;
    sharedUsers: Array<{
      userId: string;
      permissions: string[];
    }>;
  };
  layout: {
    columns: number;
  };
  pages: FormPage[];
  reference_id?: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  submissionData: Record<string, any>;
  submittedAt: string;
  submittedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}
