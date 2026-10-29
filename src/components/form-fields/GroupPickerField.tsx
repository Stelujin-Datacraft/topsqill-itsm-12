import { FormField } from '@/types/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGroups } from '@/hooks/useGroups';

interface GroupPickerFieldProps {
  field: FormField;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Selects one organization group. This is the team selector, not submission access. */
export function GroupPickerField({ value, onChange, disabled }: GroupPickerFieldProps) {
  const { groups, loading } = useGroups();
  const selected = typeof value === 'string' ? value : '';

  return (
    <Select value={selected || undefined} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'Loading groups' : 'Select a group'} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
