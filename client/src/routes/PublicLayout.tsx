import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Banner } from '~/components/Banners';

type PublicLayoutProps = {
  pageTitle: string;
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated?: string | null;
  children: ReactNode;
};

function formatUpdatedAt(lastUpdated?: string | null) {
  if (!lastUpdated) {
    return 'Refreshing from live data';
  }

  try {
    return `Updated ${new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(lastUpdated))}`;
  } catch {
    return 'Refreshing from live data';
  }
}

export default function PublicLayout({
  pageTitle,
  eyebrow,
  title,
  description,
  lastUpdated,
  children,
}: PublicLayoutProps) {
  const location = useLocation();

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  const navItems = [
    { to: '/dash', label: 'Dashboard' },
    { to: '/roadmap', label: 'Roadmap' },
    { to: '/c/new', label: 'Open App' },
  ];

  return (
    <div className="min-h-screen bg-[#f5efe6] text-[#17130e]">
      <Banner />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-[#b86c2c]/20 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-[#2f4f4f]/15 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-[#d5b07a]/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-black/10 bg-white/70 px-5 py-4 shadow-[0_20px_80px_rgba(24,18,8,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#8b6949]">
                2026GPT Public Surface
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">Big Truck Co / 2026GPT</div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-[#17130e] text-[#f5efe6]'
                        : 'bg-black/5 text-[#3f3328] hover:bg-black/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <section className="mb-8 overflow-hidden rounded-[36px] border border-black/10 bg-[#17130e] text-[#f5efe6] shadow-[0_30px_120px_rgba(17,12,6,0.24)]">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#d7b58c]">
                {eyebrow}
              </div>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#e2d6c6] sm:text-lg">
                {description}
              </p>
            </div>
            <div className="flex items-end justify-start lg:justify-end">
              <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-white/8 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b58c]">
                  Live signal
                </div>
                <div className="mt-3 text-2xl font-semibold">Transparent by design</div>
                <p className="mt-2 text-sm leading-6 text-[#d7cab9]">
                  Public metrics stay aggregated. Public roadmap stays conversational. Sensitive
                  internals stay private.
                </p>
                <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#f3e9dc]">
                  {formatUpdatedAt(lastUpdated)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="pb-10">{children}</main>
      </div>
    </div>
  );
}
