import { supabase } from '@/integrations/supabase/client';
import { NodeExecutionContext } from '../nodeActions';
import { RecordActionExecutors } from './recordActionExecutors';

export interface ActionExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  actionDetails?: any;
}

export class ActionExecutors {
  static async executeAssignFormAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🎯 STARTING ASSIGN FORM ACTION EXECUTION');
    console.log('📋 Context received:', {
      executionId: context.executionId,
      nodeId: context.nodeId,
      config: JSON.stringify(context.config, null, 2),
      submissionId: context.submissionId,
      submitterId: context.submitterId
    });

    const config = context.config;
    const actionDetails = {
      actionType: 'assign_form',
      targetFormId: config.targetFormId,
      assignmentConfig: config.assignmentConfig,
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: Validate configuration
      console.log('🔍 STEP 1: Validating configuration');
      if (!config.targetFormId) {
        const error = 'Target form ID is required for form assignment';
        console.error('❌ VALIDATION FAILED:', error);
        return {
          success: false,
          error,
          actionDetails: { ...actionDetails, validationError: error }
        };
      }

      if (!config.assignmentConfig || !config.assignmentConfig.type) {
        const error = 'Assignment configuration is required';
        console.error('❌ VALIDATION FAILED:', error);
        return {
          success: false,
          error,
          actionDetails: { ...actionDetails, validationError: error }
        };
      }

      console.log('✅ STEP 1 COMPLETED: Configuration validated');

      // Step 2: Verify target form exists
      console.log('🔍 STEP 2: Verifying target form exists');
      const { data: targetForm, error: formError } = await supabase
        .from('forms')
        .select('id, name, status')
        .eq('id', config.targetFormId)
        .single();

      if (formError || !targetForm) {
        const error = `Target form not found: ${config.targetFormId}`;
        console.error('❌ FORM VERIFICATION FAILED:', error);
        return {
          success: false,
          error,
          actionDetails: { ...actionDetails, formError: formError?.message }
        };
      }

      console.log('✅ STEP 2 COMPLETED: Target form verified:', {
        formId: targetForm.id,
        formName: targetForm.name,
        formStatus: targetForm.status
      });

      // Step 3: Resolve assignee
      console.log('🔍 STEP 3: Resolving assignee');
      const assigneeResult = await this.resolveAssignee(config.assignmentConfig, context);
      
      if (!assigneeResult.success) {
        console.error('❌ ASSIGNEE RESOLUTION FAILED:', assigneeResult.error);
        return {
          success: false,
          error: assigneeResult.error,
          actionDetails: { ...actionDetails, assigneeError: assigneeResult.error }
        };
      }

      console.log('✅ STEP 3 COMPLETED: Assignee resolved:', {
        userId: assigneeResult.userId,
        email: assigneeResult.email,
        type: config.assignmentConfig.type
      });

      // Step 4: Create form assignment
      console.log('🔍 STEP 4: Creating form assignment');
      const assignmentData = {
        form_id: config.targetFormId,
        assigned_to_user_id: assigneeResult.userId,
        assigned_to_email: assigneeResult.email,
        assigned_by_user_id: context.submitterId,
        assignment_type: 'workflow',
        workflow_execution_id: context.executionId,
        status: 'pending',
        notes: `Assigned via workflow: ${targetForm.name}`
      };

      console.log('💾 Creating assignment with data:', JSON.stringify(assignmentData, null, 2));

      const { data: assignment, error: assignmentError } = await supabase
        .from('form_assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (assignmentError) {
        const error = `Failed to create form assignment: ${assignmentError.message}`;
        console.error('❌ ASSIGNMENT CREATION FAILED:', error);
        return {
          success: false,
          error,
          actionDetails: { ...actionDetails, assignmentError: assignmentError.message }
        };
      }

      console.log('✅ STEP 4 COMPLETED: Form assignment created:', {
        assignmentId: assignment.id,
        formId: assignment.form_id,
        assignedTo: assignment.assigned_to_email
      });

      // Step 5: Send notification
      console.log('🔍 STEP 5: Sending notification');
      const notificationResult = await this.sendAssignmentNotification(
        assigneeResult.userId,
        assigneeResult.email,
        targetForm.name,
        assignment.id,
        context.executionId
      );

      console.log('✅ STEP 5 COMPLETED: Notification result:', {
        success: notificationResult.success,
        notificationId: notificationResult.notificationId
      });

      const output = {
        actionType: 'assign_form',
        success: true,
        targetFormId: config.targetFormId,
        targetFormName: targetForm.name,
        assignmentId: assignment.id,
        assignedTo: assigneeResult.email,
        assignedUserId: assigneeResult.userId,
        notificationSent: notificationResult.success,
        notificationId: notificationResult.notificationId
      };

      console.log('🎉 ASSIGN FORM ACTION COMPLETED SUCCESSFULLY:', output);

      return {
        success: true,
        output,
        actionDetails: {
          ...actionDetails,
          result: 'success',
          assignmentId: assignment.id,
          assignedTo: assigneeResult.email,
          notificationSent: notificationResult.success
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in assign form action';
      console.error('❌ ASSIGN FORM ACTION FAILED:', error);
      
      return {
        success: false,
        error: errorMessage,
        actionDetails: {
          ...actionDetails,
          result: 'failed',
          error: errorMessage
        }
      };
    }
  }

  private static async resolveAssignee(assignmentConfig: any, context: NodeExecutionContext) {
    console.log('👤 RESOLVING ASSIGNEE:', { type: assignmentConfig.type });

    if (assignmentConfig.type === 'form_submitter') {
      console.log('👤 Assigning to form submitter');
      
      let email = context.triggerData?.userEmail || 
                 context.triggerData?.email ||
                 context.triggerData?.submissionData?.email;

      // If no email found but we have submitter ID, look up user profile
      if (!email && context.submitterId) {
        console.log('🔍 Looking up user email from profile');
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', context.submitterId)
          .single();
        
        if (!profileError && userProfile) {
          email = userProfile.email;
          console.log('✅ Found user email from profile:', email);
        }
      }

      if (!email) {
        return {
          success: false,
          error: `No email found for form submitter. Submitter ID: ${context.submitterId}`
        };
      }

      return {
        success: true,
        userId: context.submitterId,
        email: email
      };

    } else if (assignmentConfig.type === 'specific_user' && assignmentConfig.email) {
      console.log('👤 Assigning to specific user:', assignmentConfig.email);
      
      // Try to find user by email
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', assignmentConfig.email)
        .single();
      
      return {
        success: true,
        userId: userProfile?.id || null,
        email: assignmentConfig.email
      };

    } else {
      return {
        success: false,
        error: `Invalid assignment configuration: ${JSON.stringify(assignmentConfig)}`
      };
    }
  }

  private static async sendAssignmentNotification(
    userId: string | null,
    email: string,
    formName: string,
    assignmentId: string,
    executionId: string
  ) {
    console.log('📬 SENDING ASSIGNMENT NOTIFICATION:', {
      userId,
      email,
      formName,
      assignmentId
    });

    try {
      if (!userId) {
        console.log('⚠️ No user ID available, skipping in-app notification');
        return { success: true, notificationId: null };
      }

      const notificationData = {
        user_id: userId,
        type: 'form_assignment',
        title: 'New Form Assignment',
        message: `You have been assigned to work on form: ${formName}`,
        data: {
          form_name: formName,
          assignment_id: assignmentId,
          workflow_execution_id: executionId,
          action_required: true
        }
      };

      console.log('💾 Creating notification:', JSON.stringify(notificationData, null, 2));

      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      if (notificationError) {
        console.error('❌ Notification creation failed:', notificationError);
        return { success: false, error: notificationError.message };
      }

      console.log('✅ Notification created successfully:', notification.id);
      return { success: true, notificationId: notification.id };

    } catch (error) {
      console.error('❌ Notification sending failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown notification error' 
      };
    }
  }

  static async executeApprovalAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('✅ EXECUTING APPROVAL ACTION');
    console.log('📋 Approval context:', {
      executionId: context.executionId,
      nodeId: context.nodeId,
      config: JSON.stringify(context.config, null, 2),
      submissionId: context.submissionId,
      submitterId: context.submitterId
    });
    
    try {
      const config = context.config;
      
      // Enhanced approvalAction detection with fallbacks
      let approvalAction = config.approvalAction;
      
      // If approvalAction is not found, check alternative config locations
      if (!approvalAction) {
        console.log('⚠️ No approvalAction found in config, checking fallbacks...');
        
        // Check if it's in nested config
        if (config.data && config.data.approvalAction) {
          approvalAction = config.data.approvalAction;
          console.log('✅ Found approvalAction in config.data:', approvalAction);
        }
        // Check for alternative field names
        else if (config.action) {
          approvalAction = config.action;
          console.log('✅ Found approvalAction as config.action:', approvalAction);
        }
        // Default to 'approve' if we have notes suggesting approval
        else if (config.notes && config.notes.toLowerCase().includes('approv')) {
          approvalAction = 'approve';
          console.log('⚠️ Defaulting to approve based on notes content');
        }
        // Last resort - default to approve
        else {
          console.log('⚠️ No approvalAction found, defaulting to approve');
          approvalAction = 'approve';
        }
      }

      console.log('🔧 Final approvalAction determined:', approvalAction);
      
      if (!context.submissionId) {
        throw new Error('Submission ID is required for approval action');
      }

      const approvalStatus = approvalAction === 'approve' ? 'approved' : 'disapproved';
      const approvalNotes = config.notes || `${approvalAction === 'approve' ? 'Approved' : 'Disapproved'} via workflow`;

      console.log('🔄 Updating submission approval status:', {
        submissionId: context.submissionId,
        approvalStatus,
        approvedBy: context.submitterId,
        notes: approvalNotes
      });

      const { data, error } = await supabase
        .from('form_submissions')
        .update({ 
          approval_status: approvalStatus,
          approved_by: context.submitterId,
          approval_timestamp: new Date().toISOString(),
          approval_notes: approvalNotes
        })
        .eq('id', context.submissionId)
        .select();

      if (error) {
        console.error('❌ Approval status update failed:', error);
        throw error;
      }

      console.log('✅ Approval status updated successfully:', data);

      // Send notification to submitter about approval status
      if (context.submitterId) {
        try {
          const notificationData = {
            user_id: context.submitterId,
            type: 'approval_status',
            title: `Form Submission ${approvalStatus === 'approved' ? 'Approved' : 'Disapproved'}`,
            message: `Your form submission has been ${approvalStatus}${config.notes ? `: ${config.notes}` : ''}`,
            data: {
              submission_id: context.submissionId,
              approval_status: approvalStatus,
              workflow_execution_id: context.executionId,
              notes: approvalNotes
            }
          };

          await supabase
            .from('notifications')
            .insert(notificationData);

          console.log('✅ Approval notification sent to submitter');
        } catch (notificationError) {
          console.error('⚠️ Failed to send approval notification:', notificationError);
          // Don't fail the whole action if notification fails
        }
      }

      return {
        success: true,
        output: {
          actionType: 'approval',
          approvalAction: approvalAction,
          approvalStatus: approvalStatus,
          submissionId: context.submissionId,
          approvedBy: context.submitterId,
          notes: approvalNotes,
          updatedSubmission: data?.[0]
        },
        actionDetails: {
          actionType: 'approval',
          result: 'success',
          approvalAction: approvalAction,
          submissionId: context.submissionId,
          approvalStatus: approvalStatus
        }
      };
    } catch (error) {
      console.error('❌ Approval action failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Approval action failed',
        actionDetails: {
          actionType: 'approval',
          result: 'failed',
          error: error instanceof Error ? error.message : 'Approval action failed'
        }
      };
    }
  }

