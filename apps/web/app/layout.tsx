import type { Metadata } from 'next';
import './styles.css';
import { ThemeProvider } from '../lib/theme-provider';

export const metadata: Metadata = {
  title: 'EveMange Platform',
  description: 'Production rewrite baseline for event management.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

