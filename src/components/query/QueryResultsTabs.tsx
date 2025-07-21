import React, { useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertCircle, Download, ArrowUpDown, ArrowUp, ArrowDown, Clock, BarChart3, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QueryResultsTabsProps {
  data: any[] | null;
  error: string | null;
  isLoading: boolean;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  executionTime?: number;
  queryStats?: {
    rowsAffected: number;
    rowsScanned: number;
    bytesProcessed: number;
  };
}

type SortDirection = 'asc' | 'desc' | null;

export const QueryResultsTabs: React.FC<QueryResultsTabsProps> = ({
  data,
  error,
  isLoading,
  totalCount = 0,
  currentPage = 1,
  pageSize = 50,
  onPageChange,
  executionTime = 0,
  queryStats
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentDisplayPage, setCurrentDisplayPage] = useState(1);
  const resultsPerPage = 100;
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / pageSize);
  
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
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

  const handleCopyCell = (value: any) => {
    const textValue = value !== null && value !== undefined ? String(value) : '';
    navigator.clipboard.writeText(textValue);
    toast({
      title: "Copied to clipboard",
      description: "Cell content copied successfully",
    });
  };

  const getSortedData = () => {
    if (!data || !sortColumn || !sortDirection) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  };

  const getPaginatedData = () => {
    const sortedData = getSortedData();
    if (!sortedData) return [];
    
    const startIndex = (currentDisplayPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    return sortedData.slice(startIndex, endIndex);
  };

  const displayTotalPages = data ? Math.ceil(data.length / resultsPerPage) : 0;

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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Query Error:</span> {error}
          </AlertDescription>
        </Alert>
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

  const columns = Object.keys(data[0]);
  const paginatedData = getPaginatedData();

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
            <span className="text-sm text-muted-foreground">
              {data.length} {data.length === 1 ? 'result' : 'results'}
              {totalCount > data.length && ` of ${totalCount}`}
            </span>
            <Button onClick={handleExportCSV} size="sm" variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="results" className="h-full m-0 p-4">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden border rounded-lg">
                <ScrollArea className="h-full">
                  <div ref={tableRef} className="min-w-full">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow className="border-b-2">
                           {columns.map(column => (
                             <TableHead 
                               key={column} 
                               className="font-semibold bg-muted hover:bg-muted/80 cursor-pointer border border-gray-300"
                               style={{ maxWidth: '150px', minWidth: '100px' }}
                               onClick={() => handleSort(column)}
                             >
                               <div className="flex items-center gap-2">
                                 <span className="truncate">
                                   {column.startsWith('"') && column.endsWith('"') ? column.slice(1, -1) : column}
                                 </span>
                                 <div className="flex flex-col">
                                   {sortColumn === column ? (
                                     sortDirection === 'asc' ? (
                                       <ArrowUp className="h-3 w-3" />
                                     ) : sortDirection === 'desc' ? (
                                       <ArrowDown className="h-3 w-3" />
                                     ) : (
                                       <ArrowUpDown className="h-3 w-3 opacity-50" />
                                     )
                                   ) : (
                                     <ArrowUpDown className="h-3 w-3 opacity-50" />
                                   )}
                                 </div>
                               </div>
                             </TableHead>
                           ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map((row, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            {columns.map(column => (
                              <ContextMenu key={column}>
                                 <ContextMenuTrigger>
                                   <TableCell 
                                     className="border border-gray-300 font-mono text-sm cursor-default"
                                     style={{ maxWidth: '150px' }}
                                   >
                                     <div className="truncate" title={String(row[column] || '')}>
                                       {row[column] !== null && row[column] !== undefined ? String(row[column]) : '-'}
                                     </div>
                                   </TableCell>
                                 </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={() => handleCopyCell(row[column])}>
                                    Copy Cell Content
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {displayTotalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => currentDisplayPage > 1 && setCurrentDisplayPage(currentDisplayPage - 1)}
                          className={currentDisplayPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, displayTotalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink 
                              onClick={() => setCurrentDisplayPage(pageNum)}
                              isActive={currentDisplayPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => currentDisplayPage < displayTotalPages && setCurrentDisplayPage(currentDisplayPage + 1)}
                          className={currentDisplayPage >= displayTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
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
                      <span className="font-mono">{sortColumn ? 'Yes' : 'No'}</span>
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