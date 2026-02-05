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
 
 // Optimization constants
 const BATCH_SIZE = 500; // Fetch users in batches
 const MAX_USERS_FOR_CLIENT = 2000; // Switch to server-side export if more users
 
 interface UserProfile {
   id: string;
   email: string;
   first_name: string | null;
   last_name: string | null;
   role: string;
   status: string;
   created_at: string;
 }
 
 interface ProcessedUser {
   email: string;
   name: string;
   role: string;
   status: string;
   created_at: string;
   roles: string;
   groups: string;
   projectCount: number;
   projects: string;
 }
 
 export function ExportAllUsersReport() {
   const [exporting, setExporting] = useState(false);
 
   // OPTIMIZATION: Fetch data in batches and build lookup maps for O(1) access
   const fetchAllUsersData = async (): Promise<{ users: ProcessedUser[]; total: number }> => {
     // First get total count
     const { count: totalCount, error: countError } = await supabase
       .from('user_profiles')
       .select('id', { count: 'exact', head: true });
 
     if (countError) throw countError;
     const total = totalCount || 0;
 
     if (total > MAX_USERS_FOR_CLIENT) {
       toast.info(`Processing ${total} users... This may take a moment.`);
     }
 
     // Build lookup maps for roles, groups, projects (O(N) build, O(1) lookup)
     const [roleAssignments, groupMemberships, projectAccess] = await Promise.all([
       supabase
         .from('user_role_assignments')
         .select('user_id, roles(name)')
         .then(({ data }) => data || []),
       supabase
         .from('group_memberships')
         .select('member_id, groups(name)')
         .eq('member_type', 'user')
         .then(({ data }) => data || []),
       supabase
         .from('project_users')
         .select('user_id, role, projects(name)')
         .then(({ data }) => data || [])
     ]);
 
     // Build lookup maps (O(N) instead of O(N*M) filtering)
     const rolesMap = new Map<string, string[]>();
     for (const r of roleAssignments) {
       const existing = rolesMap.get(r.user_id) || [];
       existing.push((r.roles as any)?.name || 'Unknown');
       rolesMap.set(r.user_id, existing);
     }
 
     const groupsMap = new Map<string, string[]>();
     for (const g of groupMemberships) {
       const existing = groupsMap.get(g.member_id) || [];
       existing.push((g.groups as any)?.name || 'Unknown');
       groupsMap.set(g.member_id, existing);
     }
 
     const projectsMap = new Map<string, { name: string; role: string }[]>();
     for (const p of projectAccess) {
       const existing = projectsMap.get(p.user_id) || [];
       existing.push({ name: (p.projects as any)?.name || 'Unknown', role: p.role });
       projectsMap.set(p.user_id, existing);
     }
 
     // Fetch and process users in batches
     const processedUsers: ProcessedUser[] = [];
     let offset = 0;
 
     while (offset < total) {
       const { data: batch, error } = await supabase
         .from('user_profiles')
         .select('id, email, first_name, last_name, role, status, created_at')
         .order('email')
         .range(offset, offset + BATCH_SIZE - 1);
 
       if (error) throw error;
       if (!batch || batch.length === 0) break;
 
       // Process batch with O(1) lookups
       for (const profile of batch) {
         const userRoles = rolesMap.get(profile.id) || [];
         const userGroups = groupsMap.get(profile.id) || [];
         const userProjects = projectsMap.get(profile.id) || [];
 
         processedUsers.push({
           email: profile.email,
           name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '-',
           role: profile.role,
           status: profile.status,
           created_at: profile.created_at,
           roles: userRoles.join(', ') || 'None',
           groups: userGroups.join(', ') || 'None',
           projectCount: userProjects.length,
           projects: userProjects.map(p => `${p.name} (${p.role})`).join('; ') || 'None'
         });
       }
 
       offset += BATCH_SIZE;
     }
 
     return { users: processedUsers, total };
   };

   const exportToCSV = async () => {
     setExporting(true);
     try {
       const { users, total } = await fetchAllUsersData();
       const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
       const lines: string[] = [];
 
       // Header
       lines.push('All Users Access Report');
       lines.push(`Generated: ${timestamp}`);
       lines.push(`Total Users: ${total}`);
       lines.push('');
 
       // Users Summary
       lines.push('=== USERS SUMMARY ===');
       lines.push('Email,Name,System Role,Status,Created,Roles,Groups,Projects');
       
       // O(N) processing with pre-built data
       for (const user of users) {
         lines.push([
           `"${user.email}"`,
           `"${user.name}"`,
           user.role,
           user.status,
           format(new Date(user.created_at), 'yyyy-MM-dd'),
           `"${user.roles}"`,
           `"${user.groups}"`,
           `"${user.projects}"`
         ].join(','));
       }
 
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
       
       toast.success(`Exported ${total} users to CSV`);
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
       const { users, total } = await fetchAllUsersData();
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
       doc.text(`Generated: ${timestamp} | Total Users: ${total}`, 14, yPos);
       yPos += 12;
 
       // O(N) table generation with pre-processed data
       const tableData = users.map(user => [
         user.email,
         user.name,
         user.role,
         user.status,
         user.roles,
         user.groups,
         String(user.projectCount)
       ]);
 
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
       toast.success(`Exported ${total} users to PDF`);
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
