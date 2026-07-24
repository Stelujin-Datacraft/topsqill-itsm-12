import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { createEngineContext, EngineContext } from './shared/engine-context';
import * as engines from './index';

@Injectable()
export class EngineHostService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  getClient(): SupabaseClient {
    return this.supabaseService.getServiceClient();
  }

  createContext(
    headers: Record<string, string | string[] | undefined> = {},
    invokeFunction?: (name: string, body: Record<string, unknown>) => Promise<unknown>,
  ): EngineContext {
    return createEngineContext(this.configService, headers, invokeFunction);
  }

  async run<T extends Record<string, unknown>>(
    engineFn: (
      supabase: SupabaseClient,
      body: Record<string, unknown>,
      ctx: EngineContext,
    ) => Promise<T>,
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined> = {},
    invokeFunction?: (name: string, body: Record<string, unknown>) => Promise<unknown>,
  ): Promise<T> {
    const supabase = this.getClient();
    const ctx = this.createContext(headers, invokeFunction);
    return engineFn(supabase, body, ctx);
  }

  // Convenience accessors
  readonly acceptUserInvitation = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.acceptUserInvitation, body, headers);

  readonly adminChangePassword = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.adminChangePassword, body, headers);

  readonly aiAssistant = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.aiAssistant, body, headers);

  readonly aiCopilotAction = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.aiCopilotAction, body, headers);

  readonly analyzePerformance = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.analyzePerformance, body, headers);

  readonly assetAgentReport = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.assetAgentReport, body, headers);

  readonly deleteUser = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.deleteUser, body, headers);

  readonly idpOauthCallback = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.idpOauthCallback, body, headers);

  readonly ldapAuthenticate = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.ldapAuthenticate, body, headers);

  readonly ldapSync = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.ldapSync, body, headers);

  readonly ldapTestConnection = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.ldapTestConnection, body, headers);

  readonly notifyFailure = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.notifyFailure, body, headers);

  readonly policyPreview = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.policyPreview, body, headers);

  readonly policyReviewReminders = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.policyReviewReminders, body, headers);

  readonly predictSlaBreach = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.predictSlaBreach, body, headers);

  readonly processSlaEscalations = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.processSlaEscalations, body, headers);

  readonly sendDelegationEmail = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendDelegationEmail, body, headers);

  readonly sendInvitationEmail = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendInvitationEmail, body, headers);

  readonly sendKbNotificationEmail = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendKbNotificationEmail, body, headers);

  readonly sendMfaCode = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendMfaCode, body, headers);

  readonly sendPasswordReset = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendPasswordReset, body, headers);

  readonly sendTemplateEmail = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendTemplateEmail, body, headers);

  readonly sendUserInvitation = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendUserInvitation, body, headers);

  readonly sendWelcomeEmail = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.sendWelcomeEmail, body, headers);

  readonly terminateSession = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.terminateSession, body, headers);

  readonly testSmtpConnection = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.testSmtpConnection, body, headers);

  readonly verifyMfaCode = (body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) =>
    this.run(engines.verifyMfaCode, body, headers);

  createPublicApiApp(headers?: Record<string, string | string[] | undefined>) {
    const supabase = this.getClient();
    const ctx = this.createContext(headers);
    return engines.createPublicApiApp(supabase, ctx);
  }

  createFormApiHandler(headers?: Record<string, string | string[] | undefined>) {
    const supabase = this.getClient();
    const ctx = this.createContext(headers);
    return engines.createFormApiHandler(supabase, ctx);
  }
}
