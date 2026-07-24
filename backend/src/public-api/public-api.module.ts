import { Module } from '@nestjs/common';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';

@Module({
  providers: [PublicApiService],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
