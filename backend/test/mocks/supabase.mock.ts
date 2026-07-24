import { User } from '@supabase/supabase-js';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number };

function createQueryBuilder(result: QueryResult = { data: [], error: null }) {
  const builder: Record<string, unknown> = {
    then(onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'order',
    'limit', 'range', 'not', 'or', 'contains', 'containedBy',
    'cs', 'cd', 'ov', 'like', 'ilike', 'is', 'gt', 'gte', 'lt', 'lte', 'fts',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn(() => builder);
  }

  builder.single = jest.fn(() => Promise.resolve({ ...result, count: result.count }));
  builder.maybeSingle = jest.fn(() => Promise.resolve({ ...result, count: result.count }));

  return builder;
}

export interface MockSupabaseOptions {
  queryResults?: Record<string, QueryResult>;
  rpcResults?: Record<string, QueryResult>;
  user?: User | null;
}

export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const { queryResults = {}, rpcResults = {}, user = null } = options;

  return {
    from: jest.fn((table: string) => createQueryBuilder(queryResults[table] || { data: [], error: null })),
    rpc: jest.fn(async (fn: string) => rpcResults[fn] || { data: null, error: null }),
    auth: {
      getUser: jest.fn(async () => ({ data: { user }, error: null })),
    },
  };
}

export function createMockSupabaseService(options: MockSupabaseOptions = {}) {
  const client = createMockSupabaseClient(options);

  return {
    getServiceClient: jest.fn(() => client),
    getAnonClient: jest.fn(() => client),
    getClientForUser: jest.fn(() => client),
    getUrl: jest.fn(() => 'https://test-project.supabase.co'),
    getUserFromToken: jest.fn(async (authHeader?: string) => {
      if (!authHeader) return null;
      if (authHeader.includes('invalid-token')) return null;
      return options.user ?? ({
        id: '00000000-0000-4000-8000-000000000001',
        email: 'e2e@test.local',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User);
    }),
  };
}

export const testUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e@test.local',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;
