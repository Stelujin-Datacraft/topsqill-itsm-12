import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class AiService {
  constructor(private readonly engineHost: EngineHostService) {}

  async assistant(body: Record<string, unknown>) {
    return this.engineHost.aiAssistant(body);
  }

  async copilotAction(body: Record<string, unknown>) {
    return this.engineHost.aiCopilotAction(body);
  }
}
