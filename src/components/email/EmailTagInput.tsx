import React, { useState, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface EmailTagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function EmailTagInput({ value, onChange, placeholder = "Type email and press Enter" }: EmailTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  
  // Parse comma-separated string to array
  const emails = value ? value.split(',').map(e => e.trim()).filter(e => e) : [];
  
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  const addEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail && isValidEmail(trimmedEmail) && !emails.includes(trimmedEmail)) {
      const newEmails = [...emails, trimmedEmail];
      onChange(newEmails.join(','));
      setInputValue('');
    }
  };
  
  const removeEmail = (emailToRemove: string) => {
    const newEmails = emails.filter(e => e !== emailToRemove);
    onChange(newEmails.join(','));
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      // Remove last email when backspace is pressed on empty input
      removeEmail(emails[emails.length - 1]);
    }
  };
  
  const handleBlur = () => {
    // Add email on blur if valid
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  };

  return (
    <div className="flex-1">
      <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-background min-h-[38px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {emails.map((email) => (
          <Badge key={email} variant="secondary" className="gap-1 pr-1">
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[150px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">Press Enter to add email</p>
    </div>
  );
}
