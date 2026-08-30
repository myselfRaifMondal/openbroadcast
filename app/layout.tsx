import type { Metadata } from 'next';
import Link from 'next/link';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { ShuffleButton } from '@/components/ShuffleButton';
import { Sidebar } from '@/components/Sidebar';
import { getRailChannels, getShuffleIds } from '@/lib/channels';
import './globals.css';

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
});
const plex = IBM_Plex_Sans({
  variable: '--font-plex',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'OpenBroadcast',
  description: 'Live television from everywhere, in one tuner.',
};

/** Seven SMPTE bars — the mark this whole interface is built around. */
function BarMark() {
  return (
    <span
      aria-hidden
      className="bars inline-block h-5 w-[18px] rounded-[2px] shadow-[0_0_18px_-4px_var(--bar-cyan)]"
    />
  );
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plex.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <BarMark />
              <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.14em]">
                Openbroadcast
              </span>
            </Link>

            <div className="ml-auto">
              <ShuffleButton ids={getShuffleIds()} />
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <Sidebar channels={getRailChannels()} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-5">
            <span aria-hidden className="bars h-[3px] flex-1 rounded-full opacity-30" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              End of transmission
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
