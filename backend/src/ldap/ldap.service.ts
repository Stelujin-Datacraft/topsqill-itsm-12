import { Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';

@Injectable()
export class LdapService {
  constructor(private readonly engineHost: EngineHostService) {}

  async authenticate(body: Record<string, unknown>) {
    return this.engineHost.ldapAuthenticate(body);
  }

  async oauthCallback(body: { code: string; state: string; redirectUri: string }) {
    return this.engineHost.idpOauthCallback(body);
  }

  async testConnection(body: { configId: string }) {
    return this.engineHost.ldapTestConnection(body);
  }

  async sync(body: { configId: string; organizationId: string }) {
    return this.engineHost.ldapSync(body);
  }
}
