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

// Green/red only where the backend says which way is better; anything else stays neutral.
const VERDICT_COLORS: Record<string, string> = {
  improved: "text-emerald-600",
  declined: "text-rose-600",
  unchanged: "text-slate-400",
};

// Pace is the headline stat for a run, so it gets the large panel when it was recorded.
const FEATURED_METRIC = "avg_pace_s_per_mi";
const GRID_COLUMNS = 3;

function Analytics({ metrics }: { metrics: MetricComparison[] }) {
  const featured = metrics.find((m) => m.key === FEATURED_METRIC) ?? metrics[0];
  const rest = metrics.filter((m) => m !== featured);
  // Pad the last grid row with empty cells so the grid keeps its shape when stats are missing.
  const blanks = (GRID_COLUMNS - (rest.length % GRID_COLUMNS)) % GRID_COLUMNS;

  if (!featured) return null;

  return (
    <div className="mt-8">
      <h3 className="font-semibold">Analytics</h3>
      {/* The featured stat on the left, the rest in an even grid beside it. */}
      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_3fr]">
        <FeaturedMetric metric={featured} />
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rest.map((m) => (
              <MetricCell key={m.key} metric={m} />
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <div key={i} className="hidden sm:block" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedMetric({ metric }: { metric: MetricComparison }) {
  const change = describeChange(metric);
  return (
    <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
      <p className="text-sm text-slate-500">{metric.label}</p>
      <p className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${change.color}`}>{change.headline}</p>
      <p className="mt-2 text-sm tabular-nums text-slate-500">{change.detail}</p>
    </div>
  );
}

function MetricCell({ metric }: { metric: MetricComparison }) {
  const change = describeChange(metric);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs text-slate-500">{metric.label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${change.color}`}>{change.headline}</p>
      <p className="mt-0.5 text-xs tabular-nums text-slate-400">{change.detail}</p>
    </div>
  );
}

/** Headline (arrow + percent), the change in units underneath, and the color for the headline. */
function describeChange(metric: MetricComparison) {
  if (metric.change == null) {
    return { headline: "–", detail: "Not on both runs", color: "text-slate-300" };
  }
  const arrow = metric.change > 0 ? "↑ " : metric.change < 0 ? "↓ " : "";
  const hasPercent = metric.percent_change != null;
  // The arrow carries the direction, so the headline itself is unsigned. Without a baseline to
  // divide by there's no percent, so the raw change takes the headline instead.
  const headline = hasPercent
    ? formatPercent(Math.abs(metric.percent_change!))
    : formatMetric(metric, Math.abs(metric.change));
  return {
    headline: `${arrow}${headline}`,
    detail: hasPercent ? formatMetric(metric, metric.change, true) : " ",
    color: VERDICT_COLORS[metric.verdict ?? ""] ?? "text-slate-900",
  };
}

function formatMetric(metric: MetricComparison, value: number | null | undefined, signed = false): string {
  if (value == null) return "–";
  const sign = signed && value > 0 ? "+" : signed && value < 0 ? "−" : "";
  const amount = Math.abs(value);
  if (metric.key === "avg_pace_s_per_mi") return `${sign}${formatPace(amount)}`;
  const digits = metric.unit === "mi" || metric.unit.includes("/") || metric.unit === "m" ? 2 : metric.unit ? 0 : 1;
  return `${sign}${formatNumber(amount, digits, metric.unit ? ` ${metric.unit}` : "")}`;
}
