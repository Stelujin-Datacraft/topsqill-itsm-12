
export interface FormBuilderProps {
  formId?: string;
}

export interface FieldOperationsHook {
  handleAddField: (type: string) => Promise<void>;
  handleFieldClick: (field: any) => void;
  handleFieldUpdate: (fieldId: string, updates: any) => void;
  handleFieldDelete: (fieldId: string) => void;
  handleFieldHighlight: (fieldId: string) => void;
  handleDragEnd: (result: any) => void;
}

export interface FormBuilderState {
  formName: string;
  setFormName: (name: string) => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  formStatus: any;
  setFormStatus: (status: any) => void;
  selectedField: any;
  setSelectedField: (field: any) => void;
  isCreating: boolean;
  setIsCreating: (creating: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  isPublishing: boolean;
  setIsPublishing: (publishing: boolean) => void;
  currentPageId: string;
  setCurrentPageId: (pageId: string) => void;
  columnLayout: 1 | 2 | 3;
  setColumnLayout: (layout: 1 | 2 | 3) => void;
  highlightedFieldId: string | null;
  setHighlightedFieldId: (fieldId: string | null) => void;
  showNavigation: boolean;
  setShowNavigation: (show: boolean) => void;
  showFieldProperties: boolean;
  setShowFieldProperties: (show: boolean) => void;
  fieldTypeSearch: string;
  setFieldTypeSearch: (search: string) => void;
  savingFieldConfig: string | null;
  setSavingFieldConfig: (configId: string | null) => void;
}
