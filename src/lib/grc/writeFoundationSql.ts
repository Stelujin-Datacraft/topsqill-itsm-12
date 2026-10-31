import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGrcFoundationSql, sqlCatalog, sqlLinks } from './grcFoundationSql';
import { GRC_FOUNDATION_CALCULATIONS } from './assetScoring';
import {
  ASSESSMENT_OUTPUT_TOOLTIPS,
  ASSET_REGISTER_OUTPUT_TOOLTIPS,
  LEGACY_SCORING_PENDING_TOOLTIP,
} from './assetScoringRule';
import { ASSET_ASSESSMENT_REFERENCE_ID, ASSET_REGISTER_REFERENCE_ID } from './foundationCatalog';

const sql = buildGrcFoundationSql();
const catalog = sqlCatalog();
const links = sqlLinks();
const migrationPath = resolve('supabase/migrations/20261029170000_provision_grc_foundation_forms.sql');
const embedPath = resolve('backend/src/grc/grc-foundation.sql.ts');
const catalogPath = resolve('backend/src/grc/grc-foundation.catalog.ts');
writeFileSync(migrationPath, sql);
writeFileSync(
  embedPath,
  `// Generated from supabase/migrations/20261029170000_provision_grc_foundation_forms.sql. Edit the catalog in src/lib/grc/foundationCatalog.ts, then regenerate this constant.\nexport const GRC_FOUNDATION_SQL = ${JSON.stringify(sql)};\n`,
);
writeFileSync(
  catalogPath,
  `// Generated from src/lib/grc/foundationCatalog.ts. Edit that catalog, then regenerate.\nexport const GRC_FOUNDATION_CATALOG = ${JSON.stringify(catalog)} as const;\nexport const GRC_FOUNDATION_LINKS = ${JSON.stringify(links)} as const;\nexport const GRC_FOUNDATION_REFERENCE_IDS = ${JSON.stringify(catalog.map((form) => form.referenceId))} as const;\n`
    + `export const GRC_FOUNDATION_CALCULATIONS = ${JSON.stringify(GRC_FOUNDATION_CALCULATIONS)} as const;\n`
    + `export const GRC_FOUNDATION_OUTPUT_TOOLTIPS: Record<string, Record<string, string>> = ${JSON.stringify({
      [ASSET_ASSESSMENT_REFERENCE_ID]: ASSESSMENT_OUTPUT_TOOLTIPS,
      [ASSET_REGISTER_REFERENCE_ID]: ASSET_REGISTER_OUTPUT_TOOLTIPS,
    })};\n`
    + `export const GRC_LEGACY_SCORING_TOOLTIP = ${JSON.stringify(LEGACY_SCORING_PENDING_TOOLTIP)};\n`,
);
console.log('wrote', sql.length, 'bytes');
