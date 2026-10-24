import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { useHealth } from "./api/health";
import { BikingPage } from "./pages/biking/BikingPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { RunningPage } from "./pages/running/RunningPage";
import { SwimmingPage } from "./pages/swimming/SwimmingPage";
import { WalkingPage } from "./pages/walking/WalkingPage";
import { SPORTS } from "./sports";

type Route = {
  hash: string;
  label: string;
  Page: ComponentType;
};

// The first route is the home page, shown when the URL has no matching hash.
const ROUTES: Route[] = [
  { hash: "#/dashboard", label: "Dashboard", Page: DashboardPage },
  { hash: SPORTS.run.href, label: SPORTS.run.title, Page: RunningPage },
  { hash: SPORTS.walk.href, label: SPORTS.walk.title, Page: WalkingPage },
  { hash: SPORTS.bike.href, label: SPORTS.bike.title, Page: BikingPage },
  { hash: SPORTS.swim.href, label: SPORTS.swim.title, Page: SwimmingPage },
];

export function App() {
  const route = useRoute();

  return (
    <>
      <Header current={route} />
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-8 pb-24 sm:gap-16 sm:px-8 sm:pt-12">
        <ApiErrorBanner />
        <route.Page />
      </main>
    </>
  );
}

/** The route matching the URL hash, kept in sync as the hash changes. */
function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  return ROUTES.find((r) => r.hash === hash) ?? ROUTES[0]!;
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function Header({ current }: { current: Route }) {
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
        <a href={ROUTES[0]!.hash} onClick={closeMenu} className="flex shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-extrabold tracking-tight whitespace-nowrap [font-stretch:112%]">
            Garmin Analyzer
          </span>
        </a>
        <nav aria-label="Pages" className="ml-auto hidden items-center gap-0.5 text-sm sm:flex">
          {ROUTES.map((route) => {
            const active = route === current;
            return (
              <a
                key={route.hash}
                href={route.hash}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 font-semibold transition-colors hover:bg-surface-raised hover:text-ink ${
                  active ? "bg-surface-raised text-ink" : "text-ink-muted"
                }`}
              >
                {route.label}
              </a>
            );
          })}
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
        <nav id="mobile-nav" aria-label="Pages" className="border-t border-line px-4 pt-2 pb-4 sm:hidden">
          <ul className="flex flex-col gap-1">
            {ROUTES.map((route) => {
              const active = route === current;
              return (
                <li key={route.hash}>
                  <a
                    href={route.hash}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center rounded-xl px-3 text-base font-semibold transition-colors hover:bg-surface-raised hover:text-ink ${
                      active ? "bg-surface-raised text-ink" : "text-ink-muted"
                    }`}
                  >
                    {route.label}
                  </a>
                </li>
              );
            })}
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
