import { useRunStats, useSyncNow, useSyncStatus } from "../api/activities";
import { formatDateTime } from "../format";

export function SyncPanel() {
  const { data: status } = useSyncStatus();
  // Count runs only, to match the rest of the page; the sync status counts every activity type.
  const { data: runStats } = useRunStats();
  const sync = useSyncNow();

  let summary = "Not synced yet.";
  if (status?.last_sync_at) {
    summary = `Last synced ${formatDateTime(status.last_sync_at)}`;
  }
  if (status && !status.configured) {
    summary = "Garmin isn't set up yet. Add your login to backend/.env and run the first sync.";
  }
  const greeting = status?.display_name ? `Hi, ${status.display_name}` : "Your training";

  return (
    <section className="card relative overflow-hidden p-5 sm:p-7">
      {/* A soft glow in the corner, the one decorative touch on the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Garmin Connect</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-ink-muted">{summary}</p>
        </div>
        <div className="flex items-end justify-between gap-6 sm:justify-end">
          {status?.last_sync_at && runStats && (
            <div className="sm:text-right">
              <p className="text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                {runStats.count}
              </p>
              <p className="text-xs text-ink-faint">{runStats.count === 1 ? "run" : "runs"}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="btn btn-primary"
          >
            <SyncIcon spinning={sync.isPending} />
            {sync.isPending ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>
      {sync.isSuccess && (
        <p className="relative mt-4 text-sm text-good">
          {sync.data.added === 0
            ? "Up to date."
            : `Added ${sync.data.added} new ${sync.data.added === 1 ? "activity" : "activities"}.`}
        </p>
      )}
      {sync.isError && <p className="relative mt-4 text-sm text-bad">{sync.error.message}</p>}
    </section>
  );
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
    >
      <path d="M16.5 10a6.5 6.5 0 0 1-11.6 4M3.5 10a6.5 6.5 0 0 1 11.6-4" />
      <path d="M15.5 2.5v3.8h-3.8M4.5 17.5v-3.8h3.8" />
    </svg>
  );
}
