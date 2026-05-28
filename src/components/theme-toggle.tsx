'use client';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from './ui/dropdown-menu';
import { Button } from './ui/button';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')} aria-current={theme === 'light'}>
          <Sun className="h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} aria-current={theme === 'dark'}>
          <Moon className="h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} aria-current={theme === 'system'}>
          <Monitor className="h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
