import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { backend as supabase } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Mail, UserPlus, Server, Chrome } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword, DEFAULT_PASSWORD_POLICY, PasswordPolicy } from '@/utils/passwordValidation';
import { getOrganizationPasswordPolicy } from '@/utils/securityEnforcement';
import { MfaVerificationDialog } from '@/components/MfaVerificationDialog';
import { LdapLoginForm } from '@/components/ldap/LdapLoginForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getProviderLabel, isOidcProvider } from '@/lib/idp/providerDefaults';

const Auth = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp, signInWithGoogle, registerOrganization, requestToJoinOrganization, isLoading, user, pendingMfa, completeMfaVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  // Password policy state
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [policyLoading, setPolicyLoading] = useState(false);

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

  // Redirect authenticated users
  useEffect(() => {
    if (user && !isLoading) {
      const destination = returnTo || '/dashboard';
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

  // Organization registration form state
  const [orgRegData, setOrgRegData] = useState({
    name: '',
    domain: '',
    description: '',
    admin_email: '',
    admin_password: '',
    admin_first_name: '',
    admin_last_name: ''
  });

  // Join request form state
  const [joinData, setJoinData] = useState({
    organization_domain: '',
    email: '',
    first_name: '',
    last_name: '',
    message: ''
  });

  // Load password policy when organization domain changes (for join tab)
  const loadPolicyFromDomain = async (domain: string) => {
    if (!domain) return;
    
    setPolicyLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('domain', domain)
        .maybeSingle();

      if (org) {
        const policy = await getOrganizationPasswordPolicy(org.id);
        if (policy) {
          setPasswordPolicy(policy);
        }
      }
    } catch (error) {
      console.error('Error loading password policy:', error);
    }
    setPolicyLoading(false);
  };

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
      const redirectPath = returnTo || '/dashboard';
      navigate(redirectPath, { replace: true });
    }
  };

  const handleMfaVerified = async () => {
    await completeMfaVerification();
    toast({
      title: "Welcome back!",
      description: "You have been successfully signed in.",
    });
    const redirectPath = returnTo || '/dashboard';
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

  const handleRegisterOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password against default policy
    const validation = validatePassword(orgRegData.admin_password, passwordPolicy);
    if (!validation.isValid) {
      toast({
        title: "Password does not meet requirements",
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }

    const { error } = await registerOrganization(orgRegData);
    if (error) {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register organization. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Organization registered!",
        description: "Please check your email to verify your account.",
      });
      setActiveTab('signin');
    }
  };

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // First, find the organization by domain
    const { data: orgs, error: findError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('domain', joinData.organization_domain)
      .single();

    if (findError || !orgs) {
      toast({
        title: "Organization not found",
        description: "No organization found with that domain.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await requestToJoinOrganization(orgs.id, {
      email: joinData.email,
      first_name: joinData.first_name,
      last_name: joinData.last_name,
      message: joinData.message
    });

    if (error) {
      toast({
        title: "Request failed",
        description: error.message || "Failed to send join request. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request sent!",
        description: `Your request to join ${orgs.name} has been sent to the administrators.`,
      });
      setJoinData({
        organization_domain: '',
        email: '',
        first_name: '',
        last_name: '',
        message: ''
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-2xl enterprise-card shadow-lg">
        <CardHeader className="text-center relative">
          <div className="absolute end-4 top-4">
            <LanguageSwitcher variant="ghost" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-lg">T</span>
            </div>
            <span className="text-2xl font-semibold tracking-tight">{t('common.appName')}</span>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">{t('auth.signIn')}</CardTitle>
          <CardDescription className="leading-relaxed">
            {t('auth.signInSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
              <TabsTrigger value="signin" className="text-xs sm:text-sm px-1 sm:px-3 py-2 whitespace-normal sm:whitespace-nowrap leading-tight">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="register-org" className="text-xs sm:text-sm px-1 sm:px-3 py-2 whitespace-normal sm:whitespace-nowrap leading-tight">{t('auth.registerOrg')}</TabsTrigger>
              <TabsTrigger value="join-org" className="text-xs sm:text-sm px-1 sm:px-3 py-2 whitespace-normal sm:whitespace-nowrap leading-tight">{t('auth.joinOrg')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              {showLdapLogin ? (
                <LdapLoginForm
                  organizationDomain={ldapDomain}
                  loginHint={signInData.email}
                  onSuccess={(user) => {
                    const redirectPath = returnTo || '/dashboard';
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

            <TabsContent value="register-org" className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Register your organization and become an administrator
              </div>
              <form onSubmit={handleRegisterOrganization} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      placeholder="Acme Corp"
                      value={orgRegData.name}
                      onChange={(e) => setOrgRegData({ ...orgRegData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-domain">Domain</Label>
                    <Input
                      id="org-domain"
                      placeholder="acmecorp.com"
                      value={orgRegData.domain}
                      onChange={(e) => setOrgRegData({ ...orgRegData, domain: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-description">Description (Optional)</Label>
                  <Textarea
                    id="org-description"
                    placeholder="Brief description of your organization"
                    value={orgRegData.description}
                    onChange={(e) => setOrgRegData({ ...orgRegData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-first-name">Admin First Name</Label>
                    <Input
                      id="admin-first-name"
                      placeholder="John"
                      value={orgRegData.admin_first_name}
                      onChange={(e) => setOrgRegData({ ...orgRegData, admin_first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-last-name">Admin Last Name</Label>
                    <Input
                      id="admin-last-name"
                      placeholder="Doe"
                      value={orgRegData.admin_last_name}
                      onChange={(e) => setOrgRegData({ ...orgRegData, admin_last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">{t('auth.adminEmail')}</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@acmecorp.com"
                    value={orgRegData.admin_email}
                    onChange={(e) => setOrgRegData({ ...orgRegData, admin_email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">{t('auth.adminPassword')}</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={orgRegData.admin_password}
                    onChange={(e) => setOrgRegData({ ...orgRegData, admin_password: e.target.value })}
                    required
                  />
                  {orgRegData.admin_password && (
                    <PasswordStrengthIndicator
                      password={orgRegData.admin_password}
                      policy={passwordPolicy}
                    />
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Registering...' : 'Register Organization'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join-org" className="space-y-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <UserPlus className="h-4 w-4" />
                Request to join an existing organization
              </div>
              <form onSubmit={handleJoinRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-domain">Organization Domain</Label>
                  <Input
                    id="join-domain"
                    placeholder="acmecorp.com"
                    value={joinData.organization_domain}
                    onChange={(e) => {
                      setJoinData({ ...joinData, organization_domain: e.target.value });
                      // Load password policy when domain is entered
                      if (e.target.value.length > 3) {
                        loadPolicyFromDomain(e.target.value);
                      }
                    }}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-first-name">First Name</Label>
                    <Input
                      id="join-first-name"
                      placeholder="Jane"
                      value={joinData.first_name}
                      onChange={(e) => setJoinData({ ...joinData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-last-name">Last Name</Label>
                    <Input
                      id="join-last-name"
                      placeholder="Smith"
                      value={joinData.last_name}
                      onChange={(e) => setJoinData({ ...joinData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-email">{t('auth.email')}</Label>
                  <Input
                    id="join-email"
                    type="email"
                    placeholder="jane.smith@acmecorp.com"
                    value={joinData.email}
                    onChange={(e) => setJoinData({ ...joinData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-message">Message (Optional)</Label>
                  <Textarea
                    id="join-message"
                    placeholder="Tell the administrators why you want to join..."
                    value={joinData.message}
                    onChange={(e) => setJoinData({ ...joinData, message: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending Request...' : 'Send Join Request'}
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
