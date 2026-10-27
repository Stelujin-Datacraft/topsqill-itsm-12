import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ReController } from './re.controller';
import { ReSourcesController } from './re-sources.controller';
import { ReIngestController } from './re-ingest.controller';
import { ReNetworkController } from './re-network.controller';
import { ReService } from './re.service';
import { ReIngestService } from './re-ingest.service';
import { ReFollowupService } from './re-followup.service';
import { ReDedupeService } from './re-dedupe.service';
import { ReMetaEnrichService } from './re-meta-enrich.service';
import { ReNetworkService } from './re-network.service';
import { ReLeadgenAccessGuard } from './re-access.guard';

@Module({
  imports: [EmailModule],
  controllers: [ReController, ReSourcesController, ReIngestController, ReNetworkController],
  providers: [
    ReService,
    ReIngestService,
    ReFollowupService,
    ReDedupeService,
    ReMetaEnrichService,
    ReNetworkService,
    ReLeadgenAccessGuard,
  ],
  exports: [
    ReService,
    ReIngestService,
    ReFollowupService,
    ReDedupeService,
    ReMetaEnrichService,
    ReNetworkService,
  ],
})
export class ReModule {}
