import { Global, Module } from '@nestjs/common';
import { EngineHostService } from './engine-host.service';

@Global()
@Module({
  providers: [EngineHostService],
  exports: [EngineHostService],
})
export class EnginesModule {}
