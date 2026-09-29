/**
 * OpenAPI / Swagger discovery — implements IApiDiscovery from connectors.
 */
import type { IApiDiscovery } from '../connectors/index';
import type { OpenApiEndpoint } from '../types/index';

function schemaFromRef(
  doc: any,
  refOrSchema: unknown,
): unknown {
  if (!refOrSchema || typeof refOrSchema !== 'object') return refOrSchema;
  const obj = refOrSchema as Record<string, unknown>;
  if (typeof obj.$ref === 'string') {
    const ref = obj.$ref as string;
    const name = ref.split('/').pop();
    if (name && doc?.components?.schemas?.[name]) return doc.components.schemas[name];
    if (name && doc?.definitions?.[name]) return doc.definitions[name];
  }
  return refOrSchema;
}

export class OpenApiDiscovery implements IApiDiscovery {
  async fromOpenApi(document: unknown): Promise<{
    endpoints: OpenApiEndpoint[];
    auth?: unknown;
  }> {
    if (!document || typeof document !== 'object') {
      throw new Error('OpenAPI document must be a JSON object');
    }
    const doc = document as any;
    const paths = doc.paths || {};
    const endpoints: OpenApiEndpoint[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      if (!methods || typeof methods !== 'object') continue;
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        const m = method.toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m)) continue;
        if (!operation || typeof operation !== 'object') continue;

        const successResponse =
          operation.responses?.['200']
          || operation.responses?.['201']
          || operation.responses?.default
          || {};

        const responseSchema =
          successResponse?.content?.['application/json']?.schema
          || successResponse?.schema
          || undefined;

        const requestSchema =
          operation.requestBody?.content?.['application/json']?.schema
          || operation.parameters?.find((p: any) => p.in === 'body')?.schema
          || undefined;

        endpoints.push({
          path,
          method: m,
          summary: operation.summary || operation.description || undefined,
          operationId: operation.operationId,
          parameters: operation.parameters || [],
          requestSchema: schemaFromRef(doc, requestSchema),
          responseSchema: schemaFromRef(doc, responseSchema),
        });
      }
    }

    const auth =
      doc.components?.securitySchemes
      || doc.securityDefinitions
      || doc.security
      || undefined;

    return { endpoints, auth };
  }

  async fromManual(definition: unknown): Promise<unknown> {
    return definition;
  }
}

/** Infer flat source field names from a sample JSON object or OpenAPI response schema. */
export function inferSourceFieldsFromSample(
  sample: Record<string, unknown> | Record<string, unknown>[],
): Array<{ name: string; label: string; type: string }> {
  const row = Array.isArray(sample) ? sample[0] : sample;
  if (!row || typeof row !== 'object') return [];
  return Object.entries(row).map(([name, value]) => ({
    name,
    label: name,
    type: value == null ? 'string' : Array.isArray(value) ? 'array' : typeof value,
  }));
}

export function inferSourceFieldsFromOpenApiSchema(schema: unknown): Array<{ name: string; label: string; type: string }> {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as any;
  // Prefer array items properties
  const props =
    s?.properties
    || s?.items?.properties
    || s?.items?.items?.properties
    || {};
  return Object.entries(props).map(([name, def]: [string, any]) => ({
    name,
    label: def?.title || name,
    type: def?.type || 'string',
  }));
}
