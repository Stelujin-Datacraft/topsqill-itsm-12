import { All, Controller, OnModuleInit, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EngineHostService } from '../engines/engine-host.service';

@Controller('form-api')
export class FormApiController implements OnModuleInit {
  private handler!: (req: globalThis.Request) => Promise<globalThis.Response>;

  constructor(private readonly engineHost: EngineHostService) {}

  onModuleInit() {
    this.handler = this.engineHost.createFormApiHandler();
  }

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const part of value) headers.append(key, part);
      } else {
        headers.set(key, value);
      }
    }

    const init: RequestInit = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? JSON.stringify(req.body)
        : req.body;
    }

    const response = await this.handler(new globalThis.Request(url, init));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  }
}
