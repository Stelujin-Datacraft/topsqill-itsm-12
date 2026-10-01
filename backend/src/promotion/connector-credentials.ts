/**
 * Migrate connector secrets from http_auth_config / credentials JSON
 * into SecretProvider via credential_reference_id.
 */
import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { SecretProvider } from '../vis/security/secret-provider';
import { scrubSecrets, isSecretKey } from './secrets';
import { normalizeLogicalKey, slugify } from './logical-keys';

const SECRET_VALUE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'apikeyvalue',
  'api_key',
  'api_key_value',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
  'secret',
  'authorization',
  'bearer',
]);

export function extractSecretMaterial(config: Record<string, unknown>): {
  secrets: Record<string, string>;
  publicMeta: Record<string, unknown>;
  hadSecrets: boolean;
} {
  const secrets: Record<string, string> = {};
  const publicMeta: Record<string, unknown> = {};
  let hadSecrets = false;
  for (const [k, v] of Object.entries(config || {})) {
    const lower = k.toLowerCase();
    if (SECRET_VALUE_KEYS.has(lower) || isSecretKey(k)) {
      if (typeof v === 'string' && v.length > 0) {
        secrets[k] = v;
        hadSecrets = true;
      }
      // drop from public meta
      continue;
    }
    // Keep non-secret metadata (header names, token URLs, usernames without passwords, etc.)
    if (lower === 'username' || lower === 'clientid' || lower === 'client_id'
      || lower === 'tokenurl' || lower === 'token_url' || lower === 'scopes'
      || lower === 'apikeyheader' || lower === 'api_key_header') {
      publicMeta[k] = v;
      continue;
    }
    if (v && typeof v === 'object') {
      const nested = extractSecretMaterial(v as Record<string, unknown>);
      if (nested.hadSecrets) {
        hadSecrets = true;
        Object.assign(secrets, nested.secrets);
      }
      publicMeta[k] = nested.publicMeta;
    } else {
      publicMeta[k] = v;
    }
  }
  return { secrets, publicMeta, hadSecrets };
}

export interface ConnectorMigrationRow {
  id: string;
  organizationId: string | null;
  name: string;
  logicalKey: string | null;
  credentialReferenceId: string | null;
  httpAuthConfig: Record<string, unknown>;
}

export interface ConnectorMigrationResult {
  migrated: Array<{ id: string; credentialReferenceId: string; logicalKey: string }>;
  alreadyClean: string[];
  blocked: Array<{ id: string; reason: string }>;
}

export async function migrateConnectorCredentials(
  rows: ConnectorMigrationRow[],
  secrets: SecretProvider,
  opts?: { dryRun?: boolean; putToDb?: (id: string, patch: {
    credentialReferenceId: string;
    logicalKey: string;
    httpAuthConfig: Record<string, unknown>;
  }) => Promise<void> },
): Promise<ConnectorMigrationResult> {
  const migrated: ConnectorMigrationResult['migrated'] = [];
  const alreadyClean: string[] = [];
  const blocked: ConnectorMigrationResult['blocked'] = [];

  for (const row of rows) {
    const { secrets: material, publicMeta, hadSecrets } = extractSecretMaterial(row.httpAuthConfig || {});
    const logicalKey = normalizeLogicalKey(
      row.logicalKey || `connector.${slugify(row.name)}.${row.id.slice(0, 8)}`,
    );

    if (!hadSecrets) {
      // Still ensure scrubbed shape + logical key
      if (row.credentialReferenceId) {
        alreadyClean.push(row.id);
        continue;
      }
      alreadyClean.push(row.id);
      continue;
    }

    if (row.credentialReferenceId && Object.keys(material).length === 0) {
      alreadyClean.push(row.id);
      continue;
    }

    const refId = row.credentialReferenceId
      || `secret://connectors/${logicalKey}/${createHash('sha256').update(row.id).digest('hex').slice(0, 12)}`;

    try {
      if (!opts?.dryRun) {
        // Store as JSON blob of secret fields only
        await secrets.put(refId, JSON.stringify(material));
        if (opts?.putToDb) {
          await opts.putToDb(row.id, {
            credentialReferenceId: refId,
            logicalKey,
            httpAuthConfig: scrubSecrets(publicMeta) as Record<string, unknown>,
          });
        }
      }
      migrated.push({ id: row.id, credentialReferenceId: refId, logicalKey });
    } catch (e: any) {
      blocked.push({
        id: row.id,
        reason: `CREDENTIAL_MIGRATION_BLOCKED: ${e?.message || e}`,
      });
    }
  }

  return { migrated, alreadyClean, blocked };
}

/** Scan auth config for residual secrets (post-migration verification). */
export function scanAuthConfigForSecrets(config: unknown): string[] {
  const findings: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      const lower = k.toLowerCase();
      // Header *names* and endpoint metadata are not secrets
      if (
        lower.endsWith('header')
        || lower.endsWith('_header')
        || lower === 'tokenurl'
        || lower === 'token_url'
        || lower === 'scopes'
        || lower === 'username'
        || lower === 'clientid'
        || lower === 'client_id'
      ) {
        continue;
      }
      if ((SECRET_VALUE_KEYS.has(lower) || isSecretKey(k)) && typeof val === 'string' && val.length > 0) {
        findings.push(p);
      } else if (val && typeof val === 'object') {
        walk(val, p);
      }
    }
  };
  walk(config, 'http_auth_config');
  return findings;
}

export async function loadAndMigrateConnectorsFromPg(
  pool: Pool,
  secrets: SecretProvider,
  dryRun = false,
): Promise<ConnectorMigrationResult> {
  const r = await pool.query(
    `SELECT id, organization_id, name, logical_key, credential_reference_id, http_auth_config
     FROM data_source_connections`,
  );
  const rows: ConnectorMigrationRow[] = r.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    logicalKey: row.logical_key,
    credentialReferenceId: row.credential_reference_id,
    httpAuthConfig: row.http_auth_config || {},
  }));

  return migrateConnectorCredentials(rows, secrets, {
    dryRun,
    putToDb: async (id, patch) => {
      await pool.query(
        `UPDATE data_source_connections
         SET credential_reference_id = $2,
             logical_key = COALESCE(logical_key, $3),
             http_auth_config = $4::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [id, patch.credentialReferenceId, patch.logicalKey, JSON.stringify(patch.httpAuthConfig)],
      );
    },
  });
}
