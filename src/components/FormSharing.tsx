import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Share2, 
  Copy, 
  Link, 
  Users, 
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Form } from '@/types/form';
import { useFormAccess } from '@/hooks/useFormAccess';
import { useFormAccessNotifications } from '@/hooks/useFormAccessNotifications';
import { UserSuggestionInput } from '@/components/UserSuggestionInput';

interface FormSharingProps {
  form: Form;
  onUpdateForm: (updates: Partial<Form>) => void;
}

export function FormSharing({ form, onUpdateForm }: FormSharingProps) {
  const [isPublic, setIsPublic] = useState(form.permissions?.view?.includes?.('*') || false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const {
    users: formUsers,
    accessRequests,
    addUserAccess,
    handleAccessRequest
  } = useFormAccess(form.id);

  // NEW: Use the notifications hook to get pending requests count
  const { pendingRequests } = useFormAccessNotifications(form.id);

  // Fix the form URLs to use the correct format
  const formUrl = `${window.location.origin}/form/${form.id}`;
  const editUrl = `${window.location.origin}/form-edit/${form.id}`;

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "The form link has been copied to your clipboard.",
    });
  };

  const handleTogglePublic = (checked: boolean) => {
    setIsPublic(checked);
    const newPermissions = {
      ...form.permissions,
      view: checked ? ['*'] : ['authenticated'],
      submit: checked ? ['*'] : ['authenticated']
    };
    onUpdateForm({ permissions: newPermissions });
    toast({
      title: checked ? "Form made public" : "Form made private",
      description: checked 
        ? "Anyone with the link can now access this form."
        : "Only invited users can access this form.",
    });
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;
    
    if (selectedUserId) {
      await addUserAccess(selectedUserId, inviteRole as 'viewer' | 'editor' | 'admin');
      setInviteEmail('');
      setSelectedUserId('');
      setInviteRole('viewer');
    }
  };

  const handleUserSelect = (user: any) => {
    setSelectedUserId(user.id);
  };

  const pendingRequestsFromFormAccess = accessRequests.filter(r => r.status === 'pending');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Share2 className="h-4 w-4 mr-2" />
          Share
          {/* NEW: Red dot indicator for pending requests */}
          {(pendingRequestsFromFormAccess.length > 0 || pendingRequests.length > 0) && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Form: {form.name}</DialogTitle>
          <DialogDescription>
            Manage who can access and edit this form
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Access Requests */}
          {pendingRequestsFromFormAccess.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Access Requests ({pendingRequestsFromFormAccess.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRequestsFromFormAccess.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{request.user_profile?.email}</div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAccessRequest(request.id, true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAccessRequest(request.id, false)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Public/Private Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Form Access</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Control who can access your form
                  </p>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={handleTogglePublic}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <>
                    <Eye className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Public - Anyone with link can access</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Private - Only invited users can access</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Form Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>View/Submit Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={formUrl} readOnly />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyLink(formUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Edit Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={editUrl} readOnly />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyLink(editUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invite Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invite Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <UserSuggestionInput
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  onUserSelect={handleUserSelect}
                  placeholder="Search users in your organization..."
                  className="flex-1"
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInviteUser} disabled={!selectedUserId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Shared with ({formUsers.length})</Label>
                {formUsers.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {formUsers.map((userAccess) => (
                      <div key={userAccess.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">{userAccess.user_profile?.email}</span>
                          <Badge variant="secondary" className="text-xs">
                            {userAccess.role}
                          </Badge>
                          <Badge 
                            variant={userAccess.status === 'active' ? 'default' : 'secondary'} 
                            className="text-xs"
                          >
                            {userAccess.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No users invited yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
