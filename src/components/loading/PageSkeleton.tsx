 import { Skeleton } from '@/components/ui/skeleton';
 
 /**
  * Animated skeleton loader for page content
  * Creates a professional loading experience that matches content structure
  */
 export function PageSkeleton() {
   return (
     <div className="flex-1 p-6 space-y-6 animate-in fade-in duration-300">
       {/* Header skeleton */}
       <div className="flex items-center justify-between">
         <div className="space-y-2">
           <Skeleton className="h-8 w-48 bg-muted/60" />
           <Skeleton className="h-4 w-72 bg-muted/40" />
         </div>
         <div className="flex gap-2">
           <Skeleton className="h-10 w-24 bg-muted/50" />
           <Skeleton className="h-10 w-32 bg-muted/50" />
         </div>
       </div>
 
       {/* Stats/cards row skeleton */}
       <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
         {[...Array(4)].map((_, i) => (
           <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/50">
             <Skeleton className="h-4 w-20 mb-2 bg-muted/40" />
             <Skeleton className="h-8 w-16 bg-muted/60" />
           </div>
         ))}
       </div>
 
       {/* Table/content skeleton */}
       <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
         {/* Table header */}
         <div className="flex gap-4 p-4 border-b border-border/30 bg-muted/20">
           <Skeleton className="h-4 w-8 bg-muted/50" />
           <Skeleton className="h-4 w-32 bg-muted/50" />
           <Skeleton className="h-4 w-40 bg-muted/50" />
           <Skeleton className="h-4 w-24 bg-muted/50" />
           <Skeleton className="h-4 w-20 bg-muted/50" />
         </div>
         {/* Table rows */}
         {[...Array(6)].map((_, i) => (
           <div 
             key={i} 
             className="flex gap-4 p-4 border-b border-border/20 last:border-0"
             style={{ animationDelay: `${i * 50}ms` }}
           >
             <Skeleton className="h-4 w-8 bg-muted/40" />
             <Skeleton className="h-4 w-32 bg-muted/40" />
             <Skeleton className="h-4 w-40 bg-muted/40" />
             <Skeleton className="h-4 w-24 bg-muted/40" />
             <Skeleton className="h-4 w-20 bg-muted/40" />
           </div>
         ))}
       </div>
     </div>
   );
 }
 
 /**
  * Minimal skeleton for quick transitions
  */
 export function MinimalSkeleton() {
   return (
     <div className="flex-1 flex items-center justify-center animate-in fade-in duration-200">
       <div className="space-y-4 w-full max-w-md px-4">
         <div className="flex justify-center">
           <div className="relative">
             <Skeleton className="h-12 w-12 rounded-full bg-primary/20" />
             <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
           </div>
         </div>
         <Skeleton className="h-3 w-full bg-muted/30" />
         <Skeleton className="h-3 w-3/4 mx-auto bg-muted/20" />
       </div>
     </div>
   );
 }
 
 /**
  * Dashboard-style skeleton with widgets
  */
 export function DashboardSkeleton() {
   return (
     <div className="flex-1 p-6 space-y-6 animate-in fade-in duration-300">
       {/* Header */}
       <div className="flex items-center justify-between">
         <Skeleton className="h-8 w-40 bg-muted/60" />
         <Skeleton className="h-10 w-36 bg-muted/50" />
       </div>
 
       {/* Stats cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         {[...Array(4)].map((_, i) => (
           <div key={i} className="p-5 rounded-xl border border-border/50 bg-card/50">
             <div className="flex items-center justify-between mb-3">
               <Skeleton className="h-4 w-24 bg-muted/40" />
               <Skeleton className="h-8 w-8 rounded-lg bg-muted/30" />
             </div>
             <Skeleton className="h-7 w-16 bg-muted/60" />
             <Skeleton className="h-3 w-20 mt-2 bg-muted/30" />
           </div>
         ))}
       </div>
 
       {/* Charts row */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="p-5 rounded-xl border border-border/50 bg-card/30">
           <Skeleton className="h-5 w-32 mb-4 bg-muted/50" />
           <Skeleton className="h-48 w-full bg-muted/20 rounded-lg" />
         </div>
         <div className="p-5 rounded-xl border border-border/50 bg-card/30">
           <Skeleton className="h-5 w-28 mb-4 bg-muted/50" />
           <Skeleton className="h-48 w-full bg-muted/20 rounded-lg" />
         </div>
       </div>
     </div>
   );
 }
 
 /**
  * Form builder skeleton
  */
 export function FormBuilderSkeleton() {
   return (
     <div className="flex-1 flex animate-in fade-in duration-300">
       {/* Sidebar */}
       <div className="w-64 border-r border-border/50 p-4 space-y-3">
         <Skeleton className="h-6 w-24 bg-muted/50" />
         {[...Array(8)].map((_, i) => (
           <Skeleton key={i} className="h-10 w-full bg-muted/30 rounded-lg" />
         ))}
       </div>
       {/* Main area */}
       <div className="flex-1 p-6 space-y-4">
         <Skeleton className="h-8 w-64 bg-muted/60" />
         <div className="space-y-3">
           {[...Array(5)].map((_, i) => (
             <Skeleton key={i} className="h-16 w-full bg-muted/30 rounded-lg" />
           ))}
         </div>
       </div>
     </div>
   );
 }