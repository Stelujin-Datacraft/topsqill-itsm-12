import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';
import { PromotionEnvironmentService } from './environments';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionEnvironmentService],
  exports: [PromotionService],
})
export class PromotionModule {}
