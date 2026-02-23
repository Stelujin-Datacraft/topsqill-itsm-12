 import React, { useState } from 'react';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Button } from '@/components/ui/button';
 import { Clock, AlertTriangle, CheckCircle, XCircle, TrendingUp, Calendar, Brain, ChevronDown } from 'lucide-react';
 import { SLATemplatesTab } from '@/components/sla/SLATemplatesTab';
 import { EscalationChainsTab } from '@/components/sla/EscalationChainsTab';
 import { SLADashboardTab } from '@/components/sla/SLADashboardTab';
 import { BusinessHolidaysTab } from '@/components/sla/BusinessHolidaysTab';
 import { SLAPredictions } from '@/components/sla/SLAPredictions';
 import { useSLADashboardStats } from '@/hooks/useSLAManagement';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
   DropdownMenuSeparator,
 } from '@/components/ui/dropdown-menu';

 export default function SLAManagementPage() {
   const [activeTab, setActiveTab] = useState('dashboard');
   const { stats, loading: statsLoading } = useSLADashboardStats();

   const statItems = [
     { label: 'Total Tracked', value: statsLoading ? '...' : stats.total, icon: Clock },
     { label: 'On Track', value: statsLoading ? '...' : stats.onTrack, icon: CheckCircle },
     { label: 'Warning', value: statsLoading ? '...' : stats.warning, icon: AlertTriangle },
     { label: 'Breached', value: statsLoading ? '...' : stats.breached, icon: XCircle },
     { label: 'Compliance Rate', value: statsLoading ? '...' : `${stats.complianceRate}%`, icon: TrendingUp },
   ];

   return (
     <div className="container mx-auto py-6 space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-3xl font-bold text-foreground">SLA & Escalation Management</h1>
           <p className="text-muted-foreground mt-1">
             Configure service level agreements and escalation chains for your workflows
           </p>
         </div>

         {/* Stats Dropdown */}
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button variant="outline" size="sm" className="gap-2">
               <TrendingUp className="h-4 w-4 text-primary" />
               Quick Stats
               <ChevronDown className="h-3 w-3" />
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="w-56">
             {statItems.map((item, index) => (
               <React.Fragment key={item.label}>
                 <DropdownMenuItem className="flex items-center justify-between cursor-default">
                   <span className="flex items-center gap-2 text-sm">
                     <item.icon className="h-4 w-4 text-primary" />
                     {item.label}
                   </span>
                   <span className="font-bold text-foreground">{item.value}</span>
                 </DropdownMenuItem>
                 {index < statItems.length - 1 && <DropdownMenuSeparator />}
               </React.Fragment>
             ))}
           </DropdownMenuContent>
         </DropdownMenu>
       </div>

       {/* Main Tabs */}
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="predictions" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Predictions
            </TabsTrigger>
           <TabsTrigger value="dashboard" className="flex items-center gap-2">
             <TrendingUp className="h-4 w-4" />
             Dashboard
           </TabsTrigger>
           <TabsTrigger value="templates" className="flex items-center gap-2">
             <Clock className="h-4 w-4" />
             SLA Templates
           </TabsTrigger>
           <TabsTrigger value="escalations" className="flex items-center gap-2">
             <AlertTriangle className="h-4 w-4" />
             Escalation Chains
           </TabsTrigger>
           <TabsTrigger value="holidays" className="flex items-center gap-2">
             <Calendar className="h-4 w-4" />
             Holidays
           </TabsTrigger>
         </TabsList>

          <TabsContent value="predictions">
            <SLAPredictions />
          </TabsContent>

         <TabsContent value="dashboard">
           <SLADashboardTab />
         </TabsContent>

         <TabsContent value="templates">
           <SLATemplatesTab />
         </TabsContent>

         <TabsContent value="escalations">
           <EscalationChainsTab />
         </TabsContent>

         <TabsContent value="holidays">
           <BusinessHolidaysTab />
         </TabsContent>
       </Tabs>
     </div>
   );
 }