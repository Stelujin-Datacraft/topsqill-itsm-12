import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, X, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { cn } from '@/lib/utils';

interface RuleUserScopeProps {
  appliesTo: 'all' | 'specific';
  appliesToUserIds: string[];
  onChange: (appliesTo: 'all' | 'specific', userIds: string[]) => void;
}

export function RuleUserScope({ appliesTo, appliesToUserIds, onChange }: RuleUserScopeProps) {
  const [open, setOpen] = useState(false);
  const { users, loading } = useOrganizationUsers();

  const selectedUsers = useMemo(() =>
    users.filter(u => appliesToUserIds.includes(u.id)),
    [users, appliesToUserIds]
  );

  const handleUserToggle = (userId: string) => {
    const newIds = appliesToUserIds.includes(userId)
      ? appliesToUserIds.filter(id => id !== userId)
      : [...appliesToUserIds, userId];
    onChange('specific', newIds);
  };

  const handleRemoveUser = (userId: string) => {
    const newIds = appliesToUserIds.filter(id => id !== userId);
    onChange(newIds.length > 0 ? 'specific' : 'all', newIds);
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div>
        <Label className="text-sm font-medium">Applies To</Label>
        <Select
          value={appliesTo}
          onValueChange={(val: 'all' | 'specific') => {
            if (val === 'all') {
              onChange('all', []);
            } else {
              onChange('specific', appliesToUserIds);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="specific">Specific Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {appliesTo === 'specific' && (
        <div className="space-y-2">
          {/* Selected users badges */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map(user => (
                <Badge key={user.id} variant="secondary" className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                  <button type="button" onClick={() => handleRemoveUser(user.id)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* User selector */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                ) : (
                  <>
                    <span className="truncate">
                      {appliesToUserIds.length > 0 ? `${appliesToUserIds.length} user(s) selected` : 'Select users...'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandEmpty>No users found.</CommandEmpty>
                <ScrollArea className="h-56">
                  <CommandList>
                    <CommandGroup>
                      {users.map(user => (
                        <CommandItem key={user.id} onSelect={() => handleUserToggle(user.id)} className="flex items-center gap-2">
                          <div className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            appliesToUserIds.includes(user.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible'
                          )}>
                            <Check className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                            </span>
                            {user.first_name && (
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
