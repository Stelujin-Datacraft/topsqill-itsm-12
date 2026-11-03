import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { PackagesService, parseExportRequest } from './packages.service';
import { packageFileName, validatePackage } from './spec';

@Controller('packages')
export class PackagesController {
  constructor(@Inject(PackagesService) private readonly packages: PackagesService) {}

  @Post('export')
  async export(@Req() req: any, @Body() body: Record<string, unknown>) {
    const request = parseExportRequest(body || {});
    const { pkg, summary } = await this.packages.exportSolution(req.authHeader, req.user.id, request);
    return { fileName: packageFileName(pkg.manifest), package: pkg, summary, warnings: validatePackage(pkg).warnings };
  }
}
