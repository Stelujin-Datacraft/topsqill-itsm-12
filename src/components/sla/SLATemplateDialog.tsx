 import React, { useEffect } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Switch } from '@/components/ui/switch';
 import { useForm } from 'react-hook-form';
 import { SLATemplate } from '@/hooks/useSLAManagement';
 
 interface SLATemplateDialogProps {
   open: boolean;
   onClose: () => void;
   onSave: (data: Partial<SLATemplate>) => void;
   template: SLATemplate | null;
 }
 
 export function SLATemplateDialog({ open, onClose, onSave, template }: SLATemplateDialogProps) {
   const { register, handleSubmit, reset, watch, setValue } = useForm({
     defaultValues: {
       name: '',
       description: '',
       warning_hours: 4,
       breach_hours: 8,
       use_business_hours: false,
       business_start_time: '09:00',
       business_end_time: '17:00',
       exclude_holidays: false,
       is_active: true,
       priority_high: 0.5,
       priority_medium: 1,
       priority_low: 2
     }
   });
 
   const useBusinessHours = watch('use_business_hours');
 
   useEffect(() => {
     if (template) {
       reset({
         name: template.name,
         description: template.description || '',
         warning_hours: template.warning_hours,
         breach_hours: template.breach_hours,
         use_business_hours: template.use_business_hours,
         business_start_time: template.business_start_time?.slice(0, 5) || '09:00',
         business_end_time: template.business_end_time?.slice(0, 5) || '17:00',
         exclude_holidays: template.exclude_holidays,
         is_active: template.is_active,
         priority_high: template.priority_multipliers?.high || 0.5,
         priority_medium: template.priority_multipliers?.medium || 1,
         priority_low: template.priority_multipliers?.low || 2
       });
     } else {
       reset({
         name: '',
         description: '',
         warning_hours: 4,
         breach_hours: 8,
         use_business_hours: false,
         business_start_time: '09:00',
         business_end_time: '17:00',
         exclude_holidays: false,
         is_active: true,
         priority_high: 0.5,
         priority_medium: 1,
         priority_low: 2
       });
     }
   }, [template, reset]);
 
   const onSubmit = (data: any) => {
     onSave({
       name: data.name,
       description: data.description || null,
       warning_hours: parseInt(data.warning_hours),
       breach_hours: parseInt(data.breach_hours),
       use_business_hours: data.use_business_hours,
       business_start_time: data.business_start_time + ':00',
       business_end_time: data.business_end_time + ':00',
       exclude_holidays: data.exclude_holidays,
       is_active: data.is_active,
       priority_multipliers: {
         high: parseFloat(data.priority_high),
         medium: parseFloat(data.priority_medium),
         low: parseFloat(data.priority_low)
       }
     });
   };
 
   return (
     <Dialog open={open} onOpenChange={onClose}>
       <DialogContent className="max-w-lg">
         <DialogHeader>
           <DialogTitle>{template ? 'Edit SLA Template' : 'Create SLA Template'}</DialogTitle>
           <DialogDescription>
             Define time thresholds for warnings and breaches
           </DialogDescription>
         </DialogHeader>
 
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="name">Template Name *</Label>
             <Input id="name" {...register('name', { required: true })} placeholder="e.g., Standard Support SLA" />
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="description">Description</Label>
             <Textarea id="description" {...register('description')} placeholder="Optional description..." rows={2} />
           </div>
 
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="warning_hours">Warning Threshold (hours) *</Label>
               <Input
                 id="warning_hours"
                 type="number"
                 min="1"
                 {...register('warning_hours', { required: true, min: 1 })}
               />
               <p className="text-xs text-muted-foreground">Alert before breach</p>
             </div>
             <div className="space-y-2">
               <Label htmlFor="breach_hours">Breach Threshold (hours) *</Label>
               <Input
                 id="breach_hours"
                 type="number"
                 min="1"
                 {...register('breach_hours', { required: true, min: 1 })}
               />
               <p className="text-xs text-muted-foreground">SLA violation time</p>
             </div>
           </div>
 
           <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
             <div>
               <Label htmlFor="use_business_hours" className="cursor-pointer">Use Business Hours</Label>
               <p className="text-xs text-muted-foreground">Only count work hours</p>
             </div>
             <Switch
               id="use_business_hours"
               checked={useBusinessHours}
               onCheckedChange={(v) => setValue('use_business_hours', v)}
             />
           </div>
 
           {useBusinessHours && (
             <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
               <div className="space-y-2">
                 <Label htmlFor="business_start_time">Start Time</Label>
                 <Input id="business_start_time" type="time" {...register('business_start_time')} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="business_end_time">End Time</Label>
                 <Input id="business_end_time" type="time" {...register('business_end_time')} />
               </div>
               <div className="col-span-2 flex items-center justify-between">
                 <Label htmlFor="exclude_holidays">Exclude Holidays</Label>
                 <Switch
                   id="exclude_holidays"
                   checked={watch('exclude_holidays')}
                   onCheckedChange={(v) => setValue('exclude_holidays', v)}
                 />
               </div>
             </div>
           )}
 
           <div className="space-y-3">
             <Label>Priority Multipliers</Label>
             <p className="text-xs text-muted-foreground">Adjust SLA based on priority (lower = faster)</p>
             <div className="grid grid-cols-3 gap-3">
               <div className="space-y-1">
                 <Label htmlFor="priority_high" className="text-xs text-red-600">High Priority</Label>
                 <Input id="priority_high" type="number" step="0.1" min="0.1" {...register('priority_high')} />
               </div>
               <div className="space-y-1">
                 <Label htmlFor="priority_medium" className="text-xs text-amber-600">Medium Priority</Label>
                 <Input id="priority_medium" type="number" step="0.1" min="0.1" {...register('priority_medium')} />
               </div>
               <div className="space-y-1">
                 <Label htmlFor="priority_low" className="text-xs text-green-600">Low Priority</Label>
                 <Input id="priority_low" type="number" step="0.1" min="0.1" {...register('priority_low')} />
               </div>
             </div>
           </div>
 
           <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
             <Label htmlFor="is_active">Active</Label>
             <Switch
               id="is_active"
               checked={watch('is_active')}
               onCheckedChange={(v) => setValue('is_active', v)}
             />
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={onClose}>
               Cancel
             </Button>
             <Button type="submit">
               {template ? 'Update Template' : 'Create Template'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }