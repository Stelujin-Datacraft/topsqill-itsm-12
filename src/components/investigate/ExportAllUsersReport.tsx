import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

export function ExportAllUsersReport() {
  const [exporting, setExporting] = useState(false);

  const fetchAllUsersData = async () => {
    // Fetch all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('email');

    if (profilesError) throw profilesError;

    // Fetch role assignments
    const { data: roleAssignments, error: rolesError } = await supabase
      .from('user_role_assignments')
      .select(`
        user_id,
        assigned_at,
        roles (
          id,
          name,
          top_level_access
        )
      `);

    if (rolesError) throw rolesError;

    // Fetch group memberships
    const { data: groupMemberships, error: groupsError } = await supabase
      .from('group_memberships')
      .select(`
        member_id,
        added_at,
        groups (
          id,
          name
        )
      `)
      .eq('member_type', 'user');

    if (groupsError) throw groupsError;

    // Fetch project access
    const { data: projectAccess, error: projectsError } = await supabase
      .from('project_users')
      .select(`
        user_id,
        role,
        assigned_at,
        projects (
          id,
          name
        )
      `);

    if (projectsError) throw projectsError;

    return {
      profiles: profiles || [],
      roleAssignments: roleAssignments || [],
      groupMemberships: groupMemberships || [],
      projectAccess: projectAccess || []
    };
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const data = await fetchAllUsersData();
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      const lines: string[] = [];

      // Header
      lines.push('All Users Access Report');
      lines.push(`Generated: ${timestamp}`);
      lines.push(`Total Users: ${data.profiles.length}`);
      lines.push('');

      // Users Summary
      lines.push('=== USERS SUMMARY ===');
      lines.push('Email,Name,System Role,Status,Created,Roles,Groups,Projects');
      
      data.profiles.forEach(profile => {
        const userRoles = data.roleAssignments
          .filter((r: any) => r.user_id === profile.id)
          .map((r: any) => r.roles?.name || 'Unknown')
          .join('; ');
        
        const userGroups = data.groupMemberships
          .filter((g: any) => g.member_id === profile.id)
          .map((g: any) => g.groups?.name || 'Unknown')
          .join('; ');
        
        const userProjects = data.projectAccess
          .filter((p: any) => p.user_id === profile.id)
          .map((p: any) => `${p.projects?.name || 'Unknown'} (${p.role})`)
          .join('; ');

        lines.push([
          `"${profile.email}"`,
          `"${(profile.first_name || '') + ' ' + (profile.last_name || '')}".trim()`,
          profile.role,
          profile.status,
          format(new Date(profile.created_at), 'yyyy-MM-dd'),
          `"${userRoles || 'None'}"`,
          `"${userGroups || 'None'}"`,
          `"${userProjects || 'None'}"`
        ].join(','));
      });

      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-users-access-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('All users report exported to CSV');
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
      const data = await fetchAllUsersData();
      const doc = new jsPDF({ orientation: 'landscape' });
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('All Users Access Report', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Generated: ${timestamp} | Total Users: ${data.profiles.length}`, 14, yPos);
      yPos += 12;

      // Users table
      const tableData = data.profiles.map(profile => {
        const userRoles = data.roleAssignments
          .filter((r: any) => r.user_id === profile.id)
          .map((r: any) => r.roles?.name || 'Unknown')
          .join(', ');
        
        const userGroups = data.groupMemberships
          .filter((g: any) => g.member_id === profile.id)
          .map((g: any) => g.groups?.name || 'Unknown')
          .join(', ');
        
        const projectCount = data.projectAccess
          .filter((p: any) => p.user_id === profile.id).length;

        return [
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '-',
          profile.role,
          profile.status,
          userRoles || 'None',
          userGroups || 'None',
          String(projectCount)
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Email', 'Name', 'System Role', 'Status', 'Roles', 'Groups', 'Projects']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 45 },
          5: { cellWidth: 45 },
          6: { cellWidth: 20 },
        },
      });

      doc.save(`all-users-access-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('All users report exported to PDF');
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
        <Button variant="outline" size="sm" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          Export All
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} disabled={exporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} disabled={exporting}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
