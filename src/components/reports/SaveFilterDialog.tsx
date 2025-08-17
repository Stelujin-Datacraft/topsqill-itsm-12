import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { FilterGroup } from './TableFiltersPanel';

interface SaveFilterDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  filters: FilterGroup[];
  loading?: boolean;
}

export function SaveFilterDialog({ 
  isOpen, 
  onOpenChange, 
  onSave, 
  filters, 
  loading = false 
}: SaveFilterDialogProps) {
  const [filterName, setFilterName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!filterName.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(filterName.trim());
      setFilterName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving filter:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFilterName('');
    onOpenChange(false);
  };

  const getTotalConditions = () => {
    return filters.reduce((total, group) => total + group.conditions.length, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Current Filter
          </DialogTitle>
          <DialogDescription>
            Save your current filter configuration with {getTotalConditions()} condition
            {getTotalConditions() !== 1 ? 's' : ''} across {filters.length} group
            {filters.length !== 1 ? 's' : ''} for future use.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-name">Filter Name</Label>
            <Input
              id="filter-name"
              placeholder="Enter a name for this filter..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filterName.trim()) {
                  handleSave();
                }
              }}
              disabled={isSaving}
            />
          </div>
          
          {filters.length > 0 && (
            <div className="bg-muted/30 p-3 rounded-md">
              <div className="text-sm font-medium mb-2">Filter Preview:</div>
              <div className="space-y-2 text-xs text-muted-foreground">
                {filters.map((group, index) => (
                  <div key={group.id}>
                    <span className="font-medium">{group.name}</span>
                    <span className="ml-2">
                      ({group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''})
                    </span>
                    {group.conditions.length > 1 && (
                      <span className="ml-1 px-1 bg-muted rounded text-xs">
                        {group.logic}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!filterName.trim() || isSaving || filters.length === 0}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}