import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface TestEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (email: string) => void;
  configName: string;
  defaultEmail?: string;
}

export function TestEmailDialog({
  open,
  onOpenChange,
  onConfirm,
  configName,
  defaultEmail = '',
}: TestEmailDialogProps) {
  const [testEmail, setTestEmail] = useState(defaultEmail);

  const handleConfirm = () => {
    if (testEmail && testEmail.includes('@')) {
      onConfirm(testEmail);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test SMTP Configuration
          </DialogTitle>
          <DialogDescription>
            Send a test email to verify "{configName}" configuration is working correctly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Test Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm();
                }
              }}
              autoFocus
            />
            <p className="text-sm text-muted-foreground">
              Enter the email address where you want to receive the test email
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!testEmail || !testEmail.includes('@')}
          >
            Send Test Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
