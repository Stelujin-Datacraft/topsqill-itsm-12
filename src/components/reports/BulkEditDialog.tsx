import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, X, Users, Calendar, MapPin } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SubmissionAccessField } from '@/components/form-fields/SubmissionAccessField';
import { UserPickerField } from '@/components/form-fields/UserPickerField';
import { FileField } from '@/components/form-fields/enhanced/FileField';
import axios from 'axios';

interface BulkEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: any[];
  formFields: any[];
  onSave: (updatedSubmissions: any[]) => void;
}

export function BulkEditDialog({
  isOpen,
  onOpenChange,
  submissions,
  formFields,
  onSave
}: BulkEditDialogProps) {
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<any[]>([]);

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await axios.get(
          "https://restcountries.com/v3.1/all?fields=name,cca2"
        );
        const data = response.data.map((country: any) => ({
          code: country.cca2,
          name: country.name?.common || "",
        }));
        data.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCountries(data);
      } catch (err) {
        console.error("Error fetching countries:", err);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (isOpen && submissions.length > 0) {
      setEditedData({});
      setFieldErrors({});
    }
  }, [isOpen, submissions]);

  const handleValueChange = (fieldId: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear field error when user starts editing
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    if (Object.keys(editedData).length === 0) {
      toast.error('No changes made');
      return;
    }

    setIsLoading(true);
    try {
      const updatedSubmissions = submissions.map(submission => ({
        ...submission,
        submission_data: {
          ...submission.submission_data,
          ...editedData
        }
      }));

      // Save all submissions
      const { error } = await supabase
        .from('form_submissions')
        .upsert(
          updatedSubmissions.map(sub => ({
            id: sub.id,
            submission_data: sub.submission_data
          }))
        );

      if (error) throw error;

      onSave(updatedSubmissions);
      onOpenChange(false);
      toast.success(`Updated ${submissions.length} submissions`);
    } catch (error) {
      console.error('Bulk edit error:', error);
      toast.error('Failed to update submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFieldInput = (field: any) => {
    const fieldValue = editedData[field.id] ?? '';

    switch (field.field_type) {
      case 'submission-access': {
        const allowedUsers = field.custom_config?.allowedUsers || [];
        const allowedGroups = field.custom_config?.allowedGroups || [];
        
        const enhancedField = {
          ...field,
          custom_config: {
            ...field.custom_config,
            allowedUsers: allowedUsers.length > 0 ? allowedUsers : undefined,
            allowedGroups: allowedGroups.length > 0 ? allowedGroups : undefined
          }
        };

        return (
          <SubmissionAccessField
            field={enhancedField}
            value={fieldValue}
            onChange={(newValue) => handleValueChange(field.id, newValue)}
            error={fieldErrors[field.id]}
            disabled={false}
          />
        );
      }

      case 'user-picker': {
        const allowedUsers = field.custom_config?.allowedUsers || [];
        const roleFilter = field.custom_config?.roleFilter;
        
        const enhancedField = {
          ...field,
          custom_config: {
            ...field.custom_config,
            allowedUsers: allowedUsers.length > 0 ? allowedUsers : undefined,
            roleFilter
          }
        };

        return (
          <UserPickerField
            field={enhancedField}
            value={fieldValue}
            onChange={(newValue) => handleValueChange(field.id, newValue)}
            error={fieldErrors[field.id]}
            disabled={false}
          />
        );
      }

      case 'address': {
        const addressValue = fieldValue || { street: '', city: '', state: '', postal_code: '', country: '' };
        
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Street Address</Label>
                <Input
                  placeholder="Enter street address"
                  value={addressValue.street || ''}
                  onChange={(e) => handleValueChange(field.id, {
                    ...addressValue,
                    street: e.target.value
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input
                    placeholder="City"
                    value={addressValue.city || ''}
                    onChange={(e) => handleValueChange(field.id, {
                      ...addressValue,
                      city: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <Input
                    placeholder="State"
                    value={addressValue.state || ''}
                    onChange={(e) => handleValueChange(field.id, {
                      ...addressValue,
                      state: e.target.value
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Postal Code</Label>
                  <Input
                    placeholder="Postal Code"
                    value={addressValue.postal_code || ''}
                    onChange={(e) => handleValueChange(field.id, {
                      ...addressValue,
                      postal_code: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <Select
                    value={addressValue.country || ''}
                    onValueChange={(value) => handleValueChange(field.id, {
                      ...addressValue,
                      country: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.name}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'file': {
        return (
          <FileField
            field={field}
            value={fieldValue}
            onChange={(newValue) => handleValueChange(field.id, newValue)}
            error={fieldErrors[field.id]}
            disabled={false}
          />
        );
      }

      case 'text':
      case 'email':
      case 'url':
        return (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            placeholder={field.placeholder}
            value={fieldValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
          />
        );

      case 'textarea':
      case 'rich-text':
        return (
          <Textarea
            placeholder={field.placeholder}
            value={fieldValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            value={fieldValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
          />
        );

      case 'select':
      case 'radio':
        if (!field.options || !Array.isArray(field.options)) {
          return <Input value={fieldValue} onChange={(e) => handleValueChange(field.id, e.target.value)} />;
        }
        return (
          <Select value={fieldValue} onValueChange={(value) => handleValueChange(field.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option: any, index: number) => (
                <SelectItem key={index} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={fieldValue}
              onCheckedChange={(checked) => handleValueChange(field.id, checked)}
            />
            <Label>Check to apply to all selected submissions</Label>
          </div>
        );

      default:
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  // Filter out non-editable fields
  const editableFields = formFields.filter(field => 
    !['header', 'description', 'section-break', 'horizontal-line'].includes(field.field_type)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Edit - {submissions.length} Submissions
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          Changes will be applied to all {submissions.length} selected submissions. Only edit fields you want to change for all selected records.
        </div>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {editableFields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label className="font-medium flex items-center gap-2">
                  {field.field_type === 'address' && <MapPin className="h-4 w-4" />}
                  {field.field_type === 'user-picker' && <Users className="h-4 w-4" />}
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                {renderFieldInput(field)}
                {fieldErrors[field.id] && (
                  <p className="text-sm text-destructive">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {Object.keys(editedData).length} field(s) will be updated
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading || Object.keys(editedData).length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : `Update ${submissions.length} Submissions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}