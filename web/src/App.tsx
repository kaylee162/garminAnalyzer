import { useSyncExternalStore, type ComponentType } from "react";
import { useHealth } from "./api/health";
import { BikingPage } from "./pages/biking/BikingPage";
import { RunningPage } from "./pages/running/RunningPage";
import { SwimmingPage } from "./pages/swimming/SwimmingPage";
import { WalkingPage } from "./pages/walking/WalkingPage";

type Route = {
  hash: string;
  label: string;
  Page: ComponentType;
};

// The first route is the home page, shown when the URL has no matching hash.
const ROUTES: Route[] = [
  { hash: "#/running", label: "Running", Page: RunningPage },
  { hash: "#/walking", label: "Walking", Page: WalkingPage },
  { hash: "#/biking", label: "Biking", Page: BikingPage },
  { hash: "#/swimming", label: "Swimming", Page: SwimmingPage },
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
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <a href={ROUTES[0]!.hash} className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-extrabold tracking-tight [font-stretch:112%]">Garmin Analyzer</span>
        </a>
        <nav aria-label="Sports" className="ml-auto flex items-center gap-0.5 text-sm">
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
