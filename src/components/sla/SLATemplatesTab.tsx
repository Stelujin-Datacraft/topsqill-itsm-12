 import React, { useState } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Plus, Edit, Trash2, Clock, Building2 } from 'lucide-react';
 import { useSLATemplates, SLATemplate } from '@/hooks/useSLAManagement';
 import { SLATemplateDialog } from './SLATemplateDialog';
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
 
 export function SLATemplatesTab() {
   const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useSLATemplates();
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingTemplate, setEditingTemplate] = useState<SLATemplate | null>(null);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
 
   const handleCreate = () => {
     setEditingTemplate(null);
     setDialogOpen(true);
   };
 
   const handleEdit = (template: SLATemplate) => {
     setEditingTemplate(template);
     setDialogOpen(true);
   };
 
   const handleSave = async (data: Partial<SLATemplate>) => {
     if (editingTemplate) {
       await updateTemplate(editingTemplate.id, data);
     } else {
       await createTemplate(data);
     }
     setDialogOpen(false);
   };
 
   const handleDelete = async () => {
     if (templateToDelete) {
       await deleteTemplate(templateToDelete);
       setDeleteDialogOpen(false);
       setTemplateToDelete(null);
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
           <h2 className="text-lg font-semibold">SLA Templates</h2>
           <p className="text-sm text-muted-foreground">
             Define reusable SLA rules with warning and breach thresholds
           </p>
         </div>
         <Button onClick={handleCreate} className="flex items-center gap-2">
           <Plus className="h-4 w-4" />
           Create Template
         </Button>
       </div>
 
       {templates.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-12">
             <Clock className="h-12 w-12 text-muted-foreground mb-4" />
             <h3 className="text-lg font-medium mb-2">No SLA Templates</h3>
             <p className="text-muted-foreground text-center mb-4">
               Create your first SLA template to start tracking service levels
             </p>
             <Button onClick={handleCreate}>
               <Plus className="h-4 w-4 mr-2" />
               Create Template
             </Button>
           </CardContent>
         </Card>
       ) : (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {templates.map((template) => (
             <Card key={template.id} className="hover:shadow-md transition-shadow">
               <CardHeader className="pb-3">
                 <div className="flex items-start justify-between">
                   <div>
                     <CardTitle className="text-base">{template.name}</CardTitle>
                     {template.description && (
                       <CardDescription className="mt-1 text-xs">
                         {template.description}
                       </CardDescription>
                     )}
                   </div>
                   <Badge variant={template.is_active ? 'default' : 'secondary'}>
                     {template.is_active ? 'Active' : 'Inactive'}
                   </Badge>
                 </div>
               </CardHeader>
               <CardContent className="space-y-3">
                 <div className="grid grid-cols-2 gap-3 text-sm">
                   <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                     <div className="w-2 h-2 rounded-full bg-amber-500" />
                     <span className="text-muted-foreground">Warning:</span>
                     <span className="font-medium">{template.warning_hours}h</span>
                   </div>
                   <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                     <div className="w-2 h-2 rounded-full bg-red-500" />
                     <span className="text-muted-foreground">Breach:</span>
                     <span className="font-medium">{template.breach_hours}h</span>
                   </div>
                 </div>
 
                 {template.use_business_hours && (
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <Building2 className="h-3 w-3" />
                     Business hours: {template.business_start_time?.slice(0, 5)} - {template.business_end_time?.slice(0, 5)}
                   </div>
                 )}
 
                 <div className="flex gap-2 pt-2 border-t">
                   <Button
                     variant="outline"
                     size="sm"
                     className="flex-1"
                     onClick={() => handleEdit(template)}
                   >
                     <Edit className="h-3 w-3 mr-1" />
                     Edit
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     className="text-destructive hover:bg-destructive/10"
                     onClick={() => {
                       setTemplateToDelete(template.id);
                       setDeleteDialogOpen(true);
                     }}
                   >
                     <Trash2 className="h-3 w-3" />
                   </Button>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       <SLATemplateDialog
         open={dialogOpen}
         onClose={() => setDialogOpen(false)}
         onSave={handleSave}
         template={editingTemplate}
       />
 
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete SLA Template</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete this template? This action cannot be undone.
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