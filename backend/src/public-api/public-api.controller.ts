import { All, Controller, OnModuleInit, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestListener } from '@hono/node-server';
import { EngineHostService } from '../engines/engine-host.service';

@Controller('public-api')
export class PublicApiController implements OnModuleInit {
  private listener!: (req: Request, res: Response) => void | Promise<void>;

  constructor(private readonly engineHost: EngineHostService) {}

  onModuleInit() {
    const app = this.engineHost.createPublicApiApp();
    this.listener = getRequestListener((request) => app.fetch(request));
  }

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.listener(req, res);
  }
}
