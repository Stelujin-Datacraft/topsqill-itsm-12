
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useTopLevelPermissions, TopLevelPermissionUpdate } from '@/hooks/useTopLevelPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface TopLevelPermissionsProps {
  projectId: string;
  userId: string;
  isCurrentUserAdmin: boolean;
}

const ENTITY_TYPES = [
  { key: 'forms', label: 'Forms' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'reports', label: 'Reports' }
] as const;

const PERMISSION_TYPES = [
  { key: 'can_create', label: 'Create' },
  { key: 'can_read', label: 'Read' },
  { key: 'can_update', label: 'Update' },
  { key: 'can_delete', label: 'Delete' }
] as const;

export function TopLevelPermissions({ projectId, userId, isCurrentUserAdmin }: TopLevelPermissionsProps) {
  const { permissions, loading, initializeDefaultPermissions, updatePermissions } = useTopLevelPermissions(projectId, userId);
  const [localPermissions, setLocalPermissions] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize local permissions state
  useEffect(() => {
    if (permissions.length === 0 && !loading) {
      // Initialize default permissions if none exist
      initializeDefaultPermissions();
      return;
    }

    const permissionMap = permissions.reduce((acc, perm) => {
      acc[perm.entity_type] = {
        can_create: perm.can_create,
        can_read: perm.can_read,
        can_update: perm.can_update,
        can_delete: perm.can_delete
      };
      return acc;
    }, {} as Record<string, any>);

    // Ensure all entity types have entries with defaults - everything false by default
    ENTITY_TYPES.forEach(({ key }) => {
      if (!permissionMap[key]) {
        permissionMap[key] = {
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false
        };
      }
    });

    setLocalPermissions(permissionMap);
  }, [permissions, loading]);

  const handlePermissionChange = (entityType: string, permissionType: string, checked: boolean) => {
    if (!isCurrentUserAdmin) return;

    setLocalPermissions(prev => ({
      ...prev,
      [entityType]: {
        ...prev[entityType],
        [permissionType]: checked
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!isCurrentUserAdmin || !hasChanges) return;

    setSaving(true);
    try {
      const updates: TopLevelPermissionUpdate[] = ENTITY_TYPES.map(({ key }) => ({
        entity_type: key,
        can_create: localPermissions[key]?.can_create || false,
        can_read: localPermissions[key]?.can_read || false,
        can_update: localPermissions[key]?.can_update || false,
        can_delete: localPermissions[key]?.can_delete || false
      }));

      await updatePermissions(updates);
      setHasChanges(false);
      toast.success('Top-level permissions updated successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!isCurrentUserAdmin) return;

    const resetPermissions = ENTITY_TYPES.reduce((acc, { key }) => {
      acc[key] = {
        can_create: false,
        can_read: false,
        can_update: false,
        can_delete: false
      };
      return acc;
    }, {} as Record<string, any>);

    setLocalPermissions(resetPermissions);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading permissions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Top-Level Permissions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set the maximum permissions this user can have in this project. Role permissions work within these limits.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {ENTITY_TYPES.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <h4 className="font-medium text-sm">{label}</h4>
              <div className="flex items-center gap-6 pl-4">
                {PERMISSION_TYPES.map(({ key: permKey, label: permLabel }) => (
                  <div key={permKey} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${key}-${permKey}`}
                      checked={localPermissions[key]?.[permKey] || false}
                      onCheckedChange={(checked) => 
                        handlePermissionChange(key, permKey, checked as boolean)
                      }
                      disabled={!isCurrentUserAdmin}
                    />
                    <label
                      htmlFor={`${key}-${permKey}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {permLabel}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!isCurrentUserAdmin && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            Only project administrators can modify top-level permissions.
          </div>
        )}

        {isCurrentUserAdmin && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
