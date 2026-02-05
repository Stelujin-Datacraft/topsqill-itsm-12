 import React, { useState } from 'react';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Plus, Clock, AlertTriangle, CheckCircle, XCircle, TrendingUp, Calendar } from 'lucide-react';
 import { SLATemplatesTab } from '@/components/sla/SLATemplatesTab';
 import { EscalationChainsTab } from '@/components/sla/EscalationChainsTab';
 import { SLADashboardTab } from '@/components/sla/SLADashboardTab';
 import { BusinessHolidaysTab } from '@/components/sla/BusinessHolidaysTab';
 import { useSLADashboardStats } from '@/hooks/useSLAManagement';
 
 export default function SLAManagementPage() {
   const [activeTab, setActiveTab] = useState('dashboard');
   const { stats, loading: statsLoading } = useSLADashboardStats();
 
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
       </div>
 
       {/* Quick Stats */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
         <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
               <Clock className="h-4 w-4" />
               Total Tracked
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
               {statsLoading ? '...' : stats.total}
             </div>
           </CardContent>
         </Card>
 
         <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
               <CheckCircle className="h-4 w-4" />
               On Track
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-green-900 dark:text-green-100">
               {statsLoading ? '...' : stats.onTrack}
             </div>
           </CardContent>
         </Card>
 
         <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
               <AlertTriangle className="h-4 w-4" />
               Warning
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
               {statsLoading ? '...' : stats.warning}
             </div>
           </CardContent>
         </Card>
 
         <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
               <XCircle className="h-4 w-4" />
               Breached
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-red-900 dark:text-red-100">
               {statsLoading ? '...' : stats.breached}
             </div>
           </CardContent>
         </Card>
 
         <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
               <TrendingUp className="h-4 w-4" />
               Compliance Rate
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
               {statsLoading ? '...' : `${stats.complianceRate}%`}
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Main Tabs */}
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
         <TabsList className="grid w-full max-w-2xl grid-cols-4">
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