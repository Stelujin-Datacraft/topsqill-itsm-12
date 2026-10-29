import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { REGULATORY_FORMS_SQL } from './regulatory-forms.sql';

function regulatoryDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.ITAM_DISCOVERY_DATABASE_URL,
    process.env.ITAM_DATABASE_URL,
    process.env.SUPABASE_DB_URL,
    process.env.DATABASE_URL,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Applies the regulatory register form SQL once per boot.
 * A failure is logged and does not stop the API.
 */
@Injectable()
export class RegulatoryFormsBootstrap implements OnModuleInit {
  private readonly logger = new Logger(RegulatoryFormsBootstrap.name);

  async onModuleInit(): Promise<void> {
    const connectionString = regulatoryDatabaseUrl();
    if (!connectionString) {
      this.logger.warn('Regulatory register forms were not applied: no Postgres URL is configured.');
      return;
    }

    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(REGULATORY_FORMS_SQL);
      this.logger.log('Regulatory Standard Library, Clause Register, and Requirement Register are present.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Regulatory register forms were not applied: ${message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
