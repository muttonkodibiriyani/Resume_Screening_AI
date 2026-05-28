export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  enqueuedAt: string;
}

export type QueueHandler<T = unknown> = (job: QueueJob<T>) => Promise<void>;

export interface Queue {
  /** Enqueue a new job. Returns its assigned id. */
  enqueue<T>(type: string, payload: T): Promise<string>;
  /** Register a handler for a job type. Called once per job. Idempotent on re-call. */
  on<T = unknown>(type: string, handler: QueueHandler<T>): void;
  /** Start processing (idempotent). */
  start(): Promise<void>;
  /** Stop accepting/processing new jobs (graceful drain). */
  stop(): Promise<void>;
}
