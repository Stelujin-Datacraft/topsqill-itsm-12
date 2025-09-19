
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { WorkflowExecutionService } from '@/services/workflowExecution';
import { useAuth } from '@/contexts/AuthContext';
import { Form } from '@/types/form';

export function useFormSubmissionHandler(formId: string | undefined, form?: Form) {
  const { userProfile } = useAuth();

  const assignRolesToUsers = async (formData: Record<string, any>) => {
    if (!form?.fields) return;

    // Find user picker fields with role assignment configuration
    const userPickerFields = form.fields.filter(
      field => field.type === 'user-picker' && field.customConfig?.assignRole
    );

    for (const field of userPickerFields) {
      const fieldValue = formData[field.id];
      const assignRoleId = field.customConfig?.assignRole;
      
      if (!fieldValue || !assignRoleId) continue;

      // Fetch the role data from the database
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('*')
        .eq('id', assignRoleId)
        .single();

      if (roleError || !roleData) {
        console.error(`Role not found for ID: ${assignRoleId}`, roleError);
        continue;
      }

      // Handle both single and multiple user selections
      const userIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      
      for (const userId of userIds) {
        if (!userId) continue;
        
        try {
          console.log(`Assigning role ${roleData.name} (ID: ${roleData.id}) to user ${userId}`);
          
          // Assign role to user using user_role_assignments table
          const { error } = await supabase
            .from('user_role_assignments')
            .upsert({
              user_id: userId,
              role_id: assignRoleId,
              assigned_by: userProfile?.id
            }, {
              onConflict: 'user_id,role_id'
            });

          if (error) {
            console.error(`Error assigning role ${roleData.name} to user ${userId}:`, error);
          } else {
            console.log(`Successfully assigned role ${roleData.name} to user ${userId}`);
          }
        } catch (error) {
          console.error(`Failed to assign role to user ${userId}:`, error);
        }
      }
    }
  };

  const generateUniqueRefId = async () => {
    const prefix = form?.reference_id?.slice(0, 3) || 'SUB';
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD format
    
    // Try to generate a unique reference ID
    for (let i = 1; i <= 999; i++) {
      const refId = `${prefix}${dateStr}${String(i).padStart(3, '0')}`;
      
      // Check if this ID already exists
      const { data: existing } = await supabase
        .from('form_submissions')
        .select('id')
        .eq('submission_ref_id', refId)
        .single();
      
      if (!existing) {
        return refId;
      }
    }
    
    // Fallback with timestamp if all 999 attempts fail
    return `${prefix}${dateStr}${Date.now().toString().slice(-3)}`;
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      console.log('📝 Submitting form data to database:', formData);
      console.log('👤 Current user profile:', userProfile);
      console.log('🆔 Form ID:', formId);
      
      // Generate unique reference ID
      const submissionRefId = await generateUniqueRefId();
      
      // Save form submission to database with user context
      const submissionPayload = {
        form_id: formId,
        submission_data: formData,
        submitted_at: new Date().toISOString(),
        submitted_by: userProfile?.id || null, // Capture authenticated user ID
        submission_ref_id: submissionRefId, // Explicitly set unique reference ID
      };

      console.log('📤 Form submission payload:', submissionPayload);
      
      const { data: submission, error: submissionError } = await supabase
        .from('form_submissions')
        .insert(submissionPayload)
        .select()
        .single();

      if (submissionError) {
        console.error('❌ Error saving submission:', submissionError);
        throw new Error('Failed to save submission');
      }

      console.log('✅ Form submission saved successfully with ID:', submission.id);
      console.log('📄 Submission reference ID:', submission.submission_ref_id);
      
      // Handle user role assignments if configured
      await assignRolesToUsers(formData);
      
      // Trigger workflow execution for form submission using the correct service
      if (formId && userProfile?.id) {
        console.log('🔍 Triggering workflows for form submission...');
        
        // Prepare enhanced trigger data with user email
        const enhancedFormData = {
          ...formData,
          userEmail: userProfile.email || formData.email,
          submittedBy: userProfile.id,
          submitterName: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
          submissionRefId: submission.submission_ref_id
        };
        
        console.log('📋 Enhanced trigger parameters:', {
          formId,
          submissionId: submission.id,
          submitterId: userProfile.id,
          userEmail: userProfile.email || formData.email,
          submissionRefId: submission.submission_ref_id
        });
        
        try {
          const triggeredWorkflows = await WorkflowExecutionService.triggerWorkflowsForFormSubmission(
            formId,
            enhancedFormData,
            submission.id,
            userProfile.id
          );
          
          console.log('✅ Workflow execution service completed:', {
            triggeredCount: triggeredWorkflows.length,
            workflows: triggeredWorkflows
          });
          
          if (triggeredWorkflows.length > 0) {
            toast({
              title: "Success!",
              description: `Your form has been submitted and ${triggeredWorkflows.length} workflow(s) have been triggered.`,
            });
          } else {
            toast({
              title: "Success!",
              description: "Your form has been submitted successfully.",
            });
          }
        } catch (triggerError) {
          console.error('❌ Error in workflow execution service:', triggerError);
          // Don't throw here - form submission was successful, workflow trigger failure shouldn't break the form
          toast({
            title: "Success!",
            description: "Your form has been submitted successfully.",
          });
        }
      } else {
        console.log('⚠️ Skipping workflow triggers - missing formId or user profile:', {
          formId: !!formId,
          userId: !!userProfile?.id
        });
        
        toast({
          title: "Success!",
          description: "Your form has been submitted successfully.",
        });
      }

      // Return submission data including reference ID
      return {
        submissionId: submission.id,
        submissionRefId: submission.submission_ref_id
      };
    } catch (error) {
      console.error('❌ Error submitting form:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your form. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return { handleFormSubmit };
}
