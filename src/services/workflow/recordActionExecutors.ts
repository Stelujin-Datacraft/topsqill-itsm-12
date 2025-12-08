import { supabase } from '@/integrations/supabase/client';
import { NodeExecutionContext } from '../nodeActions';
import { ActionExecutionResult } from './actionExecutors';

export class RecordActionExecutors {
  static async executeChangeFieldValueAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔧 EXECUTING CHANGE FIELD VALUE ACTION');
    console.log('📋 Context:', JSON.stringify(context, null, 2));

    const config = context.config;
    const actionDetails = {
      actionType: 'change_field_value',
      targetFormId: config.targetFormId,
      targetFieldId: config.targetFieldId,
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      if (!config.targetFormId || !config.targetFieldId || !config.valueType) {
        return {
          success: false,
          error: 'Missing required configuration for field value change',
          actionDetails
        };
      }

      // Determine submission ID to update (use submission from trigger)
      const submissionId = context.submissionId;
      
      if (!submissionId) {
        return {
          success: false,
          error: 'No submission ID available to update',
          actionDetails
        };
      }

      // Determine the new value
      let newValue: any;
      
      if (config.valueType === 'static') {
        newValue = config.staticValue;
      } else if (config.valueType === 'dynamic') {
        // The dynamicValuePath now contains a field ID
        // First try to get from submissionData using the field ID directly
        const submissionData = context.triggerData?.submissionData || context.triggerData || {};
        
        if (config.dynamicValuePath in submissionData) {
          newValue = submissionData[config.dynamicValuePath];
        } else {
          // Fallback: try nested path extraction for backward compatibility
          newValue = this.getNestedValue(context.triggerData, config.dynamicValuePath);
        }
        
        if (newValue === undefined) {
          return {
            success: false,
            error: `Could not find value for field: ${config.dynamicFieldName || config.dynamicValuePath}`,
            actionDetails
          };
        }
      }

      console.log('💾 New value determined:', { newValue, valueType: config.valueType });

      // Fetch current submission data
      const { data: submission, error: fetchError } = await supabase
        .from('form_submissions')
        .select('submission_data, form_id')
        .eq('id', submissionId)
        .single();

      if (fetchError || !submission) {
        return {
          success: false,
          error: `Failed to fetch submission: ${fetchError?.message}`,
          actionDetails
        };
      }

      // Verify form ID matches
      if (submission.form_id !== config.targetFormId) {
        return {
          success: false,
          error: 'Target form ID does not match submission form ID',
          actionDetails
        };
      }

      // Update the field value in submission data
      const currentData = submission.submission_data || {};
      const updatedData = {
        ...(typeof currentData === 'object' ? currentData : {}),
        [config.targetFieldId]: newValue
      };

      const { error: updateError } = await supabase
        .from('form_submissions')
        .update({ submission_data: updatedData })
        .eq('id', submissionId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update submission: ${updateError.message}`,
          actionDetails
        };
      }

      console.log('✅ Field value updated successfully');

      return {
        success: true,
        output: {
          submissionId,
          fieldId: config.targetFieldId,
          oldValue: submission.submission_data[config.targetFieldId],
          newValue,
          updatedAt: new Date().toISOString()
        },
        actionDetails
      };

    } catch (error) {
      console.error('❌ Error in change field value action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionDetails
      };
    }
  }

  static async executeChangeRecordStatusAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔄 EXECUTING CHANGE RECORD STATUS ACTION');
    console.log('📋 Context:', JSON.stringify(context, null, 2));

    const config = context.config;
    const actionDetails = {
      actionType: 'change_record_status',
      targetFormId: config.targetFormId,
      newStatus: config.newStatus,
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      if (!config.targetFormId || !config.newStatus) {
        return {
          success: false,
          error: 'Missing required configuration for status change',
          actionDetails
        };
      }

      // Determine submission ID to update
      const submissionId = context.submissionId;
      
      if (!submissionId) {
        return {
          success: false,
          error: 'No submission ID available to update',
          actionDetails
        };
      }

      // Fetch current submission
      const { data: submission, error: fetchError } = await supabase
        .from('form_submissions')
        .select('form_id, approval_status')
        .eq('id', submissionId)
        .single();

      if (fetchError || !submission) {
        return {
          success: false,
          error: `Failed to fetch submission: ${fetchError?.message}`,
          actionDetails
        };
      }

      // Verify form ID matches
      if (submission.form_id !== config.targetFormId) {
        return {
          success: false,
          error: 'Target form ID does not match submission form ID',
          actionDetails
        };
      }

      // Update the approval status
      const updateData: any = {
        approval_status: config.newStatus,
        approval_timestamp: new Date().toISOString()
      };

      if (config.statusNotes) {
        updateData.approval_notes = config.statusNotes;
      }

      // Set approved_by if available
      if (context.submitterId) {
        updateData.approved_by = context.submitterId;
      }

      const { error: updateError } = await supabase
        .from('form_submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update status: ${updateError.message}`,
          actionDetails
        };
      }

      console.log('✅ Record status updated successfully');

