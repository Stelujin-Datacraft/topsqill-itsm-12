
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Users, 
  Globe,
  Lock,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { Form } from '@/types/form';
import { EnhancedFormPermissionMatrix } from '@/components/forms/EnhancedFormPermissionMatrix';
import { FormPermissionHelp } from '@/components/FormPermissionHelp';
import { useNavigate } from 'react-router-dom';

interface FormUserAccessProps {
  form: Form;
  onUpdateForm: (updates: Partial<Form>) => void;
}

export function FormUserAccess({ form, onUpdateForm }: FormUserAccessProps) {
  const navigate = useNavigate();

  const handleTogglePublic = (isPublic: boolean) => {
    onUpdateForm({ isPublic: isPublic });
  };

  return (
    <div className="space-y-4 md:space-y-6 relative p-4 md:p-6">
      <FormPermissionHelp />
      
      {/* Header with Form Access Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">Access Management</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage permissions and access control for "{form.name}"
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            {form.isPublic ? (
              <>
                <Globe className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <Badge variant="default" className="bg-green-100 text-green-800 text-xs md:text-sm">
                  Public Form
                </Badge>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs md:text-sm">
                  Private Form
                </Badge>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleTogglePublic(!form.isPublic)}
              className="flex items-center gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
              size="sm"
            >
              {form.isPublic ? <EyeOff className="h-3 w-3 md:h-4 md:w-4" /> : <Eye className="h-3 w-3 md:h-4 md:w-4" />}
              <span className="hidden sm:inline">Make {form.isPublic ? 'Private' : 'Public'}</span>
              <span className="sm:hidden">{form.isPublic ? 'Private' : 'Public'}</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/roles-access')}
              className="flex items-center gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
              size="sm"
            >
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Roles & Access</span>
              <span className="sm:hidden">Roles</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Access Type Information */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="p-3 md:p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <h3 className="font-semibold text-sm md:text-base">Public Form Access</h3>
              </div>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                <li>• Anyone with the link can view and submit</li>
                <li>• No authentication required for submission</li>
                <li>• Viewing submissions requires explicit permission</li>
                <li>• Editing form requires explicit permission</li>
                <li>• Form creator has full permissions automatically</li>
              </ul>
            </div>
            
            <div className="p-3 md:p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <h3 className="font-semibold text-sm md:text-base">Private Form Access</h3>
              </div>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
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

      {/* Enhanced Permission Matrix */}
      <EnhancedFormPermissionMatrix form={form} />
    </div>
  );
}
