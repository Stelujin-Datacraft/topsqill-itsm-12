/**
 * Platform SecretProvider backed by platform_secret_blobs (PostgreSQL).
 * Never logs plaintext. Used for connector credentialReferenceId resolution.
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import type { Pool } from 'pg';
import type { SecretProvider } from '../vis/security/secret-provider';

function masterKey(): Buffer {
  return createHash('sha256')
    .update(process.env.PLATFORM_SECRET_MASTER_KEY || process.env.VIS_SECRET_MASTER_KEY || 'dev-only-not-for-prod')
    .digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(packed: string): string {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export class PlatformPgSecretProvider implements SecretProvider {
  readonly kind = 'platform-pg-encrypted';
  private memory = new Map<string, string>();

  constructor(private readonly pool: Pool) {}

  async put(refId: string, plaintext: string): Promise<void> {
    const ciphertext = encrypt(plaintext);
    this.memory.set(refId, ciphertext);
    await this.pool.query(
      `INSERT INTO platform_secret_blobs (ref_id, ciphertext, provider, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (ref_id) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, provider = EXCLUDED.provider, updated_at = now()`,
      [refId, ciphertext, this.kind],
    );
  }

  async get(refId: string): Promise<string | null> {
    let packed = this.memory.get(refId);
    if (!packed) {
      const r = await this.pool.query(`SELECT ciphertext FROM platform_secret_blobs WHERE ref_id = $1`, [refId]);
      packed = r.rows[0]?.ciphertext;
      if (packed) this.memory.set(refId, packed);
    }
    if (!packed) return null;
    return decrypt(packed);
  }

  async delete(refId: string): Promise<void> {
    this.memory.delete(refId);
    await this.pool.query(`DELETE FROM platform_secret_blobs WHERE ref_id = $1`, [refId]);
  }

  async rotate(refId: string, plaintext: string): Promise<void> {
    await this.put(refId, plaintext);
    await this.pool.query(`UPDATE platform_secret_blobs SET rotated_at = now() WHERE ref_id = $1`, [refId]);
  }
}
