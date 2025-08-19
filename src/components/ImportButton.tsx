import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImportDialog } from './ImportDialog';
import { Upload } from 'lucide-react';

interface ImportButtonProps {
  formId: string;
  formFields: any[];
  onImportComplete: () => void;
}

export function ImportButton({ formId, formFields, onImportComplete }: ImportButtonProps) {
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
        Import
      </Button>
      
      <ImportDialog
        isOpen={showImportDialog}
        onOpenChange={setShowImportDialog}
        formId={formId}
        formFields={formFields || []}
        onImportComplete={onImportComplete}
      />
    </>
  );
}