import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ReLeadgenAccessGuard } from './re-access.guard';
import { ReNetworkService } from './re-network.service';

type AuthedRequest = Request & { user?: { id: string } };

@Controller('re/network')
@UseGuards(SupabaseAuthGuard, ReLeadgenAccessGuard)
export class ReNetworkController {
  constructor(private readonly network: ReNetworkService) {}

  private uid(req: AuthedRequest) {
    const id = req.user?.id;
    if (!id) throw new ForbiddenException('Not authenticated');
    return id;
  }

  @Get('feed')
  feed(
    @Query('organizationId') organizationId: string,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.network.listFeed(
      organizationId,
      this.uid(req),
      limit ? Number(limit) : 30,
      cursor,
    );
  }

  @Post('posts')
  createPost(
    @Body()
    body: {
      organizationId: string;
      body: string;
      postType?: string;
      visibility?: string;
      listingId?: string | null;
      authorProfileId?: string | null;
      mediaUrls?: string[];
    },
    @Req() req: AuthedRequest,
  ) {
    return this.network.createPost({ ...body, userId: this.uid(req) });
  }

  @Post('posts/:id/react')
  react(
    @Param('id') id: string,
    @Body() body: { organizationId: string; reaction?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.network.reactToPost({
      organizationId: body.organizationId,
      postId: id,
      userId: this.uid(req),
      reaction: body.reaction,
    });
  }

  @Get('posts/:id/comments')
  comments(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.network.listComments(organizationId, id);
  }

  @Post('posts/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body()
    body: { organizationId: string; body: string; parentCommentId?: string | null },
    @Req() req: AuthedRequest,
  ) {
    return this.network.addComment({
      organizationId: body.organizationId,
      postId: id,
      userId: this.uid(req),
      body: body.body,
      parentCommentId: body.parentCommentId,
    });
  }

  @Get('professionals')
  professionals(
    @Query('organizationId') organizationId: string,
    @Query('q') q?: string,
  ) {
    return this.network.searchProfessionals(organizationId, q || '');
  }

  @Get('connections')
  connections(
    @Query('organizationId') organizationId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.network.listConnections(organizationId, this.uid(req));
  }

  @Post('connections')
  request(
    @Body() body: { organizationId: string; addresseeUserId: string },
    @Req() req: AuthedRequest,
  ) {
    return this.network.requestConnection({
      organizationId: body.organizationId,
      requesterUserId: this.uid(req),
      addresseeUserId: body.addresseeUserId,
    });
  }

  @Post('connections/:id/respond')
  respond(
    @Param('id') id: string,
    @Body() body: { organizationId: string; accept: boolean },
    @Req() req: AuthedRequest,
  ) {
    return this.network.respondConnection({
      organizationId: body.organizationId,
      connectionId: id,
      userId: this.uid(req),
      accept: !!body.accept,
    });
  }

  @Post('follow')
  follow(
    @Body() body: { organizationId: string; followingUserId: string },
    @Req() req: AuthedRequest,
  ) {
    return this.network.follow({
      organizationId: body.organizationId,
      followerUserId: this.uid(req),
      followingUserId: body.followingUserId,
    });
  }

  @Post('unfollow')
  unfollow(
    @Body() body: { organizationId: string; followingUserId: string },
    @Req() req: AuthedRequest,
  ) {
    return this.network.unfollow({
      organizationId: body.organizationId,
      followerUserId: this.uid(req),
      followingUserId: body.followingUserId,
    });
  }

  @Get('conversations')
  conversations(
    @Query('organizationId') organizationId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.network.listConversations(organizationId, this.uid(req));
  }

  @Post('conversations/direct')
  openDirect(
    @Body() body: { organizationId: string; otherUserId: string },
    @Req() req: AuthedRequest,
  ) {
    return this.network.openDirectConversation({
      organizationId: body.organizationId,
      userId: this.uid(req),
      otherUserId: body.otherUserId,
    });
  }

  @Get('conversations/:id/messages')
  messages(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.network.listMessages({
      organizationId,
      conversationId: id,
      userId: this.uid(req),
    });
  }

  @Post('conversations/:id/messages')
  send(
    @Param('id') id: string,
    @Body() body: { organizationId: string; body: string; listingId?: string | null },
    @Req() req: AuthedRequest,
  ) {
    return this.network.sendMessage({
      organizationId: body.organizationId,
      conversationId: id,
      userId: this.uid(req),
      body: body.body,
      listingId: body.listingId,
    });
  }

  @Get('notifications')
  notifications(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    return this.network.listNotifications(this.uid(req), limit ? Number(limit) : 40);
  }

  @Post('notifications/read')
  markRead(@Body() body: { ids?: string[] }, @Req() req: AuthedRequest) {
    return this.network.markNotificationsRead(this.uid(req), body.ids);
  }

  @Get('profiles/:id')
  profile(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.network.getPublicProfile(organizationId, id);
  }

  @Patch('profiles/:id')
  updateProfile(
    @Param('id') id: string,
    @Body() body: { organizationId: string } & Record<string, unknown>,
  ) {
    const { organizationId, ...patch } = body;
    return this.network.updateSocialProfile(organizationId, id, patch);
  }
}
