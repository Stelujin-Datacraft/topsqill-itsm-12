import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly engineHost: EngineHostService) {}

  async analyze(body: Record<string, unknown>) {
    return this.engineHost.analyzePerformance(body);
  }
}
