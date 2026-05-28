/**
 * Job queue abstraction.
 *
 *   QUEUE_PROVIDER=memory       -> in-process queue (dev, single instance)
 *   QUEUE_PROVIDER=service-bus  -> Azure Service Bus (multi-instance prod)
 *
 * Used for fire-and-forget scoring jobs when a synchronous request would take
 * too long (e.g. >30 second cold start scoring a 50-file batch on a CRON refresh).
 */
import { env } from '../env';
import { logger } from '../logger';
import type { Queue, QueueJob } from './types';
import { MemoryQueue } from './memory';
import { ServiceBusQueue } from './service-bus';

let driver: Queue | null = null;

export function getQueue(): Queue {
  if (driver) return driver;
  driver = env().QUEUE_PROVIDER === 'service-bus' ? new ServiceBusQueue() : new MemoryQueue();
  logger.info('queue driver initialised', { provider: env().QUEUE_PROVIDER });
  return driver;
}

export type { Queue, QueueJob };
