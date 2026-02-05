import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
 import { MessageCircle, X, Send, Loader2, Sparkles, Minimize2, Maximize2, Navigation, FileText, GitBranch, BarChart3, Layout, Mail, Settings, Database, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { useForm } from '@/contexts/FormContext';
import { useProject } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
 import { toast } from 'sonner';
 import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
   action?: {
     type: string;
     status: 'pending' | 'executing' | 'success' | 'error';
     result?: any;
   };
}

interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
}

interface ReportInfo {
  id: string;
  name: string;
  description?: string;
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
       content: `Hi! 👋 I'm your **AI Copilot** for TopSqill BPM.

 🚀 **Execute Actions**
 Create forms, trigger workflows, check SLA risks

 🧭 **Navigate**
 Take you anywhere in the system
 
 💡 **Assist**
 Explain features and guide you through tasks

 **Try saying:**
 • "Create a feedback form with name and email"
 • "What are my SLA risks right now?"
 • "Take me to workflows"`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [reports, setReports] = useState<ReportInfo[]>([]);
   const [copilotEnabled, setCopilotEnabled] = useState(true);
  const { chatbotAssist, isLoading } = useFormAI();
  const { forms } = useForm();
  const { currentProject } = useProject();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

   // Execute copilot action
   const executeCopilotAction = async (action: string, params: Record<string, any>) => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error('Not authenticated');
 
       const { data, error } = await supabase.functions.invoke('ai-copilot-action', {
         body: {
           action,
           params,
           userId: user.id,
           projectId: currentProject?.id,
           organizationId: currentProject?.organization_id
         }
       });
 
