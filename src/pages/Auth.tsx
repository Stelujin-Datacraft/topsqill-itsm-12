import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Mail, UserPlus } from 'lucide-react';

const Auth = () => {
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp, registerOrganization, requestToJoinOrganization, isLoading } = useAuth();
  const navigate = useNavigate();

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await signIn(signInData.email, signInData.password);
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been successfully signed in.",
      });
      navigate('/dashboard');
    }
  };

  const handleRegisterOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
            <span className="text-2xl font-bold">Topsqill</span>
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
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
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
              </form>
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
                    onChange={(e) => setJoinData({ ...joinData, organization_domain: e.target.value })}
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
    </div>
  );
};

export default Auth;
