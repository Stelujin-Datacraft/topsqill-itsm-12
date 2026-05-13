import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Server, Loader2 } from "lucide-react";
import { isOidcProvider, getProviderLabel } from "@/lib/idp/providerDefaults";
import { useEffect } from "react";

interface LdapLoginFormProps {
  organizationDomain: string;
  onSuccess: (user: any) => void;
  onFallbackToLocal: () => void;
}

export function LdapLoginForm({ 
  organizationDomain, 
  onSuccess, 
  onFallbackToLocal 
}: LdapLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [providerType, setProviderType] = useState<string>('ldap');
  const [providerConfigLoaded, setProviderConfigLoaded] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('');

  // Detect provider type for the org so we render the right login UI
  useEffect(() => {
    (async () => {
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('domain', organizationDomain)
          .maybeSingle();
        if (!org) {
          setProviderConfigLoaded(true);
          return;
        }
        setOrganizationId(org.id);
        const { data: config } = await supabase
          .from('ldap_configurations')
          .select('provider_type, name')
          .eq('organization_id', org.id)
          .eq('is_enabled', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (config) {
          setProviderType(config.provider_type || 'ldap');
          setProviderName(config.name || '');
        }
      } catch (err) {
        console.error('Provider detection failed:', err);
      } finally {
        setProviderConfigLoaded(true);
      }
    })();
  }, [organizationDomain]);

  const handleOidcSignIn = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ldap-authenticate', {
        body: {
          organizationId,
          mode: 'authorize',
          redirectUri: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      if (data?.fallbackToLocal) {
        onFallbackToLocal();
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
      setIsLoading(false);
    }
  };

  const handleLdapLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter your username and password',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, find the organization by domain
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('domain', organizationDomain)
        .single();

      if (orgError || !org) {
        toast({
          title: 'Organization Not Found',
          description: 'No organization found with that domain',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Call the LDAP authentication edge function
      const { data, error } = await supabase.functions.invoke('ldap-authenticate', {
        body: {
          username,
          password,
          organizationId: org.id,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Login Successful',
          description: 'Welcome! You have been authenticated via LDAP.',
        });
        
        // If LDAP auth succeeded and user was provisioned, sign them in
        if (data.user?.email) {
          // The user should now exist in the system, try to sign in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: data.user.email,
            password: password, // Use the same password (this won't work for new users)
          });
          
          if (signInError) {
            // For newly provisioned users, they may need to use a magic link
            // or the admin needs to set a password
            toast({
              title: 'Account Created',
              description: 'Your account has been created. Please contact your administrator for login credentials.',
            });
          } else {
            onSuccess(signInData.user);
          }
        }
      } else {
        if (data.fallbackToLocal) {
          toast({
            title: 'LDAP Unavailable',
            description: data.message || 'Falling back to local authentication',
          });
          onFallbackToLocal();
        } else {
          toast({
            title: 'Authentication Failed',
            description: data.message || 'Invalid username or password',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error('LDAP login error:', error);
      toast({
        title: 'Login Error',
        description: error.message || 'Failed to authenticate. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {providerConfigLoaded && isOidcProvider(providerType) ? (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            <span>Sign in with {getProviderLabel(providerType)}</span>
          </div>
          <Button onClick={handleOidcSignIn} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>Continue with {getProviderLabel(providerType)}</>
            )}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or use local account</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={onFallbackToLocal} disabled={isLoading}>
            Sign in with Email
          </Button>
        </>
      ) : (
      <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Server className="h-4 w-4" />
        <span>Sign in with your organization credentials</span>
      </div>
      
      <form onSubmit={handleLdapLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ldap-username">Username</Label>
          <Input
            id="ldap-username"
            type="text"
            placeholder="jdoe or john.doe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use your network username (e.g., sAMAccountName)
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="ldap-password">Password</Label>
          <Input
            id="ldap-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <Server className="h-4 w-4 mr-2" />
              Sign in with LDAP
            </>
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or use local account
          </span>
        </div>
      </div>

      <Button 
        variant="outline" 
        className="w-full" 
        onClick={onFallbackToLocal}
        disabled={isLoading}
      >
        Sign in with Email
      </Button>
      </>
      )}
    </div>
  );
}
