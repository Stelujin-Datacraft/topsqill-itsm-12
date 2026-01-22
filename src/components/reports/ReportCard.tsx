import React, { memo } from 'react';
import { Report } from '@/types/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Eye, Edit, Trash2 } from 'lucide-react';
import { ShareLinkButton } from '@/components/shared/ShareLinkButton';
import { format } from 'date-fns';

interface ReportCardProps {
  report: Report;
  editButtonState: { disabled: boolean; tooltip: string };
  deleteButtonState: { disabled: boolean; tooltip: string };
  loading: boolean;
  onView: (report: Report) => void;
  onEdit: (report: Report) => void;
  onDelete: (report: Report) => void;
}

export const ReportCard = memo(function ReportCard({
  report,
  editButtonState,
  deleteButtonState,
  loading,
  onView,
  onEdit,
  onDelete,
}: ReportCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{report.name}</CardTitle>
            {report.description && <CardDescription>{report.description}</CardDescription>}
          </div>
          <div className="flex space-x-1">
            <ShareLinkButton 
              assetType="report" 
              assetId={report.id} 
              assetName={report.name} 
            />
            <Button variant="ghost" size="sm" onClick={() => onView(report)} title="View Report">
              <Eye className="h-4 w-4" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(report)} disabled={editButtonState.disabled}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{editButtonState.disabled ? editButtonState.tooltip : "Edit Report"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(report)} disabled={deleteButtonState.disabled || loading}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{deleteButtonState.disabled ? deleteButtonState.tooltip : "Delete Report"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(report.created_at), 'MMM d, yyyy')}</span>
          </div>
          {report.is_public && <Badge variant="secondary">Public</Badge>}
        </div>
      </CardContent>
    </Card>
  );
});
