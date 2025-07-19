import React from 'react';
import { FieldConfiguration } from '../../hooks/useFieldConfiguration';

interface ChildCrossReferenceFieldConfigProps {
  config: FieldConfiguration;
  onUpdate: (updates: Partial<FieldConfiguration>) => void;
  errors: Record<string, string>;
}

export function ChildCrossReferenceFieldConfig({
  config,
  onUpdate,
  errors
}: ChildCrossReferenceFieldConfigProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Child Cross-Reference Field</h4>
        <p className="text-sm text-blue-700">
          This field displays related data from the parent form that references this form. 
          The configuration is automatically managed by the parent cross-reference field.
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Display Options</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.customConfig?.showMetadata || false}
                onChange={(e) => onUpdate({
                  customConfig: {
                    ...config.customConfig,
                    showMetadata: e.target.checked
                  }
                })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Show metadata columns</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.customConfig?.allowSelection || false}
                onChange={(e) => onUpdate({
                  customConfig: {
                    ...config.customConfig,
                    allowSelection: e.target.checked
                  }
                })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Allow record selection</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}