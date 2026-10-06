import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';
import { PromotionEnvironmentService } from './environments';
import { PromotionalTransferEnabledGuard } from './promotion-access.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionEnvironmentService, PromotionalTransferEnabledGuard],
  exports: [PromotionService],
})
export class PromotionModule {}
