import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface ParameterTableProps {
  parameters: Parameter[];
  title?: string;
}

export function ParameterTable({ parameters, title }: ParameterTableProps) {
  if (parameters.length === 0) return null;

  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Parameter</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[100px]">Required</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((param) => (
              <TableRow key={param.name}>
                <TableCell className="font-mono text-sm font-medium">
                  {param.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {param.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {param.required ? (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {param.description}
                  {param.default && (
                    <span className="block text-xs mt-1">
                      Default: <code className="bg-muted px-1 rounded">{param.default}</code>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
