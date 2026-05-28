/**
 * Azure Service Bus driver.
 *
 * @azure/service-bus is imported lazily so it's optional for local dev.
 * Install: npm install @azure/service-bus
 */
import { env } from '../env';
import { logger } from '../logger';
import type { Queue, QueueJob, QueueHandler } from './types';

interface SbSender {
  sendMessages(messages: unknown): Promise<unknown>;
  close(): Promise<unknown>;
}

interface SbReceiver {
  subscribe(handlers: {
    processMessage: (m: { body: unknown }) => Promise<void>;
    processError: (a: { error: Error }) => Promise<void>;
  }): unknown;
  close(): Promise<unknown>;
}

interface SbClient {
  createSender(queueName: string): SbSender;
  createReceiver(queueName: string): SbReceiver;
  close(): Promise<unknown>;
}

export class ServiceBusQueue implements Queue {
  private sender: SbSender | null = null;
  private receiver: SbReceiver | null = null;
  private client: SbClient | null = null;
  private handlers = new Map<string, QueueHandler>();
  private running = false;

  private async loadClient(): Promise<SbClient> {
    if (this.client) return this.client;
    const conn = env().AZURE_SERVICE_BUS_CONNECTION_STRING;
    if (!conn) throw new Error('AZURE_SERVICE_BUS_CONNECTION_STRING required when QUEUE_PROVIDER=service-bus');
    const mod = (await import('@azure/service-bus' as string).catch(() => {
      throw new Error('Install @azure/service-bus: npm install @azure/service-bus');
    })) as { ServiceBusClient: new (conn: string) => SbClient };
    this.client = new mod.ServiceBusClient(conn);
    return this.client;
  }

  async enqueue<T>(type: string, payload: T): Promise<string> {
    const client = await this.loadClient();
    if (!this.sender) this.sender = client.createSender(env().AZURE_SERVICE_BUS_QUEUE);
    const job: QueueJob<T> = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      enqueuedAt: new Date().toISOString(),
    };
    await this.sender.sendMessages({ body: job });
    return job.id;
  }

  on<T = unknown>(type: string, handler: QueueHandler<T>): void {
    this.handlers.set(type, handler as QueueHandler);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const client = await this.loadClient();
    this.receiver = client.createReceiver(env().AZURE_SERVICE_BUS_QUEUE);
    this.receiver.subscribe({
      processMessage: async (m) => {
        const job = m.body as QueueJob;
        const handler = this.handlers.get(job.type);
        if (!handler) return;
        await handler(job);
      },
      processError: async ({ error }) => {
        logger.error('service-bus error', { error: String(error) });
      },
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.receiver?.close().catch(() => {});
    await this.sender?.close().catch(() => {});
    await this.client?.close().catch(() => {});
  }
}