      // Send notification to submitter (optional)
      const { data: submitterData } = await supabase
        .from('form_submissions')
        .select('submitted_by')
        .eq('id', submissionId)
        .single();

      if (submitterData?.submitted_by) {
        await supabase
          .from('notifications')
          .insert({
            user_id: submitterData.submitted_by,
            title: `Submission Status Updated`,
            message: `Your submission status has been changed to: ${config.newStatus}`,
            type: 'workflow',
            metadata: {
              submissionId,
              oldStatus: submission.approval_status,
              newStatus: config.newStatus,
              notes: config.statusNotes
            }
          });
      }

      return {
        success: true,
        output: {
          submissionId,
          oldStatus: submission.approval_status,
          newStatus: config.newStatus,
          notes: config.statusNotes,
          updatedAt: new Date().toISOString()
        },
        actionDetails
      };

    } catch (error) {
      console.error('❌ Error in change record status action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionDetails
      };
    }
  }

  static async executeCreateRecordAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('➕ EXECUTING CREATE RECORD ACTION');
    console.log('📋 Context:', JSON.stringify(context, null, 2));

    const config = context.config;
    const actionDetails = {
      actionType: 'create_record',
      targetFormId: config.targetFormId,
      recordCount: config.recordCount || 1,
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      if (!config.targetFormId) {
        return {
          success: false,
          error: 'Missing target form ID for record creation',
          actionDetails
        };
      }

      const recordCount = Math.min(Math.max(config.recordCount || 1, 1), 100);
      const fieldValues = config.fieldValues || [];
      const createdRecords: string[] = [];

      console.log(`📊 Creating ${recordCount} records for form ${config.targetFormId}`);

      // Get trigger data for dynamic values
      const triggerSubmissionData = context.triggerData?.submissionData || context.triggerData || {};

      // Determine submitter based on config
      let submittedBy: string | null = null;
      if (config.setSubmittedBy === 'trigger_submitter' || !config.setSubmittedBy) {
        submittedBy = context.submitterId || null;
      } else if (config.setSubmittedBy === 'specific_user' && config.specificSubmitterId) {
        submittedBy = config.specificSubmitterId;
      }
      // 'system' leaves submittedBy as null

      // Determine initial status
      const initialStatus = config.initialStatus || 'pending';

      for (let i = 0; i < recordCount; i++) {
        // Build submission data from field values
        const submissionData: Record<string, any> = {};

        // If fieldConfigMode is 'field_mapping', use field mappings from trigger form
        if (config.fieldConfigMode === 'field_mapping' && triggerSubmissionData) {
          const fieldMappings = config.fieldMappings || [];
          
          for (const mapping of fieldMappings) {
            if (mapping.sourceFieldId && mapping.targetFieldId) {
              const sourceValue = triggerSubmissionData[mapping.sourceFieldId];
              if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                submissionData[mapping.targetFieldId] = sourceValue;
              }
            }
          }
        }

        // Then apply specific field values (these override copied values)
        for (const fieldValue of fieldValues) {
          if (!fieldValue.fieldId) continue;

          let value: any;

          if (fieldValue.valueType === 'static') {
            value = fieldValue.staticValue;
          } else if (fieldValue.valueType === 'dynamic') {
            // Get value from trigger submission data
            const dynamicPath = fieldValue.dynamicValuePath;
            if (dynamicPath && dynamicPath in triggerSubmissionData) {
              value = triggerSubmissionData[dynamicPath];
            } else {
              // Try nested extraction
              value = this.getNestedValue(context.triggerData, dynamicPath || '');
            }
          }

          if (value !== undefined && value !== null && value !== '') {
            submissionData[fieldValue.fieldId] = value;
          }
        }

        console.log(`📝 Creating record ${i + 1}/${recordCount} with data:`, submissionData);

        // Create the submission record
        const { data: newSubmission, error: insertError } = await supabase
          .from('form_submissions')
          .insert({
            form_id: config.targetFormId,
            submission_data: submissionData,
            submitted_by: submittedBy,
            approval_status: initialStatus
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`❌ Error creating record ${i + 1}:`, insertError);
          return {
            success: false,
            error: `Failed to create record ${i + 1}: ${insertError.message}`,
            actionDetails: {
              ...actionDetails,
              createdSoFar: createdRecords.length,
              failedAt: i + 1
            }
          };
        }

        if (newSubmission) {
          createdRecords.push(newSubmission.id);
          console.log(`✅ Created record ${i + 1}: ${newSubmission.id}`);
        }
      }

      console.log(`✅ Successfully created ${createdRecords.length} records`);

      return {
        success: true,
        output: {
          createdRecordIds: createdRecords,
          recordCount: createdRecords.length,
          targetFormId: config.targetFormId,
          createdAt: new Date().toISOString()
        },
        actionDetails: {
          ...actionDetails,
          createdRecordIds: createdRecords
        }
      };

    } catch (error) {
      console.error('❌ Error in create record action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionDetails
      };
    }
  }

  // Helper method for nested value extraction
  private static getNestedValue(obj: any, path: string): any {
    if (!path) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
}