  static async executeApproveFormAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('✅ EXECUTING APPROVE FORM ACTION');
    
    try {
      const config = context.config;
      const { data, error } = await supabase
        .from('forms')
        .update({ status: 'approved' })
        .eq('id', config.targetFormId)
        .select();

      if (error) throw error;

      return {
        success: true,
        output: {
          actionType: 'approve_form',
          targetFormId: config.targetFormId,
          result: 'approved'
        },
        actionDetails: {
          actionType: 'approve_form',
          result: 'success',
          targetFormId: config.targetFormId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Form approval failed',
        actionDetails: {
          actionType: 'approve_form',
          result: 'failed',
          error: error instanceof Error ? error.message : 'Form approval failed'
        }
      };
    }
  }

  static async executeUpdateFormLifecycleStatusAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔄 EXECUTING UPDATE FORM LIFECYCLE STATUS ACTION');
    console.log('📋 Update config:', JSON.stringify(context.config, null, 2));
    
    try {
      const config = context.config;
      
      if (!config.targetFormId) {
        throw new Error('Target form ID is required for lifecycle status update');
      }
      
      if (!config.newStatus) {
        throw new Error('New status is required for form lifecycle update');
      }

      console.log('🔄 Updating form lifecycle status:', {
        formId: config.targetFormId,
        newStatus: config.newStatus
      });

      const { data, error } = await supabase
        .from('forms')
        .update({ 
          status: config.newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.targetFormId)
        .select();

      if (error) {
        console.error('❌ Form lifecycle status update failed:', error);
        throw error;
      }

      console.log('✅ Form lifecycle status updated successfully:', data);

      return {
        success: true,
        output: {
          actionType: 'update_form_lifecycle_status',
          targetFormId: config.targetFormId,
          targetFormName: config.targetFormName,
          newStatus: config.newStatus,
          updatedForm: data?.[0]
        },
        actionDetails: {
          actionType: 'update_form_lifecycle_status',
          result: 'success',
          targetFormId: config.targetFormId,
          newStatus: config.newStatus
        }
      };
    } catch (error) {
      console.error('❌ Update form lifecycle status action failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Form lifecycle status update failed',
        actionDetails: {
          actionType: 'update_form_lifecycle_status',
          result: 'failed',
          error: error instanceof Error ? error.message : 'Form lifecycle status update failed'
        }
      };
    }
  }

