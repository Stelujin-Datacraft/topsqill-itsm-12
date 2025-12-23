
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Plus, X, ChevronDown, ChevronRight, Save, Users, User } from 'lucide-react';
import { Form } from '@/types/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SaveFilterDialog } from './SaveFilterDialog';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { useToast } from '@/hooks/use-toast';
import { useUsersAndGroups } from '@/hooks/useUsersAndGroups';
import { supabase } from '@/integrations/supabase/client';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

export interface FilterGroup {
  id: string;
  name: string;
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
  isOpen?: boolean;
}

interface TableFiltersPanelProps {
  filters: FilterGroup[];
  onFiltersChange: (filters: FilterGroup[]) => void;
  forms: Form[];
  primaryFormId: string;
}

interface FieldOption {
  id: string;
  label: string;
  type: string;
  options?: any;
  custom_config?: any;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'last_days', label: 'Last N Days' },
  { value: 'next_days', label: 'Next N Days' }
];

export function TableFiltersPanel({
  filters,
  onFiltersChange,
  forms,
  primaryFormId
}: TableFiltersPanelProps) {
  const selectedForm = forms.find(f => f.id === primaryFormId);
  const { saveFilter } = useSavedFilters(primaryFormId);
  const { toast } = useToast();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [availableFields, setAvailableFields] = useState<FieldOption[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  
  // Fetch users and groups for submission-access field filtering
  const { users, groups, loading: usersGroupsLoading, getUserDisplayName, getGroupDisplayName } = useUsersAndGroups();

  // Fetch fields directly from Supabase when primaryFormId changes
  useEffect(() => {
    const fetchFields = async () => {
      if (!primaryFormId) {
        setAvailableFields([]);
        return;
      }

      setLoadingFields(true);
      try {
        const { data: fields, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, options, custom_config')
          .eq('form_id', primaryFormId)
          .order('field_order', { ascending: true });

        if (error) {
          console.error('Error fetching form fields:', error);
          setAvailableFields([]);
          return;
        }

        const baseFields: FieldOption[] = [
          { id: 'submitted_at', label: 'Submitted At', type: 'datetime' },
          { id: 'submitted_by', label: 'Submitted By', type: 'text' },
          { id: 'submission_ref_id', label: 'Reference ID', type: 'text' }
        ];

        const formFields: FieldOption[] = (fields || []).map(field => ({
          id: field.id,
          label: field.label,
          type: field.field_type,
          options: field.options,
          custom_config: field.custom_config
        }));

        setAvailableFields([...baseFields, ...formFields]);
      } catch (err) {
        console.error('Error in fetchFields:', err);
        setAvailableFields([]);
      } finally {
        setLoadingFields(false);
      }
    };

    fetchFields();
  }, [primaryFormId]);

  const getAvailableFields = () => availableFields;
  
  const getFieldById = (fieldId: string): FieldOption | undefined => {
    return availableFields.find(f => f.id === fieldId);
  };

  // Get field options from various sources
  const getFieldOptions = (field: FieldOption | undefined): any[] => {
    if (!field) return [];
    
    // Check field.options first
    if (field.options) {
      if (Array.isArray(field.options) && field.options.length > 0) {
        return field.options;
      }
      if (typeof field.options === 'string') {
        try {
          const parsed = JSON.parse(field.options);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {}
      }
    }
    
    // Check custom_config.options
    const customConfig = field.custom_config;
    if (customConfig?.options) {
      if (Array.isArray(customConfig.options) && customConfig.options.length > 0) {
        return customConfig.options;
      }
      if (typeof customConfig.options === 'string') {
        try {
          const parsed = JSON.parse(customConfig.options);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {}
      }
    }
    
    if (customConfig?.choices && Array.isArray(customConfig.choices)) {
      return customConfig.choices;
    }
    
    return [];
  };

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group_${Date.now()}`,
      name: `Filter Group ${filters.length + 1}`,
      conditions: [],
      logic: 'AND',
      isOpen: true
    };
    
    onFiltersChange([...filters, newGroup]);
  };

  const removeFilterGroup = (groupId: string) => {
    onFiltersChange(filters.filter(group => group.id !== groupId));
  };

  const updateFilterGroup = (groupId: string, updates: Partial<FilterGroup>) => {
    onFiltersChange(filters.map(group => 
      group.id === groupId ? { ...group, ...updates } : group
    ));
  };

  const addCondition = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: `condition_${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
      logic: 'AND'
    };
    
    const group = filters.find(g => g.id === groupId);
    if (group) {
      updateFilterGroup(groupId, {
        conditions: [...group.conditions, newCondition]
      });
    }
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    const group = filters.find(g => g.id === groupId);
    if (group) {
      updateFilterGroup(groupId, {
        conditions: group.conditions.filter(c => c.id !== conditionId)
      });
    }
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    const group = filters.find(g => g.id === groupId);
    if (group) {
      updateFilterGroup(groupId, {
        conditions: group.conditions.map(condition =>
          condition.id === conditionId ? { ...condition, ...updates } : condition
        )
      });
    }
  };

  const getTotalConditions = () => {
    return filters.reduce((total, group) => total + group.conditions.length, 0);
  };

  const handleSaveFilter = async (name: string) => {
    try {
      const result = await saveFilter(name, filters);
      if (result) {
        toast({
          title: "Filter Saved",
          description: `Filter "${name}" has been saved successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save filter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canSaveFilter = filters.length > 0 && getTotalConditions() > 0;

  // Render value input based on field type
  const renderValueInput = (
    condition: FilterCondition, 
    groupId: string
  ) => {
    if (['is_empty', 'is_not_empty'].includes(condition.operator)) {
      return null;
    }

    const field = getFieldById(condition.field);
    const fieldType = field?.type || 'text';
    const fieldOptions = getFieldOptions(field);

    // Helper to toggle multi-select values
    const toggleMultiValue = (optionValue: string) => {
      const selectedValues = condition.value ? condition.value.split(',').map(v => v.trim()).filter(Boolean) : [];
      const newSelected = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      updateCondition(groupId, condition.id, { value: newSelected.join(',') });
    };

    // Handle submission-access field type
    if (fieldType === 'submission-access') {
      const selectedValues = condition.value ? condition.value.split(',').map(v => v.trim()).filter(Boolean) : [];
      
      if (usersGroupsLoading) {
        return <div className="text-sm text-muted-foreground p-2 flex-1">Loading...</div>;
      }

      const hasData = users.length > 0 || groups.length > 0;
      if (!hasData) {
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
            placeholder="Enter user/group ID"
            className="flex-1"
          />
        );
      }

      return (
        <div className="flex-1 space-y-2">
          {selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((val, i) => {
                const isGroup = groups.some(g => g.id === val);
                const displayName = isGroup ? getGroupDisplayName(val) : getUserDisplayName(val);
                return (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1">
                    {isGroup ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {displayName}
                    <button type="button" onClick={() => toggleMultiValue(val)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="border rounded-md p-2 max-h-40 overflow-y-auto bg-background space-y-1">
            {groups.length > 0 && (
              <>
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Groups
                </div>
                {groups.map((group) => (
                  <div key={`group-${group.id}`} className="flex items-center gap-2 pl-2">
                    <Checkbox
                      id={`filter-group-${condition.id}-${group.id}`}
                      checked={selectedValues.includes(group.id)}
                      onCheckedChange={() => toggleMultiValue(group.id)}
                    />
                    <label htmlFor={`filter-group-${condition.id}-${group.id}`} className="text-sm cursor-pointer">
                      {group.name}
                    </label>
                  </div>
                ))}
              </>
            )}
            {users.length > 0 && (
              <>
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-2">
                  <User className="h-3 w-3" /> Users
                </div>
                {users.map((user) => (
                  <div key={`user-${user.id}`} className="flex items-center gap-2 pl-2">
                    <Checkbox
                      id={`filter-user-${condition.id}-${user.id}`}
                      checked={selectedValues.includes(user.id)}
                      onCheckedChange={() => toggleMultiValue(user.id)}
                    />
                    <label htmlFor={`filter-user-${condition.id}-${user.id}`} className="text-sm cursor-pointer">
                      {getUserDisplayName(user.id)}
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      );
    }

    // Handle multi-select, select, dropdown, radio, checkbox, status with options
    const selectTypes = ['multi-select', 'select', 'dropdown', 'radio', 'status'];
    const hasOptions = fieldOptions.length > 0;
    
    if (selectTypes.includes(fieldType) || (fieldType === 'checkbox' && hasOptions)) {
      if (hasOptions) {
        // For 'in' or 'not_in' operators, show multi-select checkboxes
        if (condition.operator === 'in' || condition.operator === 'not_in') {
          const selectedValues = condition.value ? condition.value.split(',').map(v => v.trim()).filter(Boolean) : [];
          
          return (
            <div className="flex-1 space-y-2">
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((val, i) => {
                    const option = fieldOptions.find((o: any) => String(o.value || o) === val);
                    const displayLabel = option?.label || option?.value || val;
                    return (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1">
                        {displayLabel}
                        <button type="button" onClick={() => toggleMultiValue(val)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto bg-background space-y-1">
                {fieldOptions
                  .filter((option: any) => {
                    const val = option.value || option;
                    return val && String(val).trim() !== '';
                  })
                  .map((option: any, optIndex: number) => {
                    const val = String(option.value || option);
                    const label = option.label || option.value || option;
                    return (
                      <div key={option.id || optIndex} className="flex items-center gap-2">
                        <Checkbox
                          id={`filter-opt-${condition.id}-${optIndex}`}
                          checked={selectedValues.includes(val)}
                          onCheckedChange={() => toggleMultiValue(val)}
                        />
                        <label htmlFor={`filter-opt-${condition.id}-${optIndex}`} className="text-sm cursor-pointer">
                          {label}
                        </label>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        }
        
        // Single select for equals/not_equals
        return (
          <Select
            value={condition.value}
            onValueChange={(value) => updateCondition(groupId, condition.id, { value })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
              {fieldOptions
                .filter((option: any) => {
                  const val = option.value || option;
                  return val && String(val).trim() !== '';
                })
                .map((option: any, optIndex: number) => {
                  const val = option.value || option;
                  const label = option.label || option.value || option;
                  return (
                    <SelectItem key={option.id || optIndex} value={String(val)}>
                      {label}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        );
      }
    }

    // Handle boolean/toggle/checkbox (without options)
    if (['checkbox', 'toggle', 'toggle-switch', 'yes-no'].includes(fieldType) && !hasOptions) {
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(groupId, condition.id, { value })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="true">{fieldType === 'yes-no' ? 'Yes' : 'True / On'}</SelectItem>
            <SelectItem value="false">{fieldType === 'yes-no' ? 'No' : 'False / Off'}</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Handle rating field
    if (fieldType === 'rating' || fieldType === 'star-rating') {
      const customConfig = field?.custom_config;
      const maxRating = customConfig?.maxRating || 5;
      const ratingOptions = Array.from({ length: maxRating }, (_, i) => i + 1);
      
      return (
        <Select
          value={condition.value}
          onValueChange={(value) => updateCondition(groupId, condition.id, { value })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select rating" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {ratingOptions.map((rating) => (
              <SelectItem key={rating} value={String(rating)}>
                {'★'.repeat(rating)} ({rating})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Handle date/datetime fields
    if (fieldType === 'date') {
      // Handle "between" operator with two date inputs
      if (condition.operator === 'between') {
        const [startDate, endDate] = (condition.value || '').split(',').map(v => v.trim());
        return (
          <div className="flex gap-2 items-center flex-1">
            <Input
              type="date"
              value={startDate || ''}
              onChange={(e) => {
                const newValue = `${e.target.value},${endDate || ''}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate || ''}
              onChange={(e) => {
                const newValue = `${startDate || ''},${e.target.value}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
          </div>
        );
      }
      
      // Handle "last_days" operator
      if (condition.operator === 'last_days') {
        return (
          <div className="flex gap-2 items-center flex-1">
            <span className="text-muted-foreground whitespace-nowrap">Last</span>
            <Input
              type="number"
              min={1}
              value={condition.value}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              placeholder="N"
              className="w-20"
            />
            <span className="text-muted-foreground">days</span>
          </div>
        );
      }
      
      // Handle "next_days" operator
      if (condition.operator === 'next_days') {
        return (
          <div className="flex gap-2 items-center flex-1">
            <span className="text-muted-foreground whitespace-nowrap">Next</span>
            <Input
              type="number"
              min={1}
              value={condition.value}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              placeholder="N"
              className="w-20"
            />
            <span className="text-muted-foreground">days</span>
          </div>
        );
      }
      
      return (
        <Input
          type="date"
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className="flex-1"
        />
      );
    }

    if (fieldType === 'datetime' || fieldType === 'date-time') {
      // Handle "between" operator with two datetime inputs
      if (condition.operator === 'between') {
        const [startDate, endDate] = (condition.value || '').split(',').map(v => v.trim());
        return (
          <div className="flex gap-2 items-center flex-1">
            <Input
              type="datetime-local"
              value={startDate || ''}
              onChange={(e) => {
                const newValue = `${e.target.value},${endDate || ''}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="datetime-local"
              value={endDate || ''}
              onChange={(e) => {
                const newValue = `${startDate || ''},${e.target.value}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
          </div>
        );
      }
      
      // Handle "last_days" operator
      if (condition.operator === 'last_days') {
        return (
          <div className="flex gap-2 items-center flex-1">
            <span className="text-muted-foreground whitespace-nowrap">Last</span>
            <Input
              type="number"
              min={1}
              value={condition.value}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              placeholder="N"
              className="w-20"
            />
            <span className="text-muted-foreground">days</span>
          </div>
        );
      }
      
      // Handle "next_days" operator
      if (condition.operator === 'next_days') {
        return (
          <div className="flex gap-2 items-center flex-1">
            <span className="text-muted-foreground whitespace-nowrap">Next</span>
            <Input
              type="number"
              min={1}
              value={condition.value}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              placeholder="N"
              className="w-20"
            />
            <span className="text-muted-foreground">days</span>
          </div>
        );
      }
      
      return (
        <Input
          type="datetime-local"
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className="flex-1"
        />
      );
    }

    if (fieldType === 'time') {
      // Handle "between" operator with two time inputs
      if (condition.operator === 'between') {
        const [startTime, endTime] = (condition.value || '').split(',').map(v => v.trim());
        return (
          <div className="flex gap-2 items-center flex-1">
            <Input
              type="time"
              value={startTime || ''}
              onChange={(e) => {
                const newValue = `${e.target.value},${endTime || ''}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="time"
              value={endTime || ''}
              onChange={(e) => {
                const newValue = `${startTime || ''},${e.target.value}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              className="flex-1"
            />
          </div>
        );
      }
      
      return (
        <Input
          type="time"
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className="flex-1"
        />
      );
    }

    // Handle number/currency/slider fields
    if (['number', 'currency', 'slider', 'range'].includes(fieldType)) {
      // Handle "between" operator with two number inputs
      if (condition.operator === 'between') {
        const [startNum, endNum] = (condition.value || '').split(',').map(v => v.trim());
        return (
          <div className="flex gap-2 items-center flex-1">
            <Input
              type="number"
              value={startNum || ''}
              onChange={(e) => {
                const newValue = `${e.target.value},${endNum || ''}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              placeholder="From"
              className="flex-1"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              value={endNum || ''}
              onChange={(e) => {
                const newValue = `${startNum || ''},${e.target.value}`;
                updateCondition(groupId, condition.id, { value: newValue });
              }}
              placeholder="To"
              className="flex-1"
            />
          </div>
        );
      }
      
      return (
        <Input
          type="number"
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          placeholder="Enter number"
          className="flex-1"
        />
      );
    }

    // Default text input
    return (
      <Input
        value={condition.value}
        onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
        placeholder="Enter value"
        className="flex-1"
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
            {getTotalConditions() > 0 && (
              <Badge variant="secondary">{getTotalConditions()} conditions</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={addFilterGroup} 
              size="sm" 
              variant="outline"
              disabled={filters.length > 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter Group
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setShowSaveDialog(true)} 
                    size="sm" 
                    variant={canSaveFilter ? "outline" : "outline"}
                    disabled={!canSaveFilter}
                    className={canSaveFilter ? "" : "opacity-50"}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Filter
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!canSaveFilter ? "Add at least one filter condition to enable saving" : "Save current filter configuration"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No filters configured</p>
            <p className="text-sm">Add a filter group to start filtering your data</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filters.map((group, groupIndex) => (
              <Collapsible
                key={group.id}
                open={group.isOpen}
                onOpenChange={(isOpen) => updateFilterGroup(group.id, { isOpen })}
              >
                <Card className="border-l-4 border-l-blue-500">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {group.isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{group.name}</span>
                          <Badge variant="outline">
                            {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
                          </Badge>
                          {group.conditions.length > 1 && (
                            <Badge variant="secondary">{group.logic}</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFilterGroup(group.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* Group Logic */}
                      {group.conditions.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Group Logic:</span>
                          <Select
                            value={group.logic}
                            onValueChange={(value: 'AND' | 'OR') => 
                              updateFilterGroup(group.id, { logic: value })
                            }
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Conditions */}
                      <div className="space-y-3">
                        {group.conditions.map((condition, conditionIndex) => (
                          <div key={condition.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-md">
                            {conditionIndex > 0 && (
                              <Badge variant="outline" className="text-xs mt-2">
                                {condition.logic}
                              </Badge>
                            )}
                            
                            <Select
                              value={condition.field}
                              onValueChange={(value) => 
                                updateCondition(group.id, condition.id, { field: value, value: '' })
                              }
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableFields().map((field) => (
                                  <SelectItem key={field.id} value={field.id}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={condition.operator}
                              onValueChange={(value) => 
                                updateCondition(group.id, condition.id, { operator: value })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {renderValueInput(condition, group.id)}

                            {conditionIndex > 0 && (
                              <Select
                                value={condition.logic}
                                onValueChange={(value: 'AND' | 'OR') => 
                                  updateCondition(group.id, condition.id, { logic: value })
                                }
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCondition(group.id, condition.id)}
                              className="mt-1"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCondition(group.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Condition
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
      
      <SaveFilterDialog
        isOpen={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveFilter}
        filters={filters}
      />
    </Card>
  );
}
