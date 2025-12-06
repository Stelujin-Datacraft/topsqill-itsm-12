import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, Plus, Users, ChevronDown, Check } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { cn } from '@/lib/utils';

interface EnhancedUserSelectorProps {
  value: {
    type: 'form_submitter' | 'static' | 'dynamic';
    emails?: string[];
    dynamicFieldPath?: string;
  };
  onValueChange: (value: any) => void;
  triggerFormId?: string;
  formFields?: Array<{ id: string; label: string; type: string }>;
}

export function EnhancedUserSelector({ 
  value, 
  onValueChange, 
  triggerFormId,
  formFields = []
}: EnhancedUserSelectorProps) {
  const [manualEmail, setManualEmail] = useState('');
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);
  const { users, loading } = useOrganizationUsers();

  const handleTypeChange = (type: string) => {
    console.log('🔧 Assignment type changed:', type);
    if (type === 'form_submitter') {
      onValueChange({ type: 'form_submitter' });
    } else if (type === 'static') {
      onValueChange({ type: 'static', emails: value?.emails || [] });
    } else if (type === 'dynamic') {
      onValueChange({ type: 'dynamic', dynamicFieldPath: '' });
    }
  };

  const addManualEmail = () => {
    if (!manualEmail.trim()) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualEmail.trim())) {
      return;
    }

    const currentEmails = value?.emails || [];
    if (!currentEmails.includes(manualEmail.trim())) {
      onValueChange({ 
        ...value, 
        emails: [...currentEmails, manualEmail.trim()] 
      });
    }
    setManualEmail('');
  };

  const removeEmail = (emailToRemove: string) => {
    const currentEmails = value?.emails || [];
    onValueChange({ 
      ...value, 
      emails: currentEmails.filter((e: string) => e !== emailToRemove) 
    });
  };

  const toggleUserSelection = (email: string) => {
    const currentEmails = value?.emails || [];
    if (currentEmails.includes(email)) {
      onValueChange({ 
        ...value, 
        emails: currentEmails.filter((e: string) => e !== email) 
      });
    } else {
      onValueChange({ 
        ...value, 
        emails: [...currentEmails, email] 
      });
    }
  };

  const handleDynamicFieldChange = (fieldPath: string) => {
    onValueChange({ ...value, dynamicFieldPath: fieldPath });
  };

  const selectedEmails = value?.emails || [];

  // Filter fields that can contain user emails for dynamic mode
  const emailFields = formFields.filter(f => 
    f.type === 'email' || 
    f.type === 'user-picker' ||
    f.type === 'submission-access' ||
    f.type === 'user-select' ||
    f.type === 'assignee' ||
    f.label.toLowerCase().includes('email') ||
    f.label.toLowerCase().includes('user') ||
    f.label.toLowerCase().includes('assignee')
  );

  return (
    <div className="space-y-3">
      <div>
        <Label>Assignment Type</Label>
        <Select value={value?.type || 'form_submitter'} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="form_submitter">Assign to Form Submitter</SelectItem>
            <SelectItem value="static">Static - Specify User(s)</SelectItem>
            <SelectItem value="dynamic">Dynamic - From Form Field</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Static Mode: Multiple emails + user selection */}
      {value?.type === 'static' && (
        <div className="space-y-3">
          {/* Manual Email Entry */}
          <div>
            <Label>Add Email Manually</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="Enter email address"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualEmail();
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={addManualEmail}
                disabled={!manualEmail.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Select from Organization Users */}
          <div>
            <Label>Or Select from Organization Users</Label>
            <Popover open={userSelectorOpen} onOpenChange={setUserSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {selectedEmails.length > 0 
                      ? `${selectedEmails.length} user(s) selected`
                      : 'Select users...'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>
                      {loading ? 'Loading users...' : 'No users found.'}
                    </CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[200px]">
                        {users.map((user) => {
                          const displayName = user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.email;
                          const isSelected = selectedEmails.includes(user.email);
                          
                          return (
                            <CommandItem
                              key={user.id}
                              onSelect={() => toggleUserSelection(user.email)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <Checkbox 
                                  checked={isSelected}
                                  className="pointer-events-none"
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {displayName}
                                  </span>
                                  {displayName !== user.email && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {user.email}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Emails Display */}
          {selectedEmails.length > 0 && (
            <div>
              <Label>Selected Users ({selectedEmails.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-2 border rounded-md bg-muted/50">
                {selectedEmails.map((email: string) => (
                  <Badge 
                    key={email} 
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Mode: Select field from form */}
      {value?.type === 'dynamic' && (
        <div>
          <Label>Select Field Containing User Email</Label>
          <Select 
            value={value?.dynamicFieldPath || ''} 
            onValueChange={handleDynamicFieldChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {emailFields.length > 0 ? (
                emailFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({field.type})
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No email fields found in trigger form
                </div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            The form will be assigned to the user email from this field value
          </p>
        </div>
      )}

      {/* Current Setting Summary */}
      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
        <strong>Current setting:</strong>{' '}
        {value?.type === 'form_submitter' 
          ? 'Form will be assigned to the person who submitted the triggering form'
          : value?.type === 'static'
          ? selectedEmails.length > 0
            ? `Form will be assigned to: ${selectedEmails.join(', ')}`
            : 'Please add at least one email'
          : value?.type === 'dynamic'
          ? value?.dynamicFieldPath
            ? `Form will be assigned based on field value`
            : 'Please select a field'
          : 'Please select assignment type'
        }
      </div>
    </div>
  );
}
