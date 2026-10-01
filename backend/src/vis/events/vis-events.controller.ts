import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { VisService } from '../integrations/vis.service';

/**
 * Phase 4 — Event / webhook APIs under /api/vis/*
 */
@Public()
@Controller('vis')
export class VisEventsController {
  constructor(private readonly vis: VisService) {}

  @Post('events/webhook/:endpointId')
  async webhook(
    @Param('endpointId') endpointId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Req() req: { rawBody?: Buffer | string },
  ) {
    const raw =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? req.rawBody.toString('utf8')
          : JSON.stringify(body || {});
    const result = await this.vis.ingestWebhook(endpointId, headers, raw, body || {});
    if (result.status >= 400) {
      throw new HttpException(result.body, result.status);
    }
    return result.body;
  }

  @Get('events')
  listEvents(
    @Query('integrationId') integrationId?: string,
    @Query('status') status?: string,
  ) {
    return this.vis.listEvents({ integrationId, status });
  }

  @Get('events/:id')
  getEvent(@Param('id') id: string) {
    return this.vis.getEvent(id);
  }

  @Post('events/:id/replay')
  replay(@Param('id') id: string) {
    return this.vis.replayEvent(id);
  }

  @Post('events/:id/retry')
  retry(@Param('id') id: string) {
    return this.vis.replayEvent(id);
  }

  @Get('event-dead-letters')
  eventDeadLetters(@Query('integrationId') integrationId?: string) {
    return this.vis.listEventDeadLetters(integrationId);
  }

  @Get('integrations/:id/events')
  integrationEvents(@Param('id') id: string) {
    return this.vis.listEvents({ integrationId: id });
  }

  @Get('integrations/:id/event-status')
  eventStatus(@Param('id') id: string) {
    return this.vis.getRealtimeStatus(id);
  }

  @Post('integrations/:id/event-config')
  setEventConfig(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.setEventConfig(id, body);
  }

  @Get('integrations/:id/event-config')
  getEventConfig(@Param('id') id: string) {
    return this.vis.getEventConfig(id);
  }

  @Post('integrations/:id/test-event')
  testEvent(
    @Param('id') id: string,
    @Body() body: { event?: Record<string, unknown>; execute?: boolean; dryRun?: boolean },
  ) {
    return this.vis.testEvent(id, body?.event || {}, {
      execute: body?.execute,
      dryRun: body?.dryRun,
    });
  }

  @Post('integrations/:id/activate')
  activate(@Param('id') id: string) {
    return this.vis.activateIntegration(id);
  }

  @Post('integrations/:id/pause')
  pause(@Param('id') id: string) {
    return this.vis.pauseIntegration(id);
  }

  @Post('integrations/:id/resume')
  resume(@Param('id') id: string) {
    return this.vis.resumeIntegration(id);
  }

  @Post('integrations/:id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.vis.deactivateIntegration(id);
  }

  @Post('integrations/:id/subscriptions')
  createSubscription(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.vis.createEventSubscription(id, body);
  }

  @Get('integrations/:id/subscriptions')
  listSubscriptions(@Param('id') id: string) {
    return this.vis.listEventSubscriptions(id);
  }

  @Delete('integrations/:id/subscriptions/:subscriptionId')
  deleteSubscription(
    @Param('id') id: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.vis.deleteEventSubscription(id, subscriptionId);
  }

  @Post('integrations/:id/poll')
  poll(@Param('id') id: string) {
    return this.vis.pollIntegration(id);
  }
}
