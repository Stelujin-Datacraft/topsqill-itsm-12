import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLdapConfiguration, LdapGroupMapping, LdapConfiguration } from "@/hooks/useLdapConfiguration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Trash2, 
  Users, 
  Shield, 
  ArrowRight,
  GripVertical,
  Pencil
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LdapGroupMappingsProps {
  configurations: LdapConfiguration[];
  selectedConfigId?: string;
  onConfigChange?: (configId: string) => void;
}

interface SecurityTemplate {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
}

export function LdapGroupMappings({ configurations, selectedConfigId, onConfigChange }: LdapGroupMappingsProps) {
  const { userProfile } = useAuth();
  const { 
    groupMappings, 
    loadGroupMappings,
    createGroupMapping, 
    updateGroupMapping, 
    deleteGroupMapping 
  } = useLdapConfiguration();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMapping, setEditingMapping] = useState<LdapGroupMapping | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [securityTemplates, setSecurityTemplates] = useState<SecurityTemplate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  const [formData, setFormData] = useState({
    ldap_config_id: selectedConfigId || '',
    ldap_group_dn: '',
    ldap_group_name: '',
    mapped_role: '',
    mapped_security_template_id: '',
    mapped_group_id: '',
    priority: 100,
    is_active: true,
  });

  useEffect(() => {
    if (selectedConfigId) {
      loadGroupMappings(selectedConfigId);
      setFormData(prev => ({ ...prev, ldap_config_id: selectedConfigId }));
    }
  }, [selectedConfigId, loadGroupMappings]);

  useEffect(() => {
    loadSecurityTemplates();
    loadGroups();
  }, []);

  const loadSecurityTemplates = async () => {
    if (!userProfile?.organization_id) return;
    
    try {
      const result = await fetch(
        `https://fnmkczsvwpzpxyklztkt.supabase.co/rest/v1/security_templates?organization_id=eq.${userProfile.organization_id}&is_active=eq.true&select=id,name`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          }
        }
      );
      const templates = await result.json();
      if (Array.isArray(templates)) {
        setSecurityTemplates(templates);
      }
    } catch (e) {
      console.error('Error loading security templates:', e);
    }
  };

  const loadGroups = async () => {
    if (!userProfile?.organization_id) return;
    
    try {
      const result = await fetch(
        `https://fnmkczsvwpzpxyklztkt.supabase.co/rest/v1/groups?organization_id=eq.${userProfile.organization_id}&select=id,name`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          }
        }
      );
      const grps = await result.json();
      if (Array.isArray(grps)) {
        setGroups(grps);
      }
    } catch (e) {
      console.error('Error loading groups:', e);
    }
  };

  const resetForm = () => {
    setFormData({
      ldap_config_id: selectedConfigId || '',
      ldap_group_dn: '',
      ldap_group_name: '',
      mapped_role: '',
      mapped_security_template_id: '',
      mapped_group_id: '',
      priority: 100,
      is_active: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.ldap_group_dn || !formData.ldap_group_name || !formData.ldap_config_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const success = await createGroupMapping({
      ldap_config_id: formData.ldap_config_id,
      ldap_group_dn: formData.ldap_group_dn,
      ldap_group_name: formData.ldap_group_name,
      mapped_role: formData.mapped_role || undefined,
      mapped_security_template_id: formData.mapped_security_template_id || undefined,
      mapped_group_id: formData.mapped_group_id || undefined,
      priority: formData.priority,
    });

    if (success) {
      setShowCreateDialog(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingMapping) return;

    const success = await updateGroupMapping(editingMapping.id, {
      ldap_group_dn: formData.ldap_group_dn,
      ldap_group_name: formData.ldap_group_name,
      mapped_role: formData.mapped_role || null,
      mapped_security_template_id: formData.mapped_security_template_id || null,
      mapped_group_id: formData.mapped_group_id || null,
      priority: formData.priority,
      is_active: formData.is_active,
    });

    if (success) {
      setEditingMapping(null);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    
    await deleteGroupMapping(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const openEditDialog = (mapping: LdapGroupMapping) => {
    setFormData({
      ldap_config_id: mapping.ldap_config_id,
      ldap_group_dn: mapping.ldap_group_dn,
      ldap_group_name: mapping.ldap_group_name,
      mapped_role: mapping.mapped_role || '',
      mapped_security_template_id: mapping.mapped_security_template_id || '',
      mapped_group_id: mapping.mapped_group_id || '',
      priority: mapping.priority,
      is_active: mapping.is_active,
    });
    setEditingMapping(mapping);
  };

  const getConfigName = (configId: string) => {
    return configurations.find(c => c.id === configId)?.name || 'Unknown';
  };

  const filteredMappings = selectedConfigId 
    ? groupMappings.filter(m => m.ldap_config_id === selectedConfigId)
    : groupMappings;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Mappings
            </CardTitle>
            <CardDescription>
              Map LDAP groups to application roles and security templates
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {configurations.length > 1 && (
              <Select 
                value={selectedConfigId || 'all'}
                onValueChange={(value) => onConfigChange?.(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All configurations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All configurations</SelectItem>
                  {configurations.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No group mappings configured</p>
            <p className="text-sm">Map LDAP groups to automatically assign roles when users sync</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMappings.map((mapping) => (
              <div 
                key={mapping.id} 
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{mapping.ldap_group_name}</span>
                    {!mapping.is_active && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {mapping.ldap_group_dn}
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                <div className="flex items-center gap-2 flex-shrink-0">
                  {mapping.mapped_role && (
                    <Badge variant="outline" className="capitalize">
                      <Shield className="h-3 w-3 mr-1" />
                      {mapping.mapped_role}
                    </Badge>
                  )}
                  {mapping.mapped_security_template_id && (
                    <Badge variant="outline">
                      Security Template
                    </Badge>
                  )}
                  {mapping.mapped_group_id && (
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      Group
                    </Badge>
                  )}
                  {!mapping.mapped_role && !mapping.mapped_security_template_id && !mapping.mapped_group_id && (
                    <span className="text-sm text-muted-foreground">No mappings</span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditDialog(mapping)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(mapping.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Group Mapping</DialogTitle>
            <DialogDescription>
              Map an LDAP group to application roles and permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {configurations.length > 1 && (
              <div className="space-y-2">
                <Label>LDAP Configuration</Label>
                <Select 
                  value={formData.ldap_config_id}
                  onValueChange={(value) => setFormData({ ...formData, ldap_config_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurations.map(config => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ldap_group_name">Group Name *</Label>
              <Input
                id="ldap_group_name"
                value={formData.ldap_group_name}
                onChange={(e) => setFormData({ ...formData, ldap_group_name: e.target.value })}
                placeholder="Domain Admins"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ldap_group_dn">Group DN *</Label>
              <Input
                id="ldap_group_dn"
                value={formData.ldap_group_dn}
                onChange={(e) => setFormData({ ...formData, ldap_group_dn: e.target.value })}
                placeholder="CN=Domain Admins,OU=Groups,DC=company,DC=com"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Map to Role</Label>
              <Select 
                value={formData.mapped_role}
                onValueChange={(value) => setFormData({ ...formData, mapped_role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Map to Security Template</Label>
              <Select 
                value={formData.mapped_security_template_id}
                onValueChange={(value) => setFormData({ ...formData, mapped_security_template_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {securityTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Map to Group</Label>
              <Select 
                value={formData.mapped_group_id}
                onValueChange={(value) => setFormData({ ...formData, mapped_group_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={1000}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers have higher priority
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMapping} onOpenChange={(open) => { if (!open) { setEditingMapping(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group Mapping</DialogTitle>
            <DialogDescription>
              Update the LDAP group mapping
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_ldap_group_name">Group Name *</Label>
              <Input
                id="edit_ldap_group_name"
                value={formData.ldap_group_name}
                onChange={(e) => setFormData({ ...formData, ldap_group_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_ldap_group_dn">Group DN *</Label>
              <Input
                id="edit_ldap_group_dn"
                value={formData.ldap_group_dn}
                onChange={(e) => setFormData({ ...formData, ldap_group_dn: e.target.value })}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Map to Role</Label>
              <Select 
                value={formData.mapped_role}
                onValueChange={(value) => setFormData({ ...formData, mapped_role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Map to Security Template</Label>
              <Select 
                value={formData.mapped_security_template_id}
                onValueChange={(value) => setFormData({ ...formData, mapped_security_template_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {securityTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Map to Group</Label>
              <Select 
                value={formData.mapped_group_id}
                onValueChange={(value) => setFormData({ ...formData, mapped_group_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_priority">Priority</Label>
              <Input
                id="edit_priority"
                type="number"
                min={1}
                max={1000}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingMapping(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group mapping. Users will no longer be automatically assigned roles based on this LDAP group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
