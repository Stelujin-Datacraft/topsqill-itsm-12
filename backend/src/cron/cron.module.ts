import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { DataFeedsModule } from '../data-feeds/data-feeds.module';
import { SlaModule } from '../sla/sla.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [WorkflowsModule, DataFeedsModule, SlaModule, PoliciesModule],
  providers: [CronService],
})
export class CronModule {}
