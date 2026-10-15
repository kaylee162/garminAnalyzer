import { useState } from "react";
import { useHealth } from "./api/health";
import { OverallStats } from "./components/OverallStats";
import { RecentRuns } from "./components/RecentRuns";
import { RunTrends } from "./components/RunTrends";
import { RunComparison } from "./components/RunComparison";
import { SyncPanel } from "./components/SyncPanel";
import { TrainingPlan } from "./components/TrainingPlan";

const NAV_LINKS = [
  { href: "#progress", label: "Progress" },
  { href: "#runs", label: "Runs" },
  { href: "#plan", label: "Plan" },
];

export function App() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Keep at most two runs picked: ticking a third replaces the one picked first.
  const toggleRun = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2),
    );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <ApiErrorBanner />
        <SyncPanel />
        <OverallStats />
        <RunTrends />
        <RecentRuns selectedIds={selectedIds} onToggle={toggleRun} />
        <RunComparison selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
        <TrainingPlan />
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-bold tracking-tight">Garmin Analyzer</span>
        </a>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 font-medium text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-metric-power)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#logo-gradient)" />
      <path d="M6.5 14.5l3.5-5 3 3.5 4.5-6" fill="none" stroke="#04121f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ApiErrorBanner() {
  const { isError } = useHealth();
  if (!isError) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
      <span className="h-2 w-2 shrink-0 rounded-full bg-bad" />
      Can't reach the API. Is the backend running on port 8000?
    </div>
  );
}
