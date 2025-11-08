import React, { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnDef,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Clock, 
  BarChart3, 
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExportMenu } from './ExportMenu';

interface QueryResultsTableProps {
  data: any[] | null;
  error: string | null;
  isLoading: boolean;
  totalCount?: number;
  executionTime?: number;
  queryStats?: {
    rowsAffected: number;
    rowsScanned: number;
    bytesProcessed: number;
  };
}

export const QueryResultsTable: React.FC<QueryResultsTableProps> = ({
  data,
  error,
  isLoading,
  totalCount = 0,
  executionTime = 0,
  queryStats
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();

  const columnHelper = createColumnHelper<any>();

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || data.length === 0) return [];
    
    return Object.keys(data[0]).map((key) => 
      columnHelper.accessor(key, {
        header: ({ column }) => {
          const displayName = key.startsWith('"') && key.endsWith('"') ? key.slice(1, -1) : key;
          return (
            <div className="space-y-2">
              <div 
                className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 font-semibold text-sm"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                <span className="truncate">{displayName}</span>
                <div className="flex flex-col">
                  {column.getIsSorted() === 'asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : column.getIsSorted() === 'desc' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </div>
              </div>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Filter..."
                    value={(column.getFilterValue() as string) ?? ''}
                    onChange={(e) => column.setFilterValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
              </div>
            </div>
          );
        },
        cell: ({ getValue }) => {
          const value = getValue();
          const displayValue = value !== null && value !== undefined ? String(value) : '-';
          
          return (
            <ContextMenu>
              <ContextMenuTrigger>
                <div 
                  className="py-2 px-3 font-mono text-sm cursor-default truncate"
                  title={displayValue}
                >
                  {displayValue}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleCopyCell(value)}>
                  Copy Cell Content
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        },
        size: 150,
        minSize: 100,
        maxSize: 200,
      })
    );
  }, [data]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const handleCopyCell = (value: any) => {
    const textValue = value !== null && value !== undefined ? String(value) : '';
    navigator.clipboard.writeText(textValue);
    toast({
      title: "Copied to clipboard",
      description: "Cell content copied successfully",
    });
  };

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Query Results</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Executing query...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Query Results</h3>
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <Info className="h-4 w-4" />
            <span className="font-medium">Query Error:</span>
          </div>
          <div className="mt-2 text-sm text-destructive/80">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Query Results</h3>
        <div className="text-center py-8 text-muted-foreground">
          Execute a query to see results here
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Query Results</h3>
        <div className="text-center py-8 text-muted-foreground">
          No results found for your query
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="results" className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Query Results</h3>
            <TabsList className="grid w-auto grid-cols-3">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="execution">Execution</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {data.length} {data.length === 1 ? 'row' : 'rows'}
              {totalCount > data.length && ` of ${totalCount}`}
            </Badge>
            <ExportMenu data={data} />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="results" className="h-full m-0 p-4">
            <div className="h-full flex flex-col">
              {/* Table Container with horizontal scroll only */}
              <div className="flex-1 overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto overflow-y-auto h-full">
                  <table className="w-full border-collapse min-w-full">
                    {/* Table Header */}
                    <thead className="sticky top-0 bg-muted z-10">
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="border-b border-border">
                          {headerGroup.headers.map(header => (
                            <th
                              key={header.id}
                              className="border-r border-border bg-muted hover:bg-muted/80 transition-colors"
                              style={{ 
                                width: header.getSize(),
                                maxWidth: '150px',
                                minWidth: '100px'
                              }}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    
                    {/* Table Body */}
                    <tbody>
                      {table.getRowModel().rows.map(row => (
                        <tr 
                          key={row.id} 
                          className="border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          {row.getVisibleCells().map(cell => (
                            <td
                              key={cell.id}
                              className="border-r border-border"
                              style={{ 
                                width: cell.column.getSize(),
                                maxWidth: '150px'
                              }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                    {Math.min(
                      (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                      table.getFilteredRowModel().rows.length
                    )}{' '}
                    of {table.getFilteredRowModel().rows.length} entries
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-muted-foreground px-2">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="execution" className="h-full m-0 p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Execution Time</span>
                  </div>
                  <div className="text-2xl font-bold">{executionTime}ms</div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Rows Returned</span>
                  </div>
                  <div className="text-2xl font-bold">{data.length}</div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Status</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Success
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="h-full m-0 p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Query Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rows Affected:</span>
                      <span className="font-mono">{queryStats?.rowsAffected || data.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rows Scanned:</span>
                      <span className="font-mono">{queryStats?.rowsScanned || data.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Bytes Processed:</span>
                      <span className="font-mono">{queryStats?.bytesProcessed || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Result Set Info</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Columns:</span>
                      <span className="font-mono">{columns.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Data Types:</span>
                      <span className="font-mono">Mixed</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Sorted:</span>
                      <span className="font-mono">{sorting.length > 0 ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};