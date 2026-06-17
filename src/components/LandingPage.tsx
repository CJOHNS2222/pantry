import React from 'react';
import { ArrowRight, Camera, ChefHat, ClipboardList, LayoutDashboard, ScanSearch, Sparkles, Users } from 'lucide-react';
import { AppBadge } from '../../components/ui/AppBadge';

const features = [
  {
    icon: ScanSearch,
    title: 'Pantry Capture',
    description: 'Scan shelves, receipts, or barcodes and turn them into structured pantry items without manual cleanup.',
  },
  {
    icon: ChefHat,
    title: 'Recipe Discovery',
    description: 'Generate ideas from what you actually have, then filter them through dietary preferences and household context.',
  },
  {
    icon: ClipboardList,
    title: 'Shopping Intelligence',
    description: 'Build lists from gaps in your pantry, meal plans, and staple rules instead of starting from a blank page.',
  },
  {
    icon: LayoutDashboard,
    title: 'Weekly Planning',
    description: 'Schedule meals, balance leftovers, and keep the whole week visible from one focused planning surface.',
  },
  {
    icon: Users,
    title: 'Household Coordination',
    description: 'Keep pantry, recipes, and shopping aligned for everyone sharing the same kitchen.',
  },
  {
    icon: Camera,
    title: 'Less Waste, More Signal',
    description: 'Surface expiring items early and keep your next meal grounded in what needs using first.',
  },
];

const proofPoints = [
  'Pantry-first recipe suggestions',
  'Household-aware planning',
  'Shared shopping workflows',
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,_rgba(76,175,80,0.18),_transparent_58%)]" />

      <header className="sticky top-0 z-40 border-b border-theme bg-theme-primary/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="/" className="font-serif text-2xl font-bold text-theme-primary no-underline">Stock & Spoon</a>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-theme-secondary no-underline hover:text-theme-primary">Features</a>
            <a href="#screenshots" className="text-sm font-medium text-theme-secondary no-underline hover:text-theme-primary">Why It Feels Different</a>
            <a href="/app" className="rounded-full bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-[var(--accent-color)]/90">
              Open App
            </a>
          </div>
        </nav>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-24">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <AppBadge variant="success" size="sm">Pantry-first planning</AppBadge>
              <AppBadge variant="info" size="sm">AI recipe discovery</AppBadge>
              <AppBadge variant="warning" size="sm">Household-ready lists</AppBadge>
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl font-serif text-5xl font-bold tracking-tight text-theme-primary md:text-6xl">
                A calmer kitchen starts with one shared source of truth.
              </h1>
              <p className="max-w-2xl text-lg text-theme-secondary">
                Stock & Spoon turns pantry inventory, weekly planning, and recipe discovery into one connected workflow so you stop re-entering the same kitchen context in five different places.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/app" className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-color)] px-6 py-3 text-base font-semibold text-white no-underline transition-colors hover:bg-[var(--accent-color)]/90">
                Launch the app
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#features" className="inline-flex items-center gap-2 rounded-full border border-theme bg-theme-secondary px-6 py-3 text-base font-semibold text-theme-primary no-underline transition-colors hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]">
                Explore the workflow
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-theme bg-theme-secondary p-5 shadow-2xl">
            <div className="rounded-[1.5rem] border border-theme bg-theme-primary p-5">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">Today’s kitchen snapshot</p>
                  <p className="text-sm text-theme-secondary">What needs attention next, without jumping screens.</p>
                </div>
                <Sparkles className="h-5 w-5 text-[var(--accent-color)]" />
              </div>
              <div className="grid gap-3 pt-4">
                {proofPoints.map((point) => (
                  <div key={point} className="rounded-2xl border border-theme bg-theme-secondary/70 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-color)]/12 text-[var(--accent-color)]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-theme-primary">{point}</p>
                        <p className="text-sm text-theme-secondary">Designed to reduce switching cost between inventory, planning, and action.</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-theme bg-theme-secondary/50 py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="mb-12 max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-color)]">Core Workflow</p>
              <h2 className="font-serif text-4xl font-bold text-theme-primary md:text-5xl">The app is built around connected kitchen decisions, not isolated tools.</h2>
              <p className="text-lg text-theme-secondary">Each surface uses the same tone, spacing, and semantic accents as the in-app product so the marketing promise matches the actual experience.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[1.75rem] border border-theme bg-theme-primary p-6 shadow-lg transition-transform hover:-translate-y-1 hover:border-[var(--accent-color)]/50">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-color)]/12 text-[var(--accent-color)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-2xl font-semibold text-theme-primary">{title}</h3>
                  <p className="text-base leading-7 text-theme-secondary">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="screenshots" className="py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="rounded-[1.75rem] border border-theme bg-theme-secondary p-6">
                <AppBadge variant="neutral" size="sm">Pantry</AppBadge>
                <h3 className="mt-4 font-serif text-3xl font-bold text-theme-primary">Capture once, use everywhere.</h3>
                <p className="mt-3 text-base text-theme-secondary">Inventory feeds recipe discovery, shopping, and planning so pantry data keeps paying off instead of going stale.</p>
              </div>
              <div className="rounded-[1.75rem] border border-theme bg-theme-primary p-6 shadow-lg">
                <AppBadge variant="success" size="sm">Planning</AppBadge>
                <h3 className="mt-4 font-serif text-3xl font-bold text-theme-primary">See the week, not just the next task.</h3>
                <p className="mt-3 text-base text-theme-secondary">Meal plans, leftovers, and shopping state stay linked so the app can suggest the next action instead of another blank form.</p>
              </div>
              <div className="rounded-[1.75rem] border border-theme bg-theme-secondary p-6">
                <AppBadge variant="info" size="sm">Discovery</AppBadge>
                <h3 className="mt-4 font-serif text-3xl font-bold text-theme-primary">Recommendations with context.</h3>
                <p className="mt-3 text-base text-theme-secondary">Recipe suggestions carry preference signals, pantry constraints, and quick actions without switching to a separate recommendation mindset.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-5xl px-5">
            <div className="rounded-[2rem] border border-theme bg-theme-secondary px-8 py-10 text-center shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-color)]">Ready</p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-theme-primary md:text-5xl">Bring pantry, planning, and recipes back into one place.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-theme-secondary">
                Start with the ingredients you already own, then let Stock & Spoon carry that context through the rest of the week.
              </p>
              <a href="/app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--accent-color)] px-7 py-3 text-base font-semibold text-white no-underline transition-colors hover:bg-[var(--accent-color)]/90">
                Open Stock & Spoon
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-theme bg-theme-primary/90 py-8 text-center text-sm text-theme-secondary">
        <div className="mx-auto max-w-7xl px-5">© 2026 Stock & Spoon. Pantry, planning, and recipe discovery in one workflow.</div>
      </footer>
    </div>
  );
};

export default LandingPage;