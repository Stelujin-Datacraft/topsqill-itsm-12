import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Users, Star, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useUsersAndGroups } from '@/hooks/useUsersAndGroups';
import { useCrossReferenceData } from '@/hooks/useCrossReferenceData';



interface MultiLineEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: any[];
  formFields: any[];
  onSave: () => void;
}

export function MultiLineEditDialog({
  isOpen,
  onOpenChange,
  submissions,
  formFields,
  onSave
}: MultiLineEditDialogProps) {
  const [editData, setEditData] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { users, groups, getUserDisplayName, getGroupDisplayName } = useUsersAndGroups();
  const formId = submissions[0]?.form_id;
  const { records: crossRefRecords } = useCrossReferenceData(formId);

  // Initialize edit data when dialog opens - each submission gets its own data
  useEffect(() => {
    if (isOpen && Array.isArray(submissions) && submissions.length > 0) {
      const initialData: Record<string, Record<string, any>> = {};
      
      submissions.forEach(submission => {
        initialData[submission.id] = { ...submission.submission_data };
      });
      
      setEditData(initialData);
    }
  }, [isOpen, submissions]);

  const handleFieldValueChange = (submissionId: string, fieldId: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [fieldId]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!Array.isArray(submissions)) {
        throw new Error('Invalid submissions data');
      }
      
      const updates = submissions.map(submission => ({
        id: submission.id,
        submission_data: editData[submission.id]
      }));

      // Perform bulk update
      for (const update of updates) {
        const { error } = await supabase
          .from('form_submissions')
          .update({ submission_data: update.submission_data })
          .eq('id', update.id);

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `Updated ${submissions.length} records successfully.`
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating submissions:', error);
      toast({
        title: "Error",
        description: "Failed to update submissions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

const renderFieldInput = (field: any, value: any, submissionId: string) => {
  const fieldType = field.field_type || field.type;

  // Common wrapper for consistency
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-col gap-1 min-w-[220px] px-2 py-1">
      <label className="text-xs font-medium text-muted-foreground truncate">
        {field.label}
      </label>
      {children}
    </div>
  );

  switch (fieldType) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    case 'ip-address':
      return (
        <Wrapper>
          <Input
            value={value || ''}
            onChange={(e) =>
              handleFieldValueChange(submissionId, field.id, e.target.value)
            }
            placeholder={`Enter ${field.label}`}
            className="text-sm"
          />
        </Wrapper>
      );

    case 'textarea':
    case 'rich-text':
      return (
        <Wrapper>
          <Textarea
            value={value || ''}
            onChange={(e) =>
              handleFieldValueChange(submissionId, field.id, e.target.value)
            }
            placeholder={`Enter ${field.label}`}
            rows={2}
            className="text-sm resize-none"
          />
        </Wrapper>
      );

    case 'number':
      return (
        <Wrapper>
          <Input
            type="number"
            value={value || ''}
            onChange={(e) =>
              handleFieldValueChange(submissionId, field.id, e.target.value)
            }
            placeholder={`Enter ${field.label}`}
            className="text-sm"
          />
        </Wrapper>
      );

    case 'select':
    case 'dropdown':
    case 'country':
    case 'multi-select':
      return (
        <Wrapper>
          <Select
            value={value || ''}
            onValueChange={(newValue) =>
              handleFieldValueChange(submissionId, field.id, newValue)
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(field.options)
                ? field.options.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                : null}
            </SelectContent>
          </Select>
        </Wrapper>
      );

    case 'tags':
      return (
        <Wrapper>
          <Input
            value={Array.isArray(value) ? value.join(', ') : value || ''}
            onChange={(e) => {
              const tags = e.target.value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
              handleFieldValueChange(submissionId, field.id, tags);
            }}
            placeholder="Enter tags separated by commas"
            className="text-sm"
          />
        </Wrapper>
      );

      case 'user-picker': {
        const userValue = value || [];
        const selectedUserIds = Array.isArray(userValue) ? userValue : (userValue ? [userValue] : []);
        
        return (
          <Wrapper>
            <Select
              value=""
              onValueChange={(userId) => {
                const newValue = field.customConfig?.allowMultiple 
                  ? [...selectedUserIds, userId].filter((v, i, arr) => arr.indexOf(v) === i)
                  : userId;
                handleFieldValueChange(submissionId, field.id, newValue);
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select users" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {getUserDisplayName(user.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedUserIds.map((userId, i) => (
                  <Badge key={i} variant="outline" className="bg-blue-100 text-blue-800 text-xs">
                    {getUserDisplayName(userId)}
                  </Badge>
                ))}
              </div>
            )}
          </Wrapper>
        );
      }

      case 'submission-access': {
        const accessValue = value || { users: [], groups: [] };
        const normalizedValue = typeof accessValue === 'object' ? accessValue : { users: [], groups: [] };
        const { users: currentUsers = [], groups: currentGroups = [] } = normalizedValue;
        
        return (
          <Wrapper>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Users</Label>
                <Select
                  value=""
                  onValueChange={(userId) => {
                    const newUsers = [...currentUsers, userId].filter((v, i, arr) => arr.indexOf(v) === i);
                    handleFieldValueChange(submissionId, field.id, { users: newUsers, groups: currentGroups });
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Add user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {getUserDisplayName(user.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {currentUsers.map((userId, i) => (
                      <Badge key={i} variant="outline" className="bg-blue-100 text-blue-800 text-xs">
                        {getUserDisplayName(userId)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Groups</Label>
                <Select
                  value=""
                  onValueChange={(groupId) => {
                    const newGroups = [...currentGroups, groupId].filter((v, i, arr) => arr.indexOf(v) === i);
                    handleFieldValueChange(submissionId, field.id, { users: currentUsers, groups: newGroups });
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Add group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {getGroupDisplayName(group.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {currentGroups.map((groupId, i) => (
                      <Badge key={i} variant="outline" className="bg-green-100 text-green-800 text-xs">
                        {getGroupDisplayName(groupId)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Wrapper>
        );
      }

    case 'checkbox':
      return (
        <Wrapper>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) =>
                handleFieldValueChange(submissionId, field.id, checked)
              }
            />
            <span className="text-sm">{field.label}</span>
          </div>
        </Wrapper>
      );

    case 'date':
    case 'time':
    case 'datetime':
      return (
        <Wrapper>
          <Input
            type={
              fieldType === 'date'
                ? 'date'
                : fieldType === 'time'
                ? 'time'
                : 'datetime-local'
            }
            value={value || ''}
            onChange={(e) =>
              handleFieldValueChange(submissionId, field.id, e.target.value)
            }
            className="text-sm"
          />
        </Wrapper>
      );

    case 'toggle-switch':
      return (
        <Wrapper>
          <div className="flex items-center space-x-2">
            <Switch
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) =>
                handleFieldValueChange(submissionId, field.id, checked)
              }
            />
            <span className="text-sm">{field.label}</span>
          </div>
        </Wrapper>
      );

    case 'rating':
      const maxRating = field.customConfig?.ratingScale || 5;
      return (
        <Wrapper>
          <div className="flex items-center space-x-1">
            {[...Array(maxRating)].map((_, index) => {
              const starValue = index + 1;
              return (
                <Star
                  key={index}
                  className={`h-4 w-4 cursor-pointer transition-colors ${
                    starValue <= (value || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  onClick={() =>
                    handleFieldValueChange(submissionId, field.id, starValue)
                  }
                />
              );
            })}
            {value > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {value}/{maxRating}
              </span>
            )}
          </div>
        </Wrapper>
      );

    case 'slider':
      const min = field.validation?.min || 0;
      const max = field.validation?.max || 100;
      return (
        <Wrapper>
          <Slider
            value={[value || min]}
            onValueChange={(newValue) =>
              handleFieldValueChange(submissionId, field.id, newValue[0])
            }
            min={min}
            max={max}
            step={field.customConfig?.step || 1}
          />
          <div className="text-xs text-muted-foreground text-center">
            {value || min} / {max}
          </div>
        </Wrapper>
      );

    case 'radio':
      return (
        <Wrapper>
          {Array.isArray(field.options) && field.options.length > 0 ? (
            field.options.map((option: any) => (
              <div
                key={option.value || option.id}
                className="flex items-center space-x-2"
              >
                <input
                  type="radio"
                  name={`${submissionId}-${field.id}`}
                  value={option.value || option.id}
                  checked={value === (option.value || option.id)}
                  onChange={(e) =>
                    handleFieldValueChange(submissionId, field.id, e.target.value)
                  }
                  className="h-4 w-4"
                />
                <label className="text-sm">{option.label || option.name}</label>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No options available
            </p>
          )}
        </Wrapper>
      );

    case 'header':
    case 'description':
    case 'section-break':
    case 'horizontal-line':
    case 'full-width-container':
    case 'record-table':
    case 'matrix-grid':
    case 'cross-reference': {
      const crossRefValue = value || [];
      let displayValues: string[] = [];

      if (Array.isArray(crossRefValue)) {
        displayValues = crossRefValue.map(item => {
          if (typeof item === 'object' && item !== null) {
            return item.submission_ref_id || item.id || '[Unknown]';
          }
          return String(item);
        });
      } else if (crossRefValue && typeof crossRefValue === 'object') {
        displayValues = [crossRefValue.submission_ref_id || crossRefValue.id || '[Unknown]'];
      } else if (crossRefValue) {
        displayValues = [String(crossRefValue)];
      }

      return (
        <Wrapper>
          <Select
            value=""
            onValueChange={(recordRef) => {
              const newRefs = [...displayValues, recordRef].filter((v, i, arr) => arr.indexOf(v) === i);
              handleFieldValueChange(submissionId, field.id, newRefs);
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select records" />
            </SelectTrigger>
            <SelectContent>
              {crossRefRecords.map(record => (
                <SelectItem key={record.id} value={record.submission_ref_id}>
                  {record.displayData}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {displayValues.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {displayValues.map((ref, i) => (
                <Badge key={i} variant="outline" className="bg-primary/10 text-primary text-xs">
                  {ref}
                </Badge>
              ))}
            </div>
          )}
        </Wrapper>
      );
    }

    case 'child-cross-reference':
    case 'calculated':
    case 'conditional-section':
    case 'workflow-trigger':
    case 'query-field':
    case 'barcode':
    case 'address':
      case'file':
      return (
        <Wrapper>
          <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">
            Non-editable field: {fieldType}
          </div>
        </Wrapper>
      );

    default:
      return (
        <Wrapper>
          <Input
            value={value || ''}
            onChange={(e) =>
              handleFieldValueChange(submissionId, field.id, e.target.value)
            }
            placeholder={`Enter ${field.label}`}
            className="text-sm"
          />
        </Wrapper>
      );
  }
};


return (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Multi-Line Edit - {Array.isArray(submissions) ? submissions.length : 0} Records
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Select fields and set values to apply to all selected records
        </p>
      </DialogHeader>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="overflow-x-auto">
            {/* Table-like container */}
            <div className="table w-full border-collapse min-w-max">
              {/* Header row */}
              <div className="table-row bg-muted/50 text-xs font-medium text-muted-foreground">
                <div className="table-cell px-3 py-2 w-32">Record ID</div>
                {Array.isArray(formFields)
                  ? formFields.map((field) => (
                      <div
                        key={field.id}
                        className="table-cell px-3 py-2 min-w-[180px] text-left truncate"
                        title={field.label}
                      >
                        {field.label}
                      </div>
                    ))
                  : null}
              </div>

              {/* Data rows */}
              {Array.isArray(submissions)
                ? submissions.map((submission) => (
                    <div key={submission.id} className="table-row border-b">
                      {/* Record ID cell */}
                      <div className="table-cell px-3 py-2 align-top w-32">
                        <Badge
                          variant="outline"
                          className="text-xs truncate w-full"
                          title={submission.submission_ref_id || submission.id}
                        >
                          #{submission.submission_ref_id ||
                            submission.id.slice(0, 8)}
                        </Badge>
                      </div>

                      {/* Dynamic field cells */}
                      {Array.isArray(formFields)
                        ? formFields.map((field) => {
                            const currentValue =
                              editData?.[submission.id]?.[field.id];
                            return (
                              <div
                                key={field.id}
                                className="table-cell px-3 py-2 align-top min-w-[180px]"
                                title={
                                  typeof currentValue === "string"
                                    ? currentValue
                                    : currentValue ?? ""
                                }
                              >
                                {renderFieldInput(
                                  field,
                                  currentValue,
                                  submission.id
                                )}
                              </div>
                            );
                          })
                        : null}
                    </div>
                  ))
                : null}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Editing {Array.isArray(submissions) ? submissions.length : 0} record
          {(Array.isArray(submissions) ? submissions.length : 0) !== 1
            ? "s"
            : ""}{" "}
          with {Array.isArray(formFields) ? formFields.length : 0} field
          {(Array.isArray(formFields) ? formFields.length : 0) !== 1
            ? "s"
            : ""}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving
              ? "Saving..."
              : `Update ${Array.isArray(submissions) ? submissions.length : 0} Records`}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

}