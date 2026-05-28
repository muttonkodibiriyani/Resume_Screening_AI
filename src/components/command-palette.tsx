'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search, Sparkles, Library, Upload, Trophy, Users, FileBarChart, ScrollText,
  Settings, LayoutDashboard, Sun, Moon, LogOut, BarChart3,
} from 'lucide-react';
import { useTheme } from './theme-provider';
import { Dialog, DialogContent } from './ui/dialog';

interface PaletteAction {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Navigate' | 'Actions' | 'Theme';
  perform: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const navigate = (path: string) => () => {
    setOpen(false);
    router.push(path);
  };

  const actions: PaletteAction[] = [
    { id: 'nav-dash', label: 'Dashboard', icon: LayoutDashboard, group: 'Navigate', shortcut: 'g d', perform: navigate('/dashboard') },
    { id: 'nav-research', label: 'AI Benchmark Research', icon: Sparkles, group: 'Navigate', perform: navigate('/benchmark/ai-research') },
    { id: 'nav-library', label: 'Benchmark Library', icon: Library, group: 'Navigate', perform: navigate('/benchmark') },
    { id: 'nav-upload', label: 'Upload Resumes', icon: Upload, group: 'Navigate', shortcut: 'g u', perform: navigate('/upload') },
    { id: 'nav-ranking', label: 'Candidate Ranking', icon: Trophy, group: 'Navigate', perform: navigate('/ranking') },
    { id: 'nav-candidates', label: 'Candidates', icon: Users, group: 'Navigate', perform: navigate('/candidates') },
    { id: 'nav-reports', label: 'Reports', icon: FileBarChart, group: 'Navigate', perform: navigate('/reports') },
    { id: 'nav-insights', label: 'Insights & Bias', icon: BarChart3, group: 'Navigate', perform: navigate('/insights') },
    { id: 'nav-audit', label: 'Audit Log', icon: ScrollText, group: 'Navigate', perform: navigate('/audit') },
    { id: 'nav-settings', label: 'Settings', icon: Settings, group: 'Navigate', perform: navigate('/settings') },
    { id: 'theme-light', label: 'Switch to light theme', icon: Sun, group: 'Theme', perform: () => { setTheme('light'); setOpen(false); } },
    { id: 'theme-dark', label: 'Switch to dark theme', icon: Moon, group: 'Theme', perform: () => { setTheme('dark'); setOpen(false); } },
    { id: 'action-logout', label: 'Sign out', icon: LogOut, group: 'Actions', perform: async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); setOpen(false); } },
  ];

  const groups = ['Navigate', 'Actions', 'Theme'] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <Command className="bg-transparent" label="Command palette">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-fg-muted" />
            <Command.Input
              placeholder="Search pages, actions and settings..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-fg-muted disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="hidden rounded border border-border bg-bg-muted px-1.5 py-0.5 text-[10px] font-mono text-fg-muted sm:inline-block">
              esc
            </kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-fg-muted">No matches.</Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-muted">
                {actions
                  .filter((a) => a.group === group)
                  .map((a) => (
                    <Command.Item
                      key={a.id}
                      value={a.label}
                      onSelect={a.perform}
                      className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-bg-muted"
                    >
                      <a.icon className="h-4 w-4 text-fg-muted" />
                      <span className="flex-1">{a.label}</span>
                      {a.shortcut && <kbd className="text-[10px] font-mono text-fg-muted">{a.shortcut}</kbd>}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="border-t border-border px-3 py-2 text-[11px] text-fg-muted">
            Tip: open with <kbd className="rounded border border-border bg-bg-muted px-1.5 py-0.5 font-mono">Ctrl</kbd>+<kbd className="rounded border border-border bg-bg-muted px-1.5 py-0.5 font-mono">K</kbd>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
