import type { ActivitySummary, MetricComparison } from "@garmin-analyzer/api-client";
import { useCompareRuns } from "../api/activities";
import { formatDate, formatDuration, formatNumber, formatPace, formatPercent } from "../format";

type RunComparisonProps = {
  selectedIds: number[];
  onClear: () => void;
};

export function RunComparison({ selectedIds, onClear }: RunComparisonProps) {
  const pair = selectedIds.length === 2 ? ([selectedIds[0], selectedIds[1]] as [number, number]) : null;
  const { data, isPending, isError } = useCompareRuns(pair);

  if (!pair) {
    if (selectedIds.length === 0) return null;
    return <p className="mt-6 text-sm text-slate-500">Pick one more run to compare.</p>;
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Compare runs</h2>
        <button type="button" onClick={onClear} className="text-sm text-slate-500 hover:text-slate-800">
          Clear
        </button>
      </div>
      {isPending && <p className="mt-2 text-sm text-slate-500">Comparing…</p>}
      {isError && <p className="mt-2 text-sm text-red-600">Could not compare these runs.</p>}
      {data && (
        <>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <RunCard label="Earlier" run={data.earlier} />
            <RunCard label="Later" run={data.later} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {Math.round(data.days_between)} days apart. Changes are measured from the earlier run.
          </p>
          <Analytics metrics={data.metrics} />
        </>
      )}
    </section>
  );
}

function RunCard({ label, run }: { label: string; run: ActivitySummary }) {
  const stats: [string, string][] = [
    ["Distance", formatNumber(run.distance_mi, 2, " mi")],
    ["Time", formatDuration(run.moving_time_s ?? run.duration_s)],
    ["Pace", formatPace(run.avg_pace_s_per_mi)],
    ["Avg HR", formatNumber(run.avg_hr, 0, " bpm")],
    ["Cadence", formatNumber(run.avg_cadence, 0, " spm")],
    ["Power", formatNumber(run.avg_power, 0, " W")],
    ["Stride", formatNumber(run.avg_stride_m, 2, " m")],
    ["Elevation", formatNumber(run.elevation_gain_ft, 0, " ft")],
  ];

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium">{run.name ?? "Run"}</p>
      <p className="text-sm text-slate-600">{formatDate(run.start_time_local)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
        {stats.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-2">
            <dt className="text-slate-500">{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  improved: "text-green-700",
  declined: "text-red-700",
};

function Analytics({ metrics }: { metrics: MetricComparison[] }) {
  return (
    <div className="mt-6">
      <h3 className="font-semibold">Analytics</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 text-right font-medium">Earlier</th>
              <th className="px-3 py-2 text-right font-medium">Later</th>
              <th className="px-3 py-2 text-right font-medium">Change</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
              <th className="px-3 py-2 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: MetricComparison }) {
  const color = (metric.verdict && VERDICT_STYLES[metric.verdict]) ?? "text-slate-900";
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">{metric.label}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formatMetric(metric, metric.earlier)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formatMetric(metric, metric.later)}</td>
      <td className={`whitespace-nowrap px-3 py-2 text-right ${color}`}>
        {formatMetric(metric, metric.change, true)}
      </td>
      <td className={`px-3 py-2 text-right ${color}`}>{formatPercent(metric.percent_change)}</td>
      <td className="px-3 py-2 text-slate-600">{metric.summary ?? "Not recorded on both runs"}</td>
    </tr>
  );
}

function formatMetric(metric: MetricComparison, value: number | null | undefined, signed = false): string {
  if (value == null) return "–";
  const sign = signed && value > 0 ? "+" : signed && value < 0 ? "−" : "";
  const amount = Math.abs(value);
  if (metric.key === "avg_pace_s_per_mi") return `${sign}${formatPace(amount)}`;
  if (metric.key === "moving_time_s") return `${sign}${formatDuration(amount)}`;
  const digits = metric.unit === "mi" || metric.unit.includes("/") || metric.unit === "m" ? 2 : metric.unit ? 0 : 1;
  return `${sign}${formatNumber(amount, digits, metric.unit ? ` ${metric.unit}` : "")}`;
}
