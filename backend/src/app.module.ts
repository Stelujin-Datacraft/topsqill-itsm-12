import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { SupabaseModule } from './supabase/supabase.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { SessionsModule } from './sessions/sessions.module';
import { EmailModule } from './email/email.module';
import { UsersModule } from './users/users.module';
import { LdapModule } from './ldap/ldap.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { DataFeedsModule } from './data-feeds/data-feeds.module';
import { AiModule } from './ai/ai.module';
import { SlaModule } from './sla/sla.module';
import { PerformanceModule } from './performance/performance.module';
import { ItamModule } from './itam/itam.module';
import { PoliciesModule } from './policies/policies.module';
import { PublicApiModule } from './public-api/public-api.module';
import { FormApiModule } from './form-api/form-api.module';
import { EnginesModule } from './engines/engines.module';
import { CronModule } from './cron/cron.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health.controller';
import { resolve } from 'path';

const envFilePath = [
  // Support `npm --prefix backend run start:dev` from the repository root.
  resolve(process.cwd(), 'backend/.env'),
  resolve(process.cwd(), '.env'),
  // Support commands executed from inside backend/ and compiled dist/ builds.
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env'),
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      load: [() => ({
        // The repository-level Vite variables are valid public Supabase
        // configuration and provide stable aliases for the backend.
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY:
          process.env.SUPABASE_ANON_KEY ||
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      })],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 300,
    }]),
    ScheduleModule.forRoot(),
    SupabaseModule,
    DatabaseModule,
    AuthModule,
    MfaModule,
    SessionsModule,
    EmailModule,
    UsersModule,
    LdapModule,
    WorkflowsModule,
    DataFeedsModule,
    AiModule,
    SlaModule,
    PerformanceModule,
    ItamModule,
    PoliciesModule,
    PublicApiModule,
    FormApiModule,
    EnginesModule,
    CronModule,
    QueueModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AppModule {}
