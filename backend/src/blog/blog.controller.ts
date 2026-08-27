import {
  Controller,
  ForbiddenException,
  Post,
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
}
