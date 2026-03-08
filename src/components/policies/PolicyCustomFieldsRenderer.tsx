import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Star, Minus } from 'lucide-react';
import type { PolicyCustomField } from './PolicyCustomFieldsBuilder';

interface PolicyCustomFieldsRendererProps {
  fields: PolicyCustomField[];
  values: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  readOnly?: boolean;
}

export function PolicyCustomFieldsRenderer({ fields, values, onChange, readOnly = false }: PolicyCustomFieldsRendererProps) {
  if (!fields || fields.length === 0) return null;

  const updateValue = (fieldId: string, value: any) => {
    if (onChange) {
      onChange({ ...values, [fieldId]: value });
    }
  };

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const renderField = (field: PolicyCustomField) => {
    const val = values[field.id];
    const isLayout = ['header', 'description', 'horizontal-line'].includes(field.type);

    if (field.type === 'header') {
      return <h3 className="text-base font-semibold text-foreground mt-2">{field.label}</h3>;
    }
    if (field.type === 'description') {
      return <p className="text-sm text-muted-foreground">{field.description || field.label}</p>;
    }
    if (field.type === 'horizontal-line') {
      return <hr className="border-border my-2" />;
    }

    if (readOnly) {
      return (
        <div>
          <Label className="text-xs text-muted-foreground">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
          <p className="text-sm text-foreground mt-0.5">{formatDisplayValue(val, field)}</p>
        </div>
      );
    }

    // Editable field rendering
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
              value={val || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || field.label}
              className="h-8 text-sm"
            />
          </div>
        );
      case 'textarea':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Textarea
              value={val || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || field.label}
              rows={3}
              className="text-sm"
            />
          </div>
        );
      case 'number':
      case 'currency':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input
              type="number"
              value={val || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || field.label}
              className="h-8 text-sm"
            />
          </div>
        );
      case 'date':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input type="date" value={val || ''} onChange={e => updateValue(field.id, e.target.value)} className="h-8 text-sm" />
          </div>
        );
      case 'time':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input type="time" value={val || ''} onChange={e => updateValue(field.id, e.target.value)} className="h-8 text-sm" />
          </div>
        );
      case 'datetime':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input type="datetime-local" value={val || ''} onChange={e => updateValue(field.id, e.target.value)} className="h-8 text-sm" />
          </div>
        );
      case 'select':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Select value={val || ''} onValueChange={v => updateValue(field.id, v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
              <SelectContent>
                {(field.options || []).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'multi-select':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(field.options || []).map(o => {
                const selected = Array.isArray(val) && val.includes(o.value);
                return (
                  <Badge
                    key={o.value}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const current = Array.isArray(val) ? val : [];
                      updateValue(field.id, selected ? current.filter((v: string) => v !== o.value) : [...current, o.value]);
                    }}
                  >
                    {o.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        );
      case 'radio':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <RadioGroup value={val || ''} onValueChange={v => updateValue(field.id, v)} className="mt-1">
              {(field.options || []).map(o => (
                <div key={o.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={o.value} id={`${field.id}-${o.value}`} />
                  <Label htmlFor={`${field.id}-${o.value}`} className="text-sm">{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 'checkbox':
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <div className="space-y-1 mt-1">
              {(field.options || []).map(o => (
                <div key={o.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={Array.isArray(val) ? val.includes(o.value) : false}
                    onCheckedChange={checked => {
                      const current = Array.isArray(val) ? val : [];
                      updateValue(field.id, checked ? [...current, o.value] : current.filter((v: string) => v !== o.value));
                    }}
                  />
                  <span className="text-sm">{o.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'toggle-switch':
        return (
          <div className="flex items-center gap-2">
            <Switch checked={!!val} onCheckedChange={v => updateValue(field.id, v)} />
            <Label className="text-xs">{field.label}</Label>
          </div>
        );
      case 'slider':
        return (
          <div>
            <Label className="text-xs">{field.label}: {val || 50}</Label>
            <Slider value={[val || 50]} onValueChange={v => updateValue(field.id, v[0])} min={0} max={100} step={1} className="mt-2" />
          </div>
        );
      case 'rating':
        return (
          <div>
            <Label className="text-xs">{field.label}</Label>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`h-5 w-5 cursor-pointer ${n <= (val || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                  onClick={() => updateValue(field.id, n)}
                />
              ))}
            </div>
          </div>
        );
      case 'color':
        return (
          <div>
            <Label className="text-xs">{field.label}</Label>
            <Input type="color" value={val || '#000000'} onChange={e => updateValue(field.id, e.target.value)} className="h-8 w-16" />
          </div>
        );
      default:
        return (
          <div>
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
            <Input
              value={val || ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder || field.label}
              className="h-8 text-sm"
            />
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Custom Fields</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {sortedFields.map(field => {
            const isLayout = ['header', 'description', 'horizontal-line'].includes(field.type);
            return (
              <div key={field.id} className={isLayout ? 'col-span-2' : ''}>
                {renderField(field)}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDisplayValue(value: any, field: PolicyCustomField): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    const opts = field.options || [];
    return value.map(v => {
      const opt = opts.find(o => o.value === v);
      return opt?.label || v;
    }).join(', ') || '—';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'select' || field.type === 'radio') {
    const opt = (field.options || []).find(o => o.value === value);
    return opt?.label || value;
  }
  if (field.type === 'rating') return '★'.repeat(Number(value));
  return String(value);
}
