
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Users, 
  Settings, 
  Globe,
  Lock,
  Eye,
  EyeOff,
  CheckSquare
} from 'lucide-react';
import { Form } from '@/types/form';
import { FormAccessMatrix } from '@/components/FormAccessMatrix';
import { FormPermissionMatrix } from '@/components/FormPermissionMatrix';
import { FormSharing } from '@/components/FormSharing';

interface EnhancedFormUserAccessProps {
  form: Form;
  onUpdateForm: (updates: Partial<Form>) => void;
}

export function EnhancedFormUserAccess({ form, onUpdateForm }: EnhancedFormUserAccessProps) {
  const [activeTab, setActiveTab] = useState('users');

  const handleTogglePublic = (isPublic: boolean) => {
    onUpdateForm({ isPublic: isPublic });
  };

  return (
    <div className="space-y-6">
      {/* Header with Form Access Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Access Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage permissions and access control for "{form.name}"
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {form.isPublic ? (
              <>
                <Globe className="h-5 w-5 text-green-600" />
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Public Form
                </Badge>
              </>
            ) : (
              <>
                <Lock className="h-5 w-5 text-orange-600" />
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Private Form
                </Badge>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            onClick={() => handleTogglePublic(!form.isPublic)}
            className="flex items-center gap-2"
          >
            {form.isPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Make {form.isPublic ? 'Private' : 'Public'}
          </Button>
        </div>
      </div>

      {/* Access Type Information */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Public Form Access</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Anyone with the link can view and submit</li>
                <li>• No authentication required for submission</li>
                <li>• Viewing submissions requires explicit permission</li>
                <li>• Editing form requires explicit permission</li>
                <li>• Form creator has full permissions automatically</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">Private Form Access</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Requires authentication for any access</li>
                <li>• Requires explicit permission for submission</li>
                <li>• Access via direct assignment or invitation</li>
                <li>• Access request workflow available</li>
                <li>• Project-level permissions may apply</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            User Permissions
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Advanced Matrix
          </TabsTrigger>
          <TabsTrigger value="sharing" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sharing & Links
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <FormPermissionMatrix form={form} />
        </TabsContent>

        <TabsContent value="matrix" className="mt-6">
          <FormAccessMatrix form={form} />
        </TabsContent>

        <TabsContent value="sharing" className="mt-6">
          <div className="space-y-6">
            <FormSharing form={form} onUpdateForm={onUpdateForm} />
            
            {/* Additional sharing settings can go here */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Sharing Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    Configure advanced sharing options such as time-based access, 
                    IP restrictions, and custom access policies.
                  </p>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
