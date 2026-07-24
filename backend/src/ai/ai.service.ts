import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async assistant(body: Record<string, unknown>) {
    const apiKey = this.configService.get<string>('LOVABLE_API_KEY');
    const { action, prompt, context, formId, fieldType } = body as Record<string, unknown>;

    if (!apiKey) {
      return this.fallbackResponse(action as string, prompt as string, context);
    }

    try {
      const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: `You are an AI assistant for a BPM platform. Action: ${action}` },
            { role: 'user', content: String(prompt || context || '') },
          ],
        }),
      });

      if (!response.ok) {
        return this.fallbackResponse(action as string, prompt as string, context);
      }

      const data = await response.json();
      return { success: true, result: data.choices?.[0]?.message?.content || '' };
    } catch {
      return this.fallbackResponse(action as string, prompt as string, context);
    }
  }

  async copilotAction(body: Record<string, unknown>) {
    const { action, data } = body as { action: string; data: Record<string, unknown> };
    const supabase = this.supabaseService.getServiceClient();

    switch (action) {
      case 'create_form': {
        const { data: form, error } = await supabase
          .from('forms')
          .insert({
            name: data.name || 'AI Generated Form',
            description: data.description,
            organization_id: data.organizationId,
            project_id: data.projectId,
            status: 'draft',
          })
          .select()
          .single();
        return { success: !error, form, error: error?.message };
      }
      case 'create_workflow': {
        const { data: workflow, error } = await supabase
          .from('workflows')
          .insert({
            name: data.name || 'AI Generated Workflow',
            organization_id: data.organizationId,
            project_id: data.projectId,
            status: 'draft',
          })
          .select()
          .single();
        return { success: !error, workflow, error: error?.message };
      }
      default:
        return { success: true, message: `Action ${action} processed`, data };
    }
  }

  private fallbackResponse(action: string, prompt?: string, context?: unknown) {
    return {
      success: true,
      result: `AI response for action: ${action}`,
      fallback: true,
      prompt,
      context,
    };
  }
}
