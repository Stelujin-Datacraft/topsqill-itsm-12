import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PromoObjectItem = {
  objectType: string;
  objectId: string;
  name: string;
  module?: string;
  objectTypeName?: string;
  devVersion?: string | null;
  prodVersion?: string | null;
  conflictStatus?: string;
  hasDependencies?: boolean;
};

function itemKey(o: PromoObjectItem) {
  return `${o.objectType}:${o.objectId}`;
}

function matchesQuery(o: PromoObjectItem, q: string) {
  if (!q.trim()) return true;
  const hay = `${o.name} ${o.objectTypeName || ''} ${o.objectType} ${o.conflictStatus || ''}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

type Props = {
  items: PromoObjectItem[];
  selected: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
};

export function ModuleObjectDualListbox({ items, selected, onChange }: Props) {
  const [availableQuery, setAvailableQuery] = useState('');
  const [selectedQuery, setSelectedQuery] = useState('');
  const [highlightAvailable, setHighlightAvailable] = useState<Record<string, boolean>>({});
  const [highlightSelected, setHighlightSelected] = useState<Record<string, boolean>>({});

  const available = useMemo(
    () => items.filter((o) => !selected[itemKey(o)] && matchesQuery(o, availableQuery)),
    [items, selected, availableQuery],
  );
  const chosen = useMemo(
    () => items.filter((o) => selected[itemKey(o)] && matchesQuery(o, selectedQuery)),
    [items, selected, selectedQuery],
  );

  function toggleHighlight(
    side: 'available' | 'selected',
    key: string,
    multi: boolean,
  ) {
    const setter = side === 'available' ? setHighlightAvailable : setHighlightSelected;
    setter((prev) => {
      if (multi) return { ...prev, [key]: !prev[key] };
      return { [key]: true };
    });
  }

  function moveKeysToSelected(keys: string[]) {
    if (!keys.length) return;
    onChange({
      ...selected,
      ...Object.fromEntries(keys.map((k) => [k, true])),
    });
    setHighlightAvailable({});
  }

  function moveKeysToAvailable(keys: string[]) {
    if (!keys.length) return;
    const next = { ...selected };
    for (const k of keys) delete next[k];
    onChange(next);
    setHighlightSelected({});
  }

  function renderList(
    list: PromoObjectItem[],
    side: 'available' | 'selected',
    highlights: Record<string, boolean>,
  ) {
    if (!list.length) {
      return (
        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
          {side === 'available' ? 'No available items' : 'No selected items'}
        </div>
      );
    }
    return (
      <ul className="h-full overflow-auto py-1">
        {list.map((o) => {
          const key = itemKey(o);
          const active = !!highlights[key];
          return (
            <li key={key}>
              <button
                type="button"
                className={cn(
                  'w-full px-3 py-2 text-left transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60',
                )}
                onClick={(e) => toggleHighlight(side, key, e.metaKey || e.ctrlKey || e.shiftKey)}
                onDoubleClick={() => {
                  if (side === 'available') moveKeysToSelected([key]);
                  else moveKeysToAvailable([key]);
                }}
              >
                <div className="truncate text-sm font-medium">{o.name}</div>
                <div
                  className={cn(
                    'mt-0.5 flex flex-wrap gap-1 text-[10px]',
                    active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  <span>{o.objectTypeName || o.objectType}</span>
                  <span>·</span>
                  <span>{o.conflictStatus || '—'}</span>
                  {o.hasDependencies && (
                    <Badge
                      variant={active ? 'secondary' : 'outline'}
                      className="h-4 px-1 text-[9px]"
                    >
                      deps
                    </Badge>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const highlightedAvailableKeys = Object.keys(highlightAvailable).filter((k) => highlightAvailable[k]);
  const highlightedSelectedKeys = Object.keys(highlightSelected).filter((k) => highlightSelected[k]);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
      <div className="flex min-h-[320px] flex-col rounded-md border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Available ({available.length})
        </div>
        <div className="min-h-0 flex-1">{renderList(available, 'available', highlightAvailable)}</div>
        <div className="border-t p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={availableQuery}
              onChange={(e) => setAvailableQuery(e.target.value)}
              placeholder="Search available…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Add all"
          disabled={!available.length}
          onClick={() => moveKeysToSelected(available.map(itemKey))}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Add selected"
          disabled={!highlightedAvailableKeys.length}
          onClick={() => moveKeysToSelected(highlightedAvailableKeys)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Remove selected"
          disabled={!highlightedSelectedKeys.length}
          onClick={() => moveKeysToAvailable(highlightedSelectedKeys)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Remove all"
          disabled={!chosen.length && !Object.values(selected).some(Boolean)}
          onClick={() => {
            const keys = items.filter((o) => selected[itemKey(o)]).map(itemKey);
            moveKeysToAvailable(keys);
          }}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-[320px] flex-col rounded-md border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selected ({chosen.length})
        </div>
        <div className="min-h-0 flex-1">{renderList(chosen, 'selected', highlightSelected)}</div>
        <div className="border-t p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={selectedQuery}
              onChange={(e) => setSelectedQuery(e.target.value)}
              placeholder="Search selected…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
