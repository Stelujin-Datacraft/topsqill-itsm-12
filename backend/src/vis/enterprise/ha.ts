/**
 * Stage 6A/6B — HA / DR architecture notes and runtime helpers.
 *
 * Production topology (conceptual):
 *   LB → N stateless API pods → Redis (HA) + PostgreSQL (HA)
 *        M worker pods (BullMQ) coordinated via queues
 *
 * Local development remains single-process with in-memory/file store.
 */

export interface HaRuntimeHints {
  apiStateless: true;
  workersQueueCoordinated: true;
  distributedState: 'redis' | 'postgres' | 'none-local';
  gracefulShutdownMs: number;
  healthPath: string;
  readinessPath: string;
}

export const DEFAULT_HA_HINTS: HaRuntimeHints = {
  apiStateless: true,
  workersQueueCoordinated: true,
  distributedState: process.env.REDIS_URL ? 'redis' : 'none-local',
  gracefulShutdownMs: Number(process.env.VIS_SHUTDOWN_MS || 15000),
  healthPath: '/api/vis/enterprise/health',
  readinessPath: '/api/health',
};

/** Autoscaling signals — consumers must respect source/target limits. */
export interface AutoscaleSignals {
  queueDepth: number;
  processingLatencyMs: number;
  cpuPct?: number;
  memoryPct?: number;
  eventRatePerSec?: number;
  throughputPerSec?: number;
  sourceLimit?: number;
  targetLimit?: number;
  configuredConcurrency: number;
}

export function recommendWorkerCount(signals: AutoscaleSignals, limits: { maxWorkers: number; minWorkers: number }): number {
  let desired = signals.configuredConcurrency;
  if (signals.queueDepth > 500) desired += 2;
  if (signals.processingLatencyMs > 5000) desired += 1;
  if ((signals.eventRatePerSec || 0) > 100) desired += 2;
  // Cap by source/target limits — never blindly maximize
  if (signals.targetLimit) desired = Math.min(desired, signals.targetLimit);
  if (signals.sourceLimit) desired = Math.min(desired, signals.sourceLimit);
  return Math.max(limits.minWorkers, Math.min(limits.maxWorkers, desired));
}

export const DR_OBJECTIVES = {
  RPO_minutes: 15,
  RTO_minutes: 60,
  backup: {
    postgres: 'Continuous WAL + daily full snapshot',
    redis: 'AOF + periodic RDB; treat as ephemeral cache when possible',
    objectStore: 'VisStore JSON export for MVP; Prisma dump for production',
  },
  restoreProcedure: [
    '1. Provision standby Postgres from latest base backup + WAL',
    '2. Restore Redis from RDB/AOF or cold-start (queues rebuild from DB checkpoints)',
    '3. Deploy API/worker pods pointing at restored deps',
    '4. Run health + readiness checks',
    '5. Resume paused integrations after validation',
    '6. Verify last successful checkpoint per active execution',
  ],
  notes: 'Do not claim restore is tested unless a restore drill was executed in this environment.',
};

export function getDeploymentTopology() {
  return {
    local: ['single API process', 'in-process workers', 'file/memory VisStore'],
    docker: ['api', 'worker', 'redis', 'postgres', 'frontend'],
    kubernetes: {
      deployments: ['vis-api', 'vis-worker'],
      services: ['vis-api'],
      stateful: ['postgres', 'redis'],
      probes: { liveness: DEFAULT_HA_HINTS.healthPath, readiness: DEFAULT_HA_HINTS.readinessPath },
      rollingUpdate: true,
      gracefulShutdownMs: DEFAULT_HA_HINTS.gracefulShutdownMs,
    },
    dr: DR_OBJECTIVES,
  };
}
