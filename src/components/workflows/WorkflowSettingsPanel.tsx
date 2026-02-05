 import React from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import { AlertCircle, RefreshCw, Clock, Ban } from 'lucide-react';
 
 interface WorkflowSettingsProps {
   enrollmentMode: 'allow_always' | 'once_per_record' | 'cooldown';
   enrollmentCooldownHours: number;
   onEnrollmentModeChange: (mode: 'allow_always' | 'once_per_record' | 'cooldown') => void;
   onCooldownHoursChange: (hours: number) => void;
 }
 
 export function WorkflowSettingsPanel({
   enrollmentMode,
   enrollmentCooldownHours,
   onEnrollmentModeChange,
   onCooldownHoursChange
 }: WorkflowSettingsProps) {
   const enrollmentOptions = [
     {
       value: 'allow_always',
       label: 'Allow Always',
       description: 'Records can trigger this workflow multiple times',
       icon: RefreshCw,
       badge: 'Default'
     },
     {
       value: 'once_per_record',
       label: 'Once Per Record',
       description: 'Each record can only trigger this workflow once',
       icon: Ban,
       badge: 'Strict'
     },
     {
       value: 'cooldown',
       label: 'Cooldown Period',
       description: 'Records must wait before re-triggering',
       icon: Clock,
       badge: 'Timed'
     }
   ];
 
   return (
     <div className="space-y-6 p-6">
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <RefreshCw className="h-5 w-5" />
             Re-enrollment Settings
           </CardTitle>
           <CardDescription>
             Control how records can re-trigger this workflow after their initial enrollment.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
           <div className="space-y-3">
             <Label htmlFor="enrollment-mode">Enrollment Mode</Label>
             <Select
               value={enrollmentMode}
               onValueChange={(value) => onEnrollmentModeChange(value as 'allow_always' | 'once_per_record' | 'cooldown')}
             >
               <SelectTrigger id="enrollment-mode" className="w-full">
                 <SelectValue placeholder="Select enrollment mode" />
               </SelectTrigger>
               <SelectContent>
                 {enrollmentOptions.map((option) => {
                   const Icon = option.icon;
                   return (
                     <SelectItem key={option.value} value={option.value}>
                       <div className="flex items-center gap-2">
                         <Icon className="h-4 w-4 text-muted-foreground" />
                         <span>{option.label}</span>
                         <Badge variant="secondary" className="ml-2 text-xs">
                           {option.badge}
                         </Badge>
                       </div>
                     </SelectItem>
                   );
                 })}
               </SelectContent>
             </Select>
             <p className="text-sm text-muted-foreground">
               {enrollmentOptions.find(o => o.value === enrollmentMode)?.description}
             </p>
           </div>
 
           {enrollmentMode === 'cooldown' && (
             <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
               <Label htmlFor="cooldown-hours">Cooldown Period (Hours)</Label>
               <div className="flex items-center gap-3">
                 <Input
                   id="cooldown-hours"
                   type="number"
                   min={1}
                   max={8760}
                   value={enrollmentCooldownHours}
                   onChange={(e) => onCooldownHoursChange(Math.max(1, parseInt(e.target.value) || 24))}
                   className="w-32"
                 />
                 <span className="text-sm text-muted-foreground">
                   {enrollmentCooldownHours >= 24
                     ? `(${Math.round(enrollmentCooldownHours / 24)} day${enrollmentCooldownHours >= 48 ? 's' : ''})`
                     : ''}
                 </span>
               </div>
               <p className="text-sm text-muted-foreground">
                 After a record completes this workflow, it must wait {enrollmentCooldownHours} hour{enrollmentCooldownHours !== 1 ? 's' : ''} before it can trigger the workflow again.
               </p>
             </div>
           )}
 
           {enrollmentMode === 'once_per_record' && (
            <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
               <div className="text-sm">
                <p className="font-medium text-destructive">Strict Mode</p>
                <p className="text-muted-foreground">
                   Once a record triggers this workflow and completes (or is currently running), it will never trigger again automatically.
                   Manual triggers from the UI will still work.
                 </p>
               </div>
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }