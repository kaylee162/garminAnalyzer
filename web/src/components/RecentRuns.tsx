import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { useRecentRuns } from "../api/activities";
import { formatDate, formatDuration, formatNumber, formatPace } from "../format";

export function RecentRuns() {
  const { data, isPending, isError } = useRecentRuns();

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Recent runs</h2>
      {isPending && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {isError && <p className="mt-2 text-sm text-red-600">Could not load runs.</p>}
      {data && data.items.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">No runs yet. Sync with Garmin to pull them in.</p>
      )}
      {data && data.items.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Run</th>
                <th className="px-3 py-2 text-right font-medium">Distance</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="px-3 py-2 text-right font-medium">Pace</th>
                <th className="px-3 py-2 text-right font-medium">Avg HR</th>
                <th className="px-3 py-2 text-right font-medium">Cadence</th>
                <th className="px-3 py-2 text-right font-medium">Power</th>
                <th className="px-3 py-2 text-right font-medium">Stride</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunRow({ run }: { run: ActivitySummary }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(run.start_time_local)}</td>
      <td className="px-3 py-2">{run.name ?? "Run"}</td>
      <td className="px-3 py-2 text-right">{formatNumber(run.distance_mi, 2, " mi")}</td>
      <td className="px-3 py-2 text-right">{formatDuration(run.moving_time_s ?? run.duration_s)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formatPace(run.avg_pace_s_per_mi)}</td>
      <td className="px-3 py-2 text-right">{formatNumber(run.avg_hr, 0, " bpm")}</td>
      <td className="px-3 py-2 text-right">{formatNumber(run.avg_cadence, 0, " spm")}</td>
      <td className="px-3 py-2 text-right">{formatNumber(run.avg_power, 0, " W")}</td>
      <td className="px-3 py-2 text-right">{formatNumber(run.avg_stride_m, 2, " m")}</td>
    </tr>
  );
}
