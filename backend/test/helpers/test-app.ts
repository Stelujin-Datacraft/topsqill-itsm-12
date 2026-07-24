import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { AppModule } from '../../src/app.module';
import { CronService } from '../../src/cron/cron.service';
import { SupabaseService } from '../../src/supabase/supabase.service';
import { WorkflowQueueService } from '../../src/queue/workflow-queue.service';
import { createMockSupabaseService, MockSupabaseOptions } from '../mocks/supabase.mock';

const noopCron = {
  processWorkflowQueue: jest.fn(),
  runScheduledDataFeeds: jest.fn(),
  processSlaEscalations: jest.fn(),
  policyReviewReminders: jest.fn(),
};

const noopQueue = {
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  enqueueJob: jest.fn(),
  isRedisEnabled: jest.fn(() => false),
};

export async function createTestApp(
  supabaseOptions: MockSupabaseOptions = {},
): Promise<{ app: INestApplication; supabase: ReturnType<typeof createMockSupabaseService> }> {
  const mockSupabase = createMockSupabaseService(supabaseOptions);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SupabaseService)
    .useValue(mockSupabase)
    .overrideProvider(CronService)
    .useValue(noopCron)
    .overrideProvider(WorkflowQueueService)
    .useValue(noopQueue)
    .compile();

  const app = moduleFixture.createNestApplication({ bodyParser: false });
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.init();

  return { app, supabase: mockSupabase };
}
