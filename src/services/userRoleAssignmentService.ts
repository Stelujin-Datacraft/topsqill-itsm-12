import { supabase } from '@/integrations/supabase/client';

export interface RoleAssignmentRequest {
  userId: string;
  roleId: string; // Using role ID instead of role name for consistency
  assignedBy: string;
  notificationMessage?: string;
  enableNotifications?: boolean;
  logAssignments?: boolean;
}

export class UserRoleAssignmentService {
  static async assignUserRole(request: RoleAssignmentRequest): Promise<boolean> {
    try {
      const { userId, roleId, assignedBy, notificationMessage, enableNotifications, logAssignments } = request;

      // Check if user already has a role assignment - remove it first to avoid conflicts
      const { error: deleteError } = await supabase
        .from('user_role_assignments')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.warn('Error removing existing role assignment:', deleteError);
        // Continue anyway as this might just mean no existing assignment
      }

      // Assign the new role using the same method as UserRolesTab
      const { error: insertError } = await supabase
        .from('user_role_assignments')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: assignedBy
        });

      if (insertError) {
        throw insertError;
      }

      // 2. Send notification if enabled
      if (enableNotifications !== false) {
        await this.sendRoleAssignmentNotification(userId, roleId, assignedBy, notificationMessage);
      }

      // 3. Log assignment for audit if enabled
      if (logAssignments !== false) {
        await this.logRoleAssignment(userId, roleId, assignedBy);
      }

      return true;
    } catch (error) {
      console.error('Error assigning user role:', error);
      return false;
    }
  }

  // Remove the old complex role assignment methods as we're now using the simple user_role_assignments table

  private static async sendRoleAssignmentNotification(
    userId: string, 
    roleId: string, 
    assignedBy: string, 
    customMessage?: string
  ): Promise<void> {
    try {
      // Get role name
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .single();

      const roleName = role?.name || 'Unknown Role';

      // Get assigner name
      const { data: assigner } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, email')
        .eq('id', assignedBy)
        .single();

      const assignerName = assigner 
        ? `${assigner.first_name} ${assigner.last_name}`.trim() || assigner.email
        : 'Someone';

      const title = `New Role Assignment`;
      const message = customMessage || 
        `${assignerName} has assigned you the role "${roleName}".`;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'role_assignment',
          title,
          message,
          data: {
            roleId,
            roleName,
            assignedBy,
            assignerName,
          },
        });
    } catch (error) {
      console.error('Error sending role assignment notification:', error);
    }
  }

  private static async logRoleAssignment(
    userId: string, 
    roleId: string, 
    assignedBy: string
  ): Promise<void> {
    try {
      // Get role name for logging
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .single();

      const roleName = role?.name || 'Unknown Role';

      await supabase
        .from('permission_audit_log')
        .insert({
          project_id: null, // Organization level role assignment
          user_id: userId,
          permission_type: 'organization_role_assignment',
          action: 'granted',
          permission_details: {
            roleId,
            roleName,
            timestamp: new Date().toISOString(),
          },
          changed_by: assignedBy,
        });
    } catch (error) {
      console.error('Error logging role assignment:', error);
    }
  }

  static async processFormSubmissionRoleAssignments(
    formId: string, 
    formData: Record<string, any>, 
    submittedBy: string
  ): Promise<void> {
    try {
      // Get form fields to identify user-picker fields
      const { data: fields } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId);

      if (!fields) return;

      // Process each user-picker field
      for (const field of fields) {
        if (field.field_type === 'user-picker' && formData[field.id]) {
          const config = field.custom_config as any || {};
          const selectedUserIds = Array.isArray(formData[field.id]) 
            ? formData[field.id] 
            : [formData[field.id]];

          // Skip if no role assignment configured
          if (!config.assignRole) continue;

          // Assign roles to all selected users using the new simplified method
          for (const userId of selectedUserIds) {
            if (!userId) continue;

            await this.assignUserRole({
              userId,
              roleId: config.assignRole as string, // Now expects role ID
              assignedBy: submittedBy,
              notificationMessage: config.notificationMessage as string,
              enableNotifications: config.enableNotifications as boolean,
              logAssignments: config.logAssignments as boolean,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing form submission role assignments:', error);
    }
  }
}