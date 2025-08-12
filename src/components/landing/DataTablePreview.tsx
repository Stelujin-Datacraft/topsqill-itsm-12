import React from "react";

type Row = Record<string, string | number | null | undefined>;

export function TableDemo({ rows }: { rows: Row[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="border rounded-md p-4 text-sm text-muted-foreground">
        No data to display.
      </div>
    );
  }
  const columns = Object.keys(rows[0]);
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left px-3 py-2 font-medium text-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 text-muted-foreground">
                    {row[c] as any}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
