import { useState, useEffect } from 'react';
import { DataFeed, DataFeedFormData, FieldMapping, MatchingRule, SourceFilter, FilterOperator, SCHEDULE_PRESETS, FILTER_OPERATORS, ScheduleConfig, buildCronFromConfig, parseCronToReadable, getOperatorsForFieldType, getFieldCategory, SourceType, ExternalSourceConfig as ExternalSourceConfigType, DiscoveredField, CrossRefRecordSelection, CrossRefMatchRule } from '@/types/dataFeed';
import { DataSourceConnection } from '@/types/externalDataSource';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, ArrowRight, Clock, Calendar, RefreshCw, AlertCircle, Filter, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';
import { Separator } from '@/components/ui/separator';
import { FilterValueInput } from './FilterValueInput';
import { ExternalSourceConfig } from './ExternalSourceConfig';

interface DataFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed?: DataFeed | null;
  projectId: string;
  onSave: (data: DataFeedFormData) => Promise<boolean>;
}

interface FormOption {
  id: string;
  name: string;
}

interface FieldOption {
  id: string;
  label: string;
  field_type: string;
  options?: { label: string; value: string }[];
  custom_config?: any;
}

interface CrossRefFormFields {
  crossRefFieldId: string;
  referencedFormId: string;
  referencedFormName: string;
  fields: FieldOption[];
}

