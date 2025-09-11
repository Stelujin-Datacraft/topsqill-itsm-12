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
  selectedRecords: any[];
  onCopy: (numberOfCopies: number) => Promise<void>;
}

export function CopyRecordsDialog({ isOpen, onOpenChange, selectedCount, selectedRecords, onCopy }: CopyRecordsDialogProps) {
  const [numberOfCopies, setNumberOfCopies] = useState('1');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty input for better UX
    if (value === '') {
      setNumberOfCopies('');
      return;
    }
    
    // Allow digits only, remove any non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 3 digits max (100 is max)
    if (digitsOnly.length <= 3) {
      const numValue = parseInt(digitsOnly);
      if (numValue <= 100) {
        setNumberOfCopies(digitsOnly);
      }
    }
  };

  const getNumberOfCopies = () => {
    const num = parseInt(numberOfCopies);
    return isNaN(num) || num < 1 ? 1 : num;
  };

  const handleCopy = async () => {
    const finalNumberOfCopies = getNumberOfCopies();
    if (finalNumberOfCopies < 1 || finalNumberOfCopies > 100) return;
    
    setIsLoading(true);
    try {
      await onCopy(finalNumberOfCopies);
      onOpenChange(false);
      setNumberOfCopies('1');
    } catch (error) {
      console.error('Error copying records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalNewRecords = selectedCount * getNumberOfCopies();

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

          {selectedRecords.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Records:</Label>
              <div className="max-h-32 overflow-y-auto bg-muted/30 rounded-md p-2">
                <div className="space-y-1">
                  {selectedRecords.map((record, index) => (
                    <div key={record.id} className="text-xs font-mono">
                      #{record.submission_ref_id || record.id.slice(0, 8)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="copies">Number of copies per record</Label>
            <Input
              id="copies"
              type="text"
              value={numberOfCopies}
              onChange={handleInputChange}
              placeholder="1"
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Enter a number between 1 and 100
            </div>
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
            disabled={isLoading || getNumberOfCopies() < 1}
          >
            {isLoading ? 'Copying...' : `Create ${totalNewRecords} Cop${totalNewRecords > 1 ? 'ies' : 'y'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}