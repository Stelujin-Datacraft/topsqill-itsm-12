
import React, { useState, useMemo } from 'react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useProjectInvitations } from '@/hooks/useProjectInvitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Mail, X, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserInvitationSectionProps {
  projectId: string;
  onInvitationSent: () => void;
}

export function UserInvitationSection({ projectId, onInvitationSent }: UserInvitationSectionProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Always use 'viewer' role for new invitations
  const role = 'viewer';
  
  const { users: orgUsers, loading: usersLoading } = useOrganizationUsers();
  const { invitations, inviteUser, cancelInvitation, loading: invitationsLoading } = useProjectInvitations(projectId);

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery || !orgUsers) return [];
    
    const lowercaseQuery = searchQuery.toLowerCase();
    return orgUsers
      .filter(user => 
        user.email.toLowerCase().includes(lowercaseQuery) ||
        user.first_name?.toLowerCase().includes(lowercaseQuery) ||
        user.last_name?.toLowerCase().includes(lowercaseQuery)
      )
      .slice(0, 5);
  }, [searchQuery, orgUsers]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSuggestionSelect = (userEmail: string) => {
    setEmail(userEmail);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleInvite = async () => {
    if (!email.trim()) return;

    try {
      await inviteUser(email, role, message || undefined);
      setEmail('');
      setMessage('');
      setSearchQuery('');
      setShowSuggestions(false);
      onInvitationSent();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Invitation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add User to Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="pl-10"
                  onFocus={() => setShowSuggestions(searchQuery.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
              </div>
              
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
                  {filteredSuggestions.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                      onClick={() => handleSuggestionSelect(user.email)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user.first_name?.[0] || user.email[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}`
                            : user.email
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Button onClick={handleInvite} disabled={!email.trim()}>
              <Mail className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
          
          <Textarea
            placeholder="Optional message to include with the invitation"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none"
            rows={2}
          />
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{invitation.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Invited {new Date(invitation.invited_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelInvitation(invitation.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
