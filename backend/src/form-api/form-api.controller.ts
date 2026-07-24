import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
} from '@nestjs/common';
import { FormApiService } from './form-api.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('form-api')
export class FormApiController {
  constructor(private readonly formApiService: FormApiService) {}

  @Public()
  @Get('forms')
  listForms() {
    return this.formApiService.listForms();
  }

  @Public()
  @Get('forms/:id')
  getForm(@Param('id') id: string) {
    return this.formApiService.getForm(id);
  }

  @Public()
  @Get('forms/:id/fields')
  getFields(@Param('id') id: string) {
    return this.formApiService.getFormFields(id);
  }

  @Public()
  @Get('forms/:id/schema')
  getSchema(@Param('id') id: string) {
    return this.formApiService.getFormSchema(id);
  }

  @Public()
  @Get('forms/:id/records')
  listRecords(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.formApiService.listRecords(id, limit ? parseInt(limit) : 50, offset ? parseInt(offset) : 0);
  }

  @Public()
  @Get('forms/:id/records/count')
  async countRecords(@Param('id') id: string) {
    const result = await this.formApiService.listRecords(id, 1, 0);
    return { count: result.count };
  }

  @Public()
  @Get('forms/:id/records/:recordId')
  getRecord(@Param('id') id: string, @Param('recordId') recordId: string) {
    return this.formApiService.getRecord(id, recordId);
  }

  @Public()
  @Post('forms/:id/records')
  createRecord(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.formApiService.createRecord(id, body);
  }

  @Public()
  @Put('forms/:id/records/:recordId')
  @Patch('forms/:id/records/:recordId')
  updateRecord(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.formApiService.updateRecord(id, recordId, body);
  }

  @Public()
  @Delete('forms/:id/records/:recordId')
  deleteRecord(@Param('id') id: string, @Param('recordId') recordId: string) {
    return this.formApiService.deleteRecord(id, recordId);
  }
}
