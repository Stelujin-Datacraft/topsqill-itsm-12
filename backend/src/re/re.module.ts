import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ReController } from './re.controller';
import { ReSourcesController } from './re-sources.controller';
import { ReIngestController } from './re-ingest.controller';
import { ReService } from './re.service';
import { ReIngestService } from './re-ingest.service';
import { ReFollowupService } from './re-followup.service';
import { ReDedupeService } from './re-dedupe.service';
import { ReMetaEnrichService } from './re-meta-enrich.service';
import { ReLeadgenAccessGuard } from './re-access.guard';

@Module({
  imports: [EmailModule],
  controllers: [ReController, ReSourcesController, ReIngestController],
  providers: [
    ReService,
    ReIngestService,
    ReFollowupService,
    ReDedupeService,
    ReMetaEnrichService,
    ReLeadgenAccessGuard,
  ],
  exports: [ReService, ReIngestService, ReFollowupService, ReDedupeService, ReMetaEnrichService],
})
export class ReModule {}
