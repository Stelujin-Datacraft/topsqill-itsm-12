import React from 'react';
import { useDelegation } from '@/contexts/DelegationContext';
import { Button } from '@/components/ui/button';
import { UserCheck, X, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DelegationBanner() {
  const { actingAs, setActingAs, delegators } = useDelegation();
  if (!actingAs) return null;

  const nameOf = (d: { first_name: string | null; last_name: string | null; email: string }) =>
    d.first_name || d.last_name ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() : d.email;

  const name = nameOf(actingAs);
  const hasMultiple = delegators.length > 1;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99] bg-primary text-primary-foreground py-2 px-4 shadow-lg">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCheck className="h-5 w-5" />
          <span className="font-medium">Acting on behalf of:</span>
          {hasMultiple ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0 h-7"
                >
                  <strong className="mr-1">{name}</strong>
                  <span className="text-primary-foreground/80 text-xs mr-1">({actingAs.email})</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Switch delegator</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {delegators.map((d) => {
                  const active = d.id === actingAs.id;
                  return (
                    <DropdownMenuItem key={d.id} onClick={() => setActingAs(d)} className="flex items-start gap-2">
                      <Check className={`h-4 w-4 mt-0.5 ${active ? 'opacity-100' : 'opacity-0'}`} />
                      <div className="flex flex-col">
                        <span className="font-medium">{nameOf(d)}</span>
                        <span className="text-xs text-muted-foreground">{d.email}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <strong>{name}</strong>
              <span className="text-primary-foreground/80 text-sm">({actingAs.email})</span>
            </>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setActingAs(null)}
          className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
        >
          <X className="h-4 w-4 mr-2" /> Stop
        </Button>
      </div>
    </div>
  );
}