import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFormWithFields } from '@/hooks/useFormWithFields';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { PublicFormView } from '@/components/PublicFormView';
import { FormAccessRequest } from '@/components/FormAccessRequest';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogIn, ArrowLeft, Home, HelpCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FormLoadingView } from '@/components/FormLoadingView';
import DashboardLayout from '@/components/DashboardLayout';

const FormView = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // Load form with fields using the dedicated hook
  const { form, loading: formLoading, error: formError } = useFormWithFields(id);
  
  // Use unified access control for proper permission checking
  const { hasPermission, loading: accessLoading, isOrgAdmin, isProjectAdmin } = useUnifiedAccessControl(form?.projectId);

  // Handle redirect to login for private forms
  useEffect(() => {
    if (!user && form && !formLoading && !formError) {
      // Check if form is public
      const isPublic = form.permissions?.view?.includes?.('*') || 
                       form.permissions?.submit?.includes?.('*') || 
                       form.isPublic === true;
      
      if (!isPublic) {
        // Form is private, redirect to login with return URL
        const currentUrl = window.location.pathname;
        navigate(`/auth?returnTo=${encodeURIComponent(currentUrl)}`, { replace: true });
        return;
      }
    }
  }, [user, form, formLoading, formError, navigate]);

  // Show loading state while form or access control is being loaded
  if (formLoading || (user && accessLoading)) {
    return <FormLoadingView />;
  }

  // Show error if there was an error loading the form
  if (formError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Form</h2>
              <p className="text-muted-foreground mb-6">
                {formError}
              </p>
              
              <div className="space-y-3">
                <Link to="/" className="block">
                  <Button className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

  // Determine form access based on unified access control and form properties
  const isPublic = form.permissions?.view?.includes?.('*') || 
                   form.permissions?.submit?.includes?.('*') || 
                   form.isPublic === true;

  const isFormCreator = user?.id === form.createdBy;
  
  // Check permissions using unified access control
  const hasFormReadAccess = user ? hasPermission('forms', 'read', form.id) : false;
  const canAccessForm = isPublic || isFormCreator || hasFormReadAccess || isOrgAdmin || isProjectAdmin;
  
  // Allow submission if user has access and form is active, or if user is form creator/admin
  if (canAccessForm && (form.status === 'active' || isFormCreator || isOrgAdmin || isProjectAdmin)) {
    const handleFormSubmit = (formData: Record<string, any>) => {
      console.log('Form submitted:', formData);
      // Here you would typically send the data to your backend
    };

    return (
      <DashboardLayout title={form.name}>
        <PublicFormView 
          form={form} 
          onSubmit={handleFormSubmit}
          showNavigation={false}
        />
      </DashboardLayout>
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

  // If user is logged in but doesn't have access to private form, show access request form
  if (user && !canAccessForm && !isPublic) {
    return <FormAccessRequest form={form} />;
  }

  // Show form unavailable message if form is inactive and user is not creator/admin
  if (form.status !== 'active' && !isFormCreator && !isOrgAdmin && !isProjectAdmin) {
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
    <DashboardLayout title={form.name}>
      <PublicFormView 
        form={form} 
        onSubmit={handleFormSubmit}
        showNavigation={false}
      />
    </DashboardLayout>
  );
};

export default FormView;
