process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.CORS_ORIGIN = 'http://localhost:8080';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.WORKFLOW_EXECUTOR_MODE = 'test';
process.env.THROTTLE_LIMIT = '10000';
