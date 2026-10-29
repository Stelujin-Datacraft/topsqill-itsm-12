import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { RegulatoryFormsBootstrap } from '../regulatory/regulatory-forms.bootstrap';
import { GRC_FOUNDATION_SQL } from './grc-foundation.sql';

function foundationDatabaseUrl(): string | undefined {
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
 * Applies the control-objective and asset foundation forms once per boot.
 * Runs after the regulatory registers. A failure is logged and does not stop the API.
 */
@Injectable()
export class GrcFoundationBootstrap implements OnModuleInit {
  private readonly logger = new Logger(GrcFoundationBootstrap.name);

  constructor(_regulatoryForms: RegulatoryFormsBootstrap) {}

  async onModuleInit(): Promise<void> {
    const connectionString = foundationDatabaseUrl();
    if (!connectionString) {
      this.logger.warn('Control objective and asset foundation forms were not applied: no Postgres URL is configured.');
      return;
    }

    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(GRC_FOUNDATION_SQL);
      this.logger.log('Control Objective Register, Asset Type Register, Asset Register, and Asset Assessment Questionnaire are present.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Control objective and asset foundation forms were not applied: ${message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
