
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Filter, Plus, X, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { Form } from '@/types/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SaveFilterDialog } from './SaveFilterDialog';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { useToast } from '@/hooks/use-toast';

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
  { value: 'between', label: 'Between' }
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

  const getAvailableFields = () => {
    if (!selectedForm) return [];
    
    const baseFields = [
      { id: 'submitted_at', label: 'Submitted At', type: 'datetime' },
      { id: 'submitted_by', label: 'Submitted By', type: 'text' },
      { id: 'submission_ref_id', label: 'Reference ID', type: 'text' }
    ];
    
    const formFields = selectedForm.fields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.type
    }));
    
    return [...baseFields, ...formFields];
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
                          <div key={condition.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                            {conditionIndex > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {condition.logic}
                              </Badge>
                            )}
                            
                            <Select
                              value={condition.field}
                              onValueChange={(value) => 
                                updateCondition(group.id, condition.id, { field: value })
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

                            {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                              <Input
                                value={condition.value}
                                onChange={(e) => 
                                  updateCondition(group.id, condition.id, { value: e.target.value })
                                }
                                placeholder="Enter value"
                                className="flex-1"
                              />
                            )}

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
