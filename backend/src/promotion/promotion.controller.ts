import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import type { ExportInput } from './exporter';
import type { PlatformPackage } from './types';

/**
 * Platform promotion API — /api/promotion/*
 * Dry-run never writes. Approved import persists to PostgreSQL when configured.
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
      persistence: this.promotion.persistenceMode(),
      phase: 'PROMOTION_QA_BLOCKERS',
      message:
        'Promotion foundation with QA blockers remediation. Future path DEV → QA → PROD. QA/PROD not provisioned.',
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
  dryRun(
    @Body()
    body: {
      package: PlatformPackage;
      targetNamespaceId?: string;
      organizationLogicalKey?: string;
      projectLogicalKey?: string;
      namespace?: string;
    },
  ) {
    return this.promotion.dryRun(body.package, {
      namespaceId: body.targetNamespaceId,
      organizationLogicalKey: body.organizationLogicalKey,
      projectLogicalKey: body.projectLogicalKey,
      namespace: body.namespace,
    });
  }

  @Post('import')
  importPackage(
    @Req() req: any,
    @Body()
    body: {
      package: PlatformPackage;
      targetNamespaceId?: string;
      organizationLogicalKey?: string;
      projectLogicalKey?: string;
      namespace?: string;
      dryRun?: boolean;
      approved?: boolean;
      approvedBy?: string;
    },
  ) {
    const initiatedBy = req?.user?.id || req?.user?.email || 'anonymous';
    const dryRun = body.dryRun !== false && body.approved !== true;
    return this.promotion.importPackage(
      body.package,
      {
        namespaceId: body.targetNamespaceId,
        organizationLogicalKey: body.organizationLogicalKey,
        projectLogicalKey: body.projectLogicalKey,
        namespace: body.namespace,
      },
      {
        dryRun,
        initiatedBy: String(initiatedBy),
        approvedBy: body.approvedBy || null,
      },
    );
  }

  @Post('round-trip')
  roundTrip(@Req() req: any, @Body() body: ExportInput) {
    const initiatedBy = req?.user?.id || req?.user?.email || 'anonymous';
    return this.promotion.roundTrip(body, String(initiatedBy));
  }

  @Post('verify')
  verify(
    @Body()
    body: {
      package: PlatformPackage;
      targetNamespaceId?: string;
      organizationLogicalKey?: string;
      projectLogicalKey?: string;
      namespace?: string;
    },
  ) {
    return this.promotion.verify(body.package, {
      namespaceId: body.targetNamespaceId,
      organizationLogicalKey: body.organizationLogicalKey,
      projectLogicalKey: body.projectLogicalKey,
      namespace: body.namespace,
    });
  }

  @Post('migrate-connector-secrets')
  migrateConnectorSecrets(@Query('dryRun') dryRun?: string) {
    return this.promotion.migrateConnectorSecrets(dryRun !== 'false');
  }

  @Get('scan-connector-secrets')
  scanConnectorSecrets() {
    return this.promotion.scanConnectorSecrets();
  }

  @Post('backfill-field-keys')
  backfillFieldKeys() {
    return this.promotion.backfillFieldKeys();
  }

  @Get('audits')
  audits() {
    return this.promotion.listAudits();
  }
}
