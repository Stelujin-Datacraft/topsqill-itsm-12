import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Cpu, Download, History, BarChart3, ShieldCheck, FileText } from 'lucide-react';
import { AssetDashboard } from '@/components/itam/AssetDashboard';
import { AssetList } from '@/components/itam/AssetList';
import { AgentManagement } from '@/components/itam/AgentManagement';
import { SoftwareInventory } from '@/components/itam/SoftwareInventory';
import { AssetHistoryView } from '@/components/itam/AssetHistoryView';
import { WarrantyLicenseTracker } from '@/components/itam/WarrantyLicenseTracker';
import { AssetExport } from '@/components/itam/AssetExport';
import { SidebarTrigger } from '@/components/ui/sidebar';

const ITAssets = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex items-start gap-2">
        <SidebarTrigger className="shrink-0 mt-1" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">IT Asset Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            Track, manage, and monitor all IT assets across your organization
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TabsList className="inline-flex w-max sm:w-full justify-start sm:grid sm:grid-cols-7 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <BarChart3 className="h-4 w-4 shrink-0" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <Monitor className="h-4 w-4 shrink-0" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="software" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <Cpu className="h-4 w-4 shrink-0" />
            Software
          </TabsTrigger>
          <TabsTrigger value="warranty" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Warranty
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <Download className="h-4 w-4 shrink-0" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <FileText className="h-4 w-4 shrink-0" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
            <History className="h-4 w-4 shrink-0" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><AssetDashboard /></TabsContent>
        <TabsContent value="assets"><AssetList /></TabsContent>
        <TabsContent value="software"><SoftwareInventory /></TabsContent>
        <TabsContent value="warranty"><WarrantyLicenseTracker /></TabsContent>
        <TabsContent value="agents"><AgentManagement /></TabsContent>
        <TabsContent value="reports"><AssetExport /></TabsContent>
        <TabsContent value="history"><AssetHistoryView /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ITAssets;
