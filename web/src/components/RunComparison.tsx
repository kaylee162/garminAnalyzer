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
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Pick one more run to compare.
      </p>
    );
  }

  return (
    <section className="mt-10 sm:mt-14">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Compare runs</h2>
        <button type="button" onClick={onClear} className="btn btn-ghost px-3 py-1.5">
          Clear
        </button>
      </div>
      {isPending && <p className="mt-4 text-sm text-ink-faint">Comparing…</p>}
      {isError && <p className="mt-4 text-sm text-bad">Could not compare these runs.</p>}
      {data && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
            <RunCard label="Earlier" run={data.earlier} />
            <RunCard label="Later" run={data.later} />
          </div>
          <p className="mt-3 text-sm text-ink-faint">
            {Math.round(data.days_between)} days apart. Changes are measured from the earlier run.
          </p>
          <Analytics metrics={data.metrics} />
        </>
      )}
    </section>
  );
}

function RunCard({ label, run }: { label: string; run: ActivitySummary }) {
  // Each stat keeps its metric color, matching the dots used across the app.
  const stats: [string, string, string][] = [
    ["Distance", formatNumber(run.distance_mi, 2, " mi"), "bg-metric-distance"],
    ["Time", formatDuration(run.moving_time_s ?? run.duration_s), "bg-metric-time"],
    ["Pace", formatPace(run.avg_pace_s_per_mi), "bg-metric-pace"],
    ["Avg HR", formatNumber(run.avg_hr, 0, " bpm"), "bg-metric-hr"],
    ["Cadence", formatNumber(run.avg_cadence, 0, " spm"), "bg-metric-cadence"],
    ["Power", formatNumber(run.avg_power, 0, " W"), "bg-metric-power"],
    ["Stride", formatNumber(run.avg_stride_m, 2, " m"), "bg-metric-stride"],
    ["Elevation", formatNumber(run.elevation_gain_ft, 0, " ft"), "bg-metric-elevation"],
  ];

  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-bold">{run.name ?? "Run"}</p>
      <p className="text-sm text-ink-muted">{formatDate(run.start_time_local)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-sm tabular-nums">
        {stats.map(([name, value, dot]) => (
          <div key={name} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-ink-muted">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {name}
            </dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Green/red only where the backend says which way is better; anything else stays neutral.
const VERDICT_COLORS: Record<string, string> = {
  improved: "text-good",
  declined: "text-bad",
  unchanged: "text-ink-faint",
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
      <h3 className="eyebrow">Analytics</h3>
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
    <div className="card relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-accent/15 to-transparent p-6 sm:p-7">
      <p className="text-sm font-medium text-ink-muted">{metric.label}</p>
      <p className={`mt-2 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl ${change.color}`}>
        {change.headline}
      </p>
      <p className="mt-2 text-sm tabular-nums text-ink-muted">{change.detail}</p>
    </div>
  );
}

function MetricCell({ metric }: { metric: MetricComparison }) {
  const change = describeChange(metric);
  return (
    <div className="card px-4 py-4">
      <p className="text-xs text-ink-muted">{metric.label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${change.color}`}>{change.headline}</p>
      <p className="mt-0.5 text-xs tabular-nums text-ink-faint">{change.detail}</p>
    </div>
  );
}

/** Headline (arrow + percent), the change in units underneath, and the color for the headline. */
function describeChange(metric: MetricComparison) {
  if (metric.change == null) {
    return { headline: "–", detail: "Not on both runs", color: "text-ink-faint" };
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
    color: VERDICT_COLORS[metric.verdict ?? ""] ?? "text-ink",
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
