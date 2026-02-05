 import React, { useState } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Plus, Edit, Trash2, AlertTriangle, ArrowRight, Users, User } from 'lucide-react';
 import { useEscalationChains, EscalationChain } from '@/hooks/useSLAManagement';
 import { EscalationChainDialog } from './EscalationChainDialog';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 
 export function EscalationChainsTab() {
   const { chains, loading, createChain, deleteChain, fetchChains } = useEscalationChains();
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingChain, setEditingChain] = useState<EscalationChain | null>(null);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [chainToDelete, setChainToDelete] = useState<string | null>(null);
 
   const handleCreate = () => {
     setEditingChain(null);
     setDialogOpen(true);
   };
 
   const handleEdit = (chain: EscalationChain) => {
     setEditingChain(chain);
     setDialogOpen(true);
   };
 
   const handleSave = async (data: Partial<EscalationChain>) => {
     await createChain(data);
     setDialogOpen(false);
   };
 
   const handleDelete = async () => {
     if (chainToDelete) {
       await deleteChain(chainToDelete);
       setDeleteDialogOpen(false);
       setChainToDelete(null);
     }
   };
 
   const getLevelColor = (level: string) => {
     switch (level) {
       case 'L1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
       case 'L2': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
       case 'L3': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
       case 'L4': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
       default: return 'bg-gray-100 text-gray-800';
     }
   };
 
   if (loading) {
     return (
       <Card>
         <CardContent className="flex items-center justify-center h-48">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-lg font-semibold">Escalation Chains</h2>
           <p className="text-sm text-muted-foreground">
             Define escalation paths when SLAs are breached (L1 → L2 → L3 → L4)
           </p>
         </div>
         <Button onClick={handleCreate} className="flex items-center gap-2">
           <Plus className="h-4 w-4" />
           Create Chain
         </Button>
       </div>
 
       {chains.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-12">
             <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
             <h3 className="text-lg font-medium mb-2">No Escalation Chains</h3>
             <p className="text-muted-foreground text-center mb-4">
               Create escalation chains to define who gets notified when SLAs breach
             </p>
             <Button onClick={handleCreate}>
               <Plus className="h-4 w-4 mr-2" />
               Create Chain
             </Button>
           </CardContent>
         </Card>
       ) : (
         <div className="space-y-4">
           {chains.map((chain) => (
             <Card key={chain.id} className="hover:shadow-md transition-shadow">
               <CardHeader className="pb-3">
                 <div className="flex items-start justify-between">
                   <div>
                     <CardTitle className="text-base flex items-center gap-2">
                       {chain.name}
                       <Badge variant={chain.is_active ? 'default' : 'secondary'}>
                         {chain.is_active ? 'Active' : 'Inactive'}
                       </Badge>
                     </CardTitle>
                     {chain.description && (
                       <CardDescription className="mt-1">
                         {chain.description}
                       </CardDescription>
                     )}
                   </div>
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleEdit(chain)}
                     >
                       <Edit className="h-3 w-3 mr-1" />
                       Edit
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       className="text-destructive hover:bg-destructive/10"
                       onClick={() => {
                         setChainToDelete(chain.id);
                         setDeleteDialogOpen(true);
                       }}
                     >
                       <Trash2 className="h-3 w-3" />
                     </Button>
                   </div>
                 </div>
               </CardHeader>
               <CardContent>
                 {chain.levels && chain.levels.length > 0 ? (
                   <div className="flex items-center gap-2 flex-wrap">
                     {chain.levels
                       .sort((a, b) => a.level_order - b.level_order)
                       .map((level, index) => (
                         <React.Fragment key={level.id}>
                           <div className={`px-3 py-2 rounded-lg ${getLevelColor(level.level)} flex items-center gap-2`}>
                             <span className="font-semibold">{level.level}</span>
                             <span className="text-xs opacity-75">
                               +{level.hours_after_breach}h
                             </span>
                             {level.escalate_to_user_id && <User className="h-3 w-3" />}
                             {level.escalate_to_group_id && <Users className="h-3 w-3" />}
                           </div>
                           {index < (chain.levels?.length || 0) - 1 && (
                             <ArrowRight className="h-4 w-4 text-muted-foreground" />
                           )}
                         </React.Fragment>
                       ))}
                   </div>
                 ) : (
                   <p className="text-sm text-muted-foreground italic">
                     No escalation levels defined yet
                   </p>
                 )}
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       <EscalationChainDialog
         open={dialogOpen}
         onClose={() => {
           setDialogOpen(false);
           fetchChains();
         }}
         chain={editingChain}
       />
 
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Escalation Chain</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete this chain? All associated levels will be removed.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
               Delete
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </div>
   );
 }