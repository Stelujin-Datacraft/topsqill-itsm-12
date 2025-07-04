
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, GitBranch } from 'lucide-react';
import { 
  ConditionConfig, 
  IfConditionConfig, 
  SwitchConditionConfig, 
  EnhancedCondition
} from '@/types/conditions';
import { EnhancedConditionBuilder } from './EnhancedConditionBuilder';
import { ConditionBuilder } from './ConditionBuilder';

interface ConditionConfigPanelProps {
  config?: any;
  onChange: (config: any) => void;
  onClose: () => void;
}

export function ConditionConfigPanel({ config, onChange, onClose }: ConditionConfigPanelProps) {
  const [useEnhancedBuilder, setUseEnhancedBuilder] = useState(
    config?.enhancedCondition ? true : false
  );

  const handleEnhancedConditionChange = useCallback((enhancedCondition: EnhancedCondition) => {
    console.log('🔧 Enhanced condition changed:', enhancedCondition);
    const newConfig = {
      ...config,
      enhancedCondition,
      conditionType: 'enhanced'
    };
    console.log('🔧 Calling onChange with config:', newConfig);
    onChange(newConfig);
  }, [onChange, config]);

  const handleLegacyConditionChange = useCallback((conditionConfig: ConditionConfig) => {
    console.log('🔧 Legacy condition changed:', conditionConfig);
    const newConfig = {
      ...config,
      conditionConfig,
      conditionType: 'legacy'
    };
    console.log('🔧 Calling onChange with config:', newConfig);
    onChange(newConfig);
  }, [onChange, config]);

  const currentEnhancedCondition = useMemo(() => {
    return config?.enhancedCondition;
  }, [config]);

  const currentLegacyCondition = useMemo(() => {
    return config?.conditionConfig;
  }, [config]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configure Condition Node</h3>
          <p className="text-sm text-gray-600">Set up the logic for this condition</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={useEnhancedBuilder ? "default" : "outline"}
            size="sm"
            onClick={() => setUseEnhancedBuilder(!useEnhancedBuilder)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {useEnhancedBuilder ? 'Enhanced Mode' : 'Legacy Mode'}
          </Button>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>

      {useEnhancedBuilder ? (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Enhanced Condition Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnhancedConditionBuilder
              value={currentEnhancedCondition}
              onChange={handleEnhancedConditionChange}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-600" />
              Legacy Condition Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConditionBuilder
              value={currentLegacyCondition}
              onChange={handleLegacyConditionChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