  static async executeSendNotificationAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔔 EXECUTING SEND NOTIFICATION ACTION');
    console.log('📋 Full context received:', JSON.stringify(context, null, 2));
    
    try {
      const config = context.config;
      console.log('🔧 Raw config:', JSON.stringify(config, null, 2));
      
      // Handle different possible config structures
      let notificationConfig = config.notificationConfig;
      
      // If notificationConfig doesn't exist, check if the config itself has notification properties
      if (!notificationConfig) {
        console.log('⚠️ No notificationConfig found, checking for direct properties');
        if (config.recipient || config.subject || config.message) {
          notificationConfig = {
            recipient: config.recipient,
            subject: config.subject,
            message: config.message,
            type: config.type || config.notificationType || 'in_app',
            specificEmail: config.specificEmail
          };
        }
      }
      
      console.log('📧 Final notification config:', JSON.stringify(notificationConfig, null, 2));

      // For in-app notifications, subject and message are required
      if (notificationConfig?.type === 'in_app' || !notificationConfig?.type) {
        if (!notificationConfig?.subject || !notificationConfig?.message) {
          throw new Error('Subject and message are required for in-app notification');
        }
      }

      // Resolve recipients based on recipientConfig (new format) or recipient (old format)
      const recipients = await this.resolveNotificationRecipients(notificationConfig, context);
      
      if (recipients.length === 0) {
        throw new Error('No recipients found for notification');
      }

      console.log('👤 Notification recipients resolved:', recipients);

      // Send in-app notifications
      let notificationsCreated = 0;
      let emailsSent = 0;

      if (notificationConfig.type === 'in_app' || !notificationConfig.type) {
        for (const recipient of recipients) {
          if (recipient.userId) {
            try {
              const notificationData = {
                user_id: recipient.userId,
                type: 'workflow_notification',
                title: notificationConfig.subject,
                message: notificationConfig.message,
                data: {
                  workflow_execution_id: context.executionId,
                  notification_type: notificationConfig.type,
                  source: 'workflow'
                }
              };

              console.log('💾 Creating in-app notification for:', recipient.email);

              const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notificationData);

              if (notificationError) {
                console.error('❌ In-app notification creation failed for', recipient.email, ':', notificationError);
              } else {
                console.log('✅ In-app notification created for:', recipient.email);
                notificationsCreated++;
              }
            } catch (notificationError) {
              console.error('❌ In-app notification creation failed:', notificationError);
            }
          }
        }
      }

