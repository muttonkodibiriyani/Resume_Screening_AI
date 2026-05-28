'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ShieldCheck, FileSearch, Trophy, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { motion } from 'framer-motion';

const DEMO_USERS = [
  { email: 'admin@alshaya.com', role: 'Admin', desc: 'Full access, governance & audit' },
  { email: 'hiring@alshaya.com', role: 'Hiring Manager', desc: 'Review & approve top candidates' },
  { email: 'recruiter@alshaya.com', role: 'Recruiter', desc: 'Create benchmarks, upload, shortlist' },
  { email: 'panel@alshaya.com', role: 'Interview Panel', desc: 'Candidate pack + interview questions' },
  { email: 'viewer@alshaya.com', role: 'Viewer / SLT', desc: 'Read-only leadership view' },
];

export default function LoginPage() {
  // `useSearchParams` (below) requires a Suspense boundary during prerender;
  // wrapping the inner component prevents the static-export bail-out.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get('next') || '/dashboard';

  const [email, setEmail] = useState('recruiter@alshaya.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Login failed', description: data.error || 'Invalid credentials', variant: 'error' });
        setLoading(false);
        return;
      }
      toast({ title: 'Welcome back', description: `Signed in as ${data.user.name}`, variant: 'success' });
      router.push(next);
      router.refresh();
    } catch {
      toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'error' });
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="to-brand-dark relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand p-12 text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative flex items-center gap-4"
        >
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/15 text-3xl font-black backdrop-blur">
            A
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">ALSHAYA</div>
            <div className="text-xs uppercase tracking-widest opacity-80">AI Recruit Platform</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="relative space-y-8"
        >
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            AI-powered
            <br />
            resume screening,
            <br />
            <span className="text-amber-200">done right.</span>
          </h1>
          <p className="max-w-md text-lg text-white/85">
            Compare every candidate against an ideal benchmark. Score with evidence. Decide with humans in the loop.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {[
              { icon: Sparkles, t: 'Real AI', d: 'Gemini + Azure OpenAI' },
              { icon: FileSearch, t: 'Transparent', d: 'Engine + extraction shown' },
              { icon: Trophy, t: 'Ranked', d: 'Top-3 recommended' },
              { icon: ShieldCheck, t: 'Auditable', d: 'Every action logged' },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur"
              >
                <f.icon className="mb-2 h-5 w-5 text-amber-200" />
                <div className="text-sm font-semibold">{f.t}</div>
                <div className="text-xs opacity-75">{f.d}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative text-xs opacity-60">© Alshaya Group - Internal Use Only - v1.0</div>
      </aside>

      <main className="flex items-center justify-center bg-bg p-8">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Local MVP - production uses Microsoft Entra ID (SSO). Choose a demo persona below to explore each role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" loading={loading}>
                  Sign in <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="border-t border-border pt-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Demo accounts (click to fill)
                </div>
                <div className="space-y-1">
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setEmail(u.email);
                        setPassword('password123');
                      }}
                      className="group flex w-full items-center justify-between rounded-md p-2 text-left text-xs transition hover:bg-bg-muted"
                    >
                      <span className="flex flex-col">
                        <span className="font-semibold text-fg">{u.role}</span>
                        <span className="text-[11px] text-fg-muted">{u.desc}</span>
                      </span>
                      <span className="text-[10px] text-brand opacity-0 transition group-hover:opacity-100">
                        {u.email}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10px] text-fg-muted">
                  Password for all demo accounts: <span className="font-mono">password123</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
