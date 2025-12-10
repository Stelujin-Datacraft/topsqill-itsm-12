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
  parentFormId?: string;
  targetFormId?: string;
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
  const [crossRefField, setCrossRefField] = useState<CrossReferenceField | null>(null);
  const [loadingCrossRef, setLoadingCrossRef] = useState(false);

  // Check if target form has a cross-reference field pointing to trigger form
  useEffect(() => {
    const checkCrossReference = async () => {
      if (!localConfig?.targetFormId || !triggerFormId) {
        setCrossRefField(null);
        return;
      }

      setLoadingCrossRef(true);
      try {
        // Fetch fields from target form that are cross-reference or child-cross-reference
        const { data: fields, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type, custom_config')
          .eq('form_id', localConfig.targetFormId)
          .in('field_type', ['cross-reference', 'child-cross-reference']);

        if (error) {
          console.error('Error fetching cross-reference fields:', error);
          setCrossRefField(null);
          return;
        }

        // Find a cross-reference field that points to the trigger form
        const matchingField = fields?.find(field => {
          const config = field.custom_config as any;
          if (!config) return false;
          
          // For child-cross-reference, check parentFormId
          if (field.field_type === 'child-cross-reference') {
            return config.parentFormId === triggerFormId;
          }
          
          // For cross-reference, check targetFormId
          if (field.field_type === 'cross-reference') {
            return config.targetFormId === triggerFormId;
          }
          
          return false;
        });

        if (matchingField) {
          const config = matchingField.custom_config as any;
          setCrossRefField({
            id: matchingField.id,
            label: matchingField.label,
            type: matchingField.field_type,
            parentFormId: config?.parentFormId,
            targetFormId: config?.targetFormId,
          });
          
          // Auto-enable cross-reference linking if field found and not explicitly set
          if (localConfig.linkCrossReference === undefined) {
            handleConfigUpdate('linkCrossReference', true);
            handleConfigUpdate('crossReferenceFieldId', matchingField.id);
          }
        } else {
          setCrossRefField(null);
          handleConfigUpdate('linkCrossReference', false);
          handleConfigUpdate('crossReferenceFieldId', undefined);
        }
      } catch (err) {
        console.error('Error checking cross-reference:', err);
        setCrossRefField(null);
      } finally {
        setLoadingCrossRef(false);
      }
    };

    checkCrossReference();
  }, [localConfig?.targetFormId, triggerFormId]);

  const handleFormChange = useCallback((formId: string, formName: string) => {
    handleFullConfigUpdate({ 
      ...localConfig, 
      targetFormId: formId,
      targetFormName: formName,
      fieldValues: [],
      fieldMappings: [],
      fieldConfigMode: localConfig?.fieldConfigMode || 'field_values',
      linkCrossReference: undefined,
      crossReferenceFieldId: undefined,
    });
  }, [localConfig, handleFullConfigUpdate]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Target Form *</Label>
        <FormSelector
          value={localConfig?.targetFormId || ''}
          onValueChange={handleFormChange}
          placeholder="Select form to create records in"
          projectId={projectId}
        />
      </div>

      {localConfig?.targetFormId && (
        <>
          {/* Cross-Reference Link Detection */}
          {loadingCrossRef ? (
            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              Checking for cross-reference links...
            </div>
          ) : crossRefField ? (
            <div className="border rounded-lg p-3 bg-blue-50 border-blue-200 space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Cross-Reference Link Detected
                </span>
              </div>
              <p className="text-xs text-blue-700">
                Field "<strong>{crossRefField.label}</strong>" ({crossRefField.type}) links back to the trigger form.
                New records will be automatically linked.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="linkCrossReference"
                  checked={localConfig?.linkCrossReference ?? true}
                  onChange={(e) => {
                    handleConfigUpdate('linkCrossReference', e.target.checked);
                    if (e.target.checked) {
                      handleConfigUpdate('crossReferenceFieldId', crossRefField.id);
                    } else {
                      handleConfigUpdate('crossReferenceFieldId', undefined);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="linkCrossReference" className="text-xs text-blue-700 cursor-pointer">
                  Auto-link created records to trigger submission
                </Label>
              </div>
            </div>
          ) : null}

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
              <strong>Note:</strong> When cross-reference linking is enabled, the created record will only have the link populated.
              Other field values can be set via field mapping or static values if you disable auto-linking.
            </div>
          )}
        </>
      )}

      {localConfig?.targetFormId && (
        <div className="text-xs text-cyan-700 bg-cyan-50 p-3 rounded border border-cyan-200">
          <strong>Summary:</strong> Will create {localConfig.recordCount || 1} record{(localConfig.recordCount || 1) > 1 ? 's' : ''} in "{localConfig.targetFormName}"
          {localConfig.linkCrossReference 
            ? ' (auto-linked to trigger record)'
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
