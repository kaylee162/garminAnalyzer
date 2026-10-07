import { useSyncNow, useSyncStatus } from "../api/activities";
import { formatDateTime } from "../format";

export function SyncPanel() {
  const { data: status } = useSyncStatus();
  const sync = useSyncNow();

  let summary = "Not synced yet.";
  if (status?.last_sync_at) {
    summary = `${status.activity_count} activities · last synced ${formatDateTime(status.last_sync_at)}`;
  }
  if (status && !status.configured) {
    summary = "Garmin isn't set up yet. Add your login to backend/.env and run the first sync.";
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">
            Garmin{status?.display_name ? ` · ${status.display_name}` : ""}
          </div>
          <div className="text-slate-600">{summary}</div>
        </div>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {sync.isPending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {sync.isSuccess && (
        <p className="mt-2 text-sm text-green-700">
          {sync.data.added === 0
            ? "Up to date."
            : `Added ${sync.data.added} new ${sync.data.added === 1 ? "activity" : "activities"}.`}
        </p>
      )}
      {sync.isError && <p className="mt-2 text-sm text-red-600">{sync.error.message}</p>}
    </section>
  );
}
