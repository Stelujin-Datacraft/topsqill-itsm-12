import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';
import { unwrapEngineResult } from './unwrap-engine-result';

@Injectable()
export class AiService {
  constructor(private readonly engineHost: EngineHostService) {}

  async assistant(body: Record<string, unknown>) {
    const raw = await this.engineHost.aiAssistant(body);
    return unwrapEngineResult(raw);
  }

  async copilotAction(body: Record<string, unknown>) {
    const raw = await this.engineHost.aiCopilotAction(body);
    return unwrapEngineResult(raw);
  }
}
