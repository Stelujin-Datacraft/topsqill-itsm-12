import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';

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
}

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
}: QueryResultFiltersProps) {
  const clearFilters = () => {
    setFilterColumn(null);
    setFilterValue('');
    setSortColumn(null);
    setSortDirection('asc');
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterColumn || ''} onValueChange={(val) => setFilterColumn(val || null)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
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
            className="w-[140px] h-8 text-xs"
          />
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sortColumn || ''} onValueChange={(val) => { setSortColumn(val || null); setSortDirection('asc'); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
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

      {(filterColumn || sortColumn) && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
      
      <span className="text-xs text-muted-foreground ml-auto">
        {filteredCount} of {totalCount} records
      </span>
    </div>
  );
}
