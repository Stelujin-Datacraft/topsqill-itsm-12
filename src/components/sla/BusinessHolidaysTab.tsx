 import React, { useState, useEffect } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Badge } from '@/components/ui/badge';
 import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 import { format } from 'date-fns';
 import {
   Dialog,
   DialogContent,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
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
 
 interface Holiday {
   id: string;
   name: string;
   holiday_date: string;
   is_recurring: boolean;
 }
 
 export function BusinessHolidaysTab() {
   const { userProfile } = useAuth();
   const { toast } = useToast();
   const [holidays, setHolidays] = useState<Holiday[]>([]);
   const [loading, setLoading] = useState(true);
   const [dialogOpen, setDialogOpen] = useState(false);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [holidayToDelete, setHolidayToDelete] = useState<string | null>(null);
   const [newHoliday, setNewHoliday] = useState({ name: '', date: '', isRecurring: false });
   const [saving, setSaving] = useState(false);
 
   const fetchHolidays = async () => {
     if (!userProfile?.organization_id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('business_holidays')
         .select('*')
         .eq('organization_id', userProfile.organization_id)
         .order('holiday_date');
       if (error) throw error;
       setHolidays(data || []);
     } catch (err) {
       console.error('Error fetching holidays:', err);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchHolidays();
   }, [userProfile?.organization_id]);
 
   const handleCreate = async () => {
     if (!newHoliday.name || !newHoliday.date || !userProfile) return;
     setSaving(true);
     try {
       const { error } = await supabase.from('business_holidays').insert({
         name: newHoliday.name,
         holiday_date: newHoliday.date,
         is_recurring: newHoliday.isRecurring,
         organization_id: userProfile.organization_id,
         created_by: userProfile.id
       });
       if (error) throw error;
       toast({ title: 'Success', description: 'Holiday added' });
       setDialogOpen(false);
       setNewHoliday({ name: '', date: '', isRecurring: false });
       await fetchHolidays();
     } catch (err: any) {
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     } finally {
       setSaving(false);
     }
   };
 
   const handleDelete = async () => {
     if (!holidayToDelete) return;
     try {
       const { error } = await supabase
         .from('business_holidays')
         .delete()
         .eq('id', holidayToDelete);
       if (error) throw error;
       toast({ title: 'Success', description: 'Holiday deleted' });
       await fetchHolidays();
     } catch (err: any) {
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     } finally {
       setDeleteDialogOpen(false);
       setHolidayToDelete(null);
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
 
   const upcomingHolidays = holidays.filter(h => {
     const holidayDate = new Date(h.holiday_date);
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     return holidayDate >= today || h.is_recurring;
   });
 
   const pastHolidays = holidays.filter(h => {
     const holidayDate = new Date(h.holiday_date);
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     return holidayDate < today && !h.is_recurring;
   });
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-lg font-semibold">Business Holidays</h2>
           <p className="text-sm text-muted-foreground">
             Define holidays to exclude from SLA business hours calculation
           </p>
         </div>
         <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
           <Plus className="h-4 w-4" />
           Add Holiday
         </Button>
       </div>
 
       {holidays.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-12">
             <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
             <h3 className="text-lg font-medium mb-2">No Holidays Defined</h3>
             <p className="text-muted-foreground text-center mb-4">
               Add holidays to exclude them from SLA calculations
             </p>
             <Button onClick={() => setDialogOpen(true)}>
               <Plus className="h-4 w-4 mr-2" />
               Add Holiday
             </Button>
           </CardContent>
         </Card>
       ) : (
         <div className="grid gap-4 md:grid-cols-2">
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-base">Upcoming & Recurring</CardTitle>
               <CardDescription>{upcomingHolidays.length} holidays</CardDescription>
             </CardHeader>
             <CardContent className="space-y-2">
               {upcomingHolidays.length === 0 ? (
                 <p className="text-sm text-muted-foreground italic">No upcoming holidays</p>
               ) : (
                 upcomingHolidays.map((holiday) => (
                   <div
                     key={holiday.id}
                     className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                   >
                     <div>
                       <div className="font-medium flex items-center gap-2">
                         {holiday.name}
                         {holiday.is_recurring && (
                           <Badge variant="secondary" className="text-xs">
                             <RefreshCw className="h-2 w-2 mr-1" />
                             Yearly
                           </Badge>
                         )}
                       </div>
                       <div className="text-sm text-muted-foreground">
                         {format(new Date(holiday.holiday_date), 'MMMM d, yyyy')}
                       </div>
                     </div>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="text-destructive"
                       onClick={() => {
                         setHolidayToDelete(holiday.id);
                         setDeleteDialogOpen(true);
                       }}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                 ))
               )}
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-base text-muted-foreground">Past Holidays</CardTitle>
               <CardDescription>{pastHolidays.length} holidays</CardDescription>
             </CardHeader>
             <CardContent className="space-y-2">
               {pastHolidays.length === 0 ? (
                 <p className="text-sm text-muted-foreground italic">No past holidays</p>
               ) : (
                 pastHolidays.slice(0, 5).map((holiday) => (
                   <div
                     key={holiday.id}
                     className="flex items-center justify-between p-3 bg-muted/30 rounded-lg opacity-60"
                   >
                     <div>
                       <div className="font-medium">{holiday.name}</div>
                       <div className="text-sm text-muted-foreground">
                         {format(new Date(holiday.holiday_date), 'MMMM d, yyyy')}
                       </div>
                     </div>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="text-destructive"
                       onClick={() => {
                         setHolidayToDelete(holiday.id);
                         setDeleteDialogOpen(true);
                       }}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                 ))
               )}
             </CardContent>
           </Card>
         </div>
       )}
 
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Add Holiday</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="holiday-name">Holiday Name *</Label>
               <Input
                 id="holiday-name"
                 value={newHoliday.name}
                 onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                 placeholder="e.g., Christmas Day"
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="holiday-date">Date *</Label>
               <Input
                 id="holiday-date"
                 type="date"
                 value={newHoliday.date}
                 onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
               />
             </div>
             <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
               <div>
                 <Label htmlFor="is-recurring">Recurring Yearly</Label>
                 <p className="text-xs text-muted-foreground">Repeat every year on this date</p>
               </div>
               <Switch
                 id="is-recurring"
                 checked={newHoliday.isRecurring}
                 onCheckedChange={(v) => setNewHoliday({ ...newHoliday, isRecurring: v })}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
             <Button onClick={handleCreate} disabled={saving || !newHoliday.name || !newHoliday.date}>
               {saving ? 'Adding...' : 'Add Holiday'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete this holiday?
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