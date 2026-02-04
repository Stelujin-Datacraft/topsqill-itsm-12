import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, Loader2, Sparkles, Minimize2, Maximize2, FileText, GitBranch, BarChart3, Database, Clock, Bell, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { useForm } from '@/contexts/FormContext';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

interface UserInsights {
  pendingApprovals: number;
  mySubmissions: number;
  assignedTasks: number;
  recentForms: Array<{ id: string; name: string }>;
}

// Page context mapping for contextual help
const PAGE_CONTEXT: Record<string, { name: string; description: string; tips: string[] }> = {
  '/forms': {
    name: 'Forms',
    description: 'Manage and create forms for data collection',
    tips: ['Click "New Form" to create a form', 'Use AI to generate forms from descriptions', 'Set up form rules for dynamic behavior']
  },
  '/workflows': {
    name: 'Workflows',
    description: 'Automate processes with workflow designer',
    tips: ['Drag nodes to build workflows', 'Use conditions to branch logic', 'Set triggers based on form submissions']
  },
  '/reports': {
    name: 'Reports',
    description: 'Visualize data with charts and dashboards',
    tips: ['Add charts from the toolbar', 'Use AI to suggest visualizations', 'Filter data with natural language']
  },
  '/query': {
    name: 'Query Editor',
    description: 'Run SQL queries on your data',
    tips: ['Use AI to generate SQL', 'Save queries for reuse', 'Export results to CSV']
  },
  '/my-submissions': {
    name: 'My Submissions',
    description: 'View and manage your form submissions',
    tips: ['Filter by form or date', 'Click a submission to view details', 'Track approval status']
  },
  '/settings': {
    name: 'Settings',
    description: 'Configure system preferences',
    tips: ['Manage users and permissions', 'Configure email templates', 'Set up integrations']
  },
  '/dashboard': {
    name: 'Dashboard',
    description: 'Overview of your workspace',
    tips: ['Customize widgets', 'View quick stats', 'Access recent items']
  }
};

// Slash commands
const SLASH_COMMANDS = [
  { command: '/status', description: 'Show your pending items and stats' },
  { command: '/forms', description: 'List available forms' },
  { command: '/help', description: 'Show available commands' },
  { command: '/navigate', description: 'Quick navigation guide' },
  { command: '/clear', description: 'Clear chat history' },
  { command: '/tips', description: 'Tips for current page' }
];

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load from sessionStorage if available
    const saved = sessionStorage.getItem('ai-chatbot-messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch {
        return getWelcomeMessages();
      }
    }
    return getWelcomeMessages();
  });
  const [input, setInput] = useState('');
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [reports, setReports] = useState<ReportInfo[]>([]);
  const [userInsights, setUserInsights] = useState<UserInsights | null>(null);
  const { chatbotAssist, isLoading } = useFormAI();
  const { forms } = useForm();
  const { currentProject } = useProject();
  const { userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function getWelcomeMessages(): Message[] {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! 👋 I'm your TopsQill ITSM assistant.

**Quick Commands:**
- Type \`/status\` to see your pending items
- Type \`/help\` for all commands
- Type \`/tips\` for tips on your current page

**I can help you:**
- Navigate to any module
- Explain features and guide you
- Find forms, workflows, or reports

What would you like to do?`,
        timestamp: new Date()
      }
    ];
  }

  // Save messages to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('ai-chatbot-messages', JSON.stringify(messages));
  }, [messages]);

  // Load workflows and reports when project changes
  useEffect(() => {
    const loadData = async () => {
      if (!currentProject?.id) return;

      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        
        // Load workflows
        const workflowResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/workflows?project_id=eq.${currentProject.id}&is_active=eq.true&select=id,name,description&order=name`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${token}`
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
              'Authorization': `Bearer ${token}`
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

  // Load user insights
  useEffect(() => {
    const loadInsights = async () => {
      if (!userProfile?.id || !currentProject?.id) return;

      try {
        // Get pending approvals count
        const { count: pendingApprovals } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending');

        // Get my submissions count
        const { count: mySubmissions } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('submitted_by', userProfile.id);

        // Get assigned tasks
        const { count: assignedTasks } = await supabase
          .from('form_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to_user_id', userProfile.id)
          .eq('status', 'pending');

        // Get recent forms (last 3)
        const recentForms = forms.slice(0, 3).map(f => ({ id: f.id, name: f.name }));

        setUserInsights({
          pendingApprovals: pendingApprovals || 0,
          mySubmissions: mySubmissions || 0,
          assignedTasks: assignedTasks || 0,
          recentForms
        });
      } catch (error) {
        console.error('Error loading user insights:', error);
      }
    };

    loadInsights();
  }, [userProfile?.id, currentProject?.id, forms]);

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

  // Get current page context
  const getCurrentPageContext = useCallback(() => {
    const path = location.pathname;
    // Check exact match first
    if (PAGE_CONTEXT[path]) return PAGE_CONTEXT[path];
    // Check partial matches
    for (const [key, value] of Object.entries(PAGE_CONTEXT)) {
      if (path.startsWith(key)) return value;
    }
    return null;
  }, [location.pathname]);

  // Handle slash commands
  const handleSlashCommand = useCallback((command: string): string | null => {
    switch (command.toLowerCase()) {
      case '/status':
        if (!userInsights) return "Loading your status...";
        return `📊 **Your Status:**

- 🔔 **Pending Approvals:** ${userInsights.pendingApprovals}
- 📝 **Your Submissions:** ${userInsights.mySubmissions}
- ✅ **Assigned Tasks:** ${userInsights.assignedTasks}

${userInsights.recentForms.length > 0 ? `**Recent Forms:**\n${userInsights.recentForms.map(f => `- [${f.name}](/forms/${f.id}/view)`).join('\n')}` : ''}`;

      case '/forms':
        if (forms.length === 0) return "No forms found in this project.";
        return `📋 **Available Forms:**\n\n${forms.slice(0, 10).map(f => `- [${f.name}](/forms/${f.id}/view) - ${f.status}`).join('\n')}${forms.length > 10 ? `\n\n...and ${forms.length - 10} more. [View all forms](/forms)` : ''}`;

      case '/help':
        return `🔧 **Available Commands:**

${SLASH_COMMANDS.map(c => `- \`${c.command}\` - ${c.description}`).join('\n')}

**Or just ask me anything!** I can help you navigate, explain features, or guide you through tasks.`;

      case '/navigate':
        return `🧭 **Quick Navigation:**

- [Forms](/forms) - Create and manage forms
- [Workflows](/workflows) - Build automations
- [Reports](/reports) - Data visualization
- [Query Editor](/query) - SQL queries
- [My Submissions](/my-submissions) - Your submissions
- [Settings](/settings) - System configuration`;

      case '/clear':
        setTimeout(() => clearChat(), 100);
        return null;

      case '/tips':
        const pageContext = getCurrentPageContext();
        if (!pageContext) return "No specific tips for this page. Try asking me about what you need!";
        return `💡 **Tips for ${pageContext.name}:**

${pageContext.description}

**Quick tips:**
${pageContext.tips.map(t => `- ${t}`).join('\n')}`;

      default:
        return null;
    }
  }, [userInsights, forms, getCurrentPageContext]);

  // Handle navigation links in messages
  const handleNavigationClick = (path: string) => {
    navigate(path);
    setMessages(prev => [...prev, {
      id: `nav-${Date.now()}`,
      role: 'assistant',
      content: `✓ Navigated to ${path}`,
      timestamp: new Date()
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowSlashCommands(false);

    // Check for slash commands
    if (userInput.startsWith('/')) {
      const command = userInput.split(' ')[0].toLowerCase();
      const response = handleSlashCommand(command);
      
      if (response) {
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }]);
      }
      return;
    }

    // Build chat history for context
    const chatHistory = messages
      .filter(m => m.id !== 'welcome')
      .slice(-10) // Keep last 10 messages for context
      .map(m => ({ role: m.role, content: m.content }));

    // Add page context to the request
    const pageContext = getCurrentPageContext();
    const contextualInput = pageContext 
      ? `[User is on ${pageContext.name} page: ${pageContext.description}]\n\n${userInput}`
      : userInput;

    const result = await chatbotAssist(
      contextualInput,
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
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setShowSlashCommands(value.startsWith('/') && value.length <= 10);
  };

  const clearChat = () => {
    setMessages(getWelcomeMessages());
    sessionStorage.removeItem('ai-chatbot-messages');
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

  // Filter slash commands based on input
  const filteredCommands = SLASH_COMMANDS.filter(c => 
    c.command.startsWith(input.toLowerCase())
  );

  // Floating button when closed
  if (!isOpen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
              size="icon"
            >
              <MessageCircle className="h-6 w-6" />
              {userInsights && userInsights.pendingApprovals > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {userInsights.pendingApprovals > 9 ? '9+' : userInsights.pendingApprovals}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 bg-background border rounded-lg shadow-xl z-50 flex flex-col transition-all duration-200",
        isMinimized ? "w-72 h-14" : "w-[420px] h-[600px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">AI Assistant</span>
          {getCurrentPageContext() && (
            <Badge variant="secondary" className="text-xs">
              {getCurrentPageContext()?.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
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
          {/* Status Bar */}
          {userInsights && (
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-3 text-xs">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => navigate('/approvals')}>
                      <Bell className="h-3 w-3 text-amber-500" />
                      <span>{userInsights.pendingApprovals}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Pending Approvals</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => navigate('/my-submissions')}>
                      <FileText className="h-3 w-3 text-blue-500" />
                      <span>{userInsights.mySubmissions}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>My Submissions</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-pointer">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>{userInsights.assignedTasks}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Assigned Tasks</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

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

          {/* Slash Commands Popup */}
          {showSlashCommands && filteredCommands.length > 0 && (
            <div className="mx-3 mb-2 border rounded-lg bg-popover shadow-lg overflow-hidden">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.command}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                  onClick={() => {
                    setInput(cmd.command);
                    setShowSlashCommands(false);
                    inputRef.current?.focus();
                  }}
                >
                  <code className="text-primary">{cmd.command}</code>
                  <span className="text-muted-foreground text-xs">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Navigation */}
          <div className="px-3 py-2 border-t bg-muted/30">
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

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type / for commands or ask anything..."
                disabled={isLoading}
                className="flex-1"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearChat}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
