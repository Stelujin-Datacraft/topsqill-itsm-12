import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { sendMfaCode, verifyMfaCode } from '@/utils/securityEnforcement';
import { Shield, Mail, RefreshCw } from 'lucide-react';

interface MfaVerificationDialogProps {
  open: boolean;
  email: string;
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export const MfaVerificationDialog = ({
  open,
  email,
  userId,
  onVerified,
  onCancel,
}: MfaVerificationDialogProps) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (open && !codeSent) {
      handleSendCode();
    }
  }, [open]);

  const handleSendCode = async () => {
    setIsSending(true);
    const result = await sendMfaCode(email, userId);
    setIsSending(false);

    if (result.success) {
      setCodeSent(true);
      setExpiryMinutes(result.expiryMinutes || 5);
      toast({
        title: 'Verification code sent',
        description: `A code has been sent to ${email}`,
      });
    } else {
      toast({
        title: 'Failed to send code',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    const result = await verifyMfaCode(userId, code);
    setIsVerifying(false);

    if (result.success) {
      toast({
        title: 'Verification successful',
        description: 'You have been authenticated',
      });
      onVerified();
    } else {
      toast({
        title: 'Verification failed',
        description: result.error,
        variant: 'destructive',
      });
      setCode('');
    }
  };

  const handleResend = () => {
    setCode('');
    setCodeSent(false);
    handleSendCode();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the verification code sent to your email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Code sent to: {email}</span>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isVerifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Code expires in {expiryMinutes} minutes
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isVerifying}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </Button>

            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isSending}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSending ? 'animate-spin' : ''}`} />
              {isSending ? 'Sending...' : 'Resend Code'}
            </Button>

            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
