import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Home, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_exists'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link. No token provided.');
      return;
    }

    const acceptInvitation = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('accept-user-invitation', {
          body: { token }
        });

        if (error) {
          setStatus('error');
          setMessage('Failed to accept invitation. Please try again or contact support.');
          return;
        }

        if (!data?.success) {
          setStatus('error');
          setMessage(data?.error || 'Failed to accept invitation.');
          return;
        }

        if (data.alreadyExists) {
          setStatus('already_exists');
          setEmail(data.email || '');
          setMessage('Your account already exists. Please log in with your credentials.');
        } else {
          setStatus('success');
          setEmail(data.email || '');
          setMessage('Your account has been created successfully! You can now log in with the credentials sent to your email.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    acceptInvitation();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Topsqill</h1>
          <p className="text-muted-foreground">ITSM Platform</p>
        </div>

        <Card>
          <CardContent className="text-center py-12">
            {status === 'loading' && (
              <>
                <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-semibold mb-2">Accepting Invitation...</h2>
                <p className="text-muted-foreground">Please wait while we set up your account.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-green-600 mb-2">Welcome Aboard! 🎉</h2>
                <p className="text-muted-foreground mb-6">{message}</p>
                {email && (
                  <p className="text-sm text-muted-foreground mb-6">
                    Your login email: <strong>{email}</strong>
                  </p>
                )}
                <Link to="/auth">
                  <Button className="w-full">
                    <LogIn className="h-4 w-4 mr-2" />
                    Go to Login
                  </Button>
                </Link>
              </>
            )}

            {status === 'already_exists' && (
              <>
                <CheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-blue-600 mb-2">Account Already Exists</h2>
                <p className="text-muted-foreground mb-6">{message}</p>
                <Link to="/auth">
                  <Button className="w-full">
                    <LogIn className="h-4 w-4 mr-2" />
                    Go to Login
                  </Button>
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-red-600 mb-2">Invitation Error</h2>
                <p className="text-muted-foreground mb-6">{message}</p>
                <div className="space-y-3">
                  <Link to="/auth" className="block">
                    <Button className="w-full">
                      <LogIn className="h-4 w-4 mr-2" />
                      Go to Login
                    </Button>
                  </Link>
                  <Link to="/" className="block">
                    <Button variant="outline" className="w-full">
                      <Home className="h-4 w-4 mr-2" />
                      Go to Homepage
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            © 2024 Topsqill. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation;
