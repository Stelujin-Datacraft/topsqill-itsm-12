import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronLockService } from '../common/services/cron-lock.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { DataFeedsModule } from '../data-feeds/data-feeds.module';
import { SlaModule } from '../sla/sla.module';
import { PoliciesModule } from '../policies/policies.module';
import { ReModule } from '../re/re.module';

@Module({
  imports: [WorkflowsModule, DataFeedsModule, SlaModule, PoliciesModule, ReModule],
  providers: [CronService, CronLockService],
})
export class CronModule {}