export function DataFeedDialog({
  open,
  onOpenChange,
  feed,
  projectId,
  onSave,
}: DataFeedDialogProps) {
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [sourceFields, setSourceFields] = useState<FieldOption[]>([]);
  const [targetFields, setTargetFields] = useState<FieldOption[]>([]);
  const [crossRefFields, setCrossRefFields] = useState<FieldOption[]>([]);
  const [crossRefFormFields, setCrossRefFormFields] = useState<CrossRefFormFields[]>([]);
  const [scheduleType, setScheduleType] = useState<'none' | 'preset' | 'interval' | 'custom'>('none');
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    type: 'preset',
    intervalValue: 1,
    intervalUnit: 'hours',
    atTime: '09:00',
    onDays: [1, 2, 3, 4, 5], // Mon-Fri by default
  });
  // External source state
  const [sharedConnections, setSharedConnections] = useState<DataSourceConnection[]>([]);
  const [useSharedConnection, setUseSharedConnection] = useState(false);
  const [discoveredFields, setDiscoveredFields] = useState<DiscoveredField[]>([]);

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const [formData, setFormData] = useState<DataFeedFormData>({
    name: '',
    description: '',
    source_type: 'form',
    source_form_id: '',
    external_source_config: {},
    target_form_id: '',
    matching_type: 'field_matching',
    matching_rules: [],
    matching_logic: '',
    cross_ref_record_selection: 'all',
    cross_ref_match_rules: [],
    cross_ref_match_logic: '',
    source_filters: [],
    source_filter_logic: '',
    field_mappings: [],
    no_match_behavior: 'skip',
    schedule: '',
    is_active: true,
  });

  const [logicError, setLogicError] = useState<string | null>(null);
  const [filterLogicError, setFilterLogicError] = useState<string | null>(null);
  const [crossRefMatchLogicError, setCrossRefMatchLogicError] = useState<string | null>(null);

  // Load forms and shared connections
  useEffect(() => {
    if (!projectId || !open) return;

    const fetchForms = async () => {
      const { data } = await supabase
        .from('forms')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      
      setForms(data || []);
    };

    const fetchConnections = async () => {
      const { data } = await supabase
        .from('data_source_connections')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('name');
      
      // Map database records to DataSourceConnection type
      const connections = (data || []).map(conn => ({
        ...conn,
        discovered_fields: Array.isArray(conn.discovered_fields) 
          ? (conn.discovered_fields as unknown as DiscoveredField[]) 
          : []
      })) as DataSourceConnection[];
      setSharedConnections(connections);
    };

    fetchForms();
    fetchConnections();
  }, [projectId, open]);

  // Load source form fields (for 'form' source type)
  useEffect(() => {
    // For external sources, use discovered fields instead
    if (formData.source_type !== 'form') {
      // Convert discovered fields to FieldOption format
      const externalFields = discoveredFields.map(f => ({
        id: f.name, // Use field name as ID for external sources
        label: f.name,
        field_type: f.type,
        options: undefined,
        custom_config: undefined
      }));
      setSourceFields(externalFields);
      setCrossRefFields([]);
      setCrossRefFormFields([]);
      return;
    }

    if (!formData.source_form_id) {
      setSourceFields([]);
      setCrossRefFields([]);
      setCrossRefFormFields([]);
      return;
    }

    const fetchFields = async () => {
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type, options, custom_config')
        .eq('form_id', formData.source_form_id)
        .order('field_order');

      const fields = (data || []).map(f => ({
        ...f,
        options: f.options as { label: string; value: string }[] | undefined
      }));
      setSourceFields(fields);
      
      const crossRefs = fields.filter(f => f.field_type === 'cross-reference');
      setCrossRefFields(crossRefs);
      
      // Fetch fields from cross-referenced forms
      const crossRefData: CrossRefFormFields[] = [];
      for (const crossRef of crossRefs) {
        const config = crossRef.custom_config as any;
        const referencedFormId = config?.referencedFormId;
        if (referencedFormId) {
          // Get referenced form name
          const { data: formData } = await supabase
            .from('forms')
            .select('name')
            .eq('id', referencedFormId)
            .single();
          
          // Get fields from referenced form
          const { data: refFields } = await supabase
            .from('form_fields')
            .select('id, label, field_type')
            .eq('form_id', referencedFormId)
            .order('field_order');
          
          crossRefData.push({
            crossRefFieldId: crossRef.id,
            referencedFormId,
            referencedFormName: formData?.name || 'Unknown Form',
            fields: refFields || []
          });
        }
      }
      setCrossRefFormFields(crossRefData);
    };

    fetchFields();
  }, [formData.source_form_id, formData.source_type, discoveredFields]);

  // Load target form fields
  useEffect(() => {
    if (!formData.target_form_id) {
      setTargetFields([]);
      return;
    }

    const fetchFields = async () => {
      const { data } = await supabase
        .from('form_fields')
        .select('id, label, field_type')
        .eq('form_id', formData.target_form_id)
        .order('field_order');

      setTargetFields(data || []);
    };

    fetchFields();
  }, [formData.target_form_id]);

  // Initialize form data when editing
  useEffect(() => {
    if (feed) {
      // Ensure matching rules have IDs
      const rulesWithIds = (feed.matching_rules || []).map((rule, idx) => ({
        ...rule,
        id: rule.id || String(idx + 1)
      }));
      
      // Ensure source filters have IDs
      const filtersWithIds = (feed.source_filters || []).map((filter, idx) => ({
        ...filter,
        id: filter.id || String(idx + 1)
      }));

      // Ensure cross-ref match rules have IDs
      const crossRefMatchRulesWithIds = (feed.cross_ref_match_rules || []).map((rule, idx) => ({
        ...rule,
        id: rule.id || String(idx + 1)
      }));

      // Get source_type from feed (cast from database)
      const feedAny = feed as any;
      const sourceType: SourceType = feedAny.source_type || 'form';
      const externalConfig = feedAny.external_source_config || {};
      const connectionId = feedAny.data_source_connection_id;
      
      setFormData({
        name: feed.name,
        description: feed.description || '',
        source_type: sourceType,
        source_form_id: feed.source_form_id,
        external_source_config: externalConfig,
        data_source_connection_id: connectionId,
        target_form_id: feed.target_form_id,
        matching_type: feed.matching_type,
        cross_reference_field_id: feed.cross_reference_field_id,
        cross_ref_record_selection: feed.cross_ref_record_selection || 'all',
        cross_ref_match_rules: crossRefMatchRulesWithIds,
        cross_ref_match_logic: feed.cross_ref_match_logic || '',
        matching_rules: rulesWithIds,
        matching_logic: feed.matching_logic || '',
        source_filters: filtersWithIds,
        source_filter_logic: feed.source_filter_logic || '',
        field_mappings: feed.field_mappings || [],
        no_match_behavior: feed.no_match_behavior,
        schedule: feed.schedule || '',
        is_active: feed.is_active,
      });
      
      setUseSharedConnection(!!connectionId);
    } else {
      setFormData({
        name: '',
        description: '',
        source_type: 'form',
        source_form_id: '',
        external_source_config: {},
        target_form_id: '',
        matching_type: 'field_matching',
        matching_rules: [],
        matching_logic: '',
        cross_ref_record_selection: 'all',
        cross_ref_match_rules: [],
        cross_ref_match_logic: '',
        source_filters: [],
        source_filter_logic: '',
        field_mappings: [],
        no_match_behavior: 'skip',
        schedule: '',
        is_active: true,
      });
      setUseSharedConnection(false);
      setDiscoveredFields([]);
    }
    setLogicError(null);
    setFilterLogicError(null);
    setCrossRefMatchLogicError(null);
  }, [feed, open]);

  const handleSave = async () => {
    // For form source type, require source_form_id
    // For external sources, either need config or connection
    const hasValidSource = formData.source_type === 'form' 
      ? formData.source_form_id 
      : (formData.data_source_connection_id || formData.external_source_config);
      
    if (!formData.name || !hasValidSource || !formData.target_form_id) return;

    setSaving(true);
    const success = await onSave(formData);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  // ========== Source Filters ==========
  const addSourceFilter = () => {
    const newId = String((formData.source_filters?.length || 0) + 1);
    setFormData(prev => {
      const newFilters = [...(prev.source_filters || []), { id: newId, fieldId: '', operator: 'equals' as FilterOperator, value: '' }];
      const autoLogic = newFilters.length >= 2 && !prev.source_filter_logic
        ? newFilters.map(f => f.id).join(' AND ')
        : prev.source_filter_logic;
      return {
        ...prev,
        source_filters: newFilters,
        source_filter_logic: autoLogic,
      };
    });
  };

  const updateSourceFilter = (index: number, field: keyof SourceFilter, value: string) => {
    const sourceField = field === 'fieldId' ? sourceFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      source_filters: (prev.source_filters || []).map((filter, i) => {
        if (i !== index) return filter;
        
        const updates: Partial<SourceFilter> = { [field]: value };
        
        if (sourceField) {
          updates.fieldName = sourceField.label;
          updates.fieldType = sourceField.field_type;
          // Reset operator to a valid one for the new field type
          const validOperators = getOperatorsForFieldType(sourceField.field_type);
          if (!validOperators.find(op => op.value === filter.operator)) {
            updates.operator = validOperators[0]?.value || 'equals';
          }
          // Reset value when field changes
          updates.value = '';
        }
        
        return { ...filter, ...updates };
      }),
    }));
  };

  const removeSourceFilter = (index: number) => {
    setFormData(prev => {
      const removedId = (prev.source_filters || [])[index]?.id;
      const newFilters = (prev.source_filters || []).filter((_, i) => i !== index);
      
      let newLogic = prev.source_filter_logic || '';
      if (removedId && newLogic) {
        newLogic = newLogic
          .replace(new RegExp(`\\b${removedId}\\b\\s*(AND|OR)\\s*`, 'gi'), '')
          .replace(new RegExp(`\\s*(AND|OR)\\s*\\b${removedId}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${removedId}\\b`, 'g'), '')
          .replace(/\(\s*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return {
        ...prev,
        source_filters: newFilters,
        source_filter_logic: newFilters.length < 2 ? '' : newLogic,
      };
    });
  };

  const validateFilterLogicExpression = (expression: string): boolean => {
    if (!expression || (formData.source_filters?.length || 0) < 2) {
      setFilterLogicError(null);
      return true;
    }
    
    const validation = ExpressionEvaluator.validate(expression);
    if (!validation.valid) {
      setFilterLogicError(validation.error || 'Invalid expression');
      return false;
    }
    
    const referencedIds = ExpressionEvaluator.extractConditionIds(expression);
    const existingIds = (formData.source_filters || []).map(f => f.id);
    const invalidIds = referencedIds.filter(id => !existingIds.includes(id));
    
    if (invalidIds.length > 0) {
      setFilterLogicError(`Unknown filter ID(s): ${invalidIds.join(', ')}`);
      return false;
    }
    
    setFilterLogicError(null);
    return true;
  };

  const handleFilterLogicChange = (value: string) => {
    setFormData(prev => ({ ...prev, source_filter_logic: value }));
    validateFilterLogicExpression(value);
  };

  // ========== Matching Rules ==========
  const addMatchingRule = () => {
    const newId = String(formData.matching_rules.length + 1);
    setFormData(prev => {
      const newRules = [...prev.matching_rules, { id: newId, sourceFieldId: '', targetFieldId: '' }];
      const autoLogic = newRules.length >= 2 && !prev.matching_logic
        ? newRules.map(r => r.id).join(' AND ')
        : prev.matching_logic;
      return {
        ...prev,
        matching_rules: newRules,
        matching_logic: autoLogic,
      };
    });
  };

  const updateMatchingRule = (index: number, field: keyof MatchingRule, value: string) => {
    const sourceField = field === 'sourceFieldId' ? sourceFields.find(f => f.id === value) : null;
    const targetField = field === 'targetFieldId' ? targetFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map((rule, i) => 
        i === index ? { 
          ...rule, 
          [field]: value,
          ...(sourceField ? { sourceFieldName: sourceField.label } : {}),
          ...(targetField ? { targetFieldName: targetField.label } : {}),
        } : rule
      ),
    }));
  };

  const removeMatchingRule = (index: number) => {
    setFormData(prev => {
      const removedId = prev.matching_rules[index]?.id;
      const newRules = prev.matching_rules.filter((_, i) => i !== index);
      
      let newLogic = prev.matching_logic || '';
      if (removedId && newLogic) {
        newLogic = newLogic
          .replace(new RegExp(`\\b${removedId}\\b\\s*(AND|OR)\\s*`, 'gi'), '')
          .replace(new RegExp(`\\s*(AND|OR)\\s*\\b${removedId}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${removedId}\\b`, 'g'), '')
          .replace(/\(\s*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return {
        ...prev,
        matching_rules: newRules,
        matching_logic: newRules.length < 2 ? '' : newLogic,
      };
    });
  };

  const validateLogicExpression = (expression: string): boolean => {
    if (!expression || formData.matching_rules.length < 2) {
      setLogicError(null);
      return true;
    }
    
    const validation = ExpressionEvaluator.validate(expression);
    if (!validation.valid) {
      setLogicError(validation.error || 'Invalid expression');
      return false;
    }
    
    const referencedIds = ExpressionEvaluator.extractConditionIds(expression);
    const existingIds = formData.matching_rules.map(r => r.id);
    const invalidIds = referencedIds.filter(id => !existingIds.includes(id));
    
    if (invalidIds.length > 0) {
      setLogicError(`Unknown rule ID(s): ${invalidIds.join(', ')}`);
      return false;
    }
    
    setLogicError(null);
    return true;
  };

  const handleLogicChange = (value: string) => {
    setFormData(prev => ({ ...prev, matching_logic: value }));
    validateLogicExpression(value);
  };

  // ========== Cross-Reference Match Rules (for cross_reference matching type) ==========
  const getSelectedCrossRefFormFields = (): FieldOption[] => {
    if (!formData.cross_reference_field_id) return [];
    const data = crossRefFormFields.find(c => c.crossRefFieldId === formData.cross_reference_field_id);
    return data?.fields || [];
  };

  const addCrossRefMatchRule = () => {
    const newId = String((formData.cross_ref_match_rules?.length || 0) + 1);
    setFormData(prev => {
      const newRules = [...(prev.cross_ref_match_rules || []), { 
        id: newId, 
        linkedFieldId: '', 
        matchType: 'source_field' as const,
        staticValue: '',
        sourceFieldId: ''
      }];
      const autoLogic = newRules.length >= 2 && !prev.cross_ref_match_logic
        ? newRules.map(r => r.id).join(' AND ')
        : prev.cross_ref_match_logic;
      return {
        ...prev,
        cross_ref_match_rules: newRules,
        cross_ref_match_logic: autoLogic,
      };
    });
  };

  const updateCrossRefMatchRule = (index: number, field: keyof CrossRefMatchRule, value: string) => {
    const linkedFields = getSelectedCrossRefFormFields();
    const linkedField = field === 'linkedFieldId' ? linkedFields.find(f => f.id === value) : null;
    const sourceField = field === 'sourceFieldId' ? sourceFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      cross_ref_match_rules: (prev.cross_ref_match_rules || []).map((rule, i) => {
        if (i !== index) return rule;
        
        const updates: Partial<CrossRefMatchRule> = { [field]: value };
        
        if (linkedField) {
          updates.linkedFieldName = linkedField.label;
        }
        if (sourceField) {
          updates.sourceFieldName = sourceField.label;
        }
        if (field === 'matchType') {
          // Reset values when changing match type
          updates.staticValue = '';
          updates.sourceFieldId = '';
          updates.sourceFieldName = '';
        }
        
        return { ...rule, ...updates };
      }),
    }));
  };

  const removeCrossRefMatchRule = (index: number) => {
    setFormData(prev => {
      const removedId = (prev.cross_ref_match_rules || [])[index]?.id;
      const newRules = (prev.cross_ref_match_rules || []).filter((_, i) => i !== index);
      
      let newLogic = prev.cross_ref_match_logic || '';
      if (removedId && newLogic) {
        newLogic = newLogic
          .replace(new RegExp(`\\b${removedId}\\b\\s*(AND|OR)\\s*`, 'gi'), '')
          .replace(new RegExp(`\\s*(AND|OR)\\s*\\b${removedId}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${removedId}\\b`, 'g'), '')
          .replace(/\(\s*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return {
        ...prev,
        cross_ref_match_rules: newRules,
        cross_ref_match_logic: newRules.length < 2 ? '' : newLogic,
      };
    });
  };

  const validateCrossRefMatchLogicExpression = (expression: string): boolean => {
    if (!expression || (formData.cross_ref_match_rules?.length || 0) < 2) {
      setCrossRefMatchLogicError(null);
      return true;
    }
    
    const validation = ExpressionEvaluator.validate(expression);
    if (!validation.valid) {
      setCrossRefMatchLogicError(validation.error || 'Invalid expression');
      return false;
    }
    
    const referencedIds = ExpressionEvaluator.extractConditionIds(expression);
    const existingIds = (formData.cross_ref_match_rules || []).map(r => r.id);
    const invalidIds = referencedIds.filter(id => !existingIds.includes(id));
    
    if (invalidIds.length > 0) {
      setCrossRefMatchLogicError(`Unknown rule ID(s): ${invalidIds.join(', ')}`);
      return false;
    }
    
    setCrossRefMatchLogicError(null);
    return true;
  };

  const handleCrossRefMatchLogicChange = (value: string) => {
    setFormData(prev => ({ ...prev, cross_ref_match_logic: value }));
    validateCrossRefMatchLogicExpression(value);
  };

  // ========== Field Mappings ==========
  const addFieldMapping = (type: 'direct' | 'cross_reference' = 'direct') => {
    setFormData(prev => ({
      ...prev,
      field_mappings: [...prev.field_mappings, { 
        sourceFieldId: '', 
        targetFieldId: '',
        sourceType: type,
        crossRefFieldId: type === 'cross_reference' ? '' : undefined,
        crossRefSourceFieldId: type === 'cross_reference' ? '' : undefined,
      }],
    }));
  };

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const sourceField = field === 'sourceFieldId' ? sourceFields.find(f => f.id === value) : null;
    const targetField = field === 'targetFieldId' ? targetFields.find(f => f.id === value) : null;
    const crossRefField = field === 'crossRefFieldId' ? crossRefFields.find(f => f.id === value) : null;

    setFormData(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.map((mapping, i) => {
        if (i !== index) return mapping;
        
        let updates: Partial<FieldMapping> = { [field]: value };
        
        if (sourceField) {
          updates.sourceFieldName = sourceField.label;
        }
        if (targetField) {
          updates.targetFieldName = targetField.label;
        }
        if (crossRefField) {
          updates.crossRefFieldName = crossRefField.label;
          // Reset the cross-ref source field and matching when changing the cross-ref field
          updates.crossRefSourceFieldId = '';
          updates.crossRefSourceFieldName = '';
          updates.crossRefMatchType = 'first';
          updates.crossRefMatchFieldId = '';
          updates.crossRefMatchFieldName = '';
          updates.crossRefMatchValue = '';
          updates.crossRefMatchSourceFieldId = '';
          updates.crossRefMatchSourceFieldName = '';
        }
        if (field === 'crossRefSourceFieldId') {
          // Find the field name from cross-ref form fields
          const crossRefData = crossRefFormFields.find(c => c.crossRefFieldId === mapping.crossRefFieldId);
          const refField = crossRefData?.fields.find(f => f.id === value);
          if (refField) {
            updates.crossRefSourceFieldName = refField.label;
          }
        }
        if (field === 'crossRefMatchFieldId') {
          // Find the field name from cross-ref form fields
          const crossRefData = crossRefFormFields.find(c => c.crossRefFieldId === mapping.crossRefFieldId);
          const matchField = crossRefData?.fields.find(f => f.id === value);
          if (matchField) {
            updates.crossRefMatchFieldName = matchField.label;
          }
        }
        if (field === 'crossRefMatchSourceFieldId') {
          const matchSourceField = sourceFields.find(f => f.id === value);
          if (matchSourceField) {
            updates.crossRefMatchSourceFieldName = matchSourceField.label;
          }
        }
        if (field === 'crossRefMatchType') {
          // Reset values when changing match type
          updates.crossRefMatchValue = '';
          updates.crossRefMatchSourceFieldId = '';
          updates.crossRefMatchSourceFieldName = '';
          if (value === 'first') {
            updates.crossRefMatchFieldId = '';
            updates.crossRefMatchFieldName = '';
          }
        }
        
        return { ...mapping, ...updates };
      }),
    }));
  };

  const removeFieldMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      field_mappings: prev.field_mappings.filter((_, i) => i !== index),
    }));
  };

  const getCrossRefFormFields = (crossRefFieldId: string): FieldOption[] => {
    const data = crossRefFormFields.find(c => c.crossRefFieldId === crossRefFieldId);
    return data?.fields || [];
  };

  const getCrossRefFormName = (crossRefFieldId: string): string => {
    const data = crossRefFormFields.find(c => c.crossRefFieldId === crossRefFieldId);
    return data?.referencedFormName || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{feed ? 'Edit Data Feed' : 'Create Data Feed'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="source">Data Source</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="matching">Matching</TabsTrigger>
              <TabsTrigger value="mappings">Mappings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            {/* General Tab - Name, Description, Active only */}
            <TabsContent value="general" className="space-y-4 p-1">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Data Feed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this feed does..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-4 p-1">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <div>
                    <Label className="text-base">Execution Schedule</Label>
                    <p className="text-sm text-muted-foreground">Configure when this feed runs automatically</p>
                  </div>
                </div>
                
                <RadioGroup
                  value={scheduleType}
                  onValueChange={(value) => {
                    const newType = value as 'none' | 'preset' | 'interval' | 'custom';
                    setScheduleType(newType);
                    if (newType === 'none') {
                      setFormData(prev => ({ ...prev, schedule: '' }));
                    }
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="none" id="schedule_none" />
                    <Label htmlFor="schedule_none" className="font-normal cursor-pointer flex-1">Manual only</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="preset" id="schedule_preset" />
                    <Label htmlFor="schedule_preset" className="font-normal cursor-pointer flex-1">Preset</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="interval" id="schedule_interval" />
                    <Label htmlFor="schedule_interval" className="font-normal cursor-pointer flex-1">Custom interval</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50">
                    <RadioGroupItem value="custom" id="schedule_custom" />
                    <Label htmlFor="schedule_custom" className="font-normal cursor-pointer flex-1">Cron expression</Label>
                  </div>
                </RadioGroup>

                {scheduleType === 'preset' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Select a preset schedule</Label>
                    <Select
                      value={formData.schedule || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, schedule: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose schedule..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Frequent</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'frequent').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Hourly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'hourly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Daily</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'daily').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Weekly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'weekly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Monthly</div>
                        {SCHEDULE_PRESETS.filter(p => p.category === 'monthly').map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scheduleType === 'interval' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Every</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={scheduleConfig.intervalValue || 1}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              setScheduleConfig(prev => ({ ...prev, intervalValue: value }));
                              const newConfig = { ...scheduleConfig, intervalValue: value };
                              setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                            }}
                            className="w-20"
                          />
                          <Select
                            value={scheduleConfig.intervalUnit || 'hours'}
                            onValueChange={(value) => {
                              const unit = value as 'minutes' | 'hours' | 'days';
                              setScheduleConfig(prev => ({ ...prev, intervalUnit: unit }));
                              const newConfig = { ...scheduleConfig, intervalUnit: unit };
                              setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {scheduleConfig.intervalUnit === 'days' && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">At time</Label>
                          <Input
                            type="time"
                            value={scheduleConfig.atTime || '09:00'}
                            onChange={(e) => {
                              setScheduleConfig(prev => ({ ...prev, atTime: e.target.value }));
                              const newConfig = { ...scheduleConfig, atTime: e.target.value };
                              setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {scheduleConfig.intervalUnit === 'days' && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">On days (leave empty for every day)</Label>
                        <div className="flex gap-1">
                          {DAYS_OF_WEEK.map((day) => (
                            <Button
                              key={day.value}
                              type="button"
                              size="sm"
                              variant={(scheduleConfig.onDays || []).includes(day.value) ? 'default' : 'outline'}
                              className="h-8 w-10 p-0"
                              onClick={() => {
                                const currentDays = scheduleConfig.onDays || [];
                                const newDays = currentDays.includes(day.value)
                                  ? currentDays.filter(d => d !== day.value)
                                  : [...currentDays, day.value].sort();
                                setScheduleConfig(prev => ({ ...prev, onDays: newDays }));
                                const newConfig = { ...scheduleConfig, onDays: newDays };
                                setFormData(prev => ({ ...prev, schedule: buildCronFromConfig(newConfig) }));
                              }}
                            >
                              {day.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {scheduleType === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Cron expression</Label>
                    <Input
                      value={formData.schedule || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                      placeholder="*/15 * * * *"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: minute hour day-of-month month day-of-week
                    </p>
                  </div>
                )}

                {formData.schedule && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{parseCronToReadable(formData.schedule)}</span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Data Source Tab */}
            <TabsContent value="source" className="space-y-4 p-1">
              <ExternalSourceConfig
                sourceType={formData.source_type || 'form'}
                onSourceTypeChange={(type) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    source_type: type,
                    // Clear source_form_id when switching away from form
                    source_form_id: type === 'form' ? prev.source_form_id : '',
                    // Clear external config when switching to form
                    external_source_config: type === 'form' ? {} : prev.external_source_config,
                  }));
                  // Clear discovered fields when changing source type
                  if (type !== formData.source_type) {
                    setDiscoveredFields([]);
                  }
                }}
                config={formData.external_source_config || {}}
                onConfigChange={(config) => setFormData(prev => ({ ...prev, external_source_config: config }))}
                discoveredFields={discoveredFields}
                onFieldsDiscovered={setDiscoveredFields}
                projectId={projectId}
                sharedConnections={sharedConnections}
                selectedConnectionId={formData.data_source_connection_id}
                onConnectionSelect={(id) => setFormData(prev => ({ ...prev, data_source_connection_id: id }))}
                useSharedConnection={useSharedConnection}
                onUseSharedConnectionChange={setUseSharedConnection}
              />

              {/* Form source - show form selector */}
              {formData.source_type === 'form' && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Source Form *</Label>
                  <Select
                    value={formData.source_form_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, source_form_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source form" />
                    </SelectTrigger>
                    <SelectContent>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show discovered fields */}
              {discoveredFields.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Discovered Fields ({discoveredFields.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {discoveredFields.map((field, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {field.name}
                        <span className="ml-1 opacity-60">({field.type})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Target Form */}
              <div className="space-y-2">
                <Label>Target Form *</Label>
                <Select
                  value={formData.target_form_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, target_form_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target form" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Records from the data source will be matched and synced to this form
                </p>
              </div>
            </TabsContent>

            {/* Source Filters Tab */}
            <TabsContent value="filters" className="space-y-4 p-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <Label>Source Record Filters</Label>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSourceFilter}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Filter
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only process source records that match these conditions. Leave empty to process all records.
                </p>
              </div>

              {(formData.source_filters?.length || 0) === 0 && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <Filter className="h-8 w-8 mb-2" />
                  <p className="text-sm">No filters configured</p>
                  <p className="text-xs">All source records will be processed</p>
                </div>
              )}

              {(formData.source_filters || []).map((filter, index) => {
                const selectedField = sourceFields.find(f => f.id === filter.fieldId);
                const fieldType = selectedField?.field_type || filter.fieldType || 'text';
                const availableOperators = getOperatorsForFieldType(fieldType);
                const currentOperator = availableOperators.find(op => op.value === filter.operator);
                const requiresValue = currentOperator?.requiresValue !== false;

                return (
                  <div key={filter.id || index} className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <Badge variant="secondary" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs font-bold">
                      {filter.id || index + 1}
                    </Badge>
                    
                    <Select
                      value={filter.fieldId}
                      onValueChange={(value) => updateSourceFilter(index, 'fieldId', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            <span className="flex items-center gap-2">
                              {field.label}
                              <span className="text-xs text-muted-foreground">({field.field_type})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(value) => updateSourceFilter(index, 'operator', value)}
                      disabled={!filter.fieldId}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOperators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {requiresValue && filter.fieldId && (
                      <FilterValueInput
                        fieldType={fieldType}
                        value={filter.value}
                        onChange={(value) => updateSourceFilter(index, 'value', value)}
                        field={selectedField}
                        operator={filter.operator}
                        className="flex-1 min-w-[150px]"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSourceFilter(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}

              {/* Filter Logic Expression UI */}
              {(formData.source_filters?.length || 0) >= 2 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Filter Logic Expression</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleFilterLogicChange((formData.source_filters || []).map(f => f.id).join(' AND '))}
                      >
                        All (AND)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleFilterLogicChange((formData.source_filters || []).map(f => f.id).join(' OR '))}
                      >
                        Any (OR)
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={formData.source_filter_logic || ''}
                    onChange={(e) => handleFilterLogicChange(e.target.value)}
                    placeholder={`e.g., 1 AND 2, (1 OR 2) AND 3`}
                    className={filterLogicError ? 'border-destructive' : ''}
                  />
                  {filterLogicError && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {filterLogicError}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Use filter numbers with AND, OR, NOT and parentheses. Default: all filters must match (AND).
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="matching" className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Matching Type</Label>
                  <RadioGroup
                    value={formData.matching_type}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      matching_type: value as 'cross_reference' | 'field_matching' 
                    }))}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                      <RadioGroupItem value="field_matching" id="field_matching" />
                      <Label htmlFor="field_matching" className="font-normal cursor-pointer flex-1">
                        Field Value Matching
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                      <RadioGroupItem value="cross_reference" id="cross_reference" />
                      <Label htmlFor="cross_reference" className="font-normal cursor-pointer flex-1">
                        Cross-Reference Field
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>When No Match Found</Label>
                  <RadioGroup
                    value={formData.no_match_behavior}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      no_match_behavior: value as 'skip' | 'create' 
                    }))}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                      <RadioGroupItem value="skip" id="skip" />
                      <Label htmlFor="skip" className="font-normal cursor-pointer flex-1">
                        Skip (update existing only)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                      <RadioGroupItem value="create" id="create" />
                      <Label htmlFor="create" className="font-normal cursor-pointer flex-1">
                        Create new record in target form
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {formData.matching_type === 'cross_reference' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cross-Reference Field</Label>
                    <Select
                      value={formData.cross_reference_field_id || ''}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        cross_reference_field_id: value,
                        // Reset match rules when changing cross-ref field
                        cross_ref_match_rules: [],
                        cross_ref_match_logic: ''
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cross-reference field" />
                      </SelectTrigger>
                      <SelectContent>
                        {crossRefFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {crossRefFields.length === 0 && formData.source_form_id && (
                      <p className="text-sm text-muted-foreground">
                        No cross-reference fields found in the source form.
                      </p>
                    )}
                  </div>

                  {/* Record Selection - which linked records to update */}
                  {formData.cross_reference_field_id && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Record Selection</Label>
                        <p className="text-xs text-muted-foreground">
                          Choose which linked records to update when multiple are linked.
                        </p>
                      </div>
                      
                      <RadioGroup
                        value={formData.cross_ref_record_selection || 'all'}
                        onValueChange={(value) => setFormData(prev => ({ 
                          ...prev, 
                          cross_ref_record_selection: value as CrossRefRecordSelection,
                          // Clear match rules if not using match_by_field
                          cross_ref_match_rules: value === 'match_by_field' ? prev.cross_ref_match_rules : [],
                          cross_ref_match_logic: value === 'match_by_field' ? prev.cross_ref_match_logic : ''
                        }))}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                          <RadioGroupItem value="all" id="cross_ref_all" />
                          <Label htmlFor="cross_ref_all" className="font-normal cursor-pointer flex-1">
                            All Records — Update all linked records
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                          <RadioGroupItem value="first" id="cross_ref_first" />
                          <Label htmlFor="cross_ref_first" className="font-normal cursor-pointer flex-1">
                            First Record — Update only the first linked record
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                          <RadioGroupItem value="match_by_field" id="cross_ref_match" />
                          <Label htmlFor="cross_ref_match" className="font-normal cursor-pointer flex-1">
                            Match by Field — Update only records matching field rules
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* Field Match Rules */}
                      {formData.cross_ref_record_selection === 'match_by_field' && (
                        <div className="space-y-3 pt-3 border-t border-dashed">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Field Match Rules</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addCrossRefMatchRule}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Rule
                            </Button>
                          </div>

                          {(formData.cross_ref_match_rules?.length || 0) === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Add rules to filter which linked records should be updated.
                            </p>
                          )}

                          {(formData.cross_ref_match_rules || []).map((rule, index) => (
                            <div key={rule.id || index} className="space-y-2 p-3 border rounded-md bg-muted/30">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs font-bold">
                                  {rule.id || index + 1}
                                </Badge>
                                
                                {/* Target form field to match */}
                                <Select
                                  value={rule.linkedFieldId}
                                  onValueChange={(value) => updateCrossRefMatchRule(index, 'linkedFieldId', value)}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Target form field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {targetFields.map((field) => (
                                      <SelectItem key={field.id} value={field.id}>
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <span className="text-xs text-muted-foreground">=</span>

                                {/* Match type */}
                                <Select
                                  value={rule.matchType}
                                  onValueChange={(value) => updateCrossRefMatchRule(index, 'matchType', value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Match type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="source_field">Source Field</SelectItem>
                                    <SelectItem value="static_value">Static Value</SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Value input based on match type */}
                                {rule.matchType === 'static_value' ? (
                                  <Input
                                    value={rule.staticValue || ''}
                                    onChange={(e) => updateCrossRefMatchRule(index, 'staticValue', e.target.value)}
                                    placeholder="Value"
                                    className="flex-1"
                                  />
                                ) : (
                                  <Select
                                    value={rule.sourceFieldId || ''}
                                    onValueChange={(value) => updateCrossRefMatchRule(index, 'sourceFieldId', value)}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Source field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sourceFields.map((field) => (
                                        <SelectItem key={field.id} value={field.id}>
                                          {field.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeCrossRefMatchRule(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}

                          {/* Logic Expression UI - Show when 2+ rules */}
                          {(formData.cross_ref_match_rules?.length || 0) >= 2 && (
                            <div className="space-y-2 pt-2 border-t">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Logic Expression</Label>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => handleCrossRefMatchLogicChange((formData.cross_ref_match_rules || []).map(r => r.id).join(' AND '))}
                                  >
                                    All (AND)
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => handleCrossRefMatchLogicChange((formData.cross_ref_match_rules || []).map(r => r.id).join(' OR '))}
                                  >
                                    Any (OR)
                                  </Button>
                                </div>
                              </div>
                              <Input
                                value={formData.cross_ref_match_logic || ''}
                                onChange={(e) => handleCrossRefMatchLogicChange(e.target.value)}
                                placeholder={`e.g., 1 AND 2, (1 OR 2) AND 3`}
                                className={crossRefMatchLogicError ? 'border-destructive' : ''}
                              />
                              {crossRefMatchLogicError && (
                                <div className="flex items-center gap-1 text-xs text-destructive">
                                  <AlertCircle className="h-3 w-3" />
                                  {crossRefMatchLogicError}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Use rule numbers with AND, OR, NOT and parentheses. Default: all rules must match (AND).
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.matching_type === 'field_matching' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Matching Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMatchingRule}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>

                  {formData.matching_rules.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add rules to define how source and target records are matched.
                    </p>
                  )}

                  {formData.matching_rules.map((rule, index) => (
                    <div key={rule.id || index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs font-bold">
                        {rule.id || index + 1}
                      </Badge>
                      
                      <Select
                        value={rule.sourceFieldId}
                        onValueChange={(value) => updateMatchingRule(index, 'sourceFieldId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Source field" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                      <Select
                        value={rule.targetFieldId}
                        onValueChange={(value) => updateMatchingRule(index, 'targetFieldId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetFields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMatchingRule(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Logic Expression UI - Show when 2+ rules */}
                  {formData.matching_rules.length >= 2 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Logic Expression</Label>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleLogicChange(formData.matching_rules.map(r => r.id).join(' AND '))}
                          >
                            All (AND)
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleLogicChange(formData.matching_rules.map(r => r.id).join(' OR '))}
                          >
                            Any (OR)
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={formData.matching_logic || ''}
                        onChange={(e) => handleLogicChange(e.target.value)}
                        placeholder={`e.g., 1 AND 2, (1 OR 2) AND 3`}
                        className={logicError ? 'border-destructive' : ''}
                      />
                      {logicError && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {logicError}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Use rule numbers with AND, OR, NOT and parentheses. Default: all rules must match (AND).
                      </p>
                    </div>
                  )}
                </div>
              )}

            </TabsContent>

            <TabsContent value="mappings" className="space-y-4 p-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Field Mappings</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addFieldMapping('direct')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Mapping
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define which source fields are copied to target fields. Each mapping transfers a value from the source record to the matched target record.
                </p>
              </div>

              {formData.field_mappings.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <ArrowRight className="h-8 w-8 mb-2" />
                  <p className="text-sm">No field mappings configured</p>
                  <p className="text-xs">Add mappings to define which values are copied</p>
                </div>
              )}

              {formData.field_mappings.map((mapping, index) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-secondary">
                          <ArrowRight className="h-4 w-4 text-secondary-foreground" />
                        </div>
                        <span className="font-medium text-sm">Mapping #{index + 1}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFieldMapping(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Two column layout for source → target */}
                    <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-end">
                      <div className="space-y-2">
                        <Label className="text-sm">Source Field</Label>
                        <Select
                          value={mapping.sourceFieldId}
                          onValueChange={(value) => updateFieldMapping(index, 'sourceFieldId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFields.map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <ArrowRight className="h-5 w-5 text-muted-foreground mb-2" />

                      <div className="space-y-2">
                        <Label className="text-sm">Target Field</Label>
                        <Select
                          value={mapping.targetFieldId}
                          onValueChange={(value) => updateFieldMapping(index, 'targetFieldId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {targetFields.map((field) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.name || !formData.source_form_id || !formData.target_form_id}>
            {saving ? 'Saving...' : (feed ? 'Update' : 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
