
export interface FormDataTableConfig {
  targetFormId: string;
  targetFormName: string;
  filters?: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
  }>;
  displayColumns?: string[];
  joinField?: string;
  enableSorting?: boolean;
  enableSearch?: boolean;
  pageSize?: number;
  isParentReference?: boolean;
  parentFormId?: string;
  tableDisplayField?: string;
}

export interface FormDataTableProps {
  config: FormDataTableConfig;
  fieldType: 'record-table' | 'cross-reference' | 'child-cross-reference' | 'matrix-grid';
  currentFormId?: string;
  targetFormFields?: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

export interface TableFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: string;
}

export interface TableSort {
  field: string;
  direction: string;
}
