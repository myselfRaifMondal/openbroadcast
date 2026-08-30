import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenBroadcast — Public & Open Live TV',
  description:
    'Live TV from public-service broadcasters, government and civic channels only. Every channel carries a stated licensing basis.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
              />
              <span className="text-[15px] font-semibold tracking-tight">
                OpenBroadcast
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-[13px] text-muted">
              <Link href="/policy" className="transition-colors hover:text-foreground">
                Why these channels?
              </Link>
              <a
                href="https://github.com/myselfRaifMondal/openbroadcast"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Source
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-7xl px-5 py-6 text-[12px] leading-relaxed text-muted">
            OpenBroadcast indexes only public-service, government, and civic
            channels drawn from the{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              iptv-org
            </a>{' '}
            open dataset. Streams are served directly by the broadcasters; we
            host no video. See the{' '}
            <Link href="/policy" className="text-foreground underline underline-offset-2">
              filtering policy
            </Link>
            .
          </div>
        </footer>
      </body>
    </html>
  );
}
