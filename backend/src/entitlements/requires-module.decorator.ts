import { SetMetadata } from '@nestjs/common';
import type { ModuleKey, ModuleNeed } from './module-catalog';

export const REQUIRES_MODULE_KEY = 'requiresModule';

export interface RequiresModuleOptions {
  /** Defaults to view for GET/HEAD/OPTIONS and use for everything else. */
  need?: ModuleNeed;
  /** Metered metric to add 1 to on every allowed call, checked against the entitlement limit. */
  consume?: string;
}

export interface RequiresModuleMetadata extends RequiresModuleOptions {
  module: ModuleKey;
}

export const RequiresModule = (module: ModuleKey, options: RequiresModuleOptions = {}) =>
  SetMetadata(REQUIRES_MODULE_KEY, { module, ...options } satisfies RequiresModuleMetadata);
