import { logger } from '../logger';
import type { Queue, QueueJob, QueueHandler } from './types';

/**
 * In-process queue. Good enough for local dev and single-instance prod.
 * Jobs are lost on process restart - documented in docs/ARCHITECTURE.md.
 */
export class MemoryQueue implements Queue {
  private jobs: QueueJob[] = [];
  private handlers = new Map<string, QueueHandler>();
  private running = false;

  async enqueue<T>(type: string, payload: T): Promise<string> {
    const job: QueueJob<T> = { id: crypto.randomUUID(), type, payload, enqueuedAt: new Date().toISOString() };
    this.jobs.push(job as QueueJob);
    if (this.running) {
      // Schedule on the microtask queue so callers don't block.
      queueMicrotask(() => void this.drainOnce());
    }
    return job.id;
  }

  on<T = unknown>(type: string, handler: QueueHandler<T>): void {
    this.handlers.set(type, handler as QueueHandler);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.drainOnce();
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async drainOnce(): Promise<void> {
    while (this.running && this.jobs.length > 0) {
      const job = this.jobs.shift()!;
      const handler = this.handlers.get(job.type);
      if (!handler) {
        logger.warn('queue: no handler for job type', { type: job.type });
        continue;
      }
      try {
        await handler(job);
      } catch (e) {
        logger.error('queue job failed', { id: job.id, type: job.type, error: String(e) });
      }
    }
  }
}
