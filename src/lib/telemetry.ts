/**
 * Lightweight telemetry shim.
 *
 * - In dev / when APPLICATIONINSIGHTS_CONNECTION_STRING is blank, we just log.
 * - In prod, the `applicationinsights` Node SDK is loaded lazily and we send
 *   metrics, dependencies, and exceptions to Azure App Insights.
 *
 * Why a shim and not OpenTelemetry directly? OTel adds ~2MB of code we don't
 * need for a single-region app. The shim API is OTel-compatible enough to
 * swap in @opentelemetry/sdk-node later without touching call sites.
 */
import { env } from './env';
import { logger } from './logger';

interface AppInsightsClient {
  trackMetric(t: { name: string; value: number; properties?: Record<string, string> }): void;
  trackEvent(t: { name: string; properties?: Record<string, string>; measurements?: Record<string, number> }): void;
  trackException(t: { exception: Error; properties?: Record<string, string> }): void;
  trackDependency(t: {
    name: string;
    dependencyTypeName: string;
    data?: string;
    duration: number;
    resultCode: number;
    success: boolean;
  }): void;
}

let client: AppInsightsClient | null = null;
let init = false;

async function ensureClient(): Promise<AppInsightsClient | null> {
  if (init) return client;
  init = true;
  const conn = env().APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!conn) return null;
  try {
    interface AppInsightsSetup {
      setAutoCollectRequests(b: boolean): AppInsightsSetup;
      setAutoCollectDependencies(b: boolean): AppInsightsSetup;
      setAutoCollectExceptions(b: boolean): AppInsightsSetup;
      start(): void;
    }
    interface AppInsightsModule {
      setup(c: string): AppInsightsSetup;
      defaultClient: AppInsightsClient;
    }
    const ai = (await import('applicationinsights' as string)) as unknown as AppInsightsModule;
    ai.setup(conn).setAutoCollectRequests(true).setAutoCollectDependencies(true).setAutoCollectExceptions(true).start();
    client = ai.defaultClient;
    logger.info('App Insights initialised');
  } catch (e) {
    logger.warn('App Insights init failed; running in console mode', { error: String(e) });
  }
  return client;
}

export const telemetry = {
  async metric(name: string, value: number, properties?: Record<string, string>): Promise<void> {
    const c = await ensureClient();
    if (c) c.trackMetric({ name, value, properties });
    else logger.debug(`metric ${name}=${value}`, properties);
  },
  async event(name: string, properties?: Record<string, string>, measurements?: Record<string, number>): Promise<void> {
    const c = await ensureClient();
    if (c) c.trackEvent({ name, properties, measurements });
    else logger.debug(`event ${name}`, { ...properties, ...measurements });
  },
  async exception(exception: Error, properties?: Record<string, string>): Promise<void> {
    const c = await ensureClient();
    if (c) c.trackException({ exception, properties });
    else logger.error(`exception ${exception.message}`, properties);
  },
  async dependency(
    name: string,
    dependencyType: string,
    durationMs: number,
    success: boolean,
    resultCode = success ? 200 : 500,
    data?: string,
  ): Promise<void> {
    const c = await ensureClient();
    if (c)
      c.trackDependency({ name, dependencyTypeName: dependencyType, data, duration: durationMs, resultCode, success });
    else logger.debug(`dependency ${dependencyType}.${name} ${durationMs}ms ${success ? 'ok' : 'fail'}`);
  },
};
