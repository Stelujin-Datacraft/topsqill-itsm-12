
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { MfaVerificationDialog } from '@/components/MfaVerificationDialog';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signOut, isLoading, pendingMfa, completeMfaVerification, passwordExpired, clearPasswordExpired } = useAuth();
  const navigate = useNavigate();
  const [showMfa, setShowMfa] = useState(false);

  useEffect(() => {
    if (pendingMfa) {
      setShowMfa(true);
    }
  }, [pendingMfa]);

  useEffect(() => {
    if (passwordExpired) {
      toast({
        title: "Password Expired",
        description: "You must change your password to continue.",
        variant: "destructive",
      });
      clearPasswordExpired();
      navigate('/change-password');
    }
  }, [passwordExpired, navigate, clearPasswordExpired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error, requiresMfa, passwordExpired: pwExpired } = await signIn(email, password);
    
    if (requiresMfa) {
      // MFA dialog will show automatically via useEffect
      return;
    }

    if (pwExpired) {
      // Will redirect via useEffect
      return;
    }

    if (!error) {
      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });
      navigate('/dashboard');
    } else {
      const errorMessage = error.code === 'account_locked' 
        ? error.message 
        : error.code === 'access_restricted'
        ? error.message
        : error.code === 'session_limit'
        ? error.message
        : "Invalid email or password. Please try again.";
        
      toast({
        title: error.code === 'account_locked' ? "Account Locked" : 
               error.code === 'access_restricted' ? "Access Restricted" : 
               error.code === 'session_limit' ? "Session Limit Reached" :
               "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleMfaVerified = () => {
    setShowMfa(false);
    completeMfaVerification();
    toast({
      title: "Welcome back!",
      description: "You have been successfully logged in.",
    });
    navigate('/dashboard');
  };

  const handleMfaCancel = async () => {
    setShowMfa(false);
    // Sign out since MFA was not completed
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-2xl font-bold">Topsqill</span>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@topsqill.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="admin123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Demo credentials: admin@topsqill.com / admin123
            </p>
            <Link to="/" className="text-sm text-primary hover:underline">
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>

      {pendingMfa && (
        <MfaVerificationDialog
          open={showMfa}
          email={pendingMfa.email}
          userId={pendingMfa.userId}
          onVerified={handleMfaVerified}
          onCancel={handleMfaCancel}
        />
      )}
    </div>
  );
};

export default Login;
