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
    // Allow all fields except signature-pad for drilldown
    // If field has no type, still include it
    console.log('DrilldownConfig formFields:', formFields?.length, formFields);
    if (!formFields || formFields.length === 0) {
      return [];
    }
    return formFields.filter(field => {
      // Exclude only signature fields
      const fieldType = field.type?.toLowerCase() || '';
      return !fieldType.includes('signature');
    });
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
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Drilldown Configuration
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Enable Drilldown Toggle - Now below title */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="drilldown-enabled" className="text-sm font-medium">Enable Drilldown</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Allow clicking on values to filter data</p>
          </div>
          <Switch
            id="drilldown-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {enabled && (
          <>
            <div className="text-sm text-muted-foreground">
              Configure drilldown levels to enable Power BI-style exploration. For tables, click column headers to enable drilldown, then click cell values to filter. For charts, click chart elements to drill into the next hierarchy level.
            </div>

            {drilldownLevels.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
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
                        <SelectContent className="bg-popover border shadow-md z-50">
                          {getAvailableFields(index).map((field) => (
                            <SelectItem key={field.id} value={field.id} className="hover:bg-accent hover:text-accent-foreground">
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

            <div className="flex flex-col gap-2">
              <button
                onClick={addDrilldownLevel}
                disabled={drilldownLevels.length >= maxLevels || getDrilldownableFields().length === 0}
                className="px-3 py-2 text-sm border border-dashed border-muted-foreground/50 rounded-md hover:border-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Drilldown Level
              </button>
              {getDrilldownableFields().length === 0 && (
                <p className="text-xs text-amber-600">No form fields available. Please select a form with fields first.</p>
              )}
              {drilldownLevels.length >= maxLevels && (
                <p className="text-xs text-muted-foreground">Maximum {maxLevels} drilldown levels reached.</p>
              )}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
