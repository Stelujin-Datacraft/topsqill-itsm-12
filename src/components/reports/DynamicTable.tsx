import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ChevronUp, ChevronDown, Search, Filter, Settings, Eye, Maximize2, Minimize2, Trash2, Edit3, FileText, User, Calendar, CheckCircle, ExternalLink, Move } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useReports } from '@/hooks/useReports';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmissionAccessFilter } from '@/hooks/useSubmissionAccessFilter';
import { Form } from '@/types/form';
import { DynamicTableColumnSelector } from './DynamicTableColumnSelector';
import { SubmissionAnalytics } from './SubmissionAnalytics';
import { FormDataCell } from './FormDataCell';
import { SubmittedByCell } from './SubmittedByCell';
import { UserEmailCell } from './UserEmailCell';
import { DeleteSubmissionButton } from './DeleteSubmissionButton';
import { ExportDropdown } from './ExportDropdown';
import { SortingControls, SortConfig } from './SortingControls';
import { ComplexFilter, FilterGroup, FilterCondition } from '@/components/ui/complex-filter';
import { SavedFiltersManager } from './SavedFiltersManager';
import { ExpressionEvaluator, EvaluationContext } from '@/utils/expressionEvaluator';
import { InlineEditDialog } from './InlineEditDialog';
import { MultiLineEditDialog } from './MultiLineEditDialog';
import { BulkActionsBar } from './BulkActionsBar';
import { BulkDeleteDialog } from './BulkDeleteDialog';
import { CrossReferenceDialog } from './CrossReferenceDialog';
import { ColumnOrderManager } from './ColumnOrderManager';
import { CopyRecordsDialog } from './CopyRecordsDialog';
import { ImportButton } from '@/components/ImportButton';
import { SubmissionUpdateButton } from '@/components/submissions/SubmissionUpdateButton';
interface TableConfig {
  title: string;
  formId: string;
  selectedColumns: string[];
  showMetadata?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableSearch?: boolean;
  highlightSubmissionRef?: string;
}
interface DynamicTableProps {
  config: TableConfig;
  onEdit?: () => void;
}
export function DynamicTable({
  config,
  onEdit
}: DynamicTableProps) {
  // All state hooks first
  const [data, setData] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [currentForm, setCurrentForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [complexFilters, setComplexFilters] = useState<FilterGroup[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterGroup[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hasUserInteractedWithColumns, setHasUserInteractedWithColumns] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // New state for bulk operations and inline editing
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showMultiLineEdit, setShowMultiLineEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showColumnOrderManager, setShowColumnOrderManager] = useState(false);
  const [canDeleteSubmissions, setCanDeleteSubmissions] = useState(false);
  const [showCrossReferenceDialog, setShowCrossReferenceDialog] = useState(false);
  const [showCopyRecords, setShowCopyRecords] = useState(false);
  const [crossReferenceData, setCrossReferenceData] = useState<string[]>([]);
  const [crossReferenceFieldName, setCrossReferenceFieldName] = useState<string>('Cross Reference');
  const [crossReferenceTargetFormId, setCrossReferenceTargetFormId] = useState<string>();
  const [crossReferenceDisplayFields, setCrossReferenceDisplayFields] = useState<string[]>([]);
  const [highlightedSubmissionRef, setHighlightedSubmissionRef] = useState<string | null>(null);

  // Custom hooks
  const {
    forms
  } = useReports();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { filterSubmissions: applyAccessFilter, loading: accessFilterLoading } = useSubmissionAccessFilter(
    currentForm,
    userProfile?.id
  );

  // Helper function to evaluate filter conditions
  const evaluateCondition = useCallback((row: any, condition: any) => {
    if (!condition.field || !condition.operator) return true;
    const value = row.submission_data?.[condition.field];
    const filterValue = condition.value;
    if (value === null || value === undefined) {
      return ['is_empty'].includes(condition.operator);
    }
    const stringValue = value.toString().toLowerCase();
    const stringFilterValue = filterValue?.toString().toLowerCase() || '';
    switch (condition.operator) {
      case 'equals':
        return stringValue === stringFilterValue;
      case 'not_equals':
        return stringValue !== stringFilterValue;
      case 'contains':
        return stringValue.includes(stringFilterValue);
      case 'not_contains':
        return !stringValue.includes(stringFilterValue);
      case 'starts_with':
        return stringValue.startsWith(stringFilterValue);
      case 'ends_with':
        return stringValue.endsWith(stringFilterValue);
      case 'greater_than':
        return parseFloat(stringValue) > parseFloat(stringFilterValue);
      case 'less_than':
        return parseFloat(stringValue) < parseFloat(stringFilterValue);
      case 'greater_equal':
        return parseFloat(stringValue) >= parseFloat(stringFilterValue);
      case 'less_equal':
        return parseFloat(stringValue) <= parseFloat(stringFilterValue);
      case 'is_empty':
        return !stringValue || stringValue.trim() === '';
      case 'is_not_empty':
        return stringValue && stringValue.trim() !== '';
      default:
        return true;
    }
  }, []);

  // All useMemo hooks
  const displayFields = useMemo(() => {
    let fields = [];
    
    // If user has interacted with column selection, strictly respect their choices
    if (hasUserInteractedWithColumns) {
      fields = formFields.filter(field => selectedColumns.includes(field.id));
    } else if (config.selectedColumns && config.selectedColumns.length > 0) {
      // Use config selected columns if provided
      fields = formFields.filter(field => config.selectedColumns.includes(field.id));
    } else {
      // Default fallback: show all available fields
      fields = formFields;
    }
    
    // Apply column ordering if specified
    if (columnOrder.length > 0) {
      const orderedFields = [];
      
      // Add fields in the specified order
      columnOrder.forEach(fieldId => {
        const field = fields.find(f => f.id === fieldId);
        if (field) {
          orderedFields.push(field);
        }
      });
      
      // Add any remaining fields that weren't in the order
      fields.forEach(field => {
        if (!columnOrder.includes(field.id)) {
          orderedFields.push(field);
        }
      });
      
      return orderedFields;
    }
    
    return fields;
  }, [formFields, selectedColumns, config.selectedColumns, hasUserInteractedWithColumns, columnOrder]);
  
  const filteredAndSortedData = useMemo(() => {
    console.log('🔍 Filtering data - Input count:', data.length);
    console.log('🔍 Search term:', searchTerm);
    console.log('🔍 Column filters:', columnFilters);
    console.log('🔍 Applied filters:', appliedFilters);
    
    // Apply access control filter first
    let filtered = applyAccessFilter(data);
    console.log('🔒 After access control filter:', filtered.length);

    // Apply search
    if (searchTerm && config.enableSearch) {
      console.log('🔍 Applying search filter for term:', searchTerm);
      const beforeSearch = filtered.length;
      filtered = filtered.filter(row => {
        // Search in submission ID
        if (row.submission_ref_id && row.submission_ref_id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }

        // Search in internal ID
        if (row.id && row.id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }

        // Search in form fields
        return displayFields.some(field => {
          const value = row.submission_data?.[field.id];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
      console.log('🔍 After search filter:', beforeSearch, '->', filtered.length);
    }

    // Apply column filters
    if (config.enableFiltering) {
      Object.entries(columnFilters).forEach(([fieldId, filterValue]) => {
        if (filterValue) {
          console.log('🔍 Applying column filter:', fieldId, '=', filterValue);
          const beforeFilter = filtered.length;
          filtered = filtered.filter(row => {
            const value = row.submission_data?.[fieldId];
            return value && value.toString().toLowerCase().includes(filterValue.toLowerCase());
          });
          console.log('🔍 After column filter:', beforeFilter, '->', filtered.length);
        }
      });
    }

    // Apply complex filters using appliedFilters
    if (appliedFilters.length > 0) {
      console.log('🔍 Applying complex filters:', appliedFilters.length);
      const beforeComplexFilter = filtered.length;
      filtered = filtered.filter(row => {
        return appliedFilters.some(group => {
          if (group.conditions.length === 0) return true;
          
          // Use new expression system if logicExpression is defined
          if (group.logicExpression?.trim()) {
            try {
              // Build evaluation context with condition results
              const context: EvaluationContext = {};
              group.conditions.forEach((condition, index) => {
                const conditionNumber = (index + 1).toString();
                const conditionResult = evaluateCondition(row, condition);
                context[conditionNumber] = conditionResult;
                console.log(`Condition ${conditionNumber} (${condition.field} ${condition.operator} ${condition.value}):`, conditionResult);
              });
              
              console.log('Expression:', group.logicExpression);
              console.log('Context:', context);
              
              // Evaluate the expression
              const result = ExpressionEvaluator.evaluate(group.logicExpression, context);
              console.log('Result:', result);
              console.log('---');
              return result;
            } catch (error) {
              console.error('Filter expression evaluation error:', error);
              // Fallback to legacy behavior
              return group.logic === 'AND'
                ? group.conditions.every(condition => evaluateCondition(row, condition))
                : group.conditions.some(condition => evaluateCondition(row, condition));
            }
          }
          
          // Legacy behavior: simple AND/OR logic
          if (group.logic === 'AND') {
            return group.conditions.every(condition => evaluateCondition(row, condition));
          } else {
            return group.conditions.some(condition => evaluateCondition(row, condition));
          }
        });
      });
      console.log('🔍 After complex filters:', beforeComplexFilter, '->', filtered.length);
    }

    // Apply multi-level sorting
    if (sortConfigs.length > 0 && config.enableSorting) {
      filtered = [...filtered].sort((a, b) => {
        for (const sortConfig of sortConfigs) {
          const aValue = a.submission_data?.[sortConfig.field] || '';
          const bValue = b.submission_data?.[sortConfig.field] || '';
          const comparison = sortConfig.direction === 'asc' ? aValue.toString().localeCompare(bValue.toString()) : bValue.toString().localeCompare(aValue.toString());
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    console.log('✅ Final filtered count:', filtered.length);
    return filtered;
  }, [data, searchTerm, columnFilters, appliedFilters, sortConfigs, displayFields, config, evaluateCondition, applyAccessFilter]);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, currentPage, pageSize]);
  const exportData = useMemo(() => {
    // Include Submission ID as the first column
    const headers = ['Submission ID', ...displayFields.map(field => field.label)];
    if (config.showMetadata) {
      headers.push('Submitted At', 'Submitted By');
    }
    const rows = filteredAndSortedData.map(row => {
      // Add display Submission ID (e.g., #URF251023002) as first value
      const displaySubmissionId = row.submission_ref_id || row.id.slice(0, 8);
      const values = [displaySubmissionId, ...displayFields.map(field => {
        const value = row.submission_data?.[field.id];
        if (value === null || value === undefined) return 'N/A';
        
        // Handle cross-reference fields - extract only submission_ref_id values
        if (field.field_type === 'cross-reference' && Array.isArray(value)) {
          const refIds = value
            .map(item => item?.submission_ref_id)
            .filter(Boolean)
            .join(',');
          return refIds || 'N/A';
        }
        
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString();
      })];
      if (config.showMetadata) {
        values.push(new Date(row.submitted_at).toLocaleDateString(), row.submitted_by || 'Anonymous');
      }
      return values;
    });
    return {
      headers,
      rows,
      filename: `${config.title || 'submission-data'}-${new Date().toISOString().split('T')[0]}`,
      title: config.title || 'Submission Data'
    };
  }, [filteredAndSortedData, displayFields, config]);
  const availableFields = useMemo(() => {
    // Since unwanted fields are already filtered out at the query level,
    // all formFields are available for use
    return formFields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.field_type || 'text'
    }));
  }, [formFields]);

  // useEffect hooks
  useEffect(() => {
    if (config.formId) {
      loadData();
      loadFormFields();
      checkUserPermissions();
    }
  }, [config.formId]);
  useEffect(() => {
    const handleCrossReference = (event: any) => {
      console.log('Cross-reference event received:', event.detail);
      const {
        submissionIds,
        fieldName,
        targetFormId,
        displayFieldIds
      } = event.detail;
      setCrossReferenceData(submissionIds);
      setCrossReferenceFieldName(fieldName || 'Cross Reference');
      setCrossReferenceTargetFormId(targetFormId);
      setCrossReferenceDisplayFields(displayFieldIds || []);
      setShowCrossReferenceDialog(true);
    };
    
    // Use a slight delay to ensure DOM is ready
    const setupListener = () => {
      const tableElement = document.querySelector('[data-dynamic-table="main"]');
      console.log('Setting up event listener on:', tableElement);
      if (tableElement) {
        tableElement.addEventListener('showCrossReference', handleCrossReference);
        return () => {
          tableElement.removeEventListener('showCrossReference', handleCrossReference);
        };
      } else {
        console.warn('Table element not found for event listener setup');
        return undefined;
      }
    };

    const timer = setTimeout(setupListener, 100);
    const cleanup = setupListener();
    
    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [data]); // Re-run when data changes to ensure listener is active

  // Handle highlighting submission reference
  useEffect(() => {
    if (config.highlightSubmissionRef) {
      setHighlightedSubmissionRef(config.highlightSubmissionRef);
      // Don't automatically set search term - just highlight the row
      
      // Auto-scroll to highlighted submission after data loads
      setTimeout(() => {
        const targetRow = document.querySelector(`[data-submission-ref="${config.highlightSubmissionRef}"]`);
        if (targetRow) {
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [config.highlightSubmissionRef, data]);

  // Regular functions and event handlers
  const handleViewSubmission = (submissionId: string) => {
    navigate(`/submission/${submissionId}`);
  };
  const handleDeleteSubmission = async (submissionId: string) => {
    try {
      const {
        error
      } = await supabase.from('form_submissions').delete().eq('id', submissionId);
      if (error) {
        console.error('Error deleting submission:', error);
        return;
      }

      // Reload data after deletion
      loadData();
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };
  const handleEditSubmission = (submission: any) => {
    setEditingSubmission(submission);
    setShowInlineEdit(true);
  };
  const handleRowSelect = (submissionId: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(submissionId);
      } else {
        newSet.delete(submissionId);
      }
      return newSet;
    });
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };
  const handleBulkEdit = () => {
    const selectedSubmissions = paginatedData.filter(row => selectedRows.has(row.id));
    if (selectedSubmissions.length > 0) {
      setEditingSubmission(selectedSubmissions);
      setShowInlineEdit(true);
    }
  };

  const handleMultiLineEdit = () => {
    const selectedSubmissions = paginatedData.filter(row => selectedRows.has(row.id));
    if (selectedSubmissions.length > 0) {
      setEditingSubmission(selectedSubmissions);
      setShowMultiLineEdit(true);
    }
  };

  const handleCopyRecords = () => {
    if (selectedRows.size > 0) {
      setShowCopyRecords(true);
    }
  };

  const handleCopySubmissions = async (numberOfCopies: number) => {
    const selectedSubmissions = paginatedData.filter(row => selectedRows.has(row.id));
    
    try {
      for (const submission of selectedSubmissions) {
        for (let i = 0; i < numberOfCopies; i++) {
          const { id, created_at, updated_at, submitted_at, submission_ref_id, ...submissionData } = submission;
          
          const { error } = await supabase
            .from('form_submissions')
            .insert({
              form_id: submission.form_id,
              submission_data: submission.submission_data,
              submitted_by: submission.submitted_by,
              ip_address: submission.ip_address,
              user_agent: submission.user_agent,
              approval_status: submission.approval_status,
              approval_notes: submission.approval_notes,
              approved_by: submission.approved_by,
              approval_timestamp: submission.approval_timestamp
              // Note: submission_ref_id is auto-generated by the database trigger
            });

          if (error) {
            console.error('Error copying submission:', error);
            throw error;
          }
        }
      }

      // Refresh data after successful copy
      await loadData();
      
      // Clear selection
      setSelectedRows(new Set());
      
    } catch (error) {
      console.error('Error during copy operation:', error);
      throw error;
    }
  };
  const handleBulkDelete = () => {
    if (selectedRows.size > 0) {
      setShowBulkDelete(true);
    }
  };
  const handleClearSelection = () => {
    setSelectedRows(new Set());
  };
  const handleInlineEditSave = () => {
    loadData(); // Reload data after editing
    setSelectedRows(new Set()); // Clear selection
  };
  const handleBulkDeleteComplete = () => {
    loadData(); // Reload data after deletion
    setSelectedRows(new Set()); // Clear selection
  };
  const checkDeletePermission = async (submissionId: string): Promise<boolean> => {
    try {
      const {
        data: submission
      } = await supabase.from('form_submissions').select('form_id').eq('id', submissionId).single();
      if (!submission) return false;
      const {
        data: form
      } = await supabase.from('forms').select('created_by, organization_id').eq('id', submission.form_id).single();
      if (!form) return false;
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user?.user) return false;
      const {
        data: profile
      } = await supabase.from('user_profiles').select('email, role, organization_id').eq('id', user.user.id).single();
      if (!profile) return false;
      return form.created_by === profile.email || profile.role === 'admin' && form.organization_id === profile.organization_id;
    } catch (error) {
      console.error('Error checking delete permission:', error);
      return false;
    }
  };
  const checkUserPermissions = async () => {
    if (!config.formId) return;
    try {
      const {
        data: form
      } = await supabase.from('forms').select('created_by, organization_id').eq('id', config.formId).single();
      if (!form) return;
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user?.user) return;
      const {
        data: profile
      } = await supabase.from('user_profiles').select('email, role, organization_id').eq('id', user.user.id).single();
      if (!profile) return;
      const canDelete = form.created_by === profile.email || profile.role === 'admin' && form.organization_id === profile.organization_id;
      setCanDeleteSubmissions(canDelete);
    } catch (error) {
      console.error('Error checking user permissions:', error);
      setCanDeleteSubmissions(false);
    }
  };
  const loadFormFields = async () => {
    try {
      // Define excluded field types at the query level
      const excludedFieldTypes = [
        'header', 'description', 'section-break', 'horizontal-line', 
        'full-width-container', 'approval', 
        'query-field', 'geo-location', 'conditional-section', 
        'signature', 'dynamic-dropdown', 'rich-text',
        'record-table', 'matrix-grid', 'workflow-trigger','child-cross-reference','barcode'
      ];

      const {
        data: fields,
        error
      } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', config.formId)
        .not('field_type', 'in', `(${excludedFieldTypes.map(type => `"${type}"`).join(',')})`)
        .not('label', 'like', 'Reference from %')
        .order('field_order', { ascending: true });

      if (error) {
        console.error('Error fetching form fields:', error);
        return;
      }

      // Transform fields to use camelCase and parse custom_config
      const parseCustomConfig = (jsonString: any, fallback: any = null) => {
        if (!jsonString) return fallback;
        if (typeof jsonString === 'object') return jsonString;
        try {
          return JSON.parse(jsonString);
        } catch (error) {
          return fallback;
        }
      };

      const transformedFields = (fields || []).map((field: any) => ({
        ...field,
        customConfig: field.custom_config ? parseCustomConfig(field.custom_config, {}) : {}
      }));

      console.log('DynamicTable: Transformed fields with customConfig:', transformedFields);
      setFormFields(transformedFields);
      if (selectedColumns.length === 0 && transformedFields && transformedFields.length > 0) {
        setSelectedColumns(transformedFields.map(f => f.id));
      }

      // Load the full form structure for access control
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', config.formId)
        .single();

      if (formError) {
        console.error('Error loading form:', formError);
        return;
      }

      const safeParseJson = (jsonString: any, fallback: any = null) => {
        if (!jsonString) return fallback;
        if (typeof jsonString === 'object') return jsonString;
        try {
          return JSON.parse(jsonString);
        } catch (error) {
          return fallback;
        }
      };

      const transformedForm: Form = {
        id: formData.id,
        name: formData.name,
        description: formData.description || '',
        organizationId: formData.organization_id,
        projectId: formData.project_id,
        status: formData.status as Form['status'],
        fields: (fields || []).map((field: any) => ({
          id: field.id,
          type: field.field_type as any,
          label: field.label,
          customConfig: field.custom_config ? safeParseJson(field.custom_config, {}) : undefined,
        })),
        permissions: safeParseJson(formData.permissions, { view: [], submit: [], edit: [] }),
        createdAt: formData.created_at,
        updatedAt: formData.updated_at,
        createdBy: formData.created_by,
        isPublic: formData.is_public,
        shareSettings: safeParseJson(formData.share_settings, { allowPublicAccess: false, sharedUsers: [] }),
        fieldRules: safeParseJson(formData.field_rules, []),
        formRules: safeParseJson(formData.form_rules, []),
        layout: safeParseJson(formData.layout, { columns: 1 }),
        pages: safeParseJson(formData.pages, []),
      };

      setCurrentForm(transformedForm);
    } catch (error) {
      console.error('Error loading form fields:', error);
    }
  };
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading data for form ID:', config.formId);
      
      const {
        data: submissions,
        error
      } = await supabase.from('form_submissions').select(`
          *,
          user_profiles!left(email)
        `).eq('form_id', config.formId).order('submitted_at', {
        ascending: false
      });
      
      if (error) {
        console.error('❌ Error fetching submissions:', error);
        return;
      }

      console.log('📊 Raw submissions fetched:', submissions?.length || 0);
      console.log('📋 Submissions data:', submissions);

      // Transform submissions to include user email
      const transformedSubmissions = (submissions || []).map(submission => ({
        ...submission,
        submitted_by_email: submission.user_profiles?.email || submission.submitted_by
      }));
      
      console.log('✅ Transformed submissions:', transformedSubmissions.length);
      setData(transformedSubmissions);
    } catch (error) {
      console.error('💥 Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);
  const handleAddSort = (field: string, label: string) => {
    setSortConfigs(prev => [...prev, {
      field,
      direction: 'asc',
      label
    }]);
  };
  const handleRemoveSort = (index: number) => {
    setSortConfigs(prev => prev.filter((_, i) => i !== index));
  };
  const handleToggleDirection = (index: number) => {
    setSortConfigs(prev => prev.map((config, i) => i === index ? {
      ...config,
      direction: config.direction === 'asc' ? 'desc' : 'asc'
    } : config));
  };
  const handleColumnFilter = (fieldId: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };
  const handleColumnToggle = (fieldId: string) => {
    setHasUserInteractedWithColumns(true);
    setSelectedColumns(prev => {
      if (prev.includes(fieldId)) {
        return prev.filter(id => id !== fieldId);
      } else {
        return [...prev, fieldId];
      }
    });
  };

  const handleApplyFilters = () => {
    setAppliedFilters([...complexFilters]);
  };

  const handleClearFilters = () => {
    setComplexFilters([]);
    setAppliedFilters([]);
  };

  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
  };
  if (loading) {
    return <Card className="h-full">
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Loading table data...</div>
        </CardContent>
      </Card>;
  }
  if (!config.formId) {
    return <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{config.title || 'Dynamic Table'}</span>
            {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-muted-foreground">No form selected</p>
            <p className="text-sm text-muted-foreground mt-1">Configure this table to select a data source</p>
          </div>
        </CardContent>
      </Card>;
  }
  const containerClasses = isExpanded ? "fixed inset-0 z-50 bg-background p-4 space-y-6" : "space-y-6";
  return <div className={containerClasses} data-dynamic-table="main">
      {/* Analytics Section */}
      {/* {!isExpanded && <SubmissionAnalytics data={data} />} */}
      
      <Card
        className="h-full flex flex-col overflow-hidden"
        style={{
          width: isExpanded ? '100vw' : 'calc(100vw - 280px)',
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
      <div className="space-y-1">
        <CardTitle className="text-lg font-semibold">{config.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {filteredAndSortedData.length} record{filteredAndSortedData.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isExpanded ? 'Normal View' : 'Expand'}
        </Button>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Settings className="h-4 w-4" />
            Configure
          </Button>
        )}
      </div>
    </div>

          {/* Applied Filters */}
          {(Object.keys(columnFilters).length > 0 || appliedFilters.length > 0) && <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(columnFilters).map(([fieldId, value]) => {
            if (!value) return null;
            const field = displayFields.find(f => f.id === fieldId);
            return <Badge key={fieldId} variant="secondary" className="text-xs h-5">
                    {field?.label}: {value}
                    <button className="ml-1" onClick={() => handleColumnFilter(fieldId, '')}>
                      ×
                    </button>
                  </Badge>;
          })}
              {appliedFilters.map((group, index) => <Badge key={`complex-${index}`} variant="secondary" className="text-xs h-5">
                  Applied Filter {index + 1}
                  <button className="ml-1" onClick={() => setAppliedFilters(prev => prev.filter((_, i) => i !== index))}>
                    ×
                  </button>
                </Badge>)}
            </div>}

          {/* Compact Controls Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Side Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <SavedFiltersManager formId={config.formId} onApplyFilter={setAppliedFilters} currentFilters={appliedFilters} />
              
              <DynamicTableColumnSelector formFields={formFields} selectedColumns={selectedColumns} onColumnToggle={handleColumnToggle} />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnOrderManager(true)}
                disabled={selectedColumns.length === 0}
                className="gap-2"
              >
                <Move className="h-4 w-4" />
                Reorder
              </Button>

              {config.enableFiltering && (
                <ComplexFilter filters={complexFilters} onFiltersChange={setComplexFilters} availableFields={availableFields} formId={config.formId} onApplyFilters={handleApplyFilters} onClearFilters={handleClearFilters} />
              )}
           
            </div>


            {/* Right Side Controls */}
            <div className="flex items-center gap-2">
              {/* Search */}
              {config.enableSearch && <div className="relative w-80">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-7 pr-8 h-8 text-xs" />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>}

              {/* Auto Refresh Toggle */}
              <div className="flex items-center space-x-1 bg-muted/30 rounded-md px-2 py-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">Auto</span>
                <Button variant="ghost" size="sm" onClick={loadData} className="h-5 w-5 p-0">
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
                    <div className="flex items-center justify-between gap-2">

            <div className="flex items-center gap-3 flex-wrap">

              {config.enableSorting && <SortingControls availableFields={displayFields.map(f => ({
              id: f.id,
              label: f.label
            }))} sortConfigs={sortConfigs} onAddSort={handleAddSort} onRemoveSort={handleRemoveSort} onToggleDirection={handleToggleDirection} />}

               <ExportDropdown data={exportData} />
              
              <SubmissionUpdateButton formId={config.formId} onUpdateComplete={loadData} />
              
              <ImportButton formId={config.formId} formFields={formFields} onImportComplete={loadData} />
            </div>
            </div>
        </CardHeader>
      
        <CardContent className="p-0 flex flex-col h-full">
          <div className={`${isExpanded ? 'h-[85vh]' : 'flex-1 min-h-0'} flex flex-col`}>
            <div className="flex flex-col h-full space-y-2 p-2">
              {/* Compact Page Size Selector */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <Select value={pageSize.toString()} onValueChange={value => setPageSize(parseInt(value))}>
                    <SelectTrigger className="w-16 h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

<div className="flex-1 min-h-0 border rounded-md overflow-hidden">
  <div className="h-full w-full overflow-auto">
    <Table className="min-w-full">

                <TableHeader className="sticky top-0 z-[5] bg-blue-600 border-b-2 border-blue-700">
                  <TableRow className="border-b border-blue-500">
                    <TableHead className="w-10 h-8 ">
                      <Checkbox checked={paginatedData.length > 0 && paginatedData.every(row => selectedRows.has(row.id))} onCheckedChange={handleSelectAll} aria-label="Select all rows" className="text-zinc-50 bg-transparent" />
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8 text-white  min-w-[140px]">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Submission ID
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8 text-white  min-w-[100px]">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8 text-white min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Submitted
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium h-8 text-white  min-w-[80px]">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Status
                      </div>
                    </TableHead>
                    
                    {/* Form fields */}
                    {displayFields.map(field => <TableHead key={field.id} className="text-xs font-medium h-8 text-white min-w-[200px]">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{field.label}</span>
                          {config.enableFiltering && <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className={`${columnFilters[field.id] ? 'text-white' : 'text-green-100'} h-5 w-5 p-0 hover:bg-green-700`} aria-label={`Filter ${field.label}`}>
                                  <Filter className="h-2.5 w-2.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64">
                                <div className="space-y-2">
                                  <Input placeholder={`Filter ${field.label}...`} value={columnFilters[field.id] || ''} onChange={e => handleColumnFilter(field.id, e.target.value)} />
                                  {columnFilters[field.id] && <div className="flex justify-end">
                                      <Button variant="ghost" size="sm" onClick={() => handleColumnFilter(field.id, '')}>
                                        Clear
                                      </Button>
                                    </div>}
                                </div>
                              </PopoverContent>
                            </Popover>}
                        </div>
                      </TableHead>)}
                    <TableHead className="text-xs font-medium text-center h-8 bg-green-600 text-white min-w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? <TableRow>
                      <TableCell colSpan={displayFields.length + 6} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {data.length === 0 ? (
                            <div className="space-y-2">
                              <div>No data available</div>
                              <div className="text-sm">No submissions have been made for this form yet.</div>
                            </div>
                          ) : filteredAndSortedData.length === 0 ? (
                            <div className="space-y-2">
                              <div>No records match your filters</div>
                              <div className="text-sm">Try adjusting your filter criteria or clearing all filters.</div>
                            </div>
                          ) : 'No records found'}
                        </div>
                      </TableCell>
                    </TableRow> : paginatedData.map(row => <TableRow
                      key={row.id} 
                      data-submission-ref={row.submission_ref_id}
                      className={`hover:bg-gray-50 border-b border-gray-200 ${
                        selectedRows.has(row.id) ? 'bg-blue-50' : 
                        row.submission_ref_id === highlightedSubmissionRef ? 'bg-yellow-100 border-yellow-300' : 
                        'bg-white'
                      }`}>
                        <TableCell className="py-2 bg-white">
                          <Checkbox checked={selectedRows.has(row.id)} onCheckedChange={checked => handleRowSelect(row.id, Boolean(checked))} aria-label={`Select row ${row.id}`} />
                        </TableCell>
                        
                        {/* Submission ID */}
                        <TableCell className="py-2 bg-white">
                          <Button variant="link" className="font-mono text-xs p-0 h-auto underline" onClick={() => navigate(`/submission/${row.id}`)}>
                            #{row.submission_ref_id || row.id.slice(0, 8)}
                          </Button>
                        </TableCell>
                        
                        {/* User Info */}
                        <TableCell className="py-2 bg-white">
                            <UserEmailCell userId={row.submitted_by} fallbackEmail={row.submitted_by_email} />
                        </TableCell>
                        
                       {/* Submitted Date */}
                       <TableCell className="py-2 bg-white">
                         <div className="text-xs">
                           <div className="font-medium">
                             {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '-'}
                           </div>
                           <div className="text-muted-foreground">
                             {row.submitted_at ? new Date(row.submitted_at).toLocaleTimeString() : '-'}
                           </div>
                         </div>
                       </TableCell>
                       
                       {/* Status */}
                       <TableCell className="py-2 bg-white">
                         <Badge variant="secondary" className="text-xs">
                           Submitted
                         </Badge>
                       </TableCell>
                       
                       {/* Form Fields */}
                      {displayFields.map(field => <TableCell key={field.id} className="py-2 max-w-58 bg-white">
                           <div className="min-w-0">
                             <FormDataCell value={row.submission_data?.[field.id]} fieldType={field.field_type || field.type} field={field} />
                           </div>
                         </TableCell>)}
                       
                        <TableCell className="py-2 bg-white">
                          <div className="flex items-center justify-center gap-1">
                             <Button variant="ghost" size="sm" onClick={() => handleViewSubmission(row.id)} className="h-6 w-6 p-0" title="View submission">
                               <Eye className="h-3 w-3" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={e => {
                               e.stopPropagation();
                               handleEditSubmission(row);
                             }} className="h-6 w-6 p-0" title="Edit submission">
                               <Edit3 className="h-3 w-3" />
                             </Button>
                             {canDeleteSubmissions && (
                               <DeleteSubmissionButton submissionId={row.id} onDelete={() => handleDeleteSubmission(row.id)} checkPermission={() => checkDeletePermission(row.id)} />
                             )}
                          </div>
                        </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
                </div>
              </div>

              {/* Compact Pagination */}
              <div className="flex items-center justify-between px-2 py-1 border-t">
                <div className="text-xs text-muted-foreground">
                  {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedData.length)}-{Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} h-6 px-2 text-xs`} />
                    </PaginationItem>
                    {Array.from({
                    length: Math.min(3, totalPages)
                  }, (_, i) => {
                    const pageNumber = currentPage <= 2 ? i + 1 : currentPage - 1 + i;
                    if (pageNumber > totalPages) return null;
                    return <PaginationItem key={pageNumber}>
                          <PaginationLink onClick={() => setCurrentPage(pageNumber)} isActive={currentPage === pageNumber} className="cursor-pointer h-6 px-2 text-xs">
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>;
                  })}
                    <PaginationItem>
                      <PaginationNext onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} h-6 px-2 text-xs`} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
               </div>
             </div>
           </div>
         </CardContent>
       </Card>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && <BulkActionsBar selectedCount={selectedRows.size} onBulkEdit={handleBulkEdit} onMultiLineEdit={handleMultiLineEdit} onCopyRecords={handleCopyRecords} onBulkDelete={handleBulkDelete} onClearSelection={handleClearSelection} canDelete={canDeleteSubmissions} />}

      {/* Dialogs */}
      <InlineEditDialog isOpen={showInlineEdit} onOpenChange={setShowInlineEdit} submissions={editingSubmission ? Array.isArray(editingSubmission) ? editingSubmission : [editingSubmission] : []} formFields={formFields || []} onSave={handleInlineEditSave} />

      <MultiLineEditDialog isOpen={showMultiLineEdit} onOpenChange={setShowMultiLineEdit} submissions={editingSubmission ? Array.isArray(editingSubmission) ? editingSubmission : [editingSubmission] : []} formFields={formFields || []} onSave={handleInlineEditSave} />

      <BulkDeleteDialog isOpen={showBulkDelete} onOpenChange={setShowBulkDelete} submissionIds={Array.from(selectedRows)} onDelete={handleBulkDeleteComplete} />

      <ColumnOrderManager isOpen={showColumnOrderManager} onOpenChange={setShowColumnOrderManager} formFields={formFields} selectedColumns={columnOrder.length > 0 ? columnOrder : formFields.map(f => f.id)} onColumnOrderChange={handleColumnOrderChange} />

      <CopyRecordsDialog 
        isOpen={showCopyRecords} 
        onOpenChange={setShowCopyRecords} 
        selectedCount={selectedRows.size}
        selectedRecords={paginatedData.filter(row => selectedRows.has(row.id))}
        onCopy={handleCopySubmissions} 
      />

      <CrossReferenceDialog
        open={showCrossReferenceDialog} 
        onOpenChange={setShowCrossReferenceDialog} 
        submissionIds={crossReferenceData || []} 
        parentFormId={config.formId}
        fieldName={crossReferenceFieldName}
        targetFormId={crossReferenceTargetFormId}
        displayFieldIds={crossReferenceDisplayFields}
      />
    </div>;
}