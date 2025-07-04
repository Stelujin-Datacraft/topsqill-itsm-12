
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, LogIn, HelpCircle, Info } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

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
            <h2 className="text-2xl font-bold text-red-600 mb-2">404 - Page Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The page you're looking for doesn't exist or has been moved.
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
};

export default NotFound;
