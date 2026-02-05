 import React, { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Sparkles, Loader2, Clock, AlertTriangle } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 
 interface GeneratedTemplate {
   name: string;
   description: string;
   warning_hours: number;
   breach_hours: number;
   use_business_hours: boolean;
   business_start_time?: string;
   business_end_time?: string;
   business_days?: string[];
   priority_multipliers?: Record<string, number>;
 }
 
 interface GeneratedChain {
   name: string;
   description: string;
   levels: Array<{
     level: 'L1' | 'L2' | 'L3' | 'L4';
     hours_after_breach: number;
     send_email: boolean;
     send_notification: boolean;
     change_priority: boolean;
     new_priority?: string;
     custom_message?: string;
   }>;
 }
 
 interface AISLAGeneratorProps {
   type: 'template' | 'chain';
   onApply: (data: GeneratedTemplate | GeneratedChain) => void;
 }
 
 export function AISLAGenerator({ type, onApply }: AISLAGeneratorProps) {
   const [open, setOpen] = useState(false);
   const [prompt, setPrompt] = useState('');
   const [industry, setIndustry] = useState('general');
   const [loading, setLoading] = useState(false);
   const [result, setResult] = useState<GeneratedTemplate | GeneratedChain | null>(null);
   const { toast } = useToast();
 
   const industries = [
     { value: 'general', label: 'General Business' },
     { value: 'it_support', label: 'IT Support / Help Desk' },
     { value: 'customer_service', label: 'Customer Service' },
     { value: 'healthcare', label: 'Healthcare' },
     { value: 'finance', label: 'Finance / Banking' },
     { value: 'manufacturing', label: 'Manufacturing' },
     { value: 'hr', label: 'Human Resources' },
     { value: 'legal', label: 'Legal Services' },
   ];
 
   const handleGenerate = async () => {
     if (!prompt.trim()) {
       toast({ title: 'Please describe what you need', variant: 'destructive' });
       return;
     }
 
     setLoading(true);
     setResult(null);
 
     try {
       const action = type === 'template' ? 'generate-sla-template' : 'generate-escalation-chain';
       
       const { data, error } = await supabase.functions.invoke('ai-assistant', {
         body: {
           action,
           context: {
             userInput: prompt,
             industry,
           }
         }
       });
 
       if (error) throw error;
       
       if (data?.success && data?.result) {
         setResult(data.result);
         toast({ title: `${type === 'template' ? 'SLA Template' : 'Escalation Chain'} generated!` });
       } else {
         throw new Error(data?.error || 'Failed to generate');
       }
     } catch (err: any) {
       console.error('AI generation error:', err);
       toast({
         title: 'Generation failed',
         description: err.message || 'Please try again',
         variant: 'destructive'
       });
     } finally {
       setLoading(false);
     }
   };
 
   const handleApply = () => {
     if (result) {
       onApply(result);
       setOpen(false);
       setResult(null);
       setPrompt('');
     }
   };
 
   const examplePrompts = type === 'template' 
     ? [
         'Standard IT ticket SLA with 4 hour warning and 8 hour breach',
         'Critical incident response with business hours only',
         'Customer support request with priority-based response times',
       ]
     : [
         'IT support escalation from technician to manager to director',
         '4-level escalation with increasing urgency notifications',
         'Simple 2-level escalation with email and priority change',
       ];
 
   return (
     <Dialog open={open} onOpenChange={setOpen}>
       <DialogTrigger asChild>
         <Button variant="outline" size="sm" className="gap-2">
           <Sparkles className="h-4 w-4" />
           AI Generate
         </Button>
       </DialogTrigger>
       <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-primary" />
             Generate {type === 'template' ? 'SLA Template' : 'Escalation Chain'} with AI
           </DialogTitle>
           <DialogDescription>
             Describe what you need and AI will create a {type === 'template' ? 'template' : 'chain'} for you
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4">
           {/* Industry Selection */}
           <div className="space-y-2">
             <Label>Industry Context</Label>
             <Select value={industry} onValueChange={setIndustry}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {industries.map(ind => (
                   <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Prompt Input */}
           <div className="space-y-2">
             <Label>Describe your requirements</Label>
             <Textarea
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder={type === 'template' 
                 ? "e.g., Create an SLA for support tickets with 2 hour warning for high priority and 8 hours for low priority..."
                 : "e.g., Create a 3-level escalation chain that notifies the team lead first, then manager, then director..."
               }
               className="min-h-[100px]"
             />
           </div>
 
           {/* Example Prompts */}
           <div className="space-y-2">
             <Label className="text-xs text-muted-foreground">Example prompts:</Label>
             <div className="flex flex-wrap gap-2">
               {examplePrompts.map((ex, i) => (
                 <Badge 
                   key={i} 
                   variant="outline" 
                   className="cursor-pointer hover:bg-accent text-xs"
                   onClick={() => setPrompt(ex)}
                 >
                   {ex.length > 50 ? ex.slice(0, 50) + '...' : ex}
                 </Badge>
               ))}
             </div>
           </div>
 
           <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full">
             {loading ? (
               <>
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Generating...
               </>
             ) : (
               <>
                 <Sparkles className="h-4 w-4 mr-2" />
                 Generate {type === 'template' ? 'Template' : 'Chain'}
               </>
             )}
           </Button>
 
           {/* Result Preview */}
           {result && type === 'template' && (
             <Card className="border-primary/30 bg-primary/5">
               <CardHeader className="pb-2">
                 <CardTitle className="text-base flex items-center gap-2">
                   <Clock className="h-4 w-4" />
                   {(result as GeneratedTemplate).name}
                 </CardTitle>
                 {(result as GeneratedTemplate).description && (
                   <CardDescription>{(result as GeneratedTemplate).description}</CardDescription>
                 )}
               </CardHeader>
               <CardContent className="space-y-3">
                 <div className="grid grid-cols-2 gap-3 text-sm">
                   <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                     <div className="w-2 h-2 rounded-full bg-amber-500" />
                     <span className="text-muted-foreground">Warning:</span>
                     <span className="font-medium">{(result as GeneratedTemplate).warning_hours}h</span>
                   </div>
                   <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                     <div className="w-2 h-2 rounded-full bg-red-500" />
                     <span className="text-muted-foreground">Breach:</span>
                     <span className="font-medium">{(result as GeneratedTemplate).breach_hours}h</span>
                   </div>
                 </div>
                 {(result as GeneratedTemplate).use_business_hours && (
                   <p className="text-xs text-muted-foreground">
                     Business hours: {(result as GeneratedTemplate).business_start_time} - {(result as GeneratedTemplate).business_end_time}
                   </p>
                 )}
                 {(result as GeneratedTemplate).priority_multipliers && (
                   <div className="text-xs text-muted-foreground">
                     Priority multipliers: {Object.entries((result as GeneratedTemplate).priority_multipliers || {}).map(([k, v]) => `${k}: ${v}x`).join(', ')}
                   </div>
                 )}
               </CardContent>
             </Card>
           )}
 
           {result && type === 'chain' && (
             <Card className="border-primary/30 bg-primary/5">
               <CardHeader className="pb-2">
                 <CardTitle className="text-base flex items-center gap-2">
                   <AlertTriangle className="h-4 w-4" />
                   {(result as GeneratedChain).name}
                 </CardTitle>
                 {(result as GeneratedChain).description && (
                   <CardDescription>{(result as GeneratedChain).description}</CardDescription>
                 )}
               </CardHeader>
               <CardContent>
                 <div className="flex items-center gap-2 flex-wrap">
                   {(result as GeneratedChain).levels?.map((level, index) => (
                     <React.Fragment key={index}>
                      <div className={`px-3 py-2 rounded-lg flex items-center gap-2 bg-muted text-muted-foreground border ${
                        level.level === 'L1' ? 'border-primary/30' :
                        level.level === 'L2' ? 'border-amber-500/30' :
                        level.level === 'L3' ? 'border-orange-500/30' :
                        'border-destructive/30'
                      }`}>
                         <span className="font-semibold">{level.level}</span>
                         <span className="text-xs opacity-75">+{level.hours_after_breach}h</span>
                       </div>
                       {index < ((result as GeneratedChain).levels?.length || 0) - 1 && (
                         <span className="text-muted-foreground">→</span>
                       )}
                     </React.Fragment>
                   ))}
                 </div>
               </CardContent>
             </Card>
           )}
 
           {result && (
             <div className="flex gap-2">
               <Button variant="outline" onClick={() => setResult(null)} className="flex-1">
                 Regenerate
               </Button>
               <Button onClick={handleApply} className="flex-1">
                 Apply & Create
               </Button>
             </div>
           )}
         </div>
       </DialogContent>
     </Dialog>
   );
 }