       if (error) throw error;
       return data;
     } catch (err) {
       console.error('Copilot action error:', err);
       throw err;
     }
   };
 
   // Parse AI response for action commands
   const parseActionCommands = (content: string): { action: string; params: Record<string, any> } | null => {
    // Look for action patterns like: [ACTION:create_form|name=Test Form|fields=[...]]
    // Use a more robust approach that handles nested brackets in JSON values
    const actionStartMatch = content.match(/\[ACTION:(\w+)\|/);
    if (actionStartMatch) {
      const action = actionStartMatch[1];
      const startIndex = actionStartMatch.index! + actionStartMatch[0].length;
      
      // Find the matching closing bracket, accounting for nested brackets
      let bracketCount = 1;
      let endIndex = startIndex;
      for (let i = startIndex; i < content.length && bracketCount > 0; i++) {
        if (content[i] === '[') bracketCount++;
        else if (content[i] === ']') bracketCount--;
        if (bracketCount === 0) {
          endIndex = i;
          break;
        }
      }
      
      const paramsStr = content.substring(startIndex, endIndex);
      const params: Record<string, any> = {};
      
      // Parse params more carefully - split by | but not within brackets
      let currentParam = '';
      let inBrackets = 0;
      for (let i = 0; i < paramsStr.length; i++) {
        const char = paramsStr[i];
        if (char === '[') inBrackets++;
        else if (char === ']') inBrackets--;
        
        if (char === '|' && inBrackets === 0) {
          // Process current param
          const eqIndex = currentParam.indexOf('=');
          if (eqIndex > 0) {
            const key = currentParam.substring(0, eqIndex).trim();
            const value = currentParam.substring(eqIndex + 1);
            try {
              params[key] = JSON.parse(value);
            } catch {
              params[key] = value;
            }
           }
          currentParam = '';
        } else {
          currentParam += char;
         }
      }
      
      // Don't forget the last param
      if (currentParam) {
        const eqIndex = currentParam.indexOf('=');
        if (eqIndex > 0) {
          const key = currentParam.substring(0, eqIndex).trim();
          const value = currentParam.substring(eqIndex + 1);
          try {
            params[key] = JSON.parse(value);
          } catch {
            params[key] = value;
          }
        }
      }
      
       return { action, params };
     }
     return null;
   };
 
  // Load workflows and reports when project changes
  useEffect(() => {
    const loadData = async () => {
      if (!currentProject?.id) return;

      try {
        // Load workflows using raw query to avoid type issues
        const workflowResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/workflows?project_id=eq.${currentProject.id}&is_active=eq.true&select=id,name,description&order=name`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          }
        );
        
        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json();
          setWorkflows(workflowData.map((w: any) => ({ 
            id: w.id, 
            name: w.name, 
            description: w.description || undefined 
          })));
        }

        // Load reports
        const reportResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/reports?project_id=eq.${currentProject.id}&select=id,name,description&order=name`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          }
        );

        if (reportResponse.ok) {
          const reportData = await reportResponse.json();
          setReports(reportData.map((r: any) => ({ 
            id: r.id, 
            name: r.name, 
            description: r.description || undefined 
          })));
        }
      } catch (error) {
        console.error('Error loading workflows/reports:', error);
      }
    };

    loadData();
  }, [currentProject?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Handle navigation links in messages
  const handleNavigationClick = (path: string) => {
    navigate(path);
    // Show a brief confirmation
    setMessages(prev => [...prev, {
      id: `nav-${Date.now()}`,
      role: 'assistant',
      content: `✓ Navigating to ${path}...`,
      timestamp: new Date()
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Build chat history for context
    const chatHistory = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    const result = await chatbotAssist(
      userMessage.content,
      chatHistory,
      {
        availableForms: forms.map(f => ({ 
          id: f.id, 
          name: f.name, 
          description: f.description 
        })),
        availableWorkflows: workflows,
        availableReports: reports,
        currentRoute: location.pathname
      }
    );

    if (result) {
       let messageContent = result.message;
       
       // Check for action commands in the response
       const actionCommand = parseActionCommands(messageContent);
       
       if (actionCommand && copilotEnabled) {
         // Remove the action command from displayed message
         const cleanContent = messageContent.replace(/\[ACTION:[^\]]+\]/, '').trim();
         
         const assistantMessage: Message = {
           id: `assistant-${Date.now()}`,
           role: 'assistant',
           content: cleanContent,
           timestamp: new Date(),
           action: {
             type: actionCommand.action,
             status: 'executing'
           }
         };
         setMessages(prev => [...prev, assistantMessage]);
         
         // Execute the action
         try {
           const actionResult = await executeCopilotAction(actionCommand.action, actionCommand.params);
           
           // Update message with success
           setMessages(prev => prev.map(m => 
             m.id === assistantMessage.id 
               ? { ...m, action: { type: actionCommand.action, status: 'success', result: actionResult } }
               : m
           ));
           
           // Add result message
           const resultMessage: Message = {
             id: `result-${Date.now()}`,
             role: 'assistant',
             content: `✅ **Action completed!** ${actionResult.message || 'Done'}`,
             timestamp: new Date()
           };
           setMessages(prev => [...prev, resultMessage]);
           
           toast.success('Action completed', { description: actionResult.message });
           
           // If action created something, offer to navigate
           if (actionResult.result?.formId && actionResult.result?.workflowId) {
             // Both form and workflow were created
             const navMessage: Message = {
               id: `nav-offer-${Date.now()}`,
               role: 'assistant',
               content: `🎉 **Created both!**\n\n• [Open the form](/form-edit/${actionResult.result.formId})\n• [Open the workflow](/workflow-builder/${actionResult.result.workflowId})`,
               timestamp: new Date()
             };
             setMessages(prev => [...prev, navMessage]);
           } else if (actionResult.result?.formId) {
             const navMessage: Message = {
               id: `nav-offer-${Date.now()}`,
               role: 'assistant',
               content: `Would you like to [open the form](/form-edit/${actionResult.result.formId})?`,
               timestamp: new Date()
             };
             setMessages(prev => [...prev, navMessage]);
           } else if (actionResult.result?.workflowId) {
             const navMessage: Message = {
               id: `nav-offer-${Date.now()}`,
               role: 'assistant',
               content: `Would you like to [open the workflow](/workflow-builder/${actionResult.result.workflowId})?`,
               timestamp: new Date()
             };
             setMessages(prev => [...prev, navMessage]);
           } else if (actionResult.result?.dashboardId) {
             const navMessage: Message = {
               id: `nav-offer-${Date.now()}`,
               role: 'assistant',
               content: `Would you like to [open the dashboard](/dashboard-view/${actionResult.result.dashboardId})?`,
               timestamp: new Date()
             };
             setMessages(prev => [...prev, navMessage]);
           }
           
         } catch (err) {
           // Update message with error
           setMessages(prev => prev.map(m => 
             m.id === assistantMessage.id 
               ? { ...m, action: { type: actionCommand.action, status: 'error' } }
               : m
           ));
           
           const errorMessage: Message = {
             id: `error-${Date.now()}`,
             role: 'assistant',
             content: `❌ **Action failed:** ${err instanceof Error ? err.message : 'Unknown error'}`,
             timestamp: new Date()
           };
           setMessages(prev => [...prev, errorMessage]);
           
           toast.error('Action failed', { description: err instanceof Error ? err.message : 'Unknown error' });
         }
       } else {
         const assistantMessage: Message = {
           id: `assistant-${Date.now()}`,
           role: 'assistant',
           content: messageContent,
           timestamp: new Date()
         };
         setMessages(prev => [...prev, assistantMessage]);
       }
    } else {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
         content: `Hi! 👋 I'm your **AI Copilot** for TopSqill BPM.

 🚀 **Execute Actions**
 Create forms, trigger workflows, check SLA risks

 🧭 **Navigate**
 Take you anywhere in the system
 
 💡 **Assist**
 Explain features and guide you through tasks

 **Try saying:**
 • "Create a feedback form with name and email"
 • "What are my SLA risks right now?"
 • "Take me to workflows"`,
        timestamp: new Date()
      }
    ]);
  };

  // Custom link renderer that handles navigation
  const LinkRenderer = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href && href.startsWith('/')) {
      return (
        <button
          onClick={() => handleNavigationClick(href)}
          className="text-primary underline hover:text-primary/80 cursor-pointer font-medium"
        >
          {children}
        </button>
      );
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>;
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 bg-background border rounded-lg shadow-xl z-50 flex flex-col transition-all duration-200",
        isMinimized ? "w-72 h-14" : "w-[420px] h-[550px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
           <Zap className="h-5 w-5 text-primary" />
           <span className="font-semibold text-sm">AI Copilot</span>
           {copilotEnabled && (
             <Badge variant="secondary" className="text-xs h-5 px-1.5">
               Actions On
             </Badge>
           )}
        </div>
        <div className="flex items-center gap-1">
           <Button
             variant={copilotEnabled ? "default" : "ghost"}
             size="icon"
             className="h-7 w-7"
             onClick={() => setCopilotEnabled(!copilotEnabled)}
             title={copilotEnabled ? "Disable action execution" : "Enable action execution"}
           >
             <Zap className={cn("h-4 w-4", copilotEnabled && "text-primary-foreground")} />
           </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            code: ({ children }) => <code className="bg-muted-foreground/20 px-1 rounded text-xs">{children}</code>,
                            a: LinkRenderer,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Navigation */}
          <div className="px-3 py-2 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground mb-2">Quick Navigate:</div>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => navigate('/forms')}
              >
                <FileText className="h-3 w-3" />
                Forms
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => navigate('/workflows')}
              >
                <GitBranch className="h-3 w-3" />
                Workflows
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => navigate('/reports')}
              >
                <BarChart3 className="h-3 w-3" />
                Reports
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => navigate('/query')}
              >
                <Database className="h-3 w-3" />
                Query
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 border-t">
            <div className="flex gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setInput("How do I create a new form?")}
              >
                Create form
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setInput("What forms are available?")}
              >
                List forms
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setInput("How do I set up a workflow?")}
              >
                Workflows
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground"
                onClick={clearChat}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything or say where to go..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}