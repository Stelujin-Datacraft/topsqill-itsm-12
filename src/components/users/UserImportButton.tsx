import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserImportDialog } from './UserImportDialog';
import { Upload } from 'lucide-react';

interface UserImportButtonProps {
  onImportComplete: (users: Array<{ 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: string;
    password?: string;
    nationality?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }>) => void;
}

export function UserImportButton({ onImportComplete }: UserImportButtonProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowImportDialog(true)}
        className="flex items-center gap-1"
      >
        <Upload className="h-4 w-4" />
        Import Users
      </Button>
      
      <UserImportDialog
        isOpen={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={onImportComplete}
      />
    </>
  );
}
