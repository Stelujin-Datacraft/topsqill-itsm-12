
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
      const assignRole = field.customConfig?.assignRole;
      
      if (!fieldValue || !assignRole) continue;

      // Handle both single and multiple user selections
      const userIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      
      for (const userId of userIds) {
        if (!userId) continue;
        
        try {
          // Assign role to user in the project
          const { error } = await supabase
            .from('project_users')
            .upsert({
              project_id: form.projectId,
              user_id: userId,
              role: assignRole,
              assigned_at: new Date().toISOString()
            }, {
              onConflict: 'project_id,user_id'
            });

          if (error) {
            console.error(`Error assigning role ${assignRole} to user ${userId}:`, error);
          } else {
            console.log(`Successfully assigned role ${assignRole} to user ${userId}`);
          }
        } catch (error) {
          console.error(`Failed to assign role to user ${userId}:`, error);
        }
      }
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      console.log('📝 Submitting form data to database:', formData);
      console.log('👤 Current user profile:', userProfile);
      console.log('🆔 Form ID:', formId);
      
      // Save form submission to database with user context
      const submissionPayload = {
        form_id: formId,
        submission_data: formData,
        submitted_at: new Date().toISOString(),
        submitted_by: userProfile?.id || null, // Capture authenticated user ID
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
