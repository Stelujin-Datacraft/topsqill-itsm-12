import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { backend as supabase } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        setState('error');
        setMessage('Missing verification token. Please use the link from your email.');
        return;
      }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md enterprise-card shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email verification</CardTitle>
          <CardDescription>
            {state === 'loading' && 'Activating your account…'}
            {state === 'success' && 'Your account is ready'}
            {state === 'error' && 'We could not verify this link'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
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
