import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { flexRender, Row, Table } from '@tanstack/react-table';

interface VirtualizedTableBodyProps<TData> {
  table: Table<TData>;
  rowHeight?: number;
  overscan?: number;
  containerHeight?: number;
}

/**
 * Virtualized table body component for TanStack Table
 * Only renders visible rows for optimal performance with large datasets
 */
export function VirtualizedTableBody<TData>({
  table,
  rowHeight = 40,
  overscan = 10,
  containerHeight = 500,
}: VirtualizedTableBodyProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rows = table.getRowModel().rows;
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Calculate padding to maintain scroll position
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0;

  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td 
            colSpan={table.getAllColumns().length} 
            className="text-center py-8 text-muted-foreground"
          >
            No data available
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: containerHeight, contain: 'strict' }}
    >
      <table className="w-full border-collapse min-w-full">
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
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: paddingTop }} colSpan={table.getAllColumns().length} />
            </tr>
          )}
          {virtualRows.map(virtualRow => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                className="border-b border-border hover:bg-muted/30 transition-colors"
                style={{ height: rowHeight }}
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
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: paddingBottom }} colSpan={table.getAllColumns().length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Hook for virtualizing any list
 */
export function useVirtualList<T>({
  items,
  parentRef,
  itemHeight = 40,
  overscan = 5,
}: {
  items: T[];
  parentRef: React.RefObject<HTMLElement>;
  itemHeight?: number;
  overscan?: number;
}) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  
  return {
    virtualizer,
    virtualItems,
    totalSize: virtualizer.getTotalSize(),
    getVirtualItem: (index: number) => items[index],
  };
}
