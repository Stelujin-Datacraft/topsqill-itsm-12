import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowsService } from '../workflows/workflows.service';

export type QueueJob = {
  queueId: string;
  workflowId: string;
  submissionId?: string;
  triggerData?: unknown;
};

@Injectable()
export class WorkflowQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowQueueService.name);
  private redisWorker: { close: () => Promise<void> } | null = null;
  private redisQueue: { add: (name: string, data: QueueJob) => Promise<unknown> } | null = null;
  private readonly useRedis: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkflowsService))
    private readonly workflowsService: WorkflowsService,
  ) {
    this.useRedis = Boolean(this.configService.get<string>('REDIS_URL'));
  }

  async onModuleInit() {
    if (!this.useRedis) return;

    try {
      const { Queue, Worker } = await import('bullmq');
      const IORedis = (await import('ioredis')).default;
      const connection = new IORedis(this.configService.getOrThrow<string>('REDIS_URL'), {
        maxRetriesPerRequest: null,
      });

      const queueName = this.configService.get<string>('WORKFLOW_REDIS_QUEUE', 'workflow-jobs');
      this.redisQueue = new Queue<QueueJob>(queueName, { connection });

      this.redisWorker = new Worker<QueueJob>(
        queueName,
        async (job) => {
          await this.workflowsService.processQueueItem(job.data);
        },
        {
          connection,
          concurrency: Number(this.configService.get('WORKFLOW_QUEUE_CONCURRENCY', 10)),
        },
      );

      this.logger.log(`Redis workflow queue enabled (${queueName})`);
    } catch (err) {
      this.redisQueue = null;
      this.logger.warn(
        `REDIS_URL set but BullMQ unavailable — using database queue: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redisWorker) {
      await this.redisWorker.close();
    }
  }

  async enqueueJob(job: QueueJob): Promise<void> {
    if (this.redisQueue) {
      await this.redisQueue.add('execute', job);
      return;
    }
    this.workflowsService.processQueueAsync();
  }

  isRedisEnabled(): boolean {
    return Boolean(this.redisQueue);
  }
}
