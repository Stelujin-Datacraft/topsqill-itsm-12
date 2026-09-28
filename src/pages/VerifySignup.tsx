import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { backend as supabase } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const emailFromQuery = (searchParams.get('email') || '').trim().toLowerCase();
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState(
    token ? 'Verifying your email…' : 'Enter the code from your email to create your account.',
  );
  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) return;

      try {
        const { data, error } = await supabase.functions.invoke('verify-signup', {
          body: { token },
        });

        if (cancelled) return;

        if (error) {
          setState('error');
          setMessage(error.message || 'Verification failed.');
          return;
        }

        const payload = (data || {}) as {
          success?: boolean;
          error?: string;
          message?: string;
          email?: string;
        };

        if (!payload.success) {
          setState('error');
          setMessage(payload.error || 'Verification failed.');
          return;
        }

        setEmail(payload.email || '');
        setMessage(payload.message || 'Email verified. Please sign in.');
        setState('success');
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.trim();
    const verifyEmail = email.trim().toLowerCase();
    if (!verifyEmail) {
      toast({
        title: 'Email required',
        description: 'Enter the email you used to sign up.',
        variant: 'destructive',
      });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit code from your email.',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    setState('loading');
    setMessage('Creating your account…');
    try {
      const { data, error } = await supabase.functions.invoke('verify-signup', {
        body: { email: verifyEmail, otp: code },
      });

      if (error) {
        setState('error');
        setMessage(error.message || 'Verification failed.');
        return;
      }

      const payload = (data || {}) as {
        success?: boolean;
        error?: string;
        message?: string;
        email?: string;
      };

      if (!payload.success) {
        setState('error');
        setMessage(payload.error || 'Verification failed.');
        return;
      }

      setEmail(payload.email || verifyEmail);
      setMessage(payload.message || 'Email verified. Please sign in.');
      setState('success');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md enterprise-card shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email verification</CardTitle>
          <CardDescription>
            {state === 'loading' && 'Activating your account…'}
            {state === 'success' && 'Your account is ready'}
            {state === 'error' && 'We could not verify this code'}
            {state === 'idle' && 'Enter the one-time code from your email'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === 'idle' && (
            <form onSubmit={handleOtpVerify} className="space-y-4 text-left">
              <div className="flex flex-col items-center gap-2 text-center">
                <Mail className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verify-email">Email</Label>
                <Input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Verification code</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifying}>
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
              </div>
              <Button type="submit" className="w-full" disabled={verifying || otp.length !== 6}>
                {verifying ? 'Creating account…' : 'Verify & create account'}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to="/auth?mode=signup">Back to sign up</Link>
              </Button>
            </form>
          )}

          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{message}</p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm text-muted-foreground">{message}</p>
              {email && <p className="text-sm font-medium">{email}</p>}
              <Button
                type="button"
                className="w-full"
                onClick={() =>
                  navigate(
                    email
                      ? `/auth?mode=signin&verified=1&email=${encodeURIComponent(email)}`
                      : '/auth?mode=signin&verified=1',
                    { replace: true },
                  )
                }
              >
                Continue to sign in
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setState('idle');
                  setOtp('');
                  setMessage('Enter the code from your email to create your account.');
                }}
              >
                Try again
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to="/auth?mode=signup">Back to sign up</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
