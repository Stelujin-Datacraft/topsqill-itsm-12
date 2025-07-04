import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm } from '@/contexts/FormContext';
import { useAuth } from '@/contexts/AuthContext';
import { PublicFormView } from '@/components/PublicFormView';
import { FormAccessRequest } from '@/components/FormAccessRequest';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogIn, ArrowLeft, Home, HelpCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const FormView = () => {
  const { id } = useParams<{ id: string }>();
  const { getFormById } = useForm();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const form = id ? getFormById(id) : null;

  const checkUserAccess = async () => {
    if (!form || !user) {
      setLoading(false);
      return;
    }

    try {
      // Check if user has specific access to this form
      const { data: userAccess, error } = await supabase
        .from('form_user_access')
        .select('*')
        .eq('form_id', form.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking user access:', error);
      }

      setHasAccess(!!userAccess);
    } catch (error) {
      console.error('Error checking user access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserAccess();
  }, [form, user]);

  // Themed error page for form not found
  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          {/* Topsqill Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Topsqill</h1>
            <p className="text-muted-foreground">Form Builder Platform</p>
          </div>

          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-600 mb-2">Form Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The form you're looking for doesn't exist or has been removed.
              </p>
              
              <div className="space-y-3">
                <Link to="/" className="block">
                  <Button className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>
                </Link>
                
                <Link to="/auth" className="block">
                  <Button variant="outline" className="w-full">
                    <LogIn className="h-4 w-4 mr-2" />
                    Login to Platform
                  </Button>
                </Link>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Link to="/" className="block">
                    <Button variant="ghost" size="sm" className="w-full">
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Help
                    </Button>
                  </Link>
                  <Link to="/" className="block">
                    <Button variant="ghost" size="sm" className="w-full">
                      <Info className="h-4 w-4 mr-1" />
                      About
                    </Button>
                  </Link>
                </div>
              </div>
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
  }

  // Check if form is public or user has access
  const isPublic = form.permissions?.view?.includes?.('*') || 
                   form.permissions?.submit?.includes?.('*') || 
                   form.isPublic === true;

  // Check if user is the form creator
  const isFormCreator = user?.id === form.createdBy;
  
  // Allow access if form is public, user is form creator
  const hasBasicAccess = isPublic || isFormCreator;
  
  // If form has basic access and is active, OR if user is form creator, allow submission
  if ((hasBasicAccess && form.status === 'active') || isFormCreator) {
    const handleFormSubmit = (formData: Record<string, any>) => {
      console.log('Form submitted:', formData);
      // Here you would typically send the data to your backend
    };

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <PublicFormView 
            form={form} 
            onSubmit={handleFormSubmit}
            showNavigation={true}
          />
        </div>
      </div>
    );
  }

  // If user is not logged in and form is private, show themed login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          {/* Topsqill Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Topsqill</h1>
            <p className="text-muted-foreground">Form Builder Platform</p>
          </div>

          <Card>
            <CardContent className="text-center py-12">
              <LogIn className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-blue-600 mb-2">Login Required</h2>
              <p className="text-muted-foreground mb-6">
                You need to login to access this form.
              </p>
              
              <div className="space-y-3">
                <Link to="/auth" className="block">
                  <Button className="w-full">
                    <LogIn className="h-4 w-4 mr-2" />
                    Login to Continue
                  </Button>
                </Link>
                
                <Link to="/" className="block">
                  <Button variant="outline" className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>
                </Link>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Link to="/" className="block">
                    <Button variant="ghost" size="sm" className="w-full">
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Help
                    </Button>
                  </Link>
                  <Link to="/" className="block">
                    <Button variant="ghost" size="sm" className="w-full">
                      <Info className="h-4 w-4 mr-1" />
                      About
                    </Button>
                  </Link>
                </div>
              </div>
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
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div>Loading...</div>
      </div>
    );
  }

  // If user is logged in but doesn't have access, show access request form
  if (!hasAccess) {
    return <FormAccessRequest form={form} />;
  }

  // User has access or is form creator, show the form
  if (form.status !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          {/* Topsqill Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Topsqill</h1>
            <p className="text-muted-foreground">Form Builder Platform</p>
          </div>

          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-orange-600 mb-2">Form Unavailable</h2>
              <p className="text-muted-foreground mb-6">
                This form is not currently active.
              </p>
              
              <div className="space-y-3">
                <Link to="/dashboard" className="block">
                  <Button className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
                
                <Link to="/" className="block">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>
                </Link>
              </div>
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
  }

  const handleFormSubmit = (formData: Record<string, any>) => {
    console.log('Form submitted:', formData);
    // Here you would typically send the data to your backend
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <PublicFormView 
          form={form} 
          onSubmit={handleFormSubmit}
          showNavigation={true}
        />
      </div>
    </div>
  );
};

export default FormView;
