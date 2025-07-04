
import React from 'react';
import { EnhancedReportAccessManager } from './EnhancedReportAccessManager';

interface ReportAccessManagerProps {
  reportId: string;
  reportName: string;
}

export function ReportAccessManager({ reportId, reportName }: ReportAccessManagerProps) {
  return <EnhancedReportAccessManager reportId={reportId} reportName={reportName} />;
}
