import { Controller, Get, Post, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Public()
  @Get('preview')
  preview(@Query('id') id: string) {
    return this.policiesService.getPreview(id);
  }

  @Public()
  @Post('review-reminders')
  reviewReminders() {
    return this.policiesService.sendReviewReminders();
  }
}
