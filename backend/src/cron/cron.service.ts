import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowsService } from '../workflows/workflows.service';
import { DataFeedsService } from '../data-feeds/data-feeds.service';
import { SlaService } from '../sla/sla.service';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class CronService {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly dataFeedsService: DataFeedsService,
    private readonly slaService: SlaService,
    private readonly policiesService: PoliciesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processWorkflowQueue() {
    try {
      await this.workflowsService.processQueue();
    } catch (err) {
      console.error('Workflow queue processing error:', err);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledDataFeeds() {
    try {
      await this.dataFeedsService.runScheduled();
    } catch (err) {
      console.error('Scheduled data feeds error:', err);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async processSlaEscalations() {
    try {
      await this.slaService.processEscalations();
    } catch (err) {
      console.error('SLA escalation processing error:', err);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async policyReviewReminders() {
    try {
      await this.policiesService.sendReviewReminders();
    } catch (err) {
      console.error('Policy review reminders error:', err);
    }
  }
}
