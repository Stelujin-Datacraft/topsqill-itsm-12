import React, { useEffect, useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSelector } from './FormSelector';
import { CreateRecordFieldsConfig } from './CreateRecordFieldsConfig';
import { FieldMappingConfig } from './FieldMappingConfig';
import { supabase } from '@/integrations/supabase/client';
import { Link2 } from 'lucide-react';

interface CreateRecordConfigProps {
  localConfig: any;
  triggerFormId?: string;
  projectId?: string;
  organizationUsers: Array<{ id: string; email: string; first_name?: string; last_name?: string }>;
  loadingUsers: boolean;
  handleConfigUpdate: (key: string, value: any) => void;
  handleFullConfigUpdate: (config: any) => void;
}

interface CrossReferenceField {
  id: string;
  label: string;
  type: string;
  targetFormId?: string;
  targetFormName?: string;
}

export function CreateRecordConfig({
  localConfig,
  triggerFormId,
  projectId,
  organizationUsers,
  loadingUsers,
  handleConfigUpdate,
  handleFullConfigUpdate,
}: CreateRecordConfigProps) {
  const [crossRefFields, setCrossRefFields] = useState<CrossReferenceField[]>([]);
  const [loadingCrossRef, setLoadingCrossRef] = useState(false);

  // Detect cross-reference fields in the TRIGGER form (parent form)
  useEffect(() => {
    const fetchCrossReferenceFields = async () => {
      if (!triggerFormId) {
        setCrossRefFields([]);
        return;
      }

      setLoadingCrossRef(true);
      try {
        // Fetch cross-reference fields from the trigger form
        const { data: fields, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, custom_config')
          .eq('form_id', triggerFormId)
          .in('field_type', ['cross-reference', 'child-cross-reference']);

        if (error) {
          console.error('Error fetching cross-reference fields:', error);
          setCrossRefFields([]);
          return;
        }

        // Get target form IDs to fetch their names
        const targetFormIds = fields
          ?.map(f => {
            const config = f.custom_config as any;
            return config?.targetFormId;
          })
          .filter(Boolean) || [];

        // Fetch form names
        let formNames: Record<string, string> = {};
        if (targetFormIds.length > 0) {
          const { data: forms } = await supabase
            .from('forms')
            .select('id, name')
            .in('id', targetFormIds);
          
          forms?.forEach(f => {
            formNames[f.id] = f.name;
          });
        }

        const crossRefFieldsList = fields?.map(field => {
          const config = field.custom_config as any;
          return {
            id: field.id,
            label: field.label,
            type: field.field_type,
            targetFormId: config?.targetFormId,
            targetFormName: formNames[config?.targetFormId] || 'Unknown Form',
          };
        }).filter(f => f.targetFormId) || [];

        setCrossRefFields(crossRefFieldsList);
      } catch (err) {
        console.error('Error fetching cross-reference fields:', err);
        setCrossRefFields([]);
      } finally {
        setLoadingCrossRef(false);
      }
    };

    fetchCrossReferenceFields();
  }, [triggerFormId]);

  const handleCrossReferenceFieldSelect = useCallback((fieldId: string) => {
    const selectedField = crossRefFields.find(f => f.id === fieldId);
    if (selectedField) {
      handleFullConfigUpdate({
        ...localConfig,
        linkCrossReference: true,
        crossReferenceFieldId: fieldId,
        targetFormId: selectedField.targetFormId,
        targetFormName: selectedField.targetFormName,
        fieldValues: [],
        fieldMappings: [],
      });
    }
  }, [crossRefFields, localConfig, handleFullConfigUpdate]);

  const handleFormChange = useCallback((formId: string, formName: string) => {
    handleFullConfigUpdate({ 
      ...localConfig, 
      targetFormId: formId,
      targetFormName: formName,
      fieldValues: [],
      fieldMappings: [],
      fieldConfigMode: localConfig?.fieldConfigMode || 'field_values',
      linkCrossReference: false,
      crossReferenceFieldId: undefined,
    });
  }, [localConfig, handleFullConfigUpdate]);

  const handleDisableCrossRefLinking = useCallback(() => {
    handleFullConfigUpdate({
      ...localConfig,
      linkCrossReference: false,
      crossReferenceFieldId: undefined,
      targetFormId: undefined,
      targetFormName: undefined,
    });
  }, [localConfig, handleFullConfigUpdate]);

  return (
    <div className="space-y-4">
      {/* Cross-Reference Field Selection (Primary Option) */}
      {crossRefFields.length > 0 && (
        <div className="border rounded-lg p-3 bg-blue-50 border-blue-200 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Create Linked Record
            </span>
          </div>
          <p className="text-xs text-blue-700">
            Select a cross-reference field from the trigger form to create a linked child record.
          </p>
          <Select
            value={localConfig?.crossReferenceFieldId || ''}
            onValueChange={handleCrossReferenceFieldSelect}
          >
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="Select cross-reference field" />
            </SelectTrigger>
            <SelectContent>
              {crossRefFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label} → {field.targetFormName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {localConfig?.linkCrossReference && localConfig?.crossReferenceFieldId && (
            <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
              <strong>✓ Linked:</strong> Creating records in "{localConfig.targetFormName}" and auto-linking to parent's "{crossRefFields.find(f => f.id === localConfig.crossReferenceFieldId)?.label}" field.
              <button
                type="button"
                onClick={handleDisableCrossRefLinking}
                className="ml-2 text-red-600 hover:text-red-800 underline"
              >
                Disable
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Form Selection (Alternative) */}
      {!localConfig?.linkCrossReference && (
        <>
          <div>
            <Label>{crossRefFields.length > 0 ? 'Or Select Target Form Manually' : 'Target Form *'}</Label>
            <FormSelector
              value={localConfig?.targetFormId || ''}
              onValueChange={handleFormChange}
              placeholder="Select form to create records in"
              projectId={projectId}
            />
          </div>
        </>
      )}

      {localConfig?.targetFormId && (
        <>
          <div>
            <Label>Number of Records *</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={localConfig?.recordCount ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  handleConfigUpdate('recordCount', '');
                } else {
                  const num = parseInt(val);
                  if (!isNaN(num)) {
                    handleConfigUpdate('recordCount', Math.max(1, Math.min(100, num)));
                  }
                }
              }}
              onBlur={() => {
                const currentValue = localConfig?.recordCount;
                if (currentValue === '' || currentValue === null || currentValue === undefined || (typeof currentValue === 'number' && currentValue < 1)) {
                  handleConfigUpdate('recordCount', 1);
                }
              }}
              placeholder="Enter number of records to create"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum 100 records per action</p>
          </div>

          <div>
            <Label>Initial Status</Label>
            <Select
              value={localConfig?.initialStatus || 'pending'}
              onValueChange={(value) => handleConfigUpdate('initialStatus', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select initial status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Submitted By</Label>
            <Select
              value={localConfig?.setSubmittedBy || 'trigger_submitter'}
              onValueChange={(value) => {
                handleConfigUpdate('setSubmittedBy', value);
                if (value !== 'specific_user') {
                  handleConfigUpdate('specificSubmitterId', undefined);
                }
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select submitter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trigger_submitter">Trigger Form Submitter</SelectItem>
                <SelectItem value="specific_user">Specific User</SelectItem>
                <SelectItem value="system">System (No User)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Who will be recorded as the submitter</p>
          </div>

          {localConfig?.setSubmittedBy === 'specific_user' && (
            <div>
              <Label>Select User *</Label>
              <Select
                value={localConfig?.specificSubmitterId || ''}
                onValueChange={(value) => handleConfigUpdate('specificSubmitterId', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {organizationUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name} (${user.email})`
                        : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Only show field configuration if cross-reference linking is NOT enabled */}
          {!localConfig?.linkCrossReference && (
            <>
              <div>
                <Label>Field Configuration Mode</Label>
                <Select
                  value={localConfig?.fieldConfigMode || 'field_values'}
                  onValueChange={(value) => {
                    handleConfigUpdate('fieldConfigMode', value);
                    if (value === 'field_values') {
                      handleConfigUpdate('fieldMappings', []);
                    } else {
                      handleConfigUpdate('fieldValues', []);
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select configuration mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_values">Set Field Values</SelectItem>
                    <SelectItem value="field_mapping">Map Fields from Trigger Form</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {localConfig?.fieldConfigMode === 'field_mapping' 
                    ? 'Map fields from the trigger form to the target form'
                    : 'Set static or dynamic values for target form fields'}
                </p>
              </div>

              {localConfig?.fieldConfigMode === 'field_mapping' ? (
                <FieldMappingConfig
                  triggerFormId={triggerFormId}
                  targetFormId={localConfig.targetFormId}
                  fieldMappings={localConfig?.fieldMappings || []}
                  onFieldMappingsChange={(mappings) => handleConfigUpdate('fieldMappings', mappings)}
                />
              ) : (
                <CreateRecordFieldsConfig
                  targetFormId={localConfig.targetFormId}
                  triggerFormId={triggerFormId}
                  fieldValues={localConfig?.fieldValues || []}
                  onFieldValuesChange={(values) => handleConfigUpdate('fieldValues', values)}
                />
              )}
            </>
          )}

          {localConfig?.linkCrossReference && (
            <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              <strong>Note:</strong> When cross-reference linking is enabled, the created child record will be automatically linked to the parent submission's cross-reference field.
              Additional field values can be set if you disable auto-linking.
            </div>
          )}
        </>
      )}

      {localConfig?.targetFormId && (
        <div className="text-xs text-cyan-700 bg-cyan-50 p-3 rounded border border-cyan-200">
          <strong>Summary:</strong> Will create {localConfig.recordCount || 1} record{(localConfig.recordCount || 1) > 1 ? 's' : ''} in "{localConfig.targetFormName}"
          {localConfig.linkCrossReference 
            ? ' and link back to parent submission'
            : localConfig.fieldConfigMode === 'field_mapping' 
              ? ` (mapping ${localConfig.fieldMappings?.length || 0} field${(localConfig.fieldMappings?.length || 0) !== 1 ? 's' : ''} from trigger form)`
              : (localConfig.fieldValues?.length || 0) > 0 
                ? ` with ${localConfig.fieldValues.length} field value${localConfig.fieldValues.length > 1 ? 's' : ''}`
                : ' with empty/default values'}
          {' | Status: '}{localConfig.initialStatus || 'pending'}
          {' | By: '}{
            localConfig.setSubmittedBy === 'system' 
              ? 'System' 
              : localConfig.setSubmittedBy === 'specific_user'
                ? (organizationUsers.find(u => u.id === localConfig.specificSubmitterId)?.email || 'Selected User')
                : 'Trigger Submitter'
          }
        </div>
      )}
    </div>
  );
}
