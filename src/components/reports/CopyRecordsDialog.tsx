import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';

interface CopyRecordsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onCopy: (numberOfCopies: number) => Promise<void>;
}

export function CopyRecordsDialog({ isOpen, onOpenChange, selectedCount, onCopy }: CopyRecordsDialogProps) {
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (numberOfCopies < 1 || numberOfCopies > 100) return;
    
    setIsLoading(true);
    try {
      await onCopy(numberOfCopies);
      onOpenChange(false);
      setNumberOfCopies(1);
    } catch (error) {
      console.error('Error copying records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalNewRecords = selectedCount * numberOfCopies;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy Records
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            You have selected <strong>{selectedCount}</strong> record{selectedCount > 1 ? 's' : ''} to copy.
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="copies">Number of copies per record</Label>
            <Input
              id="copies"
              type="number"
              value={numberOfCopies}
              onChange={(e) => setNumberOfCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              min="1"
              max="100"
              className="w-full"
            />
          </div>
          
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <strong>Total new records:</strong> {totalNewRecords}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedCount} record{selectedCount > 1 ? 's' : ''} × {numberOfCopies} copies = {totalNewRecords} new record{totalNewRecords > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={isLoading || numberOfCopies < 1}
          >
            {isLoading ? 'Copying...' : `Create ${totalNewRecords} Cop${totalNewRecords > 1 ? 'ies' : 'y'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}