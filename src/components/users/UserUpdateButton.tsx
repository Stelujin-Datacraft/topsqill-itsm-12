import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserUpdateDialog } from './UserUpdateDialog';
import { RefreshCw } from 'lucide-react';

interface UserUpdateButtonProps {
  onUpdateComplete: (updates: Array<{ 
    email: string; 
    firstName?: string; 
    lastName?: string; 
    role?: string;
    nationality?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }>) => void;
}

export function UserUpdateButton({ onUpdateComplete }: UserUpdateButtonProps) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowUpdateDialog(true)}
        className="flex items-center gap-1"
      >
        <RefreshCw className="h-4 w-4" />
        Update Users
      </Button>
      
      <UserUpdateDialog
        isOpen={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        onUpdateComplete={onUpdateComplete}
      />
    </>
  );
}
