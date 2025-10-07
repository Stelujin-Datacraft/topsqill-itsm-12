
import React, { useState, useEffect } from 'react';
import { FormField } from '@/types/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useForm } from '@/contexts/FormContext';
import { useFormsData } from '@/hooks/useFormsData';
import { toast } from '@/hooks/use-toast';

interface FieldConfigurationDialogProps {
  field: FormField;
  open: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
}

export function FieldConfigurationDialog({ field, open, onClose, onSave }: FieldConfigurationDialogProps) {
  const { forms } = useForm();
  const { addField, updateForm } = useFormsData();
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (field && open) {
      setConfig(field.customConfig || {});
    }
  }, [field, open]);

  const handleSave = async () => {
    try {
      // If this is a cross-reference field and we're setting a target form
      if (field.type === 'cross-reference' && config.targetFormId && config.targetFormId !== field.customConfig?.targetFormId) {
        const targetForm = forms.find(f => f.id === config.targetFormId);
        const currentForm = forms.find(f => f.fields.some(fld => fld.id === field.id));
        
        if (targetForm && currentForm) {
          // Check if reverse cross-reference already exists
          const existingReverseField = targetForm.fields.find(f => 
            f.type === 'cross-reference' && 
            f.customConfig?.targetFormId === currentForm.id
          );

          if (!existingReverseField) {
            console.log('Creating reverse cross-reference field in target form:', targetForm.name);
            
            // Create reverse cross-reference field in target form
            const reverseFieldData = {
              type: 'cross-reference' as const,
              label: `${currentForm.name} (Parent)`,
              required: false,
              defaultValue: '',
              permissions: { read: ['*'], write: ['*'] },
              triggers: [],
              placeholder: '',
              isVisible: true,
              isEnabled: true,
              currentValue: '',
              tooltip: `Cross-reference to ${currentForm.name}`,
              errorMessage: '',
              pageId: 'default',
              isFullWidth: true,
              fieldCategory: 'advanced',
              customConfig: {
                targetFormId: currentForm.id,
                targetFormName: currentForm.name,
                isParentReference: true,
                parentFormId: currentForm.id,
                displayColumns: [],
                filters: [],
                enableSorting: true,
                enableSearch: true,
                pageSize: 10
              }
            };

            try {
              const newReverseField = await addField(targetForm.id, reverseFieldData);
              
              if (newReverseField) {
                console.log('Successfully created reverse field:', newReverseField.id);
                
                // Update target form's pages to include the new field
                const updatedPages = targetForm.pages && targetForm.pages.length > 0 
                  ? targetForm.pages.map(page => 
                      page.id === 'default' 
                        ? { ...page, fields: [...page.fields, newReverseField.id] }
                        : page
                    )
                  : [{ id: 'default', name: 'Page 1', order: 0, fields: [newReverseField.id] }];
                
                await updateForm(targetForm.id, { pages: updatedPages });
                
                toast({
                  title: "Cross-reference created",
                  description: `Added reverse cross-reference field to ${targetForm.name}`,
                });
              }
            } catch (error) {
              console.error('Error creating reverse cross-reference field:', error);
              toast({
                title: "Warning",
                description: "Cross-reference configured but couldn't create reverse link",
                variant: "destructive",
              });
            }
          } else {
            console.log('Reverse cross-reference already exists');
          }
        }
      }

      onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving cross-reference configuration:', error);
      toast({
        title: "Error",
        description: "Failed to save cross-reference configuration",
        variant: "destructive",
      });
    }
  };

  const handleAddFilter = () => {
    const newFilter = {
      id: Date.now().toString(),
      field: '',
      operator: '==',
      value: ''
    };
    setConfig({
      ...config,
      filters: [...(config.filters || []), newFilter]
    });
  };

  const handleRemoveFilter = (filterId: string) => {
    setConfig({
      ...config,
      filters: (config.filters || []).filter((f: any) => f.id !== filterId)
    });
  };

  const handleFilterChange = (filterId: string, key: string, value: any) => {
    setConfig({
      ...config,
      filters: (config.filters || []).map((f: any) => 
        f.id === filterId ? { ...f, [key]: value } : f
      )
    });
  };

  const targetForm = forms.find(f => f.id === config.targetFormId);
  const availableForms = forms.filter(f => f.fields.some(fld => fld.id === field.id) ? false : true);
  const targetFormFields = targetForm?.fields || [];

  if (!field || field.type !== 'cross-reference') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Cross Reference Field</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Target Form Selection */}
          <div className="space-y-2">
            <Label>Target Form</Label>
            <Select
              value={config.targetFormId || ''}
              onValueChange={(value) => {
                const selectedForm = forms.find(f => f.id === value);
                setConfig({
                  ...config,
                  targetFormId: value,
                  targetFormName: selectedForm?.name || '',
                  displayColumns: [],
                  filters: []
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a form to reference" />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetForm && (
            <>
              {/* Display Columns */}
              <div className="space-y-2">
                <Label>Display Columns (in form table)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {targetFormFields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={(config.displayColumns || []).includes(field.id)}
                        onCheckedChange={(checked) => {
                          const currentColumns = config.displayColumns || [];
                          setConfig({
                            ...config,
                            displayColumns: checked
                              ? [...currentColumns, field.id]
                              : currentColumns.filter((col: string) => col !== field.id)
                          });
                        }}
                      />
                      <span className="text-sm">{field.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Display Field in Table View - IMPORTANT CONFIGURATION */}
              <div className="space-y-2 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                <Label className="text-base font-semibold">📊 Table Display Field</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose which field from the linked form to display in the table view. This makes it easier to identify records without opening them.
                </p>
                <Select
                  value={config.tableDisplayField || '__default__'}
                  onValueChange={(value) => setConfig({ ...config, tableDisplayField: value === '__default__' ? '' : value })}
                >
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Select a field to display in table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Submission ID only (default)</SelectItem>
                    {targetFormFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {config.tableDisplayField && config.tableDisplayField !== '__default__' && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    ✓ Will display: {targetFormFields.find(f => f.id === config.tableDisplayField)?.label}
                  </p>
                )}
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Filters</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddFilter}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                </div>
                
                {(config.filters || []).map((filter: any) => (
                  <div key={filter.id} className="flex items-center space-x-2 p-3 border rounded">
                    <Select
                      value={filter.field}
                      onValueChange={(value) => handleFilterChange(filter.id, 'field', value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetFormFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(value) => handleFilterChange(filter.id, 'operator', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="==">=</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Value"
                      value={filter.value}
                      onChange={(e) => handleFilterChange(filter.id, 'value', e.target.value)}
                      className="flex-1"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveFilter(filter.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page Size</Label>
                  <Input
                    type="number"
                    value={config.pageSize || 10}
                    onChange={(e) => setConfig({ ...config, pageSize: parseInt(e.target.value) || 10 })}
                    min="1"
                    max="100"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Join Field (Optional)</Label>
                  <Select
                    value={config.joinField || '__none__'}
                    onValueChange={(value) => setConfig({ ...config, joinField: value === '__none__' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select join field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No join field</SelectItem>
                      {targetFormFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.enableSorting !== false}
                    onCheckedChange={(checked) => setConfig({ ...config, enableSorting: checked })}
                  />
                  <Label>Enable Sorting</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.enableSearch !== false}
                    onCheckedChange={(checked) => setConfig({ ...config, enableSearch: checked })}
                  />
                  <Label>Enable Search</Label>
                </div>
              </div>
            </>
          )}

          {/* Parent Reference Indicator */}
          {config.isParentReference && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <Badge variant="secondary" className="mb-2">Parent Reference</Badge>
              <p className="text-sm text-blue-700">
                This field was automatically created as a reverse cross-reference to maintain the relationship between forms.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
