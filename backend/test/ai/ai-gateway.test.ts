/**
 * Shared AI gateway + engine call-shape regression tests.
 * Run: npx tsx backend/test/ai/ai-gateway.test.ts
 */
import assert from 'assert';
import {
  DEFAULT_OPENROUTER_MODEL,
  LOVABLE_CHAT_COMPLETIONS_URL,
  OPENROUTER_CHAT_COMPLETIONS_URL,
  chatCompletions,
  mapAiGatewayHttpError,
  normalizeAiProvider,
  parseAiJsonContent,
  resolveAiGatewayConfig,
  resolveChatModel,
  tryResolveAiGatewayConfig,
  type AiGatewayConfig,
} from '../../src/engines/shared/ai-gateway';

function env(map: Record<string, string | undefined>) {
  return (key: string) => map[key];
}

console.log('ai-gateway');

{
  assert.equal(normalizeAiProvider(undefined), 'lovable');
  assert.equal(normalizeAiProvider('OPENROUTER'), 'openrouter');
  assert.equal(DEFAULT_OPENROUTER_MODEL, 'google/gemini-2.5-flash');
  console.log('  ✓ provider normalize + default OpenRouter model');
}

{
  const lovable = resolveAiGatewayConfig(env({ LOVABLE_API_KEY: 'lov-key' }));
  assert.equal(lovable.provider, 'lovable');
  assert.equal(lovable.endpoint, LOVABLE_CHAT_COMPLETIONS_URL);
  assert.equal(lovable.apiKey, 'lov-key');

  let missingLovable = false;
  try {
    resolveAiGatewayConfig(env({}));
  } catch (e: any) {
    missingLovable = /LOVABLE_API_KEY is not configured/.test(String(e?.message || e));
  }
  assert.equal(missingLovable, true);

  const openrouter = resolveAiGatewayConfig(
    env({
      AI_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'or-key',
    }),
  );
  assert.equal(openrouter.provider, 'openrouter');
  assert.equal(openrouter.endpoint, OPENROUTER_CHAT_COMPLETIONS_URL);
  assert.equal(openrouter.model, DEFAULT_OPENROUTER_MODEL);
  assert.equal(openrouter.apiKey, 'or-key');

  const customModel = resolveAiGatewayConfig(
    env({
      AI_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_MODEL: 'openai/gpt-4.1-mini',
    }),
  );
  assert.equal(customModel.model, 'openai/gpt-4.1-mini');

  let missingOpenRouter = false;
  try {
    resolveAiGatewayConfig(env({ AI_PROVIDER: 'openrouter' }));
  } catch (e: any) {
    missingOpenRouter = /OPENROUTER_API_KEY is not configured/.test(String(e?.message || e));
  }
  assert.equal(missingOpenRouter, true);
  console.log('  ✓ resolve config / missing credentials');
}

{
  assert.equal(tryResolveAiGatewayConfig(env({})), null);
  assert.equal(tryResolveAiGatewayConfig(env({ AI_PROVIDER: 'openrouter' })), null);
  assert.ok(tryResolveAiGatewayConfig(env({ LOVABLE_API_KEY: 'x' })));
  console.log('  ✓ optional resolve for SLA graceful skip');
}

{
  assert.equal(mapAiGatewayHttpError(429, 'lovable')?.error.includes('rate limit'), true);
  assert.equal(
    mapAiGatewayHttpError(402, 'lovable')?.error.includes('Lovable'),
    true,
  );
  assert.equal(
    mapAiGatewayHttpError(402, 'openrouter')?.error.includes('OpenRouter'),
    true,
  );
  assert.equal(mapAiGatewayHttpError(500, 'openrouter'), null);
  console.log('  ✓ provider error mapping');
}

{
  assert.deepEqual(parseAiJsonContent('{"a":1}'), { a: 1 });
  assert.deepEqual(parseAiJsonContent('```json\n{"b":2}\n```'), { b: 2 });
  assert.deepEqual(parseAiJsonContent('plain text'), { text: 'plain text' });
  console.log('  ✓ response parsing');
}

