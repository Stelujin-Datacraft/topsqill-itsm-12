import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService, DatabaseQueryDto, DatabaseInsertDto, DatabaseUpsertDto, DatabaseUpdateDto, DatabaseDeleteDto, DatabaseRpcDto } from './database.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('database')
@UseGuards(SupabaseAuthGuard)
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post('query')
  query(
    @Body() dto: DatabaseQueryDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.query(dto, authHeader);
  }

  @Post('insert')
  insert(
    @Body() dto: DatabaseInsertDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.insert(dto, authHeader);
  }

  @Post('upsert')
  upsert(
    @Body() dto: DatabaseUpsertDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.upsert(dto, authHeader);
  }

  @Post('update')
  update(
    @Body() dto: DatabaseUpdateDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.update(dto, authHeader);
  }

  @Post('delete')
  delete(
    @Body() dto: DatabaseDeleteDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.delete(dto, authHeader);
  }

  @Post('rpc')
  rpc(
    @Body() dto: DatabaseRpcDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.databaseService.rpc(dto, authHeader);
  }
}
