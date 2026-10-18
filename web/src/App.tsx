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
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-8 pb-24 sm:gap-16 sm:px-8 sm:pt-12">
        <ApiErrorBanner />
        <div className="flex flex-col gap-6 sm:gap-8">
          <SyncPanel />
          <OverallStats />
        </div>
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
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-extrabold tracking-tight [font-stretch:112%]">Garmin Analyzer</span>
        </a>
        <nav aria-label="Sections" className="ml-auto flex items-center gap-0.5 text-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 font-semibold text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
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
    <svg viewBox="0 0 30 30" aria-hidden="true" className="h-7.5 w-7.5">
      <rect x="0.5" y="0.5" width="29" height="29" rx="7.5" fill="var(--color-surface-raised)" stroke="var(--color-line-strong)" />
      <path
        d="M7 19l5-7 4 5 7-9"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ApiErrorBanner() {
  const { isError } = useHealth();
  if (!isError) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
      <span className="h-2 w-2 shrink-0 rounded-full bg-bad" />
      Can't reach the API. Is the backend running on port 8000?
    </div>
  );
}
