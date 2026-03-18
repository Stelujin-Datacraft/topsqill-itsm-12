import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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

const Auth = () => {
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp, signInWithGoogle, registerOrganization, requestToJoinOrganization, isLoading, user, pendingMfa, completeMfaVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  // Password policy state
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [policyLoading, setPolicyLoading] = useState(false);

  // LDAP state
  const [showLdapLogin, setShowLdapLogin] = useState(false);
  const [ldapDomain, setLdapDomain] = useState('');
  const [ldapEnabled, setLdapEnabled] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (user && !isLoading) {
      const destination = returnTo || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [user, isLoading, navigate, returnTo]);

  // Check if LDAP is available for the entered email domain
  const checkLdapAvailability = async (email: string) => {
    const domain = email.split('@')[1];
    if (!domain) {
      setLdapEnabled(false);
      return;
    }

    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('domain', domain)
        .maybeSingle();

      if (org) {
        const { data: ldapConfig } = await supabase
          .from('ldap_configurations')
          .select('id')
          .eq('organization_id', org.id)
          .eq('is_enabled', true)
          .limit(1)
          .maybeSingle();

        setLdapEnabled(!!ldapConfig);
        setLdapDomain(domain);
      } else {
        setLdapEnabled(false);
      }
    } catch (e) {
      console.error('Error checking LDAP availability:', e);
      setLdapEnabled(false);
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
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-2xl font-bold">TopSqill</span>
          </div>
          <CardTitle className="text-2xl">Authentication</CardTitle>
          <CardDescription>
            Sign in to your account or register your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="register-org">Register Organization</TabsTrigger>
              <TabsTrigger value="join-org">Join Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              {showLdapLogin ? (
                <LdapLoginForm
                  organizationDomain={ldapDomain}
                  onSuccess={(user) => {
                    const redirectPath = returnTo || '/dashboard';
                    navigate(redirectPath, { replace: true });
                  }}
                  onFallbackToLocal={() => setShowLdapLogin(false)}
                />
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={signInData.email}
                      onChange={(e) => {
                        setSignInData({ ...signInData, email: e.target.value });
                        checkLdapAvailability(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                    onClick={async () => {
                      const { error } = await signInWithGoogle();
                      if (error) {
                        toast({
                          title: "Google Sign-In failed",
                          description: error.message || "Could not sign in with Google.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </Button>

                  {ldapEnabled && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setShowLdapLogin(true)}
                    >
                      <Server className="h-4 w-4 mr-2" />
                      Sign in with LDAP / Active Directory
                    </Button>
                  )}

                  <div className="text-center pt-2">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot Password?
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="admin-email">Admin Email</Label>
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
                  <Label htmlFor="admin-password">Admin Password</Label>
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
                <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="join-email">Email</Label>
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
            <Link to="/" className="text-sm text-primary hover:underline">
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
