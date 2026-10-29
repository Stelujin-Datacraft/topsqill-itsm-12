import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { RegulatoryFormsBootstrap } from '../regulatory/regulatory-forms.bootstrap';
import { SupabaseService } from '../supabase/supabase.service';
import { GRC_FOUNDATION_SQL } from './grc-foundation.sql';
import { provisionGrcFoundationRecords } from './grc-foundation.provision';

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

  constructor(
    _regulatoryForms: RegulatoryFormsBootstrap,
    private readonly supabase: SupabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.applyDirectSql();
    await this.applyInAppDatabase();
  }

  private async applyDirectSql(): Promise<void> {
    const connectionString = foundationDatabaseUrl();
    if (!connectionString) {
      this.logger.warn('Foundation SQL was not applied through a direct Postgres URL.');
      return;
    }

    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(GRC_FOUNDATION_SQL);
      this.logger.log('Foundation SQL finished on the direct Postgres connection.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Foundation SQL was not applied through the direct Postgres connection: ${message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /** Writes the forms into the Supabase project the Forms page reads. */
  private async applyInAppDatabase(): Promise<void> {
    try {
      const result = await provisionGrcFoundationRecords(this.supabase.getServiceClient());
      const summary = `created ${result.created}, already present ${result.alreadyPresent}`;
      if (result.errors.length > 0) {
        this.logger.error(`Control objective and asset foundation forms: ${summary}. ${result.errors.join(' | ')}`);
        return;
      }
      this.logger.log(`Control Objective Register, Asset Type Register, Asset Register, and Asset Assessment Questionnaire are in the app database (${summary}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Control objective and asset foundation forms were not written to the app database: ${message}`);
    }
  }
}
