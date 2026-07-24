/**
 * @deprecated Prefer `import { backend } from '@/services/api'` for all data access.
 * This re-export exists for backward compatibility during migration.
 */
export { backend as supabase } from '@/services/api';
export { SUPABASE_URL } from './rawClient';
