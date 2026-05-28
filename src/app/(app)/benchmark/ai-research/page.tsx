'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Globe } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { apiFetch, ApiError } from '@/lib/api-client';

interface GenerateResponse {
  benchmark: { id: string };
  engineUsed: string;
  source: string;
}

export default function AIResearchBenchmarkPage() {
  const router = useRouter();
  const [form, setForm] = useState({ roleTitle: '', skillFamily: '', minExperience: 10, seniority: 'Senior', domainContext: 'Retail enterprise (Alshaya)', hiringNotes: '' });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  async function generate() {
    if (!form.roleTitle) { toast({ title: 'Role title required', variant: 'warning' }); return; }
    setLoading(true);
    setProgress('Initializing AI engine...');
    setTimeout(() => setProgress('Searching online for market signals...'), 800);
    setTimeout(() => setProgress('AI is composing the ideal candidate profile...'), 2400);
    setTimeout(() => setProgress('Finalizing benchmark JSON...'), 5000);

    try {
      const data = await apiFetch<GenerateResponse>('/api/benchmarks', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast({ title: 'Benchmark generated', description: `Engine: ${data.engineUsed} - Source: ${data.source}`, variant: 'success' });
      router.push(`/benchmark/${data.benchmark.id}`);
    } catch (e) {
      toast({ title: 'Generation failed', description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
      setLoading(false);
      setProgress('');
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">AI Research</div>
        <h1 className="text-3xl font-bold text-maroon-800 flex items-center gap-2"><Sparkles className="h-7 w-7" /> Generate Benchmark with AI</h1>
        <p className="text-sm text-muted-foreground mt-1">AI + online search (when configured) builds an ideal-candidate profile for the role.</p>
      </div>

      {loading ? (
        <Card className="border-maroon-200 bg-maroon-50">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 text-maroon-700 mx-auto animate-spin mb-4" />
            <h3 className="text-xl font-bold text-maroon-800 mb-2">Please wait — generating benchmark…</h3>
            <p className="text-sm text-maroon-700 mb-6">This may take 15–45 seconds depending on AI engine. Do not navigate away.</p>
            <div className="bg-white border border-maroon-200 rounded p-4 text-sm font-mono text-left max-w-lg mx-auto">{progress || 'Starting…'}</div>
            <div className="mt-6 text-xs text-maroon-700/70">Hint: ensure GOOGLE_GEMINI_API_KEY or AZURE_OPENAI_* is set in .env.local for real AI</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Role Definition</CardTitle>
            <CardDescription>The more context you provide, the sharper the benchmark.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Role title *" value={form.roleTitle} onChange={v => setForm({ ...form, roleTitle: v })} placeholder="e.g. Senior Azure Integration Architect" />
              <Field label="Skill family" value={form.skillFamily} onChange={v => setForm({ ...form, skillFamily: v })} placeholder="e.g. Azure Integration / Oracle EBS" />
              <Field label="Minimum experience (yrs)" type="number" value={form.minExperience} onChange={v => setForm({ ...form, minExperience: parseInt(v) || 0 })} />
              <Field label="Seniority" value={form.seniority} onChange={v => setForm({ ...form, seniority: v })} placeholder="Senior / Architect / Lead / Developer" />
            </div>
            <div className="space-y-2">
              <Label>Domain context</Label>
              <Input value={form.domainContext} onChange={(e) => setForm({ ...form, domainContext: e.target.value })} placeholder="Retail / e-commerce / multi-country" />
            </div>
            <div className="space-y-2">
              <Label>Hiring notes (optional)</Label>
              <Textarea value={form.hiringNotes} onChange={(e) => setForm({ ...form, hiringNotes: e.target.value })} placeholder="Any specific certifications, geographies, must-have projects, red flags to watch…" rows={4} />
            </div>

            <div className="flex items-center gap-3 p-4 bg-cream-100 rounded-md text-sm">
              <Globe className="h-5 w-5 text-maroon-700" />
              <div className="flex-1">
                <div className="font-medium">Online research</div>
                <div className="text-xs text-muted-foreground">If TAVILY_API_KEY is configured, the AI will use fresh market data and cite sources.</div>
              </div>
            </div>

            <Button onClick={generate} size="lg" className="w-full">
              <Sparkles className="h-4 w-4 mr-2" /> Generate Benchmark
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

function Field({ label, value, onChange, placeholder, type }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
