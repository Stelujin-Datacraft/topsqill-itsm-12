import React from 'react';
import { useDelegation } from '@/contexts/DelegationContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserCheck, ChevronDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Compact switcher to "Act on behalf of" a delegator who has granted
 * the current user a record delegation. Hidden when no delegations exist.
 */
export function DelegationSwitcher() {
  const { delegators, actingAs, setActingAs } = useDelegation();
  if (!delegators.length) return null;

  const currentLabel = actingAs
    ? (actingAs.first_name || actingAs.email)
    : 'Act on behalf';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="truncate max-w-[140px]">{currentLabel}</span>
          {actingAs && <Badge variant="secondary" className="ml-1">on behalf</Badge>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Delegations granted to you</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setActingAs(null)} className="flex items-center justify-between">
          <span>Act as myself</span>
          {!actingAs && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {delegators.map(d => {
          const name = d.first_name || d.last_name ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() : d.email;
          const selected = actingAs?.id === d.id;
          return (
            <DropdownMenuItem key={d.id} onClick={() => setActingAs(d)} className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">{d.email}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {d.delegations.length} active scope{d.delegations.length === 1 ? '' : 's'}
                </span>
              </div>
              {selected && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}