import {
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { BlogService } from './blog.service';

@Controller('blog')
@UseGuards(SupabaseAuthGuard)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  /** Create blog-media bucket (and table if possible). Admins only. */
  @Post('ensure')
  ensure(@Req() req: Request & { user?: { id: string }; authHeader?: string }) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.blogService.ensure(userId, req.authHeader);
  }

  /** Hard-delete a CMS post (and tombstone slug so demo seeds stay hidden). Admins only. */
  @Delete('posts/:id')
  remove(
    @Param('id') id: string,
    @Query('slug') slug: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    return this.blogService.deletePost(userId, id, slug);
  }
}
