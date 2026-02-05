 import React from 'react';
 import { Badge } from '@/components/ui/badge';
 import { Clock, AlertTriangle, XCircle, CheckCircle, Pause } from 'lucide-react';
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
 import { formatDistanceToNow } from 'date-fns';
 
 interface SLAStatusBadgeProps {
   status: 'on_track' | 'warning' | 'breached' | 'completed' | 'paused';
   warningAt?: string | null;
   breachAt?: string | null;
   completedAt?: string | null;
   templateName?: string;
   currentStage?: string;
   size?: 'sm' | 'default';
 }
 
 export function SLAStatusBadge({
   status,
   warningAt,
   breachAt,
   completedAt,
   templateName,
   currentStage,
   size = 'default'
 }: SLAStatusBadgeProps) {
   const getStatusConfig = () => {
     switch (status) {
       case 'on_track':
         return {
           icon: Clock,
           label: 'On Track',
           variant: 'default' as const,
           className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
           timeLabel: breachAt ? `Breach in ${formatDistanceToNow(new Date(breachAt))}` : null
         };
       case 'warning':
         return {
           icon: AlertTriangle,
           label: 'Warning',
           variant: 'default' as const,
           className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse',
           timeLabel: breachAt ? `Breach in ${formatDistanceToNow(new Date(breachAt))}` : null
         };
       case 'breached':
         return {
           icon: XCircle,
           label: 'Breached',
           variant: 'destructive' as const,
           className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
           timeLabel: breachAt ? `Breached ${formatDistanceToNow(new Date(breachAt))} ago` : null
         };
       case 'completed':
         return {
           icon: CheckCircle,
           label: 'Completed',
           variant: 'default' as const,
           className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
           timeLabel: completedAt ? `Completed ${formatDistanceToNow(new Date(completedAt))} ago` : null
         };
       case 'paused':
         return {
           icon: Pause,
           label: 'Paused',
           variant: 'secondary' as const,
           className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300',
           timeLabel: 'SLA timer paused'
         };
       default:
         return {
           icon: Clock,
           label: 'Unknown',
           variant: 'outline' as const,
           className: '',
           timeLabel: null
         };
     }
   };
 
   const config = getStatusConfig();
   const Icon = config.icon;
   const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
   const badgeSize = size === 'sm' ? 'text-xs px-1.5 py-0.5' : '';
 
   return (
     <TooltipProvider>
       <Tooltip>
         <TooltipTrigger asChild>
           <Badge 
             variant={config.variant} 
             className={`${config.className} ${badgeSize} flex items-center gap-1 cursor-help`}
           >
             <Icon className={iconSize} />
             {size !== 'sm' && config.label}
           </Badge>
         </TooltipTrigger>
         <TooltipContent side="top" className="max-w-xs">
           <div className="space-y-1 text-xs">
             <div className="font-medium">{config.label}</div>
             {templateName && <div className="text-muted-foreground">Template: {templateName}</div>}
             {currentStage && <div className="text-muted-foreground">Stage: {currentStage}</div>}
             {config.timeLabel && <div className="text-muted-foreground">{config.timeLabel}</div>}
           </div>
         </TooltipContent>
       </Tooltip>
     </TooltipProvider>
   );
 }