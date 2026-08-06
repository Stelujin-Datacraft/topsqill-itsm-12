import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2, FileText, GitBranch, BarChart3, Database, Zap, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { useCopilotEngine } from '@/hooks/useCopilotEngine';
import { CopilotFormPicker } from '@/components/ai/CopilotFormPicker';

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, sendPrompt, clearChat, copilotEnabled, setCopilotEnabled, appendMessage, resolveFormChoice, availableForms } = useCopilotEngine();

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

  // Allow other surfaces to hand a prompt to the copilot
  const sendRef = useRef(sendPrompt);
  sendRef.current = sendPrompt;
  useEffect(() => {
    const onExternalPrompt = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      if (!detail?.prompt?.trim()) return;
      setIsOpen(true);
      setIsMinimized(false);
      setTimeout(() => sendRef.current(detail.prompt as string), 300);
    };
    window.addEventListener('topsqill:copilot-prompt', onExternalPrompt);
    return () => window.removeEventListener('topsqill:copilot-prompt', onExternalPrompt);
  }, []);

  const handleNavigationClick = (path: string) => {
    navigate(path);
    appendMessage({
      id: `nav-${Date.now()}`,
      role: 'assistant',
      content: `✓ Navigating to ${path}...`,
      timestamp: new Date(),
    });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    void sendPrompt(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
          <Zap className="h-5 w-5 text-module-workflows" />
          <span className="font-semibold text-sm">AI Copilot</span>
          {copilotEnabled && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">Actions On</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setIsOpen(false); navigate('/build'); }}
            title="Open full AI Builder"
          >
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            variant={copilotEnabled ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setCopilotEnabled(!copilotEnabled)}
            title={copilotEnabled ? "Disable action execution" : "Enable action execution"}
          >
            <Zap className={cn("h-4 w-4", copilotEnabled && "text-primary-foreground")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
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
                  className={cn("flex", message.role === 'user' ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="space-y-2">
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
                        {message.formPicker && !message.resolved && (
                          <CopilotFormPicker
                            forms={availableForms}
                            onSelect={(formId) => resolveFormChoice(message.id, formId)}
                            placeholder="Search and select a form…"
                          />
                        )}
                        {message.choices && !message.resolved && !message.formPicker && (
                          <div className="flex flex-wrap gap-1.5">
                            {message.choices.map((choice) => (
                              <button
                                key={choice.value}
                                type="button"
                                onClick={() => resolveFormChoice(message.id, choice.value)}
                                className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs hover:bg-muted/60"
                              >
                                {choice.label}
                              </button>
                            ))}
                          </div>
                        )}
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
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/forms')}>
                <FileText className="h-3 w-3" />Forms
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/workflows')}>
                <GitBranch className="h-3 w-3" />Workflows
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/reports')}>
                <BarChart3 className="h-3 w-3" />Reports
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/query')}>
                <Database className="h-3 w-3" />Query
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 border-t">
            <div className="flex gap-1 flex-wrap">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setInput("How do I create a new form?")}>
                Create form
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setInput("What forms are available?")}>
                List forms
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setInput("How do I set up a workflow?")}>
                Workflows
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={clearChat}>
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
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
