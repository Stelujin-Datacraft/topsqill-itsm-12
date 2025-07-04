
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { HelpCircle } from 'lucide-react';
import { FORM_PERMISSION_TYPES } from '@/hooks/useFormAccessMatrix';

export function FormPermissionHelp() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="absolute top-4 right-4">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permission Matrix Help</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Permission Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Access:</strong> Basic form viewing and submission permissions</li>
                <li>• <strong>Content:</strong> Permissions to modify form content and view data</li>
                <li>• <strong>Management:</strong> Administrative permissions for form settings</li>
              </ul>
            </CardContent>
          </Card>

          {/* Permission Status */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox checked={true} disabled className="scale-75" />
                  <span>Permission granted</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={false} disabled className="scale-75" />
                  <span>Permission not granted</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs h-4">E</Badge>
                  <span>Explicit permission (overrides role defaults)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Available Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                {FORM_PERMISSION_TYPES.map(permission => (
                  <div key={permission.id}>
                    <strong>{permission.label}:</strong> {permission.description}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role Information */}
          <Card>
            <CardHeader>
              <CardTitle>Role Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default">admin</Badge>
                  <span>Project administrator</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">editor</Badge>
                  <span>Project editor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Custom</Badge>
                  <span>Has explicit form permissions</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
