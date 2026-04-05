type PublicSurfacePlaceholderProps = {
  surfaceLabel: string;
  liveUrl: string;
};

export default function PublicSurfacePlaceholder({
  surfaceLabel,
  liveUrl,
}: PublicSurfacePlaceholderProps) {
  return (
    <section className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-[0_24px_80px_rgba(24,18,8,0.08)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6949]">
        Staging placeholder
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">
        This staging {surfaceLabel} is paused.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#655447] sm:text-base">
        Production is the source of truth for public metrics and public roadmap data. Staging keeps
        a placeholder here by default so test data and in-progress experiments do not look like live
        public signal.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={liveUrl}
          className="inline-flex rounded-full bg-[#17130e] px-5 py-3 text-sm font-medium text-[#f5efe6] transition hover:bg-[#2b2218]"
        >
          Open live {surfaceLabel}
        </a>
        <a
          href="/c/new"
          className="inline-flex rounded-full bg-black/5 px-5 py-3 text-sm font-medium text-[#3f3328] transition hover:bg-black/10"
        >
          Open staging app
        </a>
      </div>
    </section>
  );
}
