import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { ParameterTable, Parameter } from './ParameterTable';
import { cn } from '@/lib/utils';

export interface ErrorResponse {
  code: string;
  status: number;
  description: string;
}

export interface ApiEndpointProps {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  authenticated?: boolean;
  pathParams?: Parameter[];
  queryParams?: Parameter[];
  bodyParams?: Parameter[];
  requestExample?: string;
  responseExample?: string;
  curlExample?: string;
  jsExample?: string;
  errors?: ErrorResponse[];
  notes?: string[];
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function ApiEndpoint({
  id,
  method,
  path,
  title,
  description,
  authenticated = false,
  pathParams = [],
  queryParams = [],
  bodyParams = [],
  requestExample,
  responseExample,
  curlExample,
  jsExample,
  errors = [],
  notes = [],
}: ApiEndpointProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card id={id} className="scroll-mt-20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={cn("font-mono text-xs", methodColors[method])}>
                  {method}
                </Badge>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {path}
                </code>
                {authenticated ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Unlock className="h-4 w-4 text-green-500" />
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardTitle className="text-lg mt-2">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Authentication */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Authentication:</span>
              {authenticated ? (
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Required
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Unlock className="h-3 w-3 mr-1" />
                  Public (No auth required)
                </Badge>
              )}
            </div>

            {/* Path Parameters */}
            {pathParams.length > 0 && (
              <ParameterTable parameters={pathParams} title="Path Parameters" />
            )}

            {/* Query Parameters */}
            {queryParams.length > 0 && (
              <ParameterTable parameters={queryParams} title="Query Parameters" />
            )}

            {/* Request Body */}
            {bodyParams.length > 0 && (
              <ParameterTable parameters={bodyParams} title="Request Body" />
            )}

            {/* Request Example */}
            {requestExample && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Request Body Example</h4>
                <CodeBlock code={requestExample} language="json" />
              </div>
            )}

            {/* Code Examples */}
            {(curlExample || jsExample) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Code Examples</h4>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList>
                    {curlExample && <TabsTrigger value="curl">cURL</TabsTrigger>}
                    {jsExample && <TabsTrigger value="js">JavaScript</TabsTrigger>}
                  </TabsList>
                  {curlExample && (
                    <TabsContent value="curl">
                      <CodeBlock code={curlExample} language="bash" />
                    </TabsContent>
                  )}
                  {jsExample && (
                    <TabsContent value="js">
                      <CodeBlock code={jsExample} language="javascript" />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}

            {/* Response Example */}
            {responseExample && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Response Example</h4>
                <CodeBlock code={responseExample} language="json" title="200 OK" />
              </div>
            )}

            {/* Error Responses */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Error Responses</h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Code</th>
                        <th className="text-left p-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((error) => (
                        <tr key={error.code} className="border-t">
                          <td className="p-3">
                            <Badge variant="destructive" className="text-xs">
                              {error.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{error.code}</td>
                          <td className="p-3 text-muted-foreground">{error.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {notes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Notes & Tips</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
