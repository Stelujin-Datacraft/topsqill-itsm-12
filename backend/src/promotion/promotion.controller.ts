import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import type { ExportInput } from './exporter';
import type { PlatformPackage } from './types';

/**
 * DEV-only promotion foundation API.
 * Paths are under /api/promotion/*
 * Does NOT create QA/PROD environments.
 */
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

  @Get('status')
  status() {
    return {
      environment: 'DEV',
      qaProvisioned: false,
      prodProvisioned: false,
      phase: 'DEV_PROMOTION_READINESS',
      message:
        'Foundation only. Future path is DEV → QA → PROD. QA and PROD are not implemented in this phase.',
      namespaces: this.promotion.listNamespaces(),
    };
  }

  @Get('namespaces')
  listNamespaces() {
    return this.promotion.listNamespaces();
  }

  @Post('namespaces')
  createNamespace(@Body() body: { name: string; organizationLogicalKey?: string }) {
    return this.promotion.createTestNamespace(body.name, body.organizationLogicalKey);
  }

  @Post('export')
  exportPackage(@Body() body: ExportInput) {
    return this.promotion.exportPackage(body);
  }

  @Post('validate')
  validate(@Body() body: PlatformPackage) {
    return this.promotion.validate(body);
  }

  @Post('dry-run')
  dryRun(@Body() body: { package: PlatformPackage; targetNamespaceId: string }) {
    return this.promotion.dryRun(body.package, body.targetNamespaceId);
  }

  @Post('import')
  importPackage(
    @Req() req: any,
    @Body()
    body: {
      package: PlatformPackage;
      targetNamespaceId: string;
      dryRun?: boolean;
    },
  ) {
    const initiatedBy = req?.user?.id || req?.user?.email || 'anonymous';
    return this.promotion.importPackage(body.package, body.targetNamespaceId, {
      dryRun: body.dryRun !== false,
      initiatedBy: String(initiatedBy),
    });
  }

  @Post('round-trip')
  roundTrip(@Req() req: any, @Body() body: ExportInput) {
    const initiatedBy = req?.user?.id || req?.user?.email || 'anonymous';
    return this.promotion.roundTrip(body, String(initiatedBy));
  }

  @Get('audits')
  audits() {
    return this.promotion.listAudits();
  }

  @Post('verify')
  verify(@Body() body: { package: PlatformPackage; targetNamespaceId: string }) {
    return this.promotion.verify(body.package, body.targetNamespaceId);
  }
}
