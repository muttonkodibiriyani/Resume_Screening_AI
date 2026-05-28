'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Upload,
  Trophy,
  Users,
  FileBarChart,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  Command as CmdIcon,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-react';
import { cn, initials, roleLabelClient } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortGroup?: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/insights', label: 'Insights', icon: BarChart3 },
    ],
  },
  {
    group: 'Benchmark',
    items: [
      { href: '/benchmark/ai-research', label: 'AI Research', icon: Sparkles },
      { href: '/benchmark', label: 'Library', icon: Library },
    ],
  },
  {
    group: 'Pipeline',
    items: [
      { href: '/upload', label: 'Upload & Score', icon: Upload },
      { href: '/ranking', label: 'Ranking', icon: Trophy },
      { href: '/candidates', label: 'Candidates', icon: Users },
      { href: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    group: 'Governance',
    items: [
      { href: '/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface AppShellProps {
  children: React.ReactNode;
  user?: { id: string; name: string; role: string; email: string } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavBody = ({ collapsed: c = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) => (
    <TooltipProvider delayDuration={150}>
      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Primary">
        {NAV.map((group) => (
          <div key={group.group} className="space-y-0.5">
            {!c && (
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                {group.group}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const inner = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    active ? 'bg-brand text-brand-foreground shadow-sm' : 'text-fg hover:bg-bg-muted',
                    c && 'justify-center px-2',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!c && <span className="truncate">{item.label}</span>}
                </Link>
              );
              if (c) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{inner}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.href}>{inner}</div>;
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );

  const breadcrumbs = (() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((p, i) => ({
      label: p.replace(/-/g, ' '),
      href: '/' + parts.slice(0, i + 1).join('/'),
    }));
  })();

  return (
    <div className="flex min-h-screen bg-bg">
      <CommandPalette />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden border-r border-border bg-bg-elevated transition-all duration-200 ease-out lg:flex lg:flex-col',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        )}
      >
        <div className={cn('flex items-center gap-3 border-b border-border p-4', collapsed && 'justify-center px-3')}>
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="Alshaya AI Recruit home">
            <div className="alshaya-gradient flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white shadow-md">
              A
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-tight text-fg">ALSHAYA</div>
                <div className="text-[10px] font-semibold tracking-widest text-fg-muted">AI RECRUIT</div>
              </div>
            )}
          </Link>
        </div>
        <NavBody collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-bg-elevated/85 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <div className="alshaya-gradient flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white">
                      A
                    </div>
                    <div className="leading-tight">
                      <div className="text-sm font-bold tracking-tight">ALSHAYA</div>
                      <div className="text-[10px] font-semibold tracking-widest text-fg-muted">AI RECRUIT</div>
                    </div>
                  </div>
                  <NavBody onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm text-fg-muted md:flex">
              <Link href="/dashboard" className="hover:text-fg">
                Home
              </Link>
              {breadcrumbs.slice(0, 3).map((b, i) => (
                <span key={b.href} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <Link
                    href={b.href}
                    className={cn('capitalize', i === breadcrumbs.length - 1 ? 'font-medium text-fg' : 'hover:text-fg')}
                  >
                    {b.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-xs text-fg-muted shadow-sm sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>AI-Advisory · Human approval · Audit on</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => {
                const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
                window.dispatchEvent(ev);
              }}
              aria-label="Open command palette"
            >
              <CmdIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-border bg-bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                Ctrl K
              </kbd>
            </Button>
            <ThemeToggle />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {initials(user.name)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-fg">{user.name}</span>
                    <span className="text-[11px] font-normal text-fg-muted">{user.email}</span>
                    <span className="mt-1 inline-flex w-fit rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {roleLabelClient(user.role)}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await fetch('/api/auth/logout', { method: 'POST' });
                      router.push('/login');
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
