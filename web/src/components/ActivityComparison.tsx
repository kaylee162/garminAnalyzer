import type { ActivitySummary, MetricComparison } from "@garmin-analyzer/api-client";
import { useCompareActivities } from "../api/activities";
import { formatDate, formatNumber, formatPercent } from "../format";
import { capitalize, type SportConfig } from "../sports";

const PACE_KEY = "avg_pace_s_per_mi";

type ActivityComparisonProps = {
  config: SportConfig;
  selectedIds: number[];
  onClear: () => void;
};

export function ActivityComparison({ config, selectedIds, onClear }: ActivityComparisonProps) {
  const pair = selectedIds.length === 2 ? ([selectedIds[0], selectedIds[1]] as [number, number]) : null;
  const { data, isPending, isError } = useCompareActivities(pair);
  const titleId = `${config.sport}-compare-title`;

  if (!pair) {
    if (selectedIds.length === 0) return null;
    return (
      <p className="-mt-6 flex items-center gap-2 text-sm text-ink-muted sm:-mt-10">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Pick one more {config.noun} to compare.
      </p>
    );
  }

  return (
    <section aria-labelledby={titleId}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={titleId} className="section-title">
            Compare {config.nounPlural}
          </h2>
          {data && (
            <p className="mt-1 text-ink-muted">
              {Math.round(data.days_between)} days apart. Changes are measured from the earlier {config.noun}.
            </p>
          )}
        </div>
        <button type="button" onClick={onClear} className="btn btn-secondary min-h-11 px-5">
          Clear
        </button>
      </div>
      {isPending && <p className="mt-5 text-sm text-ink-faint">Comparing…</p>}
      {isError && <p className="mt-5 text-sm text-bad">Could not compare these {config.nounPlural}.</p>}
      {data && (
        <div className="card mt-5 overflow-hidden">
          <div className="grid grid-cols-2 border-b border-line">
            <ActivityHeading label="Earlier" noun={config.noun} activity={data.earlier} />
            <ActivityHeading label="Later" noun={config.noun} activity={data.later} highlight />
          </div>
          <MetricTable config={config} metrics={data.metrics.map((m) => inSportUnits(config, m))} />
        </div>
      )}
    </section>
  );
}

type ActivityHeadingProps = {
  label: string;
  noun: string;
  activity: ActivitySummary;
  highlight?: boolean;
};

function ActivityHeading({ label, noun, activity, highlight = false }: ActivityHeadingProps) {
  return (
    <div className={`min-w-0 px-4 py-5 sm:px-6 ${highlight ? "border-l border-line" : ""}`}>
      <p className={`eyebrow ${highlight ? "text-accent" : ""}`}>{label}</p>
      <p className="mt-1.5 truncate text-lg font-extrabold [font-stretch:108%] sm:text-xl">{activity.name ?? capitalize(noun)}</p>
      <p className="text-sm text-ink-muted">{formatDate(activity.start_time_local)}</p>
    </div>
  );
}

function MetricTable({ config, metrics }: { config: SportConfig; metrics: MetricComparison[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-[15px] tabular-nums">
        <thead className="text-left text-xs font-bold tracking-wider text-ink-faint uppercase">
          <tr>
            <th className="px-4 py-3.5 font-bold sm:px-6">Metric</th>
            <th className="px-3 py-3.5 text-right font-bold">Earlier</th>
            <th className="px-3 py-3.5 text-right font-bold">Later</th>
            <th className="px-4 py-3.5 text-right font-bold sm:px-6">Change</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} className="border-t border-line">
              <th scope="row" className="px-4 py-3 text-left font-semibold sm:px-6">
                {m.label}
              </th>
              <td className="px-3 py-3 text-right whitespace-nowrap text-ink-muted">{formatMetric(config, m, m.earlier)}</td>
              <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatMetric(config, m, m.later)}</td>
              <td className="px-4 py-3 text-right sm:px-6">
                <ChangeChip config={config} metric={m} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Green/red only where the backend says which way is better; anything else stays neutral.
const VERDICT_STYLES: Record<string, string> = {
  improved: "bg-good/15 text-good",
  declined: "bg-bad/15 text-bad",
  unchanged: "bg-surface-raised text-ink-muted",
};

function ChangeChip({ config, metric }: { config: SportConfig; metric: MetricComparison }) {
  if (metric.change == null) {
    return <span className="text-sm text-ink-faint">Not on both {config.nounPlural}</span>;
  }
  // The arrow carries the direction, so color is never the only signal.
  const arrow = metric.change > 0 ? "▲ " : metric.change < 0 ? "▼ " : "";
  const amount =
    metric.percent_change != null
      ? formatPercent(metric.percent_change)
      : formatMetric(config, metric, metric.change, true);
  return (
    <span
      title={formatMetric(config, metric, metric.change, true)}
      className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap ${
        VERDICT_STYLES[metric.verdict ?? ""] ?? VERDICT_STYLES.unchanged
      }`}
    >
      {arrow}
      {amount}
    </span>
  );
}

/**
 * The API compares pace in seconds per mile; restate it in the sport's own speed unit (mph for
 * rides, per 100 yd for swims) so the table matches the rest of the page. Cadence gets the sport's unit.
 */
function inSportUnits(config: SportConfig, metric: MetricComparison): MetricComparison {
  if (metric.key === "avg_cadence") return { ...metric, unit: config.cadenceUnit };
  if (metric.key !== PACE_KEY) return metric;
  const { fromPace, unit } = config.speed;
  const earlier = metric.earlier == null ? null : fromPace(metric.earlier);
  const later = metric.later == null ? null : fromPace(metric.later);
  const change = earlier != null && later != null ? later - earlier : null;
  const percentChange = change != null && earlier ? (change / earlier) * 100 : null;
  return { ...metric, unit, earlier, later, change, percent_change: percentChange };
}

function formatMetric(
  config: SportConfig,
  metric: MetricComparison,
  value: number | null | undefined,
  signed = false,
): string {
  if (value == null) return "–";
  const sign = signed && value > 0 ? "+" : signed && value < 0 ? "−" : "";
  const amount = Math.abs(value);
  if (metric.key === PACE_KEY) return `${sign}${config.speed.format(amount)} ${config.speed.unit}`;
  const digits = metric.unit === "mi" || metric.unit.includes("/") || metric.unit === "m" ? 2 : metric.unit ? 0 : 1;
  return `${sign}${formatNumber(amount, digits, metric.unit ? ` ${metric.unit}` : "")}`;
}
