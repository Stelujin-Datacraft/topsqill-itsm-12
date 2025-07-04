
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { User } from 'lucide-react';

interface UserSuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (user: { id: string; email: string; first_name?: string; last_name?: string }) => void;
  placeholder?: string;
  className?: string;
}

export function UserSuggestionInput({ 
  value, 
  onChange, 
  onUserSelect, 
  placeholder = "Enter email address",
  className 
}: UserSuggestionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { users, searchUsers } = useOrganizationUsers();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredUsers = searchUsers(searchQuery);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSearchQuery(newValue);
    setIsOpen(newValue.length > 0);
  };

  const handleUserSelect = (user: any) => {
    onChange(user.email);
    setIsOpen(false);
    setSearchQuery('');
    if (onUserSelect) {
      onUserSelect(user);
    }
  };

  const displayName = (user: any) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name ? `${name} (${user.email})` : user.email;
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => value.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      
      {isOpen && filteredUsers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          <Command>
            <CommandList>
              <CommandGroup>
                {filteredUsers.slice(0, 5).map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.email}
                    onSelect={() => handleUserSelect(user)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">{displayName(user)}</span>
                      <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {filteredUsers.length === 0 && searchQuery && (
                <CommandEmpty className="px-3 py-2 text-sm text-muted-foreground">
                  No users found
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
