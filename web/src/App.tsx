import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    // The menu only exists below the sm breakpoint, so drop it if the window grows past that.
    const desktop = window.matchMedia("(min-width: 40rem)");
    const onResize = () => desktop.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <a href="#" onClick={closeMenu} className="flex shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-extrabold tracking-tight whitespace-nowrap [font-stretch:112%]">
            Garmin Analyzer
          </span>
        </a>
        <nav aria-label="Sections" className="ml-auto hidden items-center gap-0.5 text-sm sm:flex">
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
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
          className="btn btn-ghost -mr-2 ml-auto h-11 w-11 p-0 sm:hidden"
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Sections" className="border-t border-line px-4 pt-2 pb-4 sm:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={closeMenu}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
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
