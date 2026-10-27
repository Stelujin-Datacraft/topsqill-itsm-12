import { Module } from '@nestjs/common';
import { ReController } from './re.controller';
import { ReService } from './re.service';
import { ReLeadgenAccessGuard } from './re-access.guard';

@Module({
  controllers: [ReController],
  providers: [ReService, ReLeadgenAccessGuard],
  exports: [ReService],
})
export class ReModule {}
