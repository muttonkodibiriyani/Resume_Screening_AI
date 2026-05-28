import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: { default: 'Alshaya AI Recruit', template: '%s · Alshaya AI Recruit' },
  description: 'Enterprise AI-powered recruitment screening and candidate benchmarking platform.',
  applicationName: 'Alshaya AI Recruit',
  keywords: ['recruitment', 'AI', 'resume', 'screening', 'Alshaya'],
  authors: [{ name: 'Alshaya Group - Talent Acquisition Engineering' }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e16' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Inline theme-init script: applies saved theme before paint to prevent flash.
const themeInit = `(function(){try{var t=localStorage.getItem('alshaya-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans antialiased min-h-screen">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
