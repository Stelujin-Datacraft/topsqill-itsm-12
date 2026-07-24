import { Controller, Post, Body, UseGuards, Headers } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('delete')
  deleteUser(@Body() body: { userId: string }) {
    return this.usersService.deleteUser(body.userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('admin-change-password')
  adminChangePassword(@Body() body: { userId: string; newPassword: string }) {
    return this.usersService.adminChangePassword(body.userId, body.newPassword);
  }

  @Public()
  @Post('send-password-reset')
  sendPasswordReset(
    @Body() body: { email: string; redirectUrl?: string },
    @Headers('origin') origin: string,
  ) {
    return this.usersService.sendPasswordReset(body.email, body.redirectUrl, origin);
  }
}
