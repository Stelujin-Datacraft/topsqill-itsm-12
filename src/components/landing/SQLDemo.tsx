import React, { Suspense, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Remove the TableDemo import since we have a separate DataTablePreview component

const CodeMirror = React.lazy(() => import("@uiw/react-codemirror"));
import { sql as sqlLang } from "@codemirror/lang-sql";

const SAMPLE_QUERY = `-- Query your form submissions like a database
SELECT department, 
       COUNT(FIELD("satisfaction-field")) as total,
       AVG(FIELD("satisfaction-field")) as avg_score,
       MIN(FIELD("satisfaction-field")) as min_score,
       MAX(FIELD("satisfaction-field")) as max_score
FROM "form-uuid"
GROUP BY department
ORDER BY total DESC;`;

const rows = [
  { id: 1, department: "Sales", satisfaction: 4.7 },
  { id: 2, department: "Support", satisfaction: 4.1 },
  { id: 3, department: "Sales", satisfaction: 4.9 },
  { id: 4, department: "Engineering", satisfaction: 4.3 },
  { id: 5, department: "Support", satisfaction: 3.9 },
];

function computeAggregate() {
  const grouped: Record<string, { total: number; sum: number; min: number; max: number }> = {};
  for (const r of rows) {
    if (!grouped[r.department]) {
      grouped[r.department] = { total: 0, sum: 0, min: Infinity, max: -Infinity };
    }
    grouped[r.department].total += 1;
    grouped[r.department].sum += r.satisfaction;
    grouped[r.department].min = Math.min(grouped[r.department].min, r.satisfaction);
    grouped[r.department].max = Math.max(grouped[r.department].max, r.satisfaction);
  }
  return Object.entries(grouped).map(([department, v]) => ({
    department,
    total: v.total,
    avg_score: Number((v.sum / v.total).toFixed(2)),
    min_score: v.min,
    max_score: v.max,
  }));
}

export default function SQLDemo() {
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [mode, setMode] = useState<"raw" | "aggregate">("aggregate");
  const result = useMemo(() => (mode === "aggregate" ? computeAggregate() : rows), [mode]);

  return (
    <section aria-labelledby="sql-demo-heading" className="container mx-auto px-4">
      <Card>
        <CardHeader>
          <CardTitle id="sql-demo-heading">SQL editor for your forms</CardTitle>
          <CardDescription>Run SQL on form data with instant results and export-ready tables.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="min-h-64">
            <Suspense fallback={<div className="h-64 rounded-md border bg-muted" />}>
              <CodeMirror
                value={query}
                height="260px"
                extensions={[sqlLang()]}
                theme="dark"
                onChange={(val) => setQuery(val)}
              />
            </Suspense>
            <div className="mt-3 flex gap-3">
              <Button onClick={() => setMode("aggregate")}>Run</Button>
              <Button variant="outline" onClick={() => setMode((m) => (m === "raw" ? "aggregate" : "raw"))}>
                Toggle raw/aggregate
              </Button>
            </div>
          </div>
          <div>
            <div className="rounded border bg-background p-4">
              <h4 className="font-medium mb-3">Query Results</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(result[0] || {}).map(key => (
                        <th key={key} className="text-left p-2 font-medium">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="p-2">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
