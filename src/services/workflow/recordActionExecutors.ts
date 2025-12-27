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

      // Get the trigger form ID from context
      const triggerFormId = context.triggerData?.formId;
      
      // Check if target form is different from trigger form
      const isTargetFormDifferent = config.targetFormId !== triggerFormId;
      
      console.log('📋 Trigger form:', triggerFormId, 'Target form:', config.targetFormId, 'Is different:', isTargetFormDifferent);

      // Fetch target field to check if it's a submission-access field
      const { data: targetField, error: fieldError } = await supabase
        .from('form_fields')
        .select('id, field_type, custom_config')
        .eq('id', config.targetFieldId)
        .single();

      if (fieldError) {
        console.error('⚠️ Could not fetch target field config:', fieldError);
      }

      // Validate submission-access field value if applicable
      if (targetField && targetField.field_type === 'submission-access') {
        const customConfig = (targetField.custom_config as any) || {};
        const accessConfig = {
          allowedUsers: customConfig.allowedUsers || [],
          allowedGroups: customConfig.allowedGroups || []
        };
        
        const validatedValue = this.validateSubmissionAccessValue(newValue, accessConfig);
        if (validatedValue && (validatedValue.users.length > 0 || validatedValue.groups.length > 0)) {
          newValue = validatedValue;
          console.log(`✅ Validated submission-access field value:`, validatedValue);
        } else {
          return {
            success: false,
            error: 'The users/groups from the source field are not allowed in the target submission-access field configuration',
            actionDetails
          };
        }
      }

      if (isTargetFormDifferent) {
        // Update ALL submissions in the target form
        console.log('🔄 Updating ALL submissions in target form:', config.targetFormId);
        
        // Fetch all submissions from the target form
        const { data: targetSubmissions, error: fetchError } = await supabase
          .from('form_submissions')
          .select('id, submission_data')
          .eq('form_id', config.targetFormId);

        if (fetchError) {
          return {
            success: false,
            error: `Failed to fetch target form submissions: ${fetchError.message}`,
            actionDetails
          };
        }

        if (!targetSubmissions || targetSubmissions.length === 0) {
          return {
            success: false,
            error: 'No submissions found in target form to update',
            actionDetails
          };
        }

        console.log(`📊 Found ${targetSubmissions.length} submissions to update`);

        // Batch update using Promise.all for parallel execution
        const BATCH_SIZE = 50; // Process in batches to avoid overwhelming the DB
        const updatedIds: string[] = [];
        let updatedCount = 0;

        // Split submissions into batches
        for (let i = 0; i < targetSubmissions.length; i += BATCH_SIZE) {
          const batch = targetSubmissions.slice(i, i + BATCH_SIZE);
          
          const updatePromises = batch.map(async (submission) => {
            const currentData = submission.submission_data || {};
            const updatedData = {
              ...(typeof currentData === 'object' ? currentData : {}),
              [config.targetFieldId]: newValue
            };

            const { error: updateError } = await supabase
              .from('form_submissions')
              .update({ submission_data: updatedData })
              .eq('id', submission.id);

            if (!updateError) {
              return { success: true, id: submission.id };
            } else {
              console.error(`❌ Failed to update submission ${submission.id}:`, updateError);
              return { success: false, id: submission.id };
            }
          });

          // Execute batch in parallel
          const results = await Promise.all(updatePromises);
          
          for (const result of results) {
            if (result.success) {
              updatedCount++;
              updatedIds.push(result.id);
            }
          }
        }

        console.log(`✅ Successfully updated ${updatedCount}/${targetSubmissions.length} submissions`);

        return {
          success: true,
          output: {
            targetFormId: config.targetFormId,
            fieldId: config.targetFieldId,
            newValue,
            updatedCount,
            totalSubmissions: targetSubmissions.length,
            updatedSubmissionIds: updatedIds,
            updatedAt: new Date().toISOString()
          },
          actionDetails: {
            ...actionDetails,
            updatedCount,
            totalSubmissions: targetSubmissions.length
          }
        };
      } else {
        // Update the trigger submission (original behavior)
        const submissionId = context.submissionId;
        
        if (!submissionId) {
          return {
            success: false,
            error: 'No submission ID available to update',
            actionDetails
          };
        }

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
            oldValue: (submission.submission_data as any)?.[config.targetFieldId],
            newValue,
            updatedAt: new Date().toISOString()
          },
          actionDetails
        };
      }

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

      // Note: We no longer enforce strict form ID matching since Change Record Status
      // always operates on the trigger submission. The targetFormId in config is used
      // for UI display purposes only.
      console.log('📋 Submission form:', submission.form_id, 'Config target form:', config.targetFormId);

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

      // Fetch target form fields to get submission-access field configurations
      const { data: targetFormFields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('id, field_type, custom_config')
        .eq('form_id', config.targetFormId);

      if (fieldsError) {
        console.error('❌ Error fetching target form fields:', fieldsError);
      }

      // Build a map of submission-access fields and their allowed users/groups
      const submissionAccessFieldConfigs: Record<string, { allowedUsers: string[]; allowedGroups: string[] }> = {};
      if (targetFormFields) {
        for (const field of targetFormFields) {
          if (field.field_type === 'submission-access') {
            const customConfig = (field.custom_config as any) || {};
            submissionAccessFieldConfigs[field.id] = {
              allowedUsers: customConfig.allowedUsers || [],
              allowedGroups: customConfig.allowedGroups || []
            };
          }
        }
      }

      console.log('📋 Submission-access field configs:', submissionAccessFieldConfigs);

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
                // Check if this is a submission-access field and validate the value
                const accessConfig = submissionAccessFieldConfigs[mapping.targetFieldId];
                if (accessConfig) {
                  const validatedValue = this.validateSubmissionAccessValue(sourceValue, accessConfig);
                  if (validatedValue && (validatedValue.users.length > 0 || validatedValue.groups.length > 0)) {
                    submissionData[mapping.targetFieldId] = validatedValue;
                    console.log(`✅ Validated submission-access field ${mapping.targetFieldId}:`, validatedValue);
                  } else {
                    console.log(`⚠️ Skipping submission-access field ${mapping.targetFieldId} - no valid users/groups after validation`);
                  }
                } else {
                  submissionData[mapping.targetFieldId] = sourceValue;
                }
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
            // Check if this is a submission-access field and validate the value
            const accessConfig = submissionAccessFieldConfigs[fieldValue.fieldId];
            if (accessConfig) {
              const validatedValue = this.validateSubmissionAccessValue(value, accessConfig);
              if (validatedValue && (validatedValue.users.length > 0 || validatedValue.groups.length > 0)) {
                submissionData[fieldValue.fieldId] = validatedValue;
                console.log(`✅ Validated submission-access field ${fieldValue.fieldId}:`, validatedValue);
              } else {
                console.log(`⚠️ Skipping submission-access field ${fieldValue.fieldId} - no valid users/groups after validation`);
              }
            } else {
              submissionData[fieldValue.fieldId] = value;
            }
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

  // Validate submission-access value against field configuration
  private static validateSubmissionAccessValue(
    value: any, 
    config: { allowedUsers: string[]; allowedGroups: string[] }
  ): { users: string[]; groups: string[] } | null {
    try {
      // Parse value if it's a string
      let parsedValue = value;
      if (typeof value === 'string') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          return null;
        }
      }

      if (!parsedValue || typeof parsedValue !== 'object') {
        return null;
      }

      const sourceUsers = parsedValue.users || [];
      const sourceGroups = parsedValue.groups || [];

      // Filter users to only include those allowed in target field config
      const validUsers = sourceUsers.filter((userId: string) => 
        config.allowedUsers.includes(userId)
      );

      // Filter groups to only include those allowed in target field config
      const validGroups = sourceGroups.filter((groupId: string) => 
        config.allowedGroups.includes(groupId)
      );

      console.log(`🔍 Submission-access validation: source users=${sourceUsers.length}, valid=${validUsers.length}, source groups=${sourceGroups.length}, valid=${validGroups.length}`);

      return {
        users: validUsers,
        groups: validGroups
      };
    } catch (error) {
      console.error('❌ Error validating submission-access value:', error);
      return null;
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

  static async executeCreateLinkedRecordAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔗 EXECUTING CREATE LINKED RECORD ACTION');
    console.log('📋 Context:', JSON.stringify(context, null, 2));

    const config = context.config;
    const recordCount = Math.min(Math.max(config.recordCount || 1, 1), 100);
    const actionDetails = {
      actionType: 'create_linked_record',
      crossReferenceFieldId: config.crossReferenceFieldId,
      targetFormId: config.targetFormId,
      recordCount,
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      if (!config.crossReferenceFieldId) {
        return {
          success: false,
          error: 'Missing cross-reference field selection',
          actionDetails
        };
      }

      if (!config.targetFormId) {
        return {
          success: false,
          error: 'Missing target form ID for linked record creation',
          actionDetails
        };
      }

      // Get trigger data
      const triggerSubmissionData = context.triggerData?.submissionData || context.triggerData || {};
      const triggerSubmissionId = context.submissionId;
      const triggerFormId = context.triggerData?.formId;

      console.log('📋 Trigger data:', { triggerSubmissionId, triggerFormId, recordCount });

      // Determine submitter
      let submittedBy: string | null = null;
      if (config.setSubmittedBy === 'trigger_submitter' || !config.setSubmittedBy) {
        submittedBy = context.submitterId || null;
      } else if (config.setSubmittedBy === 'specific_user' && config.specificSubmitterId) {
        submittedBy = config.specificSubmitterId;
      }

      // Determine initial status
      const initialStatus = config.initialStatus || 'pending';

      // Build base submission data for the new child records
      const childSubmissionData: Record<string, any> = {};

      // Apply field values if configured
      if (config.fieldConfigMode === 'field_mapping' && config.fieldMappings) {
        for (const mapping of config.fieldMappings) {
          if (mapping.sourceFieldId && mapping.targetFieldId) {
            const sourceValue = triggerSubmissionData[mapping.sourceFieldId];
            if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
              childSubmissionData[mapping.targetFieldId] = sourceValue;
            }
          }
        }
      } else if (config.fieldValues && config.fieldValues.length > 0) {
        for (const fieldValue of config.fieldValues) {
          if (!fieldValue.fieldId) continue;

          let value: any;
          if (fieldValue.valueType === 'static') {
            value = fieldValue.staticValue;
          } else if (fieldValue.valueType === 'dynamic') {
            const dynamicPath = fieldValue.dynamicValuePath;
            if (dynamicPath && dynamicPath in triggerSubmissionData) {
              value = triggerSubmissionData[dynamicPath];
            }
          }

          if (value !== undefined && value !== null && value !== '') {
            childSubmissionData[fieldValue.fieldId] = value;
          }
        }
      }

      console.log('📝 Child submission data template:', childSubmissionData);

      // Create multiple child records
      const createdRecords: Array<{ id: string; submission_ref_id: string }> = [];
      
      for (let i = 0; i < recordCount; i++) {
        const { data: newSubmission, error: createError } = await supabase
          .from('form_submissions')
          .insert({
            form_id: config.targetFormId,
            submission_data: childSubmissionData,
            submitted_by: submittedBy,
            approval_status: initialStatus
          })
          .select('id, submission_ref_id')
          .single();

        if (createError || !newSubmission) {
          console.error(`❌ Error creating child record ${i + 1}/${recordCount}:`, createError);
          // Continue trying to create remaining records
          continue;
        }

        console.log(`✅ Child record ${i + 1}/${recordCount} created:`, newSubmission);
        createdRecords.push({
          id: newSubmission.id,
          submission_ref_id: newSubmission.submission_ref_id || ''
        });
      }

      if (createdRecords.length === 0) {
        return {
          success: false,
          error: 'Failed to create any linked records',
          actionDetails
        };
      }

      // Now update the parent (trigger) submission's cross-reference field
      // to include all new child records' submission_ref_ids
      if (triggerSubmissionId && createdRecords.length > 0) {
        // Fetch current parent submission data
        const { data: parentSubmission, error: fetchError } = await supabase
          .from('form_submissions')
          .select('submission_data')
          .eq('id', triggerSubmissionId)
          .single();

        if (fetchError || !parentSubmission) {
          console.error('⚠️ Could not fetch parent submission to update cross-reference:', fetchError);
          return {
            success: true,
            output: {
              createdCount: createdRecords.length,
              requestedCount: recordCount,
              childRecords: createdRecords,
              parentUpdated: false,
              warning: 'Child records created but could not update parent cross-reference field'
            },
            actionDetails
          };
        }

        // Get the current value of the cross-reference field
        const currentData = parentSubmission.submission_data || {};
        const currentCrossRefValue = (currentData as any)[config.crossReferenceFieldId];

        // Cross-reference fields typically store an array of submission_ref_ids
        let updatedCrossRefValue: string[];
        if (Array.isArray(currentCrossRefValue)) {
          updatedCrossRefValue = [...currentCrossRefValue];
        } else if (typeof currentCrossRefValue === 'string' && currentCrossRefValue) {
          updatedCrossRefValue = [currentCrossRefValue];
        } else {
          updatedCrossRefValue = [];
        }

        // Add all new submission_ref_ids
        for (const record of createdRecords) {
          if (record.submission_ref_id) {
            updatedCrossRefValue.push(record.submission_ref_id);
          }
        }

        // Update the parent submission with the new cross-reference value
        const updatedData = {
          ...(typeof currentData === 'object' ? currentData : {}),
          [config.crossReferenceFieldId]: updatedCrossRefValue
        };

        const { error: updateError } = await supabase
          .from('form_submissions')
          .update({ submission_data: updatedData })
          .eq('id', triggerSubmissionId);

        if (updateError) {
          console.error('⚠️ Error updating parent cross-reference field:', updateError);
          return {
            success: true,
            output: {
              createdCount: createdRecords.length,
              requestedCount: recordCount,
              childRecords: createdRecords,
              parentUpdated: false,
              warning: `Child records created but failed to update parent: ${updateError.message}`
            },
            actionDetails
          };
        }

        console.log(`✅ Parent cross-reference field updated with ${createdRecords.length} new child refs`);

        return {
          success: true,
          output: {
            createdCount: createdRecords.length,
            requestedCount: recordCount,
            childRecords: createdRecords,
            parentSubmissionId: triggerSubmissionId,
            crossReferenceFieldId: config.crossReferenceFieldId,
            crossReferenceValue: updatedCrossRefValue,
            parentUpdated: true,
            linkedAt: new Date().toISOString()
          },
          actionDetails
        };
      }

      // If no trigger submission to update, just return the created children
      return {
        success: true,
        output: {
          createdCount: createdRecords.length,
          requestedCount: recordCount,
          childRecords: createdRecords,
          parentUpdated: false,
          note: 'No parent submission to update'
        },
        actionDetails
      };

    } catch (error) {
      console.error('❌ Error in create linked record action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionDetails
      };
    }
  }

  static async executeUpdateLinkedRecordsAction(context: NodeExecutionContext): Promise<ActionExecutionResult> {
    console.log('🔄 EXECUTING UPDATE LINKED RECORDS ACTION');
    console.log('📋 Context:', JSON.stringify(context, null, 2));

    const config = context.config;
    const actionDetails = {
      actionType: 'update_linked_records',
      crossReferenceFieldId: config.crossReferenceFieldId,
      targetFormId: config.targetFormId,
      updateScope: config.updateScope || 'all',
      timestamp: new Date().toISOString()
    };

    try {
      // Validate configuration
      if (!config.crossReferenceFieldId) {
        return {
          success: false,
          error: 'Missing cross-reference field selection',
          actionDetails
        };
      }

      if (!config.targetFormId) {
        return {
          success: false,
          error: 'Missing target form ID for linked record update',
          actionDetails
        };
      }

      if (!config.fieldMappings || config.fieldMappings.length === 0) {
        return {
          success: false,
          error: 'At least one field mapping is required',
          actionDetails
        };
      }

      // Get trigger data
      const triggerSubmissionData = context.triggerData?.submissionData || context.triggerData || {};
      const triggerSubmissionId = context.submissionId;

      console.log('📋 Trigger data:', { triggerSubmissionId, fieldMappings: config.fieldMappings });

      // Get the linked record refs from the cross-reference field
      const crossRefValue = triggerSubmissionData[config.crossReferenceFieldId];
      
      if (!crossRefValue) {
        console.log('⚠️ No linked records found in cross-reference field');
        return {
          success: true,
          output: {
            updatedCount: 0,
            message: 'No linked records found in cross-reference field',
            crossReferenceFieldId: config.crossReferenceFieldId
          },
          actionDetails
        };
      }

      // Cross-reference fields store an array of objects with:
      // { id, submission_ref_id, form_id, displayData }
      // We need to extract both the submission_ref_id AND the form_id
      interface LinkedRecord {
        refId: string;
        formId: string;
      }
      
      let linkedRecords: LinkedRecord[] = [];
      
      if (Array.isArray(crossRefValue)) {
        linkedRecords = crossRefValue
          .map(v => {
            if (typeof v === 'string') {
              // Just a string ref ID - use config.targetFormId
              return { refId: v, formId: config.targetFormId };
            }
            if (v && typeof v === 'object' && v.submission_ref_id) {
              // Object with form_id - use the form_id from the value
              return { 
                refId: v.submission_ref_id, 
                formId: v.form_id || config.targetFormId 
              };
            }
            return null;
          })
          .filter((v): v is LinkedRecord => v !== null && v.refId !== '');
      } else if (typeof crossRefValue === 'object' && crossRefValue?.submission_ref_id) {
        linkedRecords = [{
          refId: crossRefValue.submission_ref_id,
          formId: crossRefValue.form_id || config.targetFormId
        }];
      } else if (typeof crossRefValue === 'string' && crossRefValue) {
        linkedRecords = [{ refId: crossRefValue, formId: config.targetFormId }];
      }

      console.log('📋 Extracted linked records:', linkedRecords, 'from cross-ref value:', crossRefValue);

      if (linkedRecords.length === 0) {
        return {
          success: true,
          output: {
            updatedCount: 0,
            message: 'No valid linked record references found',
            crossReferenceFieldId: config.crossReferenceFieldId,
            rawCrossRefValue: crossRefValue
          },
          actionDetails
        };
      }

      console.log(`📋 Found ${linkedRecords.length} linked records:`, linkedRecords);

      // Apply update scope filter
      const updateScope = config.updateScope || 'all';
      let recordsToUpdate: LinkedRecord[];
      
      if (updateScope === 'first') {
        recordsToUpdate = [linkedRecords[0]];
      } else if (updateScope === 'last') {
        recordsToUpdate = [linkedRecords[linkedRecords.length - 1]];
      } else {
        recordsToUpdate = linkedRecords;
      }

      console.log(`📋 Will update ${recordsToUpdate.length} records (scope: ${updateScope})`);

      // Build the update data from field mappings
      const updateData: Record<string, any> = {};
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceFieldId && mapping.targetFieldId) {
          const sourceValue = triggerSubmissionData[mapping.sourceFieldId];
          if (sourceValue !== undefined) {
            updateData[mapping.targetFieldId] = sourceValue;
          }
        }
      }

      console.log('📝 Update data:', updateData);

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No valid field mappings resulted in update data',
          actionDetails
        };
      }

      // Find and update the linked submissions
      const updatedRecordsList: Array<{ id: string; submission_ref_id: string }> = [];
      const errors: string[] = [];

      for (const linkedRec of recordsToUpdate) {
        // First find the submission by ref ID - use the form_id from the cross-reference value
        const targetFormId = linkedRec.formId;
        console.log(`🔍 Looking for submission ${linkedRec.refId} in form ${targetFormId}`);
        
        const { data: linkedSubmission, error: findError } = await supabase
          .from('form_submissions')
          .select('id, submission_ref_id, submission_data, form_id')
          .eq('submission_ref_id', linkedRec.refId)
          .eq('form_id', targetFormId)
          .single();

        if (findError || !linkedSubmission) {
          console.error(`⚠️ Could not find linked submission with ref ${linkedRec.refId} in form ${targetFormId}:`, findError);
          errors.push(`Submission ${linkedRec.refId} not found in form ${targetFormId}`);
          continue;
        }

        // Merge update data with existing submission data
        const currentData = linkedSubmission.submission_data || {};
        const mergedData = {
          ...(typeof currentData === 'object' ? currentData : {}),
          ...updateData
        };

        // Update the submission
        const { error: updateError } = await supabase
          .from('form_submissions')
          .update({ submission_data: mergedData })
          .eq('id', linkedSubmission.id);

        if (updateError) {
          console.error(`❌ Error updating submission ${linkedSubmission.id}:`, updateError);
          errors.push(`Failed to update ${linkedRec.refId}: ${updateError.message}`);
          continue;
        }

        console.log(`✅ Updated linked record: ${linkedSubmission.submission_ref_id}`);
        updatedRecordsList.push({
          id: linkedSubmission.id,
          submission_ref_id: linkedSubmission.submission_ref_id || linkedRec.refId
        });
      }

      if (updatedRecordsList.length === 0 && errors.length > 0) {
        return {
          success: false,
          error: `Failed to update any linked records: ${errors.join(', ')}`,
          actionDetails
        };
      }

      return {
        success: true,
        output: {
          updatedCount: updatedRecordsList.length,
          requestedCount: recordsToUpdate.length,
          updatedRecords: updatedRecordsList,
          updateScope,
          fieldMappingsApplied: config.fieldMappings.length,
          errors: errors.length > 0 ? errors : undefined,
          updatedAt: new Date().toISOString()
        },
        actionDetails
      };

    } catch (error) {
      console.error('❌ Error in update linked records action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionDetails
      };
    }
  }
}
