 import React, { useEffect, useState } from 'react';
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
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Card, CardContent } from '@/components/ui/card';
 import { Plus, Trash2, User, Users, Bell, Mail, ArrowRight } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 import { EscalationChain, EscalationLevel } from '@/hooks/useSLAManagement';
 
 interface EscalationChainDialogProps {
   open: boolean;
   onClose: () => void;
   chain: EscalationChain | null;
  aiGeneratedLevels?: Array<{
    level: 'L1' | 'L2' | 'L3' | 'L4';
    hours_after_breach: number;
    send_email: boolean;
    send_notification: boolean;
    change_priority: boolean;
    new_priority?: string;
    custom_message?: string;
  }>;
 }
 
 interface LevelFormData {
   id?: string;
   level: 'L1' | 'L2' | 'L3' | 'L4';
   hours_after_breach: number;
   escalate_to_user_id: string | null;
   escalate_to_group_id: string | null;
   send_email: boolean;
   send_notification: boolean;
   auto_reassign: boolean;
   custom_message: string;
 }
 
export function EscalationChainDialog({ open, onClose, chain, aiGeneratedLevels }: EscalationChainDialogProps) {
   const { userProfile } = useAuth();
   const { toast } = useToast();
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [isActive, setIsActive] = useState(true);
   const [levels, setLevels] = useState<LevelFormData[]>([]);
   const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
   const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
   const [saving, setSaving] = useState(false);
 
   useEffect(() => {
     if (chain) {
       setName(chain.name);
       setDescription(chain.description || '');
       setIsActive(chain.is_active);
      // Use AI generated levels if provided, otherwise use chain's levels
      if (aiGeneratedLevels && aiGeneratedLevels.length > 0) {
        setLevels(
          aiGeneratedLevels.map(l => ({
            level: l.level,
            hours_after_breach: l.hours_after_breach,
            escalate_to_user_id: null,
            escalate_to_group_id: null,
            send_email: l.send_email,
            send_notification: l.send_notification,
            auto_reassign: false,
            custom_message: l.custom_message || ''
          }))
        );
      } else {
        setLevels(
          (chain.levels || []).map(l => ({
            id: l.id,
            level: l.level,
            hours_after_breach: l.hours_after_breach,
            escalate_to_user_id: l.escalate_to_user_id,
            escalate_to_group_id: l.escalate_to_group_id,
            send_email: l.send_email,
            send_notification: l.send_notification,
            auto_reassign: l.auto_reassign,
            custom_message: l.custom_message || ''
          }))
        );
      }
     } else {
       setName('');
       setDescription('');
       setIsActive(true);
       setLevels([{
         level: 'L1',
         hours_after_breach: 0,
         escalate_to_user_id: null,
         escalate_to_group_id: null,
         send_email: true,
         send_notification: true,
         auto_reassign: false,
         custom_message: ''
       }]);
     }
  }, [chain, open, aiGeneratedLevels]);
 
   useEffect(() => {
     const fetchOptions = async () => {
       if (!userProfile?.organization_id) return;
 
       const [usersRes, groupsRes] = await Promise.all([
         supabase
           .from('user_profiles')
           .select('id, first_name, last_name, email')
           .eq('organization_id', userProfile.organization_id),
         supabase
           .from('groups')
           .select('id, name')
           .eq('organization_id', userProfile.organization_id)
       ]);
 
       if (usersRes.data) {
         setUsers(usersRes.data.map(u => ({
           id: u.id,
           name: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.id
         })));
       }
       if (groupsRes.data) {
         setGroups(groupsRes.data);
       }
     };
 
     if (open) fetchOptions();
   }, [open, userProfile?.organization_id]);
 
   const addLevel = () => {
     const nextLevels: ('L1' | 'L2' | 'L3' | 'L4')[] = ['L1', 'L2', 'L3', 'L4'];
     const usedLevels = levels.map(l => l.level);
     const nextLevel = nextLevels.find(l => !usedLevels.includes(l));
     if (nextLevel) {
       setLevels([...levels, {
         level: nextLevel,
         hours_after_breach: levels.length * 2,
         escalate_to_user_id: null,
         escalate_to_group_id: null,
         send_email: true,
         send_notification: true,
         auto_reassign: false,
         custom_message: ''
       }]);
     }
   };
 
   const removeLevel = (index: number) => {
     setLevels(levels.filter((_, i) => i !== index));
   };
 
   const updateLevel = (index: number, updates: Partial<LevelFormData>) => {
     setLevels(levels.map((l, i) => i === index ? { ...l, ...updates } : l));
   };
 
   const handleSave = async () => {
     if (!name.trim() || !userProfile) return;
     setSaving(true);
 
     try {
       let chainId = chain?.id;
 
       if (chain) {
         // Update existing chain
         const { error } = await supabase
           .from('escalation_chains')
           .update({ name, description, is_active: isActive })
           .eq('id', chain.id);
         if (error) throw error;
 
         // Delete old levels
         await supabase.from('escalation_levels').delete().eq('chain_id', chain.id);
       } else {
         // Create new chain
         const { data, error } = await supabase
           .from('escalation_chains')
           .insert({
             name,
             description,
             is_active: isActive,
             organization_id: userProfile.organization_id,
             created_by: userProfile.id
           })
           .select()
           .single();
         if (error) throw error;
         chainId = data.id;
       }
 
       // Insert levels
       if (chainId && levels.length > 0) {
         const { error: levelsError } = await supabase
           .from('escalation_levels')
           .insert(
             levels.map((l, i) => ({
               chain_id: chainId,
               level: l.level,
               level_order: i + 1,
               hours_after_breach: l.hours_after_breach,
               escalate_to_user_id: l.escalate_to_user_id,
               escalate_to_group_id: l.escalate_to_group_id,
               send_email: l.send_email,
               send_notification: l.send_notification,
               auto_reassign: l.auto_reassign,
               custom_message: l.custom_message || null
             }))
           );
         if (levelsError) throw levelsError;
       }
 
       toast({ title: 'Success', description: chain ? 'Chain updated' : 'Chain created' });
       onClose();
     } catch (err: any) {
       console.error('Error saving chain:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     } finally {
       setSaving(false);
     }
   };
 
   const getLevelColor = (level: string) => {
     switch (level) {
       case 'L1': return 'border-blue-300 bg-blue-50 dark:bg-blue-900/20';
       case 'L2': return 'border-amber-300 bg-amber-50 dark:bg-amber-900/20';
       case 'L3': return 'border-orange-300 bg-orange-50 dark:bg-orange-900/20';
       case 'L4': return 'border-red-300 bg-red-50 dark:bg-red-900/20';
       default: return '';
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onClose}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle>{chain ? 'Edit Escalation Chain' : 'Create Escalation Chain'}</DialogTitle>
           <DialogDescription>
             Define escalation levels that trigger when SLAs breach
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="chain-name">Chain Name *</Label>
               <Input
                 id="chain-name"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 placeholder="e.g., Support Escalation"
               />
             </div>
             <div className="flex items-center justify-between pt-6">
               <Label>Active</Label>
               <Switch checked={isActive} onCheckedChange={setIsActive} />
             </div>
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="chain-desc">Description</Label>
             <Textarea
               id="chain-desc"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder="Optional description..."
               rows={2}
             />
           </div>
 
           <div className="space-y-3">
             <div className="flex items-center justify-between">
               <Label>Escalation Levels</Label>
               {levels.length < 4 && (
                 <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                   <Plus className="h-3 w-3 mr-1" />
                   Add Level
                 </Button>
               )}
             </div>
 
             <div className="space-y-3">
               {levels.map((level, index) => (
                 <Card key={index} className={`${getLevelColor(level.level)} border-2`}>
                   <CardContent className="pt-4 space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <span className="font-bold text-lg">{level.level}</span>
                         <div className="flex items-center gap-2 text-sm">
                           <span className="text-muted-foreground">After breach +</span>
                           <Input
                             type="number"
                             min="0"
                             className="w-16 h-8"
                             value={level.hours_after_breach}
                             onChange={(e) => updateLevel(index, { hours_after_breach: parseInt(e.target.value) || 0 })}
                           />
                           <span className="text-muted-foreground">hours</span>
                         </div>
                       </div>
                       {levels.length > 1 && (
                         <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           className="text-destructive"
                           onClick={() => removeLevel(index)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                     </div>
 
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <Label className="text-xs flex items-center gap-1">
                           <User className="h-3 w-3" /> Escalate to User
                         </Label>
                         <Select
                           value={level.escalate_to_user_id || ''}
                           onValueChange={(v) => updateLevel(index, { escalate_to_user_id: v || null })}
                         >
                           <SelectTrigger className="h-8">
                             <SelectValue placeholder="Select user..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="">None</SelectItem>
                             {users.map(u => (
                               <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs flex items-center gap-1">
                           <Users className="h-3 w-3" /> Escalate to Group
                         </Label>
                         <Select
                           value={level.escalate_to_group_id || ''}
                           onValueChange={(v) => updateLevel(index, { escalate_to_group_id: v || null })}
                         >
                           <SelectTrigger className="h-8">
                             <SelectValue placeholder="Select group..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="">None</SelectItem>
                             {groups.map(g => (
                               <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
 
                     <div className="flex items-center gap-4 text-sm">
                       <div className="flex items-center gap-2">
                         <Switch
                           checked={level.send_notification}
                           onCheckedChange={(v) => updateLevel(index, { send_notification: v })}
                         />
                         <Bell className="h-3 w-3" />
                         <span>In-app</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <Switch
                           checked={level.send_email}
                           onCheckedChange={(v) => updateLevel(index, { send_email: v })}
                         />
                         <Mail className="h-3 w-3" />
                         <span>Email</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <Switch
                           checked={level.auto_reassign}
                           onCheckedChange={(v) => updateLevel(index, { auto_reassign: v })}
                         />
                         <span>Auto-reassign</span>
                       </div>
                     </div>
 
                     <Input
                       placeholder="Custom message (optional)"
                       className="h-8 text-sm"
                       value={level.custom_message}
                       onChange={(e) => updateLevel(index, { custom_message: e.target.value })}
                     />
                   </CardContent>
                 </Card>
               ))}
             </div>
           </div>
         </div>
 
         <DialogFooter>
           <Button type="button" variant="outline" onClick={onClose}>
             Cancel
           </Button>
           <Button onClick={handleSave} disabled={saving || !name.trim()}>
             {saving ? 'Saving...' : chain ? 'Update Chain' : 'Create Chain'}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }