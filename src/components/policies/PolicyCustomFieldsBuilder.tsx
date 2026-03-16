import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Search, X, GripVertical, Trash2, Settings2, Plus,
  Type, Hash, Calendar, Clock, CalendarClock, Edit3, Link, Mail
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface PolicyCustomField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  description?: string;
  options?: { label: string; value: string; color?: string }[];
  defaultValue?: string;
  order: number;
}

interface PolicyCustomFieldsBuilderProps {
  fields: PolicyCustomField[];
  onFieldsChange: (fields: PolicyCustomField[]) => void;
  values?: Record<string, any>;
  onValuesChange?: (values: Record<string, any>) => void;
}

const POLICY_FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type, description: 'Single line text input' },
  { type: 'textarea', label: 'Text Area', icon: Edit3, description: 'Multi-line text input' },
  { type: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { type: 'email', label: 'Email', icon: Mail, description: 'Email address input' },
  { type: 'url', label: 'URL', icon: Link, description: 'Web URL input' },
  { type: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { type: 'time', label: 'Time', icon: Clock, description: 'Time picker' },
  { type: 'datetime', label: 'Date & Time', icon: CalendarClock, description: 'Date and time picker' },
];

export function PolicyCustomFieldsBuilder({ fields, onFieldsChange, values = {}, onValuesChange }: PolicyCustomFieldsBuilderProps) {
  const [search, setSearch] = useState('');
  const [editingField, setEditingField] = useState<PolicyCustomField | null>(null);

  const filtered = POLICY_FIELD_TYPES.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  const addField = (type: string) => {
    const fieldType = POLICY_FIELD_TYPES.find(f => f.type === type);
    const newField: PolicyCustomField = {
      id: uuidv4(),
      type,
      label: fieldType?.label || type,
      required: false,
      order: fields.length,
    };
    onFieldsChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i })));
    if (onValuesChange) {
      const newValues = { ...values };
      delete newValues[id];
      onValuesChange(newValues);
    }
  };

  const updateField = (id: string, updates: Partial<PolicyCustomField>) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateValue = (fieldId: string, value: any) => {
    if (onValuesChange) {
      onValuesChange({ ...values, [fieldId]: value });
    }
  };

  const getFieldIcon = (type: string) => {
    const ft = POLICY_FIELD_TYPES.find(f => f.type === type);
    return ft ? ft.icon : Type;
  };

  const getInputType = (type: string) => {
    switch (type) {
      case 'email': return 'email';
      case 'url': return 'url';
      case 'number': return 'number';
      case 'date': return 'date';
      case 'time': return 'time';
      case 'datetime': return 'datetime-local';
      default: return 'text';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Custom Fields</CardTitle>
        <p className="text-xs text-muted-foreground">Add custom data fields with values</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          {/* Field Types Panel - Left */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fields..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-8 h-8 text-sm"
              />
              {search && (
                <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="absolute right-1 top-1 h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-0.5">
                {filtered.map(ft => {
                  const Icon = ft.icon;
                  return (
                    <TooltipProvider key={ft.type}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-left h-auto py-1.5 px-2"
                            onClick={() => addField(ft.type)}
                          >
                            <Icon className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-muted-foreground" />
                            <span className="text-xs">{ft.label}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="text-xs">{ft.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Fields with inline values - Right */}
          <div className="border rounded-lg p-4 min-h-[300px]">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <Plus className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No custom fields yet</p>
                <p className="text-xs">Click field types from the left panel to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.sort((a, b) => a.order - b.order).map(field => {
                  const Icon = getFieldIcon(field.type);
                  return (
                    <div
                      key={field.id}
                      className="group border rounded-md p-3 bg-card hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{field.label}</span>
                          {field.required && <span className="text-destructive text-xs">*</span>}
                          <Badge variant="secondary" className="text-[10px] ml-1">{field.type}</Badge>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingField(field)}>
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeField(field.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Inline value input */}
                      <div>
                        {field.type === 'textarea' ? (
                          <Textarea
                            value={values[field.id] || ''}
                            onChange={e => updateValue(field.id, e.target.value)}
                            placeholder={field.placeholder || `Enter ${field.label}...`}
                            rows={2}
                            className="text-sm"
                          />
                        ) : (
                          <Input
                            type={getInputType(field.type)}
                            value={values[field.id] || ''}
                            onChange={e => updateValue(field.id, e.target.value)}
                            placeholder={field.placeholder || `Enter ${field.label}...`}
                            className="h-8 text-sm"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Field Settings Dialog */}
        <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Field Settings</DialogTitle>
            </DialogHeader>
            {editingField && (
              <div className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={editingField.label}
                    onChange={e => {
                      setEditingField(prev => prev ? { ...prev, label: e.target.value } : null);
                      updateField(editingField.id, { label: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label>Placeholder</Label>
                  <Input
                    value={editingField.placeholder || ''}
                    onChange={e => {
                      setEditingField(prev => prev ? { ...prev, placeholder: e.target.value } : null);
                      updateField(editingField.id, { placeholder: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editingField.description || ''}
                    onChange={e => {
                      setEditingField(prev => prev ? { ...prev, description: e.target.value } : null);
                      updateField(editingField.id, { description: e.target.value });
                    }}
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingField.required || false}
                    onCheckedChange={v => {
                      setEditingField(prev => prev ? { ...prev, required: v } : null);
                      updateField(editingField.id, { required: v });
                    }}
                  />
                  <Label>Required</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setEditingField(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
