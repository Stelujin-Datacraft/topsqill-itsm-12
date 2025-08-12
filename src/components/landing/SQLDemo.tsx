import React, { Suspense, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableDemo } from "./DataTablePreview";

const CodeMirror = React.lazy(() => import("@uiw/react-codemirror"));
import { sql as sqlLang } from "@codemirror/lang-sql";

const SAMPLE_QUERY = `-- Query your form submissions like a database\nSELECT department, COUNT(*) as total, AVG(satisfaction) as avg_score\nFROM submissions\nGROUP BY department\nORDER BY total DESC;`;

const rows = [
  { id: 1, department: "Sales", satisfaction: 4.7 },
  { id: 2, department: "Support", satisfaction: 4.1 },
  { id: 3, department: "Sales", satisfaction: 4.9 },
  { id: 4, department: "Engineering", satisfaction: 4.3 },
  { id: 5, department: "Support", satisfaction: 3.9 },
];

function computeAggregate() {
  const grouped: Record<string, { total: number; sum: number }> = {};
  for (const r of rows) {
    if (!grouped[r.department]) grouped[r.department] = { total: 0, sum: 0 };
    grouped[r.department].total += 1;
    grouped[r.department].sum += r.satisfaction;
  }
  return Object.entries(grouped).map(([department, v]) => ({
    department,
    total: v.total,
    avg_score: Number((v.sum / v.total).toFixed(2)),
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
            <TableDemo rows={result} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
