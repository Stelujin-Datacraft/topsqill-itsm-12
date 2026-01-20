import React from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { UserRoundX, Eye } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  const userName = [impersonatedUser.first_name, impersonatedUser.last_name]
    .filter(Boolean)
    .join(' ') || impersonatedUser.email;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 shadow-lg">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5" />
          <span className="font-medium">
            Impersonating: <strong>{userName}</strong>
          </span>
          <span className="text-amber-800 text-sm">
            ({impersonatedUser.email})
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={stopImpersonation}
          className="bg-amber-600 hover:bg-amber-700 text-white border-0"
        >
          <UserRoundX className="h-4 w-4 mr-2" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}
