import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockService } from '../common/services/cron-lock.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { DataFeedsService } from '../data-feeds/data-feeds.service';
import { SlaService } from '../sla/sla.service';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly cronLock: CronLockService,
    private readonly workflowsService: WorkflowsService,
    private readonly dataFeedsService: DataFeedsService,
    private readonly slaService: SlaService,
    private readonly policiesService: PoliciesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processWorkflowQueue() {
    if (!(await this.cronLock.tryAcquire('workflow-queue'))) return;
    try {
      await this.workflowsService.processQueue();
    } catch (err) {
      this.logger.error('Workflow queue processing error', err);
    } finally {
      await this.cronLock.release('workflow-queue');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledDataFeeds() {
    if (!(await this.cronLock.tryAcquire('data-feeds'))) return;
    try {
      await this.dataFeedsService.runScheduled();
    } catch (err) {
      this.logger.error('Scheduled data feeds error', err);
    } finally {
      await this.cronLock.release('data-feeds');
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async processSlaEscalations() {
    if (!(await this.cronLock.tryAcquire('sla-escalations'))) return;
    try {
      await this.slaService.processEscalations();
    } catch (err) {
      this.logger.error('SLA escalation processing error', err);
    } finally {
      await this.cronLock.release('sla-escalations');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async policyReviewReminders() {
    if (!(await this.cronLock.tryAcquire('policy-reminders'))) return;
    try {
      await this.policiesService.sendReviewReminders();
    } catch (err) {
      this.logger.error('Policy review reminders error', err);
    } finally {
      await this.cronLock.release('policy-reminders');
    }
  }
}
