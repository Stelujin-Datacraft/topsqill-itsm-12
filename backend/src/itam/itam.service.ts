import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class ItamService {
  constructor(private readonly engineHost: EngineHostService) {}

  async handleAgentReport(body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined>) {
    return this.engineHost.assetAgentReport(body, headers);
  }
}
