import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { request } from '@/services/api/apiClient';
import { MODULES, MODULE_KEYS } from '@/lib/entitlements/modules';
import {
  PACKAGE_LICENSE_OPTIONS,
  downloadJson,
  exportFormErrors,
  packageKeyFromName,
  type ExportFormValues,
  type PackageLicenseOption,
} from '@/lib/packages/exportForm';

interface ExportResult {
  fileName: string;
  package: unknown;
  summary: { forms: number; fields: number; workflows: number; reports: number; signed: number };
  warnings: string[];
}

export function ExportPackageDialog({
  open,
  onOpenChange,
  solution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solution: { id: string; name: string; description?: string | null };
}) {
  const [values, setValues] = useState<ExportFormValues>(() => ({
    key: packageKeyFromName(solution.name),
    name: solution.name,
    version: '1.0.0',
    description: solution.description || '',
    license: 'private',
    requiresModules: [],
  }));
  const [keyEdited, setKeyEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const errors = exportFormErrors(values);
  const set = (patch: Partial<ExportFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  const close = (next: boolean) => {
    if (!next) {
      setResult(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const exportPackage = async () => {
    setBusy(true);
    setError(null);
    const { data, error: requestError } = await request<ExportResult>('/packages/export', {
      method: 'POST',
      body: JSON.stringify({ solutionId: solution.id, ...values, version: values.version.trim() }),
    });
    setBusy(false);
    if (requestError || !data) {
      setError(requestError?.message || 'Export failed');
      return;
    }
    downloadJson(data.fileName, data.package);
    setResult(data);
    toast.success(`Downloaded ${data.fileName}`);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-primary" /> Export as package</DialogTitle>
          <DialogDescription>
            Packages contain the solution's forms, fields, workflows and reports. Records and personal data are never included.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <div className="font-medium">{result.fileName}</div>
                <div className="text-muted-foreground">
                  {result.summary.forms} form(s), {result.summary.fields} field(s), {result.summary.workflows} workflow(s), {result.summary.reports} report(s).{' '}
                  {result.summary.signed ? 'Signed.' : 'Not signed: this server has no signing key, so the package can only be installed where unsigned packages are allowed.'}
                </div>
              </div>
            </div>
            {result.warnings.length > 0 && (
              <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" /> Check before sharing</div>
                <ul className="list-disc space-y-0.5 ps-5 text-muted-foreground">
                  {result.warnings.map((warning) => <li key={warning}>{warning.replace(/^(\w+):[0-9a-f-]+ /, '$1 ')}</li>)}
                </ul>
                <p className="text-xs text-muted-foreground">Add the referenced forms to this solution and export again so the package works on its own.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => downloadJson(result.fileName, result.package)}><Download className="me-1.5 h-4 w-4" /> Download again</Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Package name</Label>
              <Input
                value={values.name}
                onChange={(e) => set({ name: e.target.value, ...(keyEdited ? {} : { key: packageKeyFromName(e.target.value) }) })}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Package key</Label>
                <Input value={values.key} onChange={(e) => { setKeyEdited(true); set({ key: e.target.value.toLowerCase() }); }} className="font-mono text-sm" />
                {errors.key ? <p className="text-xs text-destructive">{errors.key}</p> : <p className="text-xs text-muted-foreground">Keep the same key for every version.</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Version</Label>
                <Input value={values.version} onChange={(e) => set({ version: e.target.value })} className="font-mono text-sm" />
                {errors.version && <p className="text-xs text-destructive">{errors.version}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={values.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Availability</Label>
              <Select value={values.license} onValueChange={(value) => set({ license: value as PackageLicenseOption })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PACKAGE_LICENSE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Requires paid modules</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values.requiresModules.includes(key)}
                      onCheckedChange={(checked) =>
                        set({ requiresModules: checked ? [...values.requiresModules, key] : values.requiresModules.filter((m) => m !== key) })
                      }
                    />
                    {MODULES[key].name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Organisations without these modules cannot install the package.</p>
            </div>
            {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">Export failed: {error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={exportPackage} disabled={busy || Object.keys(errors).length > 0}>
                <Download className="me-1.5 h-4 w-4" /> {busy ? 'Exporting…' : 'Export'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
