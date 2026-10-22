export default function About() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 pt-24 pb-16 px-4 sm:px-6 transition-colors">
      <section className="max-w-5xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">About the project</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">NG Conflict Tracker</h1>
        <p className="mt-5 max-w-2xl text-sm sm:text-base leading-7 text-zinc-600 dark:text-zinc-400">
          A public view of reported conflict events across Nigeria, with filters for location, date, and ACLED event type.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-[1.15fr_0.85fr] items-stretch">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-7 sm:p-9 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold">Built to make event data easier to explore</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                Move around the map to see incident records for the visible area. Filter by state, local government, year, month, or one of the event types present in the supplied ACLED dataset.
              </p>
              <p className="mt-4 text-xs leading-6 text-zinc-500">
                The supplied monthly summaries cover 2021–2026. Event type details come from the ACLED file through 17 October 2025.
              </p>
            </div>
            <img src="/images/company-logo.png" alt="Company logo" className="mt-8 h-28 w-28 rounded-2xl object-contain" />
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-7 sm:p-9">
            <div className="aspect-[4/3] max-h-[360px] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <img src="/images/developer-photo.jpg" alt="Portrait of the project developer" className="h-full w-full object-cover object-[center_25%]" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Created by</p>
            <h2 className="mt-2 text-xl font-bold">Ahmed G. Sani</h2>
          </div>
        </div>
      </section>
    </main>
  );
}