      // TODO: Implement email notification if type is 'email'
      if (notificationConfig.type === 'email') {
        console.log('📧 Email notification - using email template:', notificationConfig.emailTemplateId);
        // This would require an edge function with the email template
      }

      const result = {
        success: true,
        notificationType: notificationConfig.type,
        recipientCount: recipients.length,
        recipients: recipients.map(r => r.email),
        inAppNotificationsCreated: notificationsCreated,
        emailsSent: emailsSent,
        subject: notificationConfig.subject,
        message: notificationConfig.message
      };

      const output = {
        actionType: 'send_notification',
        notificationType: notificationConfig.type,
        recipientCount: recipients.length,
        recipients: recipients.map(r => r.email),
        subject: notificationConfig.subject,
        success: true
      };

      console.log('🎉 Notification action completed successfully:', result);

      return {
        success: true,
        output,
        actionDetails: {
          actionType: 'send_notification',
          result: 'success',
          notificationType: notificationConfig.type,
          recipientCount: recipients.length,
          notificationsCreated: notificationsCreated
        }
      };
    } catch (error) {
      console.error('❌ Send notification action failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Notification sending failed',
        actionDetails: {
          actionType: 'send_notification',
          result: 'failed',
          error: error instanceof Error ? error.message : 'Notification sending failed'
        }
      };
    }
  }

  private static async resolveNotificationRecipients(
    notificationConfig: any, 
    context: NodeExecutionContext
  ): Promise<Array<{ userId: string | null; email: string }>> {
    const recipients: Array<{ userId: string | null; email: string }> = [];

    // Check for new recipientConfig format (static/dynamic/form_submitter)
    const recipientConfig = notificationConfig.recipientConfig;
    
    if (recipientConfig) {
      console.log('📧 Using new recipientConfig format:', recipientConfig.type);
      
      if (recipientConfig.type === 'form_submitter') {
        const result = await this.getFormSubmitterInfo(context);
        if (result) {
          recipients.push(result);
        }
      } else if (recipientConfig.type === 'static' && recipientConfig.emails?.length > 0) {
        // Static emails - look up user IDs for each
        for (const email of recipientConfig.emails) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .single();
          
          recipients.push({
            userId: userProfile?.id || null,
            email: email
          });
        }
      } else if (recipientConfig.type === 'dynamic' && recipientConfig.dynamicFieldPath) {
        // Dynamic - get email from form field value
        const fieldValue = context.triggerData?.submissionData?.[recipientConfig.dynamicFieldPath];
        console.log('📧 Dynamic field value:', fieldValue);
        
        if (fieldValue) {
          // Handle different field value formats
          const emails = this.extractEmailsFromFieldValue(fieldValue);
          for (const email of emails) {
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('email', email)
              .single();
            
            recipients.push({
              userId: userProfile?.id || null,
              email: email
            });
          }
        }
      }
    } else {
      // Fallback to old recipient format
      console.log('📧 Using old recipient format');
      const recipientType = notificationConfig.recipient || 'form_submitter';
      
      if (recipientType === 'form_submitter') {
        const result = await this.getFormSubmitterInfo(context);
        if (result) {
          recipients.push(result);
        }
      } else if (recipientType === 'specific_user' && notificationConfig.specificEmail) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', notificationConfig.specificEmail)
          .single();
        
        recipients.push({
          userId: userProfile?.id || null,
          email: notificationConfig.specificEmail
        });
      }
    }

    return recipients;
  }

  private static async getFormSubmitterInfo(context: NodeExecutionContext): Promise<{ userId: string | null; email: string } | null> {
    let email = context.triggerData?.userEmail || 
                context.triggerData?.email ||
                context.triggerData?.submissionData?.email;

    // If no email found but we have submitter ID, look up user profile
    if (!email && context.submitterId) {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', context.submitterId)
        .single();
      
      if (userProfile) {
        email = userProfile.email;
      }
    }

    if (email) {
      return {
        userId: context.submitterId || null,
        email: email
      };
    }
    return null;
  }

  private static extractEmailsFromFieldValue(fieldValue: any): string[] {
    const emails: string[] = [];
    
    if (typeof fieldValue === 'string') {
      // Simple email string
      if (fieldValue.includes('@')) {
        emails.push(fieldValue);
      }
    } else if (Array.isArray(fieldValue)) {
      // Array of emails or objects
      for (const item of fieldValue) {
        if (typeof item === 'string' && item.includes('@')) {
          emails.push(item);
        } else if (item?.email) {
          emails.push(item.email);
        }
      }
    } else if (fieldValue && typeof fieldValue === 'object') {
      // Handle submission-access field format: { users: [...], groups: [...] }
      if (fieldValue.users && Array.isArray(fieldValue.users)) {
        for (const user of fieldValue.users) {
          if (typeof user === 'string' && user.includes('@')) {
            emails.push(user);
          } else if (user?.email) {
            emails.push(user.email);
          }
        }
      }
      // Single object with email property
      if (fieldValue.email) {
        emails.push(fieldValue.email);
      }
    }

    return emails;
  }
}
