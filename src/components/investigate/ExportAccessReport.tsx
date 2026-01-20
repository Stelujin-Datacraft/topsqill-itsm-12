import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { InvestigateAccessData } from '@/hooks/useInvestigateAccess';
import { format } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportAccessReportProps {
  data: InvestigateAccessData;
  userName: string;
}

export function ExportAccessReport({ data, userName }: ExportAccessReportProps) {
  const [exporting, setExporting] = useState(false);

  const generateCSV = () => {
    const lines: string[] = [];
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    // Header
    lines.push(`Access Report for: ${userName}`);
    lines.push(`Generated: ${timestamp}`);
    lines.push('');

    // Profile Section
    if (data.profile) {
      lines.push('=== USER PROFILE ===');
      lines.push(`Email,${data.profile.email}`);
      lines.push(`Name,${data.profile.first_name || ''} ${data.profile.last_name || ''}`);
      lines.push(`Role,${data.profile.role}`);
      lines.push(`Status,${data.profile.status}`);
      lines.push(`Created,${format(new Date(data.profile.created_at), 'yyyy-MM-dd')}`);
      lines.push('');
    }

    // Roles Section
    lines.push('=== ROLE ASSIGNMENTS ===');
    lines.push('Role Name,Description,Top Level Access,Assigned At');
    data.roleAssignments.forEach(r => {
      lines.push(`"${r.role.name}","${r.role.description || ''}","${r.role.top_level_access}","${format(new Date(r.assigned_at), 'yyyy-MM-dd')}"`);
    });
    if (data.roleAssignments.length === 0) lines.push('No roles assigned');
    lines.push('');

    // Groups Section
    lines.push('=== GROUP MEMBERSHIPS ===');
    lines.push('Group Name,Added At');
    data.groupMemberships.forEach(g => {
      lines.push(`"${g.group.name}","${format(new Date(g.added_at), 'yyyy-MM-dd')}"`);
    });
    if (data.groupMemberships.length === 0) lines.push('No groups assigned');
    lines.push('');

    // Project Access Section
    lines.push('=== PROJECT ACCESS ===');
    lines.push('Project Name,Role,Assigned At');
    data.projectAccess.forEach(p => {
      lines.push(`"${p.project_name}","${p.role}","${format(new Date(p.assigned_at), 'yyyy-MM-dd')}"`);
    });
    if (data.projectAccess.length === 0) lines.push('No project access');
    lines.push('');

    // Top Level Permissions Section
    lines.push('=== TOP LEVEL PERMISSIONS ===');
    lines.push('Project,Entity Type,Create,Read,Update,Delete');
    data.topLevelPermissions.forEach(p => {
      lines.push(`"${p.project_name || 'Unknown'}","${p.entity_type}",${p.can_create},${p.can_read},${p.can_update},${p.can_delete}`);
    });
    if (data.topLevelPermissions.length === 0) lines.push('No top-level permissions');
    lines.push('');

    // Resource Permissions Section
    lines.push('=== RESOURCE PERMISSIONS ===');
    lines.push('Resource Type,Resource Name,Permission,Via Role');
    data.resourcePermissions.forEach(p => {
      lines.push(`"${p.resource_type}","${p.resource_name}","${p.permission_type}","${p.role_name}"`);
    });
    if (data.resourcePermissions.length === 0) lines.push('No resource-specific permissions');
    lines.push('');

    // Security Settings Section
    if (data.securitySettings) {
      lines.push('=== SECURITY SETTINGS ===');
      lines.push(`MFA Required,${data.securitySettings.mfa_required || false}`);
      lines.push(`Max Concurrent Sessions,${data.securitySettings.max_concurrent_sessions || 'Unlimited'}`);
      lines.push(`Session Timeout (minutes),${data.securitySettings.session_timeout_minutes || 'Not set'}`);
      lines.push(`Access Hours,${data.securitySettings.access_start_time || 'N/A'} - ${data.securitySettings.access_end_time || 'N/A'}`);
      lines.push(`Allowed Days,${data.securitySettings.allowed_days?.join(', ') || 'All days'}`);
      lines.push(`Security Template,${data.securitySettings.security_template_name || 'None'}`);
      lines.push(`Using Template Settings,${data.securitySettings.use_template_settings || false}`);
      lines.push(`Account Locked Until,${data.securitySettings.account_locked_until || 'Not locked'}`);
      lines.push(`Last Login,${data.securitySettings.last_login ? format(new Date(data.securitySettings.last_login), 'yyyy-MM-dd HH:mm') : 'Never'}`);
      lines.push(`Last Password Change,${data.securitySettings.last_password_change ? format(new Date(data.securitySettings.last_password_change), 'yyyy-MM-dd') : 'Never'}`);
      lines.push('');
    }

    // Active Sessions Section
    lines.push('=== ACTIVE SESSIONS ===');
    lines.push('IP Address,User Agent,Created,Last Activity');
    data.activeSessions.forEach(s => {
      lines.push(`"${s.ip_address || 'Unknown'}","${s.user_agent || 'Unknown'}","${format(new Date(s.created_at), 'yyyy-MM-dd HH:mm')}","${format(new Date(s.last_activity), 'yyyy-MM-dd HH:mm')}"`);
    });
    if (data.activeSessions.length === 0) lines.push('No active sessions');

    return lines.join('\n');
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `access-report-${userName.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Access report exported to CSV');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Access Report', 14, yPos);
      yPos += 10;

      // User Info
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text(`User: ${userName}`, 14, yPos);
      yPos += 6;
      doc.text(`Generated: ${timestamp}`, 14, yPos);
      yPos += 10;

      // Profile Section
      if (data.profile) {
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('User Profile', 14, yPos);
        yPos += 6;

        autoTable(doc, {
          startY: yPos,
          head: [['Field', 'Value']],
          body: [
            ['Email', data.profile.email],
            ['Name', `${data.profile.first_name || ''} ${data.profile.last_name || ''}`.trim() || 'N/A'],
            ['System Role', data.profile.role],
            ['Status', data.profile.status],
            ['Created', format(new Date(data.profile.created_at), 'yyyy-MM-dd')],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Roles Section
      doc.setFontSize(14);
      doc.text('Role Assignments', 14, yPos);
      yPos += 6;

      if (data.roleAssignments.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Role Name', 'Top Level Access', 'Assigned']],
          body: data.roleAssignments.map(r => [
            r.role.name,
            r.role.top_level_access,
            format(new Date(r.assigned_at), 'yyyy-MM-dd'),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text('No roles assigned', 14, yPos);
        yPos += 10;
      }

      // Check page break
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Project Access Section
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Project Access', 14, yPos);
      yPos += 6;

      if (data.projectAccess.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Project', 'Role', 'Assigned']],
          body: data.projectAccess.map(p => [
            p.project_name,
            p.role,
            format(new Date(p.assigned_at), 'yyyy-MM-dd'),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text('No project access', 14, yPos);
        yPos += 10;
      }

      // Check page break
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Security Settings Section
      if (data.securitySettings) {
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Security Settings', 14, yPos);
        yPos += 6;

        autoTable(doc, {
          startY: yPos,
          head: [['Setting', 'Value']],
          body: [
            ['MFA Required', data.securitySettings.mfa_required ? 'Yes' : 'No'],
            ['Max Concurrent Sessions', String(data.securitySettings.max_concurrent_sessions || 'Unlimited')],
            ['Session Timeout', data.securitySettings.session_timeout_minutes ? `${data.securitySettings.session_timeout_minutes} min` : 'Not set'],
            ['Security Template', data.securitySettings.security_template_name || 'None'],
            ['Last Login', data.securitySettings.last_login ? format(new Date(data.securitySettings.last_login), 'yyyy-MM-dd HH:mm') : 'Never'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Active Sessions Section
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text(`Active Sessions (${data.activeSessions.length})`, 14, yPos);
      yPos += 6;

      if (data.activeSessions.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['IP Address', 'Last Activity']],
          body: data.activeSessions.map(s => [
            s.ip_address || 'Unknown',
            format(new Date(s.last_activity), 'yyyy-MM-dd HH:mm'),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text('No active sessions', 14, yPos);
      }

      // Save
      doc.save(`access-report-${userName.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Access report exported to PDF');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting || !data.profile}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export Report'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
