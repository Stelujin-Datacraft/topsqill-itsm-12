import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGrcFoundationSql } from './grcFoundationSql';

const sql = buildGrcFoundationSql();
const migrationPath = resolve('supabase/migrations/20261029170000_provision_grc_foundation_forms.sql');
const embedPath = resolve('backend/src/grc/grc-foundation.sql.ts');
writeFileSync(migrationPath, sql);
writeFileSync(
  embedPath,
  `// Generated from supabase/migrations/20261029170000_provision_grc_foundation_forms.sql. Edit the catalog in src/lib/grc/foundationCatalog.ts, then regenerate this constant.\nexport const GRC_FOUNDATION_SQL = ${JSON.stringify(sql)};\n`,
);
console.log('wrote', sql.length, 'bytes');
