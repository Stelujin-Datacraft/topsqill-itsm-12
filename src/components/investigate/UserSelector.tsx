import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface UserSelectorProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  loading?: boolean;
}

export function UserSelector({ users, selectedUserId, onSelectUser, loading }: UserSelectorProps) {
  const getDisplayName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <Select
      value={selectedUserId || ''}
      onValueChange={(value) => onSelectUser(value || null)}
    >
      <SelectTrigger className="w-full max-w-md">
        <SelectValue placeholder="Select a user to investigate..." />
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-3">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{getDisplayName(user)}</span>
                {user.first_name && (
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
