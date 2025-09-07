import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, ChevronRight } from 'lucide-react';
import { FormField } from '@/types/form';

interface DrilldownConfigProps {
  formFields: FormField[];
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  drilldownLevels: string[];
  onDrilldownLevelsChange: (levels: string[]) => void;
  maxLevels?: number;
}

export function DrilldownConfig({
  formFields,
  enabled,
  onEnabledChange,
  drilldownLevels,
  onDrilldownLevelsChange,
  maxLevels = 3
}: DrilldownConfigProps) {
  const getDrilldownableFields = () => {
    return formFields.filter(field => 
      ['text', 'select', 'radio', 'dropdown', 'date', 'category'].includes(field.type)
    );
  };

  const addDrilldownLevel = () => {
    if (drilldownLevels.length < maxLevels) {
      onDrilldownLevelsChange([...drilldownLevels, '']);
    }
  };

  const removeDrilldownLevel = (index: number) => {
    onDrilldownLevelsChange(drilldownLevels.filter((_, i) => i !== index));
  };

  const updateDrilldownLevel = (index: number, fieldId: string) => {
    const newLevels = [...drilldownLevels];
    newLevels[index] = fieldId;
    onDrilldownLevelsChange(newLevels);
  };

  const getAvailableFields = (currentIndex: number) => {
    const usedFields = drilldownLevels.filter((_, i) => i !== currentIndex);
    return getDrilldownableFields().filter(field => !usedFields.includes(field.id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Drilldown Configuration
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="drilldown-enabled" className="text-sm">Enable Drilldown</Label>
            <Switch
              id="drilldown-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Configure drilldown levels to allow users to explore data hierarchically. 
            Users can click on chart elements to drill down through the levels.
          </div>

          {drilldownLevels.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No drilldown levels configured. Add levels to enable hierarchical data exploration.
            </div>
          ) : (
            <div className="space-y-3">
              {drilldownLevels.map((fieldId, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-0">
                    Level {index + 1}
                    {index > 0 && <ChevronRight className="h-4 w-4" />}
                  </div>
                  
                  <div className="flex-1">
                    <Select
                      value={fieldId}
                      onValueChange={(value) => updateDrilldownLevel(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field for this level" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableFields(index).map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{field.label}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {field.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <button
                    onClick={() => removeDrilldownLevel(index)}
                    className="text-destructive hover:text-destructive/80 p-1"
                    title="Remove level"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={addDrilldownLevel}
              disabled={drilldownLevels.length >= maxLevels || getDrilldownableFields().length === 0}
              className="px-3 py-2 text-sm border border-dashed border-muted-foreground/50 rounded-md hover:border-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Drilldown Level
            </button>
          </div>

          {drilldownLevels.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="text-sm font-medium mb-2">Drilldown Path:</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {drilldownLevels.map((fieldId, index) => {
                  const field = formFields.find(f => f.id === fieldId);
                  return (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight className="h-4 w-4" />}
                      <Badge variant="secondary">
                        {field?.label || 'Unselected'}
                      </Badge>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}