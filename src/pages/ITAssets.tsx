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

const ITAssets = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex-1 space-y-6 p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IT Asset Management</h1>
        <p className="text-muted-foreground mt-1">
          Track, manage, and monitor all IT assets across your organization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="software" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Software
          </TabsTrigger>
          <TabsTrigger value="warranty" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Warranty
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
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
