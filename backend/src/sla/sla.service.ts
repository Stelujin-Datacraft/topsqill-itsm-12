import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class SlaService {
  constructor(private readonly engineHost: EngineHostService) {}

  async predictBreach() {
    return this.engineHost.predictSlaBreach({});
  }

  async processEscalations() {
    return this.engineHost.processSlaEscalations({});
  }
}
