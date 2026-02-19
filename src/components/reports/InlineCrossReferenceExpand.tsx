import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { SubmissionRefDisplay } from '@/components/SubmissionRefDisplay';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface InlineCrossReferenceExpandProps {
  targetFormId: string;
  linkedRefIds: string[];
  tableDisplayFields?: string[];
  colSpan: number;
}

interface LinkedRecord {
  id: string;
  submission_ref_id: string;
  submission_data: Record<string, any>;
}

interface DisplayField {
  id: string;
  label: string;
}

export function InlineCrossReferenceExpand({
  targetFormId,
  linkedRefIds,
  tableDisplayFields = [],
  colSpan,
}: InlineCrossReferenceExpandProps) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<LinkedRecord[]>([]);
  const [displayFieldsMeta, setDisplayFieldsMeta] = useState<DisplayField[]>([]);

  useEffect(() => {
    if (!targetFormId || linkedRefIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [subsRes, fieldsRes] = await Promise.all([
          supabase
            .from('form_submissions')
            .select('id, submission_ref_id, submission_data')
            .eq('form_id', targetFormId)
            .in('submission_ref_id', linkedRefIds),
          tableDisplayFields.length > 0
            ? supabase
                .from('form_fields')
                .select('id, label')
                .in('id', tableDisplayFields)
            : Promise.resolve({ data: [] }),
        ]);

        setRecords((subsRes.data || []) as LinkedRecord[]);
        setDisplayFieldsMeta((fieldsRes.data || []) as DisplayField[]);
      } catch (err) {
        console.error('InlineCrossReferenceExpand: Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [targetFormId, linkedRefIds.join(','), tableDisplayFields.join(',')]);

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-2 px-8 bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading linked records...
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (records.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-2 px-8 bg-muted/30">
          <span className="text-xs text-muted-foreground italic">No linked records found</span>
        </TableCell>
      </TableRow>
    );
  }

  // Build ordered display fields
  const orderedFields = tableDisplayFields.length > 0
    ? tableDisplayFields.map(fId => {
        const meta = displayFieldsMeta.find(m => m.id === fId);
        return { id: fId, label: meta?.label || fId };
      })
    : [];

  const formatValue = (val: any): string => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'object') {
      if (Array.isArray(val)) return val.join(', ');
      return JSON.stringify(val);
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-1 px-4 bg-muted/20 border-l-4 border-accent/40">
        <div className="ml-4">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-b border-accent/20">
                <TableHead className="h-7 text-xs font-semibold text-accent px-2">ID</TableHead>
                {orderedFields.map(f => (
                  <TableHead key={f.id} className="h-7 text-xs font-semibold text-accent px-2">
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(rec => (
                <TableRow key={rec.id} className="border-b border-muted/40 hover:bg-muted/30">
                  <TableCell className="py-1 px-2">
                    <SubmissionRefDisplay
                      submissionRefId={rec.submission_ref_id}
                      submissionId={rec.id}
                      variant="compact"
                    />
                  </TableCell>
                  {orderedFields.map(f => (
                    <TableCell key={f.id} className="py-1 px-2">
                      {formatValue(rec.submission_data?.[f.id])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TableCell>
    </TableRow>
  );
}
