import { Controller, Post, Body } from '@nestjs/common';
import { LdapService } from './ldap.service';
import { Public } from '../common/decorators/public.decorator';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('ldap')
export class LdapController {
  constructor(private readonly ldapService: LdapService) {}

  @Public()
  @Post('authenticate')
  authenticate(@Body() body: Record<string, unknown>) {
    return this.ldapService.authenticate(body);
  }

  @Public()
  @Post('oauth-callback')
  oauthCallback(@Body() body: { code: string; state: string; redirectUri: string }) {
    return this.ldapService.oauthCallback(body);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('test-connection')
  testConnection(@Body() body: { configId: string }) {
    return this.ldapService.testConnection(body);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('sync')
  sync(@Body() body: { configId: string; organizationId: string }) {
    return this.ldapService.sync(body);
  }
}
