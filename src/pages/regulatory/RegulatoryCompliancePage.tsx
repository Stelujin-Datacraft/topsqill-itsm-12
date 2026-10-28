import { useState } from 'react';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProject } from '@/contexts/ProjectContext';
import { regulatoryApi } from '@/lib/regulatory/api';

export default function RegulatoryCompliancePage() {
  const { currentProject } = useProject();
  const [message, setMessage] = useState('Provision the three forms, then import a source. Draft requirements stay unapproved.');
  const [busy, setBusy] = useState(false);

  const run = async (label: string, work: () => Promise<unknown>) => {
    if (!currentProject?.id) return;
    setBusy(true);
    try {
      const result = await work();
      setMessage(`${label}\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (!currentProject) {
    return <div className="p-6 text-sm text-muted-foreground">Select a project before opening the regulatory register.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Regulatory compliance</h1>
          <p className="text-sm text-muted-foreground">
            Standards, clauses, and draft requirements use the existing form and cross-reference records. A catalog entry is not a decision that the regulation applies, and it is not a compliance conclusion.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run('Provisioned', () => regulatoryApi.provision(currentProject.id))}>Provision forms</Button>
        <Button disabled={busy} variant="outline" onClick={() => run('GDPR import', () => regulatoryApi.importInstrument(currentProject.id, 'gdpr'))}>Import GDPR</Button>
        <Button disabled={busy} variant="outline" onClick={() => run('DPDP import', () => regulatoryApi.importInstrument(currentProject.id, 'dpdp'))}>Import DPDP Act</Button>
        <Button disabled={busy} variant="outline" onClick={() => run('Quality findings', () => regulatoryApi.quality(currentProject.id))}>Quality check</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Result</CardTitle></CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap text-xs">{message}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
