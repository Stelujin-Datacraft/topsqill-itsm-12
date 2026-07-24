import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class PoliciesService {
  constructor(private readonly engineHost: EngineHostService) {}

  async getPreview(policyId: string) {
    return this.engineHost.policyPreview({ policyId, id: policyId });
  }

  async sendReviewReminders() {
    return this.engineHost.policyReviewReminders({});
  }
}