{
  const openrouter: AiGatewayConfig = {
    provider: 'openrouter',
    apiKey: 'k',
    endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
    model: DEFAULT_OPENROUTER_MODEL,
  };
  // OpenRouter always uses configured OPENROUTER_MODEL, not Lovable-era request models.
  assert.equal(
    resolveChatModel(openrouter, 'google/gemini-3-flash-preview'),
    DEFAULT_OPENROUTER_MODEL,
  );

  const lovable: AiGatewayConfig = {
    provider: 'lovable',
    apiKey: 'k',
    endpoint: LOVABLE_CHAT_COMPLETIONS_URL,
    model: '',
  };
  assert.equal(resolveChatModel(lovable, 'google/gemini-3-flash-preview'), 'google/gemini-3-flash-preview');
  console.log('  ✓ model resolution per provider');
}

async function runAsyncCases() {
{
  const cfg: AiGatewayConfig = {
    provider: 'openrouter',
    apiKey: 'or-test-key',
    endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
    model: DEFAULT_OPENROUTER_MODEL,
  };

  const mockFetch = async (_url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    const body = JSON.parse(init?.body || '{}');
    assert.equal(body.model, DEFAULT_OPENROUTER_MODEL);
    assert.equal(init?.headers?.Authorization, `Bearer ${cfg.apiKey}`);
    assert.ok(Array.isArray(body.tools));
    assert.equal(body.tools[0].function.name, 'create_form');
    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Creating the form…',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'create_form',
                    arguments: JSON.stringify({ name: 'Incident Form' }),
                  },
                },
              ],
            },
          },
        ],
      }),
    };
  };

  const result = await chatCompletions(
    cfg,
    {
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'copilot' },
        { role: 'user', content: 'create a form' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_form',
            description: 'Create a form',
            parameters: { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    },
    mockFetch as any,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    const tool = result.data.choices?.[0]?.message?.tool_calls?.[0];
    assert.equal(tool?.function?.name, 'create_form');
    assert.equal(JSON.parse(tool?.function?.arguments || '{}').name, 'Incident Form');
  }
  console.log('  ✓ assistant chatbot tool-call success path');
}

{
  const cfg: AiGatewayConfig = {
    provider: 'openrouter',
    apiKey: 'or-key',
    endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
    model: DEFAULT_OPENROUTER_MODEL,
  };

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'performance_analysis',
                  arguments: JSON.stringify({
                    risk_score: 42,
                    health_status: 'yellow',
                    summary: 'On track with minor variance',
                    anomalies: [],
                    predictions: [],
                    recommendations: [],
                  }),
                },
              },
            ],
          },
        },
      ],
    }),
  });

  const result = await chatCompletions(
    cfg,
    {
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'analyze' }],
      tools: [{ type: 'function', function: { name: 'performance_analysis' } }],
      tool_choice: { type: 'function', function: { name: 'performance_analysis' } },
      max_tokens: 8192,
    },
    mockFetch as any,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    const args = JSON.parse(
      result.data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}',
    );
    assert.equal(args.risk_score, 42);
    assert.equal(args.health_status, 'yellow');
  }
  console.log('  ✓ performance analysis tool-call success path');
}

{
  const cfg: AiGatewayConfig = {
    provider: 'openrouter',
    apiKey: 'or-key',
    endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
    model: DEFAULT_OPENROUTER_MODEL,
  };

  const failFetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'upstream unavailable',
    json: async () => ({}),
  });

  const failed = await chatCompletions(
    cfg,
    {
      model: 'google/gemini-2.0-flash',
      messages: [{ role: 'user', content: 'sla insights' }],
      max_tokens: 300,
    },
    failFetch as any,
  );
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.status, 503);
    // SLA engine must treat this as non-fatal — caller keeps predictions without insights.
    assert.match(failed.error, /AI Gateway error|503/);
  }

  assert.equal(tryResolveAiGatewayConfig(env({ AI_PROVIDER: 'openrouter' })), null);
  console.log('  ✓ SLA prediction AI failure is graceful / skippable');
}

{
  const cfg: AiGatewayConfig = {
    provider: 'lovable',
    apiKey: 'lov-key',
    endpoint: LOVABLE_CHAT_COMPLETIONS_URL,
    model: '',
  };
  const result = await chatCompletions(
    cfg,
    {
      model: 'google/gemini-3-flash-preview',
      messages: [{ role: 'user', content: 'hi' }],
    },
    (async () => ({
      ok: false,
      status: 402,
      text: async () => 'Payment Required',
      json: async () => ({}),
    })) as any,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 402);
    assert.match(result.error, /Lovable/);
  }
  console.log('  ✓ Lovable 402 mapped without leaking secrets');
}
}

runAsyncCases()
  .then(() => {
    console.log('\nAll ai-gateway tests passed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
