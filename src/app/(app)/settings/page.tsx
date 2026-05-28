'use client';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Lock, Cpu, Cloud, Search, FileScan, CheckCircle2 } from 'lucide-react';
import { EngineBadge } from '@/components/engine-badge';
import { fetcher } from '@/lib/api-client';

interface StatusResponse {
  ai: {
    preferredEngine: string;
    preferredEngineForBenchmark: string;
    geminiConfigured: boolean;
    azureOpenAIConfigured: boolean;
    searchConfigured: boolean;
    ocrConfigured: boolean;
    copilotStudioConfigured: boolean;
    geminiModel?: { name: string; ok: boolean; error?: string } | null;
  };
}

export default function SettingsPage() {
  const { data } = useSWR<StatusResponse>('/api/system/status', fetcher);
  const status = data?.ai;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Configuration</p>
        <h1 className="text-display-sm flex items-center gap-2 font-semibold tracking-tight">
          <Settings className="h-7 w-7 text-brand" /> System settings
        </h1>
        <p className="text-sm text-fg-muted">Configure AI engines, OCR, online search, and governance. Edit <code className="rounded bg-bg-muted px-1.5 py-0.5">.env.local</code> and restart the dev server to change values.</p>
      </header>

      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Active engine</CardTitle>
            <CardDescription>Auto-selected from configuration. Local-rule is the safety net.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Scoring</div>
              <div className="mt-2 flex items-center gap-2"><EngineBadge engine={status.preferredEngine} /></div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Benchmark generation</div>
              <div className="mt-2 flex items-center gap-2"><EngineBadge engine={status.preferredEngineForBenchmark} /></div>
            </div>
            {status.geminiModel && (
              <div className="rounded-lg border border-border p-4 sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Resolved Gemini model</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-bg-muted px-2 py-0.5 text-sm">{status.geminiModel.name}</code>
                  {status.geminiModel.ok ? <Badge variant="success">Reachable</Badge> : <Badge variant="danger">Unreachable</Badge>}
                </div>
                {status.geminiModel.error && (
                  <p className="mt-2 text-xs text-red-500">{status.geminiModel.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Provider configuration</CardTitle>
          <CardDescription>Toggle providers by adding/removing the env keys below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProviderRow icon={Cpu} name="Google Gemini" envKey="GOOGLE_GEMINI_API_KEY" on={status?.geminiConfigured} help="Free tier at aistudio.google.com/apikey." />
          <ProviderRow icon={Cloud} name="Azure OpenAI" envKey="AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT" on={status?.azureOpenAIConfigured} help="Production-grade enterprise AI." />
          <ProviderRow icon={Search} name="Online research (Tavily)" envKey="TAVILY_API_KEY" on={status?.searchConfigured} help="Live web grounding for benchmark generation." />
          <ProviderRow icon={FileScan} name="OCR (Azure Document Intelligence)" envKey="AZURE_DOC_INTELLIGENCE_ENDPOINT + KEY" on={status?.ocrConfigured} help="Scanned-PDF and image-resume support." />
          <ProviderRow icon={Lock} name="Copilot Studio" envKey="COPILOT_STUDIO_WEBHOOK_URL" on={status?.copilotStudioConfigured} help="Optional Microsoft Power Platform integration." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governance & compliance</CardTitle>
          <CardDescription>Built-in guardrails. Detailed policy in docs/SECURITY.md.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            'AI scoring is advisory only - human decision is mandatory before progressing a candidate.',
            'Protected attributes (gender, age, race, religion, marital status, nationality) are excluded from scoring.',
            'Every mutation is logged with user, IP, and timestamp.',
            'Resume files are stored locally in /uploads. Switch STORAGE_PROVIDER=azure-blob for production.',
            'API keys must live only in .env.local; production uses Azure Key Vault via Managed Identity.',
            'Rate limits protect login, upload, and benchmark creation.',
            'CSRF protection: double-submit cookie for all mutating endpoints.',
            'Bias mitigation: scoring is benchmark-driven and evidence-bound, not keyword-only.',
          ].map((p) => (
            <div key={p} className="flex items-start gap-2 rounded-md border border-border p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span>{p}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo accounts</CardTitle>
          <CardDescription>Local-only - rotate or remove in production.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-sm">
          <div>admin@alshaya.com - password123</div>
          <div>hiring@alshaya.com - password123</div>
          <div>recruiter@alshaya.com - password123</div>
          <div>panel@alshaya.com - password123</div>
          <div>viewer@alshaya.com - password123</div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderRow({
  icon: Icon,
  name,
  envKey,
  on,
  help,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  envKey: string;
  on?: boolean;
  help: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-md bg-bg-muted">
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs text-fg-muted">
            env: <code className="rounded bg-bg-muted px-1 py-0.5">{envKey}</code>
          </div>
          <div className="text-xs text-fg-muted">{help}</div>
        </div>
      </div>
      {on ? <Badge variant="success">Configured</Badge> : <Badge variant="warning">Not configured</Badge>}
    </div>
  );
}
