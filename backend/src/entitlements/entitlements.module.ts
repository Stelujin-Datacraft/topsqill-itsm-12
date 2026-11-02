import { Global, Module } from '@nestjs/common';
import { EntitlementsController, PlatformController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ModuleEntitlementGuard } from './module-entitlement.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@Global()
@Module({
  providers: [EntitlementsService, ModuleEntitlementGuard, PlatformAdminGuard],
  controllers: [EntitlementsController, PlatformController],
  exports: [EntitlementsService, ModuleEntitlementGuard],
})
export class EntitlementsModule {}
