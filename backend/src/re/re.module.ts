import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ReController } from './re.controller';
import { ReSourcesController } from './re-sources.controller';
import { ReIngestController } from './re-ingest.controller';
import { ReService } from './re.service';
import { ReIngestService } from './re-ingest.service';
import { ReFollowupService } from './re-followup.service';
import { ReLeadgenAccessGuard } from './re-access.guard';

@Module({
  imports: [EmailModule],
  controllers: [ReController, ReSourcesController, ReIngestController],
  providers: [ReService, ReIngestService, ReFollowupService, ReLeadgenAccessGuard],
  exports: [ReService, ReIngestService, ReFollowupService],
})
export class ReModule {}
