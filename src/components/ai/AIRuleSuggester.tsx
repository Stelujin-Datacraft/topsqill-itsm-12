 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { Textarea } from '@/components/ui/textarea';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Checkbox } from '@/components/ui/checkbox';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Sparkles, Loader2, Zap, Settings, Check, Info, Lightbulb } from 'lucide-react';
 import { useFormAI } from '@/hooks/useFormAI';
 import { FormField } from '@/types/form';
 import { FieldRule, FormRule } from '@/types/rules';
 import { toast } from 'sonner';
 
 interface AIRuleSuggesterProps {
   formFields: FormField[];
   formName?: string;
   formDescription?: string;
   existingFieldRules?: FieldRule[];
   existingFormRules?: FormRule[];
   onApplyFieldRules: (rules: FieldRule[]) => void;
   onApplyFormRules: (rules: FormRule[]) => void;
 }
 
 interface GeneratedFieldRule {
   name: string;
   targetFieldId: string;
   targetFieldLabel: string;
   conditions: Array<{
     fieldId: string;
     fieldLabel: string;
     operator: string;
     value: string | string[] | number | boolean;
   }>;
   logicExpression: string;
   action: string;
   actionValue?: string | string[] | number | boolean;
   explanation: string;
   selected: boolean;
 }
 
 interface GeneratedFormRule {
   name: string;
   conditions: Array<{
     fieldId: string;
     fieldLabel: string;
     operator: string;
     value: string | string[] | number | boolean;
   }>;
   logicExpression: string;
   action: string;
   actionValue?: string | any;
   explanation: string;
   selected: boolean;
 }
 
 export function AIRuleSuggester({
   formFields,
   formName,
   formDescription,
   existingFieldRules = [],
   existingFormRules = [],
   onApplyFieldRules,
   onApplyFormRules
 }: AIRuleSuggesterProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [activeTab, setActiveTab] = useState<'field' | 'form'>('field');
   const [prompt, setPrompt] = useState('');
   const [generatedFieldRules, setGeneratedFieldRules] = useState<GeneratedFieldRule[]>([]);
   const [generatedFormRules, setGeneratedFormRules] = useState<GeneratedFormRule[]>([]);
   const [fieldSummary, setFieldSummary] = useState('');
   const [formSummary, setFormSummary] = useState('');
   const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
   const [formSuggestions, setFormSuggestions] = useState<string[]>([]);
 
   const { suggestFieldRules, suggestFormRules, isLoading } = useFormAI();
 
   const handleGenerate = async () => {
     if (!prompt.trim()) {
       toast.error('Please describe what rules you want to create');
       return;
     }
 
     if (formFields.length === 0) {
       toast.error('No form fields available. Add fields to your form first.');
       return;
     }
 
     if (activeTab === 'field') {
       const result = await suggestFieldRules(formFields, prompt, {
         formName,
         formDescription,
         existingRules: existingFieldRules.map(r => ({
           name: r.name,
           targetField: r.targetFieldId,
           action: r.action
         }))
       });
 
       if (result?.rules) {
         setGeneratedFieldRules(result.rules.map(r => ({ ...r, selected: true })));
         setFieldSummary(result.summary || '');
         setFieldSuggestions(result.suggestions || []);
         toast.success(`Generated ${result.rules.length} field rule(s)`);
       }
     } else {
       const result = await suggestFormRules(formFields, prompt, {
         formName,
         formDescription,
         existingRules: existingFormRules.map(r => ({
           name: r.name,
           action: r.action
         }))
       });
 
       if (result?.rules) {
         setGeneratedFormRules(result.rules.map(r => ({ ...r, selected: true })));
         setFormSummary(result.summary || '');
         setFormSuggestions(result.suggestions || []);
         toast.success(`Generated ${result.rules.length} form rule(s)`);
       }
     }
   };
 
   const handleApplyFieldRules = () => {
     const selectedRules = generatedFieldRules.filter(r => r.selected);
     if (selectedRules.length === 0) {
       toast.error('Please select at least one rule to apply');
       return;
     }
 
     const newRules: FieldRule[] = selectedRules.map(rule => ({
       id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
       name: rule.name,
       targetFieldId: rule.targetFieldId,
       conditions: rule.conditions.map((cond, idx) => ({
         id: `condition-${Date.now()}-${idx}`,
         fieldId: cond.fieldId,
         operator: cond.operator as any,
         value: cond.value
       })),
       logicExpression: rule.logicExpression,
       action: rule.action as any,
       actionValue: rule.actionValue,
       isActive: true
     }));
 
     onApplyFieldRules([...existingFieldRules, ...newRules]);
     toast.success(`Applied ${newRules.length} field rule(s)`);
     resetAndClose();
   };
 
   const handleApplyFormRules = () => {
     const selectedRules = generatedFormRules.filter(r => r.selected);
     if (selectedRules.length === 0) {
       toast.error('Please select at least one rule to apply');
       return;
     }
 
     const newRules: FormRule[] = selectedRules.map(rule => ({
       id: `form-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
       name: rule.name,
       conditions: rule.conditions.map((cond, idx) => ({
         id: `condition-${Date.now()}-${idx}`,
         type: 'single' as const,
         fieldId: cond.fieldId,
         operator: cond.operator as any,
         value: cond.value
       })),
       logicExpression: rule.logicExpression,
       action: rule.action as any,
       actionValue: rule.actionValue,
       isActive: true
     }));
 
     onApplyFormRules([...existingFormRules, ...newRules]);
     toast.success(`Applied ${newRules.length} form rule(s)`);
     resetAndClose();
   };
 
   const resetAndClose = () => {
     setPrompt('');
     setGeneratedFieldRules([]);
     setGeneratedFormRules([]);
     setFieldSummary('');
     setFormSummary('');
     setFieldSuggestions([]);
     setFormSuggestions([]);
     setIsOpen(false);
   };
 
   const toggleFieldRuleSelection = (index: number) => {
     setGeneratedFieldRules(prev => 
       prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r)
     );
   };
 
   const toggleFormRuleSelection = (index: number) => {
     setGeneratedFormRules(prev => 
       prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r)
     );
   };
 
   const getActionBadgeColor = (action: string) => {
     const colors: Record<string, string> = {
      show: 'bg-primary/10 text-primary',
      hide: 'bg-muted text-muted-foreground',
      enable: 'bg-accent text-accent-foreground',
      disable: 'bg-secondary text-secondary-foreground',
      require: 'bg-destructive/10 text-destructive',
      optional: 'bg-primary/10 text-primary',
      approve: 'bg-primary/10 text-primary',
      reject: 'bg-destructive/10 text-destructive',
      notify: 'bg-accent text-accent-foreground',
      sendEmail: 'bg-secondary text-secondary-foreground'
     };
     return colors[action] || 'bg-muted text-muted-foreground';
   };
 
   const examplePrompts = activeTab === 'field' 
     ? [
         "Show additional details field when priority is High or Critical",
         "Make phone number required when contact method is Phone",
         "Hide billing address if same as shipping address is checked",
         "Disable end date if ongoing checkbox is selected"
       ]
     : [
         "Auto-approve requests under $1000, send for review otherwise",
         "Send email notification when status changes to Approved",
         "Lock form after submission is approved",
         "Start approval workflow when priority is High"
       ];
 
   return (
     <Dialog open={isOpen} onOpenChange={setIsOpen}>
       <DialogTrigger asChild>
         <Button variant="outline" size="sm" className="gap-2">
           <Sparkles className="h-4 w-4" />
           AI Suggest Rules
         </Button>
       </DialogTrigger>
       <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-primary" />
             AI Rule Suggester
           </DialogTitle>
         </DialogHeader>
 
         <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'field' | 'form')} className="flex-1 flex flex-col overflow-hidden">
           <TabsList className="grid w-full grid-cols-2">
             <TabsTrigger value="field" className="gap-2">
               <Settings className="h-4 w-4" />
               Field Rules
             </TabsTrigger>
             <TabsTrigger value="form" className="gap-2">
               <Zap className="h-4 w-4" />
               Form Rules
             </TabsTrigger>
           </TabsList>
 
           <div className="flex-1 overflow-hidden flex flex-col mt-4">
             {/* Input Section */}
             <div className="space-y-3">
               <div>
                 <label className="text-sm font-medium mb-1.5 block">
                   Describe the rules you want to create
                 </label>
                 <Textarea
                   placeholder={activeTab === 'field' 
                     ? "E.g., Show additional fields when category is 'Other', make phone required when preferred contact is phone..."
                     : "E.g., Auto-approve low value requests, send notifications on approval, lock form after completion..."
                   }
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   className="min-h-[80px]"
                 />
               </div>
 
               {/* Example Prompts */}
               <div className="flex flex-wrap gap-1.5">
                 {examplePrompts.slice(0, 2).map((example, idx) => (
                   <Button
                     key={idx}
                     variant="ghost"
                     size="sm"
                     className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                     onClick={() => setPrompt(example)}
                   >
                     <Lightbulb className="h-3 w-3 mr-1" />
                     {example.length > 50 ? example.substring(0, 50) + '...' : example}
                   </Button>
                 ))}
               </div>
 
               <Button 
                 onClick={handleGenerate} 
                 disabled={isLoading || !prompt.trim()}
                 className="w-full"
               >
                 {isLoading ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Generating...
                   </>
                 ) : (
                   <>
                     <Sparkles className="h-4 w-4 mr-2" />
                     Generate {activeTab === 'field' ? 'Field' : 'Form'} Rules
                   </>
                 )}
               </Button>
             </div>
 
             {/* Results Section */}
             <TabsContent value="field" className="flex-1 overflow-hidden mt-4">
               {generatedFieldRules.length > 0 && (
                 <div className="flex flex-col h-full">
                   {fieldSummary && (
                     <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                       <Info className="h-4 w-4 mt-0.5 text-primary" />
                       <p className="text-sm text-muted-foreground">{fieldSummary}</p>
                     </div>
                   )}
 
                   <ScrollArea className="flex-1 pr-4">
                     <div className="space-y-3">
                       {generatedFieldRules.map((rule, index) => (
                         <Card 
                           key={index} 
                           className={`cursor-pointer transition-all ${rule.selected ? 'ring-2 ring-primary' : 'opacity-60'}`}
                           onClick={() => toggleFieldRuleSelection(index)}
                         >
                           <CardHeader className="pb-2">
                             <div className="flex items-start justify-between">
                               <div className="flex items-center gap-2">
                                 <Checkbox checked={rule.selected} />
                                 <CardTitle className="text-sm">{rule.name}</CardTitle>
                               </div>
                               <Badge className={getActionBadgeColor(rule.action)}>
                                 {rule.action}
                               </Badge>
                             </div>
                             <CardDescription className="text-xs">
                               Target: <span className="font-medium">{rule.targetFieldLabel}</span>
                             </CardDescription>
                           </CardHeader>
                           <CardContent className="pt-0">
                             <p className="text-xs text-muted-foreground">{rule.explanation}</p>
                             <div className="mt-2 flex flex-wrap gap-1">
                               {rule.conditions.map((cond, cIdx) => (
                                 <Badge key={cIdx} variant="outline" className="text-xs">
                                   {cond.fieldLabel} {cond.operator} {String(cond.value)}
                                 </Badge>
                               ))}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   </ScrollArea>
 
                   {fieldSuggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-secondary rounded-lg">
                      <p className="text-xs font-medium text-secondary-foreground mb-1">
                         Additional Suggestions:
                       </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                         {fieldSuggestions.map((s, i) => (
                           <li key={i}>• {s}</li>
                         ))}
                       </ul>
                     </div>
                   )}
 
                   <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                     <Button variant="outline" onClick={resetAndClose}>
                       Cancel
                     </Button>
                     <Button onClick={handleApplyFieldRules}>
                       <Check className="h-4 w-4 mr-2" />
                       Apply {generatedFieldRules.filter(r => r.selected).length} Rule(s)
                     </Button>
                   </div>
                 </div>
               )}
             </TabsContent>
 
             <TabsContent value="form" className="flex-1 overflow-hidden mt-4">
               {generatedFormRules.length > 0 && (
                 <div className="flex flex-col h-full">
                   {formSummary && (
                     <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                       <Info className="h-4 w-4 mt-0.5 text-primary" />
                       <p className="text-sm text-muted-foreground">{formSummary}</p>
                     </div>
                   )}
 
                   <ScrollArea className="flex-1 pr-4">
                     <div className="space-y-3">
                       {generatedFormRules.map((rule, index) => (
                         <Card 
                           key={index} 
                           className={`cursor-pointer transition-all ${rule.selected ? 'ring-2 ring-primary' : 'opacity-60'}`}
                           onClick={() => toggleFormRuleSelection(index)}
                         >
                           <CardHeader className="pb-2">
                             <div className="flex items-start justify-between">
                               <div className="flex items-center gap-2">
                                 <Checkbox checked={rule.selected} />
                                 <CardTitle className="text-sm">{rule.name}</CardTitle>
                               </div>
                               <Badge className={getActionBadgeColor(rule.action)}>
                                 {rule.action}
                               </Badge>
                             </div>
                           </CardHeader>
                           <CardContent className="pt-0">
                             <p className="text-xs text-muted-foreground">{rule.explanation}</p>
                             <div className="mt-2 flex flex-wrap gap-1">
                               {rule.conditions.map((cond, cIdx) => (
                                 <Badge key={cIdx} variant="outline" className="text-xs">
                                   {cond.fieldLabel} {cond.operator} {String(cond.value)}
                                 </Badge>
                               ))}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   </ScrollArea>
 
                   {formSuggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-secondary rounded-lg">
                      <p className="text-xs font-medium text-secondary-foreground mb-1">
                         Additional Suggestions:
                       </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                         {formSuggestions.map((s, i) => (
                           <li key={i}>• {s}</li>
                         ))}
                       </ul>
                     </div>
                   )}
 
                   <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                     <Button variant="outline" onClick={resetAndClose}>
                       Cancel
                     </Button>
                     <Button onClick={handleApplyFormRules}>
                       <Check className="h-4 w-4 mr-2" />
                       Apply {generatedFormRules.filter(r => r.selected).length} Rule(s)
                     </Button>
                   </div>
                 </div>
               )}
             </TabsContent>
           </div>
         </Tabs>
       </DialogContent>
     </Dialog>
   );
 }