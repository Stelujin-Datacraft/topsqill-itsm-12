import { Module } from '@nestjs/common';
import { FormApiService } from './form-api.service';
import { FormApiController } from './form-api.controller';

@Module({
  providers: [FormApiService],
  controllers: [FormApiController],
})
export class FormApiModule {}
