import { ConfigService } from '@nestjs/config';

export interface EngineRequest {
  method: string;
  url: string;
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface EngineContext {
  getEnv(key: string): string | undefined;
  getHeader(name: string): string | undefined;
  defer(task: Promise<unknown>): void;
  invokeFunction?(name: string, body: Record<string, unknown>): Promise<unknown>;
}

export function createEngineContext(
  configService: ConfigService,
  headers: Record<string, string | string[] | undefined> = {},
  invokeFunction?: (name: string, body: Record<string, unknown>) => Promise<unknown>,
): EngineContext {
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') normalizedHeaders[key.toLowerCase()] = value;
    else if (Array.isArray(value)) normalizedHeaders[key.toLowerCase()] = value[0] || '';
  }

  return {
    getEnv: (key: string) => configService.get<string>(key) || process.env[key],
    getHeader: (name: string) => normalizedHeaders[name.toLowerCase()],
    defer: (task: Promise<unknown>) => {
      task.catch((err) => console.error('Deferred engine task failed:', err));
    },
    invokeFunction,
  };
}
