import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { backend as supabase } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Mail, Server } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword, DEFAULT_PASSWORD_POLICY, PasswordPolicy } from '@/utils/passwordValidation';
import { MfaVerificationDialog } from '@/components/MfaVerificationDialog';
import { LdapLoginForm } from '@/components/ldap/LdapLoginForm';
import { getProviderLabel, isOidcProvider } from '@/lib/idp/providerDefaults';

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

const Auth = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [activeTab, setActiveTab] = useState(initialMode);
  const { signIn, registerOrganization, isLoading, user, pendingMfa, completeMfaVerification } = useAuth();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo');
  const skipAuthRedirectRef = useRef(false);

  // Password policy state
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);

  // IdP / LDAP state
  const [showLdapLogin, setShowLdapLogin] = useState(false);
  const [ldapDomain, setLdapDomain] = useState('');
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [providerType, setProviderType] = useState<string>('ldap');
  const [autoRedirectedFor, setAutoRedirectedFor] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [prefetchedAuthUrl, setPrefetchedAuthUrl] = useState<string | null>(null);

  // Two-step email-first sign-in flow
  const [signinStep, setSigninStep] = useState<'email' | 'method'>('email');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [usePasswordInstead, setUsePasswordInstead] = useState(false);

  // Redirect authenticated users (unless we just finished signup → landing)
  useEffect(() => {
    if (user && !isLoading && !skipAuthRedirectRef.current) {
      const destination = returnTo || '/build';
      navigate(destination, { replace: true });
    }
  }, [user, isLoading, navigate, returnTo]);

  // Check if LDAP is available for the entered email domain
  const checkLdapAvailability = async (email: string) => {
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (!domain) {
      setLdapEnabled(false);
      setLdapDomain('');
      setProviderType('ldap');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ldap-authenticate', {
        body: {
          mode: 'lookup',
          email,
          domain,
        },
      });

      if (error) throw error;

      const hasProvider = !!data?.hasProvider;
      setLdapEnabled(hasProvider);
      setLdapDomain(hasProvider ? (data?.organizationDomain || domain) : '');
      const detectedType = hasProvider ? (data?.providerType || 'ldap') : 'ldap';
      setProviderType(detectedType);
      setOrganizationId(hasProvider ? (data?.organizationId || null) : null);

      // Prefetch the OIDC authorization URL in the background so clicking
      // "Continue with Microsoft" redirects instantly (no extra roundtrip).
      if (hasProvider && isOidcProvider(detectedType) && data?.organizationId) {
        prefetchAuthorizationUrl(data.organizationId, email);
      } else {
        setPrefetchedAuthUrl(null);
      }
    } catch (e) {
      console.error('Error checking LDAP availability:', e);
      setLdapEnabled(false);
      setLdapDomain('');
      setProviderType('ldap');
      setOrganizationId(null);
      setPrefetchedAuthUrl(null);
    }
  };

  // Warm up the IdP authorization URL while the user is on the method step.
  const prefetchAuthorizationUrl = async (orgId: string, email: string) => {
    try {
      // Preconnect to Microsoft to shave TLS/DNS time off the redirect.
      if (typeof document !== 'undefined') {
        const href = 'https://login.microsoftonline.com';
        if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = href;
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
      }
      const { data, error } = await supabase.functions.invoke('ldap-authenticate', {
        body: {
          organizationId: orgId,
          mode: 'authorize',
          loginHint: email || undefined,
        },
      });
      if (!error && data?.authorizationUrl) {
        setPrefetchedAuthUrl(data.authorizationUrl);
      }
    } catch (e) {
      console.warn('Authorization URL prefetch failed:', e);
    }
  };

  const handleOidcContinue = async () => {
    if (!organizationId) return;
    setOidcLoading(true);
    try {
      // Fast path: if we already prefetched the authorization URL during
      // the lookup step, redirect immediately — no extra roundtrip.
      const fastUrl = prefetchedAuthUrl;
      if (fastUrl) {
        redirectToAuthUrl(fastUrl);
        return;
      }
      const { data, error } = await supabase.functions.invoke('ldap-authenticate', {
        body: {
          organizationId,
          mode: 'authorize',
          loginHint: signInData.email || undefined,
        },
      });
      if (error) throw error;
      if (data?.authorizationUrl) {
        redirectToAuthUrl(data.authorizationUrl);
        return;
      }
      toast({
        title: 'Sign-in failed',
        description: data?.message || 'Could not start sign-in flow',
        variant: 'destructive',
      });
    } catch (err: any) {
      toast({
        title: 'Sign-in failed',
        description: err.message || 'Could not start sign-in flow',
        variant: 'destructive',
      });
    } finally {
      setOidcLoading(false);
    }
  };

  const redirectToAuthUrl = (authorizationUrl: string) => {
    // Break out of the Lovable preview iframe — Microsoft / Google refuse
    // to render inside iframes (X-Frame-Options: DENY).
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    if (inIframe) {
      const opened = window.open(authorizationUrl, '_top');
      if (!opened) {
        window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      window.location.assign(authorizationUrl);
    }
  };

  // Sign in form state
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Sign up form state (creates organization + admin account)
  const [signUpData, setSignUpData] = useState({
    organization_name: '',
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  // Keep tab in sync when landing links use ?mode=signup
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'signup') setActiveTab('signup');
    if (mode === 'signin') setActiveTab('signin');
  }, [searchParams]);

  const handleEmailNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = signInData.email.trim();
    if (!email) return;
    setLookupLoading(true);
    try {
      await checkLdapAvailability(email);
    } finally {
      setLookupLoading(false);
      setSigninStep('method');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await signIn(signInData.email, signInData.password);
    if (result.error) {
      toast({
        title: "Sign in failed",
        description: result.error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } else if (result.requiresMfa) {
      // MFA is required - dialog will be shown via pendingMfa state
      toast({
        title: "Verification Required",
        description: "Please enter the verification code sent to your email.",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been successfully signed in.",
      });
      const redirectPath = returnTo || '/build';
      navigate(redirectPath, { replace: true });
    }
  };

  const handleMfaVerified = async () => {
    await completeMfaVerification();
    toast({
      title: "Welcome back!",
      description: "You have been successfully signed in.",
    });
    const redirectPath = returnTo || '/build';
    navigate(redirectPath, { replace: true });
  };

  const handleMfaCancel = () => {
    // Clear pending MFA and sign out
    supabase.auth.signOut();
    toast({
      title: "Sign in cancelled",
      description: "MFA verification was cancelled.",
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signUpData.password !== signUpData.confirm_password) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure password and confirm password are the same.',
        variant: 'destructive',
      });
      return;
    }

    const validation = validatePassword(signUpData.password, passwordPolicy);
    if (!validation.isValid) {
      toast({
        title: 'Password does not meet requirements',
        description: validation.errors[0],
        variant: 'destructive',
      });
      return;
    }

    const { first_name, last_name } = splitFullName(signUpData.full_name);
    if (!first_name) {
      toast({
        title: 'Full name required',
        description: 'Please enter your full name.',
        variant: 'destructive',
      });
      return;
    }

    const { error, needsEmailVerification } = await registerOrganization({
      name: signUpData.organization_name.trim(),
      admin_email: signUpData.email.trim(),
      admin_password: signUpData.password,
      admin_first_name: first_name,
      admin_last_name: last_name,
    });

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message || 'Failed to create your account. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Account created!',
      description: needsEmailVerification
        ? 'Please verify your email, then sign in. Your organization will be set up automatically.'
        : 'Welcome! Create your first form in the AI Builder.',
    });

    setSignUpData({
      organization_name: '',
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
    });

    // Email verification required: stay on auth / go home to sign in later.
    // Otherwise take new users straight to AI Builder (their only page until a form exists).
    if (needsEmailVerification) {
      skipAuthRedirectRef.current = true;
      setActiveTab('signin');
      setSignInData({ email: signUpData.email.trim(), password: '' });
      return;
    }

    navigate('/build', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-2xl enterprise-card shadow-lg">
        <CardHeader className="text-center relative">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-lg">T</span>
            </div>
            <span className="text-2xl font-semibold tracking-tight">{t('common.appName')}</span>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {activeTab === 'signup' ? t('auth.signUp') : t('auth.signIn')}
          </CardTitle>
          <CardDescription className="leading-relaxed">
            {activeTab === 'signup' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto gap-1">
              <TabsTrigger value="signin" className="text-sm px-3 py-2">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm px-3 py-2">{t('auth.signUp')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              {showLdapLogin ? (
                <LdapLoginForm
                  organizationDomain={ldapDomain}
                  loginHint={signInData.email}
                  onSuccess={(user) => {
                    const redirectPath = returnTo || '/build';
                    navigate(redirectPath, { replace: true });
                  }}
                  onFallbackToLocal={() => setShowLdapLogin(false)}
                />
              ) : signinStep === 'email' ? (
                <form onSubmit={handleEmailNext} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('auth.email')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={signInData.email}
                      onChange={(e) =>
                        setSignInData({ ...signInData, email: e.target.value })
                      }
                      autoFocus
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your work email to continue.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={lookupLoading}>
                    {lookupLoading ? 'Checking…' : 'Next'}
                  </Button>
                  <div className="text-center pt-2">
                    <Link to="/forgot-password" className="text-sm text-module-relationship hover:underline">
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Signing in as</Label>
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                      <span className="text-sm truncate">{signInData.email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSigninStep('email');
                          setSignInData({ ...signInData, password: '' });
                          setUsePasswordInstead(false);
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  {ldapEnabled && isOidcProvider(providerType) && !usePasswordInstead ? (
                    <>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={oidcLoading}
                      onClick={handleOidcContinue}
                    >
                      <Server className="h-4 w-4 mr-2" />
                      {oidcLoading
                        ? 'Redirecting…'
                        : `Continue with ${getProviderLabel(providerType)}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary font-medium"
                      onClick={() => setUsePasswordInstead(true)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Sign in with password instead
                    </Button>
                    </>
                  ) : ldapEnabled && !usePasswordInstead ? (
                    <>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setShowLdapLogin(true)}
                    >
                      <Server className="h-4 w-4 mr-2" />
                      Sign in with LDAP / Active Directory
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary font-medium"
                      onClick={() => setUsePasswordInstead(true)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Sign in with password instead
                    </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">{t('auth.password')}</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          value={signInData.password}
                          onChange={(e) =>
                            setSignInData({ ...signInData, password: e.target.value })
                          }
                          autoFocus
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                      </Button>
                      {ldapEnabled && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="w-full"
                          onClick={() => setUsePasswordInstead(false)}
                        >
                          Back to {isOidcProvider(providerType) ? getProviderLabel(providerType) : 'SSO'} sign-in
                        </Button>
                      )}
                    </>
                  )}

                  <div className="text-center pt-2">
                    <Link to="/forgot-password" className="text-sm text-module-relationship hover:underline">
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {t('auth.signUpIntro')}
              </div>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-org-name">{t('auth.organizationName')}</Label>
                  <Input
                    id="signup-org-name"
                    placeholder="Acme Corp"
                    value={signUpData.organization_name}
                    onChange={(e) => setSignUpData({ ...signUpData, organization_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-full-name">{t('auth.fullName')}</Label>
                  <Input
                    id="signup-full-name"
                    placeholder="Jane Smith"
                    value={signUpData.full_name}
                    onChange={(e) => setSignUpData({ ...signUpData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="jane@acmecorp.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                  />
                  {signUpData.password && (
                    <PasswordStrengthIndicator
                      password={signUpData.password}
                      policy={passwordPolicy}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    value={signUpData.confirm_password}
                    onChange={(e) => setSignUpData({ ...signUpData, confirm_password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-module-relationship hover:underline">
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* MFA Verification Dialog */}
      {pendingMfa && (
        <MfaVerificationDialog
          open={!!pendingMfa}
          email={pendingMfa.email}
          userId={pendingMfa.userId}
          onVerified={handleMfaVerified}
          onCancel={handleMfaCancel}
        />
      )}
    </div>
  );
};

export default Auth;
