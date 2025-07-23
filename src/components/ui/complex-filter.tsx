import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, Plus, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface ComplexFilterProps {
  filters: FilterGroup[];
  onFiltersChange: (filters: FilterGroup[]) => void;
  availableFields: Array<{ id: string; label: string; type: string }>;
  className?: string;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals', types: ['text', 'number', 'select'] },
  { value: 'not_equals', label: 'Not Equals', types: ['text', 'number', 'select'] },
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['text'] },
  { value: 'starts_with', label: 'Starts With', types: ['text'] },
  { value: 'ends_with', label: 'Ends With', types: ['text'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_equal', label: 'Greater or Equal', types: ['number', 'date'] },
  { value: 'less_equal', label: 'Less or Equal', types: ['number', 'date'] },
  { value: 'is_empty', label: 'Is Empty', types: ['text', 'number'] },
  { value: 'is_not_empty', label: 'Is Not Empty', types: ['text', 'number'] },
];

export function ComplexFilter({ filters, onFiltersChange, availableFields, className }: ComplexFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group_${Date.now()}`,
      name: `Filter Group ${filters.length + 1}`,
      conditions: [{
        id: `condition_${Date.now()}`,
        field: '',
        operator: 'equals',
        value: '',
        logic: 'AND'
      }],
      logic: 'AND'
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
    
    updateFilterGroup(groupId, {
      conditions: [...(filters.find(g => g.id === groupId)?.conditions || []), newCondition]
    });
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    const group = filters.find(g => g.id === groupId);
    if (!group) return;
    
    updateFilterGroup(groupId, {
      conditions: group.conditions.filter(c => c.id !== conditionId)
    });
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    const group = filters.find(g => g.id === groupId);
    if (!group) return;
    
    updateFilterGroup(groupId, {
      conditions: group.conditions.map(condition =>
        condition.id === conditionId ? { ...condition, ...updates } : condition
      )
    });
  };

  const getOperatorsForField = (fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    const fieldType = field?.type || 'text';
    
    return OPERATORS.filter(op => op.types.includes(fieldType));
  };

  const getActiveFilterCount = () => {
    return filters.reduce((count, group) => {
      return count + group.conditions.filter(c => c.field && c.value).length;
    }, 0);
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[800px] p-0" align="start" side="bottom">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Advanced Filters</CardTitle>
                <div className="flex items-center gap-2">
                  {filters.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
              {filters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No filters applied</p>
                  <p className="text-sm">Add a filter group to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filters.map((group, groupIndex) => (
                    <div key={group.id} className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Label className="font-medium">{group.name}</Label>
                          <Select
                            value={group.logic}
                            onValueChange={(value: 'AND' | 'OR') =>
                              updateFilterGroup(group.id, { logic: value })
                            }
                          >
                            <SelectTrigger className="w-20 h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilterGroup(group.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {group.conditions.map((condition, conditionIndex) => (
                          <div key={condition.id} className="flex items-center gap-2">
                            {conditionIndex > 0 && (
                              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                                {group.logic}
                              </Badge>
                            )}
                            
                            <Select
                              value={condition.field}
                              onValueChange={(value) =>
                                updateCondition(group.id, condition.id, { field: value })
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableFields.map((field) => (
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
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Operator" />
                              </SelectTrigger>
                              <SelectContent>
                                {getOperatorsForField(condition.field).map((op) => (
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
                                placeholder="Value"
                                className="flex-1"
                              />
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCondition(group.id, condition.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addCondition(group.id)}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Condition
                        </Button>
                      </div>

                      {groupIndex < filters.length - 1 && (
                        <div className="flex items-center justify-center mt-4 mb-2">
                          <Badge variant="secondary" className="px-3 py-1">
                            OR
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFilterGroup}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Filter Group
                </Button>
                
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
      
      {getActiveFilterCount() > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-destructive hover:text-destructive"
        >
          Clear
        </Button>
      )}
    </div>
  );
}