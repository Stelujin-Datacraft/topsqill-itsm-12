import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, X, HelpCircle, GripVertical, Trash2, Settings2, Plus,
  Type, Hash, Calendar, Clock, CalendarClock, ChevronDown, List,
  CheckSquare, ToggleLeft, Sliders, Star, Upload, Palette,
  Globe, Phone, DollarSign, Link, Mail, FileText, Minus, Edit3,
  Image, Tag, PenTool, MapPin, Users
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
}

const POLICY_FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type, description: 'Single line text input' },
  { type: 'textarea', label: 'Text Area', icon: Edit3, description: 'Multi-line text input' },
  { type: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { type: 'email', label: 'Email', icon: Mail, description: 'Email address input' },
  { type: 'url', label: 'URL', icon: Link, description: 'Web URL input' },
  { type: 'phone', label: 'Phone', icon: Phone, description: 'Phone number input' },
  { type: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { type: 'time', label: 'Time', icon: Clock, description: 'Time picker' },
  { type: 'datetime', label: 'Date & Time', icon: CalendarClock, description: 'Date and time picker' },
  { type: 'select', label: 'Dropdown', icon: ChevronDown, description: 'Single select dropdown' },
  { type: 'multi-select', label: 'Multi Select', icon: List, description: 'Multiple selection' },
  { type: 'radio', label: 'Radio', icon: ChevronDown, description: 'Radio button group' },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Checkbox input' },
  { type: 'toggle-switch', label: 'Toggle', icon: ToggleLeft, description: 'On/off toggle switch' },
  { type: 'slider', label: 'Slider', icon: Sliders, description: 'Range slider' },
  { type: 'rating', label: 'Rating', icon: Star, description: 'Star rating' },
  { type: 'file', label: 'File Upload', icon: Upload, description: 'File upload field' },
  { type: 'image', label: 'Image', icon: Image, description: 'Image upload' },
  { type: 'color', label: 'Color', icon: Palette, description: 'Color picker' },
  { type: 'country', label: 'Country', icon: Globe, description: 'Country selector' },
  { type: 'currency', label: 'Currency', icon: DollarSign, description: 'Currency input' },
  { type: 'tags', label: 'Tags', icon: Tag, description: 'Tag input' },
  { type: 'signature', label: 'Signature', icon: PenTool, description: 'Digital signature' },
  { type: 'address', label: 'Address', icon: MapPin, description: 'Full address input' },
  { type: 'user-picker', label: 'User Picker', icon: Users, description: 'Select user from org' },
  { type: 'header', label: 'Header', icon: Type, description: 'Section header text', category: 'layout' },
  { type: 'description', label: 'Description', icon: FileText, description: 'Help text block', category: 'layout' },
  { type: 'horizontal-line', label: 'Divider', icon: Minus, description: 'Horizontal separator', category: 'layout' },
];

const FIELDS_WITH_OPTIONS = ['select', 'multi-select', 'radio', 'checkbox'];

export function PolicyCustomFieldsBuilder({ fields, onFieldsChange }: PolicyCustomFieldsBuilderProps) {
  const [search, setSearch] = useState('');
  const [editingField, setEditingField] = useState<PolicyCustomField | null>(null);
  const [optionInput, setOptionInput] = useState('');

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
      options: FIELDS_WITH_OPTIONS.includes(type) ? [{ label: 'Option 1', value: 'option_1' }] : undefined,
    };
    onFieldsChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i })));
  };

  const updateField = (id: string, updates: Partial<PolicyCustomField>) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const moveField = (id: string, direction: 'up' | 'down') => {
    const idx = fields.findIndex(f => f.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === fields.length - 1)) return;
    const newFields = [...fields];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newFields[idx], newFields[swapIdx]] = [newFields[swapIdx], newFields[idx]];
    onFieldsChange(newFields.map((f, i) => ({ ...f, order: i })));
  };

  const getFieldIcon = (type: string) => {
    const ft = POLICY_FIELD_TYPES.find(f => f.type === type);
    return ft ? ft.icon : Type;
  };

  const addOption = () => {
    if (!editingField || !optionInput.trim()) return;
    const newOpt = { label: optionInput.trim(), value: optionInput.trim().toLowerCase().replace(/\s+/g, '_') };
    updateField(editingField.id, { options: [...(editingField.options || []), newOpt] });
    setEditingField(prev => prev ? { ...prev, options: [...(prev.options || []), newOpt] } : null);
    setOptionInput('');
  };

  const removeOption = (optIdx: number) => {
    if (!editingField) return;
    const newOpts = (editingField.options || []).filter((_, i) => i !== optIdx);
    updateField(editingField.id, { options: newOpts });
    setEditingField(prev => prev ? { ...prev, options: newOpts } : null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Custom Fields</CardTitle>
        <p className="text-xs text-muted-foreground">Add custom data fields to this policy (2-column layout)</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
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
            <ScrollArea className="h-[400px]">
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

          {/* Fields Preview - Right (2-column grid) */}
          <div className="border rounded-lg p-4 min-h-[400px]">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <Plus className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No custom fields yet</p>
                <p className="text-xs">Click field types from the left panel to add</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {fields.sort((a, b) => a.order - b.order).map(field => {
                  const Icon = getFieldIcon(field.type);
                  const isLayout = ['header', 'description', 'horizontal-line'].includes(field.type);
                  return (
                    <div
                      key={field.id}
                      className={`group relative border rounded-md p-3 bg-card hover:border-primary/50 transition-colors ${isLayout ? 'col-span-2' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium truncate">{field.label}</span>
                          {field.required && <span className="text-destructive text-xs">*</span>}
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
                      {/* Field preview */}
                      <div className="mt-1">
                        {field.type === 'header' && <div className="text-sm font-semibold text-foreground">{field.label}</div>}
                        {field.type === 'description' && <div className="text-xs text-muted-foreground">{field.description || field.label}</div>}
                        {field.type === 'horizontal-line' && <hr className="border-border" />}
                        {!isLayout && (
                          <div className="h-8 bg-muted/50 rounded border border-dashed border-muted-foreground/20 flex items-center px-2">
                            <span className="text-xs text-muted-foreground">{field.placeholder || field.label}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px] mt-1.5">{field.type}</Badge>
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
                {FIELDS_WITH_OPTIONS.includes(editingField.type) && (
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-1 mt-1">
                      {(editingField.options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input value={opt.label} readOnly className="h-7 text-sm flex-1" />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOption(i)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          value={optionInput}
                          onChange={e => setOptionInput(e.target.value)}
                          placeholder="Add option..."
                          className="h-7 text-sm flex-1"
                          onKeyDown={e => e.key === 'Enter' && addOption()}
                        />
                        <Button size="sm" variant="outline" className="h-7" onClick={addOption}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
