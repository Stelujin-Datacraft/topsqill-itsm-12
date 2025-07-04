
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFieldsByCategory } from '@/data/fieldTypes';
import { Search, X, HelpCircle } from 'lucide-react';

interface FieldTypesPanelProps {
  fieldTypeSearch: string;
  setFieldTypeSearch: (search: string) => void;
  onAddField: (type: string) => void;
  disabled?: boolean;
}

export function FieldTypesPanel({
  fieldTypeSearch,
  setFieldTypeSearch,
  onAddField,
  disabled = false,
}: FieldTypesPanelProps) {
  const filteredFullWidthFields = getFieldsByCategory('full-width').filter(field =>
    field.label.toLowerCase().includes(fieldTypeSearch.toLowerCase())
  );

  const filteredStandardFields = getFieldsByCategory('standard').filter(field =>
    field.label.toLowerCase().includes(fieldTypeSearch.toLowerCase())
  );

  return (
    <TooltipProvider>
      <Card className="col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Field Types</CardTitle>
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search field types..."
              value={fieldTypeSearch}
              onChange={(e) => setFieldTypeSearch(e.target.value)}
              className="pl-8 pr-8 h-8 text-sm"
            />
            {fieldTypeSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFieldTypeSearch('')}
                className="absolute right-1 top-1 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto">
          {/* Full-Width Components */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Full-Width Components</h4>
            <div className="space-y-1">
              {filteredFullWidthFields.map((fieldType) => (
                <Button
                  key={fieldType.type}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => onAddField(fieldType.type)}
                  disabled={disabled}
                >
                  <fieldType.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{fieldType.label}</div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground ml-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">{fieldType.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              ))}
            </div>
          </div>

          {/* Standard Components */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Standard Fields</h4>
            <div className="space-y-1">
              {filteredStandardFields.map((fieldType) => (
                <Button
                  key={fieldType.type}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => onAddField(fieldType.type)}
                  disabled={disabled}
                >
                  <fieldType.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{fieldType.label}</div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground ml-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">{fieldType.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              ))}
            </div>
          </div>

          {(filteredFullWidthFields.length === 0 && filteredStandardFields.length === 0) && fieldTypeSearch && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-sm">No field types found</div>
              <div className="text-xs">Try a different search term</div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
