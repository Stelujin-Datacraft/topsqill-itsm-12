import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Group, Calculator } from 'lucide-react';
import { AggregationType } from '@/hooks/useQueryResultFilters';

interface QueryResultFiltersProps {
  columns: string[];
  sortColumn: string | null;
  setSortColumn: (value: string | null) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (value: 'asc' | 'desc') => void;
  filterColumn: string | null;
  setFilterColumn: (value: string | null) => void;
  filterValue: string;
  setFilterValue: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  groupByColumn?: string | null;
  setGroupByColumn?: (value: string | null) => void;
  aggregateColumn?: string | null;
  setAggregateColumn?: (value: string | null) => void;
  aggregationType?: AggregationType;
  setAggregationType?: (value: AggregationType) => void;
}

const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

export function QueryResultFilters({
  columns,
  sortColumn,
  setSortColumn,
  sortDirection,
  setSortDirection,
  filterColumn,
  setFilterColumn,
  filterValue,
  setFilterValue,
  filteredCount,
  totalCount,
  groupByColumn,
  setGroupByColumn,
  aggregateColumn,
  setAggregateColumn,
  aggregationType = 'count',
  setAggregationType,
}: QueryResultFiltersProps) {
  const clearFilters = () => {
    setFilterColumn(null);
    setFilterValue('');
    setSortColumn(null);
    setSortDirection('asc');
    setGroupByColumn?.(null);
    setAggregateColumn?.(null);
    setAggregationType?.('count');
  };

  const hasActiveFilters = filterColumn || sortColumn || groupByColumn;

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-2 mb-4 p-3 bg-muted/50 rounded-lg">
      {/* Row 1: Filter and Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterColumn || ''} onValueChange={(val) => setFilterColumn(val || null)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              {columns.map(col => (
                <SelectItem key={col} value={col}>{col}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterColumn && (
            <Input
              placeholder="Filter value..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-[120px] h-8 text-xs"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortColumn || ''} onValueChange={(val) => { setSortColumn(val || null); setSortDirection('asc'); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {columns.map(col => (
                <SelectItem key={col} value={col}>{col}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sortColumn && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              <SortIcon column={sortColumn} />
            </Button>
          )}
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredCount} of {totalCount} records
        </span>
      </div>

      {/* Row 2: Group By and Aggregation */}
      {setGroupByColumn && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Group className="h-4 w-4 text-muted-foreground" />
            <Select value={groupByColumn || ''} onValueChange={(val) => setGroupByColumn(val || null)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Group by..." />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {groupByColumn && setAggregationType && (
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <Select value={aggregationType} onValueChange={(val) => setAggregationType(val as AggregationType)}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {aggregationType !== 'count' && setAggregateColumn && (
                <Select value={aggregateColumn || ''} onValueChange={(val) => setAggregateColumn(val || null)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 ml-auto" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Clear All
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
