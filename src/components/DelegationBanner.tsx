import React from 'react';
import { useDelegation } from '@/contexts/DelegationContext';
import { Button } from '@/components/ui/button';
import { UserCheck, X } from 'lucide-react';

export function DelegationBanner() {
  const { actingAs, setActingAs } = useDelegation();
  if (!actingAs) return null;

  const name = actingAs.first_name || actingAs.last_name
    ? `${actingAs.first_name ?? ''} ${actingAs.last_name ?? ''}`.trim()
    : actingAs.email;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99] bg-primary text-primary-foreground py-2 px-4 shadow-lg">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCheck className="h-5 w-5" />
          <span className="font-medium">
            Acting on behalf of: <strong>{name}</strong>
          </span>
          <span className="text-primary-foreground/80 text-sm">({actingAs.email})</span>
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