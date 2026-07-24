import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DataFeedsService } from './data-feeds.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('data-feeds')
export class DataFeedsController {
  constructor(private readonly dataFeedsService: DataFeedsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('execute')
  execute(@Body() body: { feedId: string }) {
    return this.dataFeedsService.executeFeed(body);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('discover-fields')
  discoverFields(@Body() body: Record<string, unknown>) {
    return this.dataFeedsService.discoverFields(body);
  }

  @Public()
  @Post('run-scheduled')
  runScheduled() {
    return this.dataFeedsService.runScheduled();
  }
}
