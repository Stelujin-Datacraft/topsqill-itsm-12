import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { FormRule } from '@/types/form';
import { Loader2 } from 'lucide-react';

interface FormRuleSelectorProps {
  formId: string;
  value: string;
  onValueChange: (ruleId: string, ruleName: string) => void;
  placeholder?: string;
}

export function FormRuleSelector({ formId, value, onValueChange, placeholder = "Select a rule" }: FormRuleSelectorProps) {
  const [rules, setRules] = useState<FormRule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!formId) {
      setRules([]);
      return;
    }

    const fetchFormRules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('form_rules')
          .eq('id', formId)
          .single();

        if (error) {
          console.error('Error fetching form rules:', error);
          setRules([]);
          return;
        }

        // Parse form_rules JSON
        const formRules = data?.form_rules 
          ? (typeof data.form_rules === 'string' 
              ? JSON.parse(data.form_rules) 
              : data.form_rules) as FormRule[]
          : [];

        // Filter only active rules
        const activeRules = formRules.filter(rule => rule.isActive);
        setRules(activeRules);
      } catch (error) {
        console.error('Error parsing form rules:', error);
        setRules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFormRules();
  }, [formId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading rules...
      </div>
    );
  }

  if (!formId) {
    return (
      <p className="text-xs text-muted-foreground">Select a form first to see available rules</p>
    );
  }

  if (rules.length === 0) {
    return (
      <p className="text-xs text-amber-600">No active rules found for this form. Create rules in the Form Builder.</p>
    );
  }

  return (
    <Select value={value} onValueChange={(id) => {
      const selectedRule = rules.find(r => r.id === id);
      onValueChange(id, selectedRule?.name || '');
    }}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {rules.map((rule) => (
          <SelectItem key={rule.id} value={rule.id}>
            <div className="flex flex-col">
              <span>{rule.name}</span>
              <span className="text-xs text-muted-foreground">
                Action: {rule.action}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
