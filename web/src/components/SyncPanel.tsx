import { useSyncNow, useSyncStatus } from "../api/activities";
import { formatDateTime } from "../format";

export function SyncPanel() {
  const { data: status } = useSyncStatus();
  const sync = useSyncNow();

  let summary = "Not synced yet.";
  if (status?.last_sync_at) {
    summary = `Last synced ${formatDateTime(status.last_sync_at)}`;
  }
  if (status && !status.configured) {
    summary = "Garmin isn't set up yet. Add your login to backend/.env and run the first sync.";
  }
  const greeting = status?.display_name ? `Hi, ${status.display_name}` : "Your training";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <section aria-label="Overview" className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-[0.12em] text-accent uppercase">{today}</p>
        <h1 className="display mt-2.5 text-4xl text-balance sm:text-[3.25rem]">{greeting}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          {status?.last_sync_at && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-good" />}
          {summary}
        </p>
        {sync.isSuccess && (
          <p className="mt-2 text-sm font-semibold text-good">
            {sync.data.added === 0
              ? "Up to date."
              : `Added ${sync.data.added} new ${sync.data.added === 1 ? "activity" : "activities"}.`}
          </p>
        )}
        {sync.isError && <p className="mt-2 text-sm font-semibold text-bad">{sync.error.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        className="btn btn-primary min-h-11 self-start px-5 sm:self-auto"
      >
        <SyncIcon spinning={sync.isPending} />
        {sync.isPending ? "Syncing…" : "Sync now"}
      </button>
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
