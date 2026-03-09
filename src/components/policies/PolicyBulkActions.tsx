import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, Archive, Trash2, X, Copy } from 'lucide-react';
import type { Policy } from '@/types/policy';

interface PolicyBulkActionsProps {
  policies: Policy[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onBulkPublish: (ids: string[]) => Promise<void>;
  onBulkRetire: (ids: string[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onClone: (id: string) => Promise<void>;
}

export function PolicyBulkActions({
  policies,
  selectedIds,
  onSelectionChange,
  onBulkPublish,
  onBulkRetire,
  onBulkDelete,
  onClone,
}: PolicyBulkActionsProps) {
  const [confirmAction, setConfirmAction] = useState<'publish' | 'retire' | 'delete' | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPolicies = policies.filter(p => selectedIds.includes(p.id));
  const canPublish = selectedPolicies.some(p => p.status === 'draft');
  const canRetire = selectedPolicies.some(p => p.status === 'published');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (confirmAction === 'publish') {
        await onBulkPublish(selectedIds.filter(id => policies.find(p => p.id === id)?.status === 'draft'));
      } else if (confirmAction === 'retire') {
        await onBulkRetire(selectedIds.filter(id => policies.find(p => p.id === id)?.status === 'published'));
      } else if (confirmAction === 'delete') {
        await onBulkDelete(selectedIds);
      }
      onSelectionChange([]);
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === policies.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(policies.map(p => p.id));
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Checkbox
          checked={selectedIds.length === policies.length}
          onCheckedChange={toggleAll}
        />
        <Badge variant="secondary">{selectedIds.length} selected</Badge>
        
        <div className="flex items-center gap-1.5 ml-auto">
          {canPublish && (
            <Button size="sm" variant="outline" onClick={() => setConfirmAction('publish')} className="gap-1.5 text-emerald-600 hover:text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" /> Publish
            </Button>
          )}
          {canRetire && (
            <Button size="sm" variant="outline" onClick={() => setConfirmAction('retire')} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" /> Retire
            </Button>
          )}
          {selectedIds.length === 1 && (
            <Button size="sm" variant="outline" onClick={() => onClone(selectedIds[0])} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Clone
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setConfirmAction('delete')} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSelectionChange([])} className="ml-1">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'publish' && 'Publish Selected Policies'}
              {confirmAction === 'retire' && 'Retire Selected Policies'}
              {confirmAction === 'delete' && 'Delete Selected Policies'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'publish' && `This will publish ${selectedPolicies.filter(p => p.status === 'draft').length} draft policy(ies).`}
              {confirmAction === 'retire' && `This will retire ${selectedPolicies.filter(p => p.status === 'published').length} published policy(ies).`}
              {confirmAction === 'delete' && `This will permanently delete ${selectedIds.length} policy(ies) and all their versions. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className={confirmAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
