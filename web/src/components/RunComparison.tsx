import type { ActivitySummary, MetricComparison } from "@garmin-analyzer/api-client";
import { useCompareRuns } from "../api/activities";
import { formatDate, formatNumber, formatPace, formatPercent } from "../format";

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
      <p className="-mt-6 flex items-center gap-2 text-sm text-ink-muted sm:-mt-10">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Pick one more run to compare.
      </p>
    );
  }

  return (
    <section aria-labelledby="compare-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="compare-title" className="section-title">
            Compare runs
          </h2>
          {data && (
            <p className="mt-1 text-ink-muted">
              {Math.round(data.days_between)} days apart. Changes are measured from the earlier run.
            </p>
          )}
        </div>
        <button type="button" onClick={onClear} className="btn btn-secondary min-h-11 px-5">
          Clear
        </button>
      </div>
      {isPending && <p className="mt-5 text-sm text-ink-faint">Comparing…</p>}
      {isError && <p className="mt-5 text-sm text-bad">Could not compare these runs.</p>}
      {data && (
        <div className="card mt-5 overflow-hidden">
          <div className="grid grid-cols-2 border-b border-line">
            <RunHeading label="Earlier" run={data.earlier} />
            <RunHeading label="Later" run={data.later} highlight />
          </div>
          <MetricTable metrics={data.metrics} />
        </div>
      )}
    </section>
  );
}

function RunHeading({ label, run, highlight = false }: { label: string; run: ActivitySummary; highlight?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-5 sm:px-6 ${highlight ? "border-l border-line" : ""}`}>
      <p className={`eyebrow ${highlight ? "text-accent" : ""}`}>{label}</p>
      <p className="mt-1.5 truncate text-lg font-extrabold [font-stretch:108%] sm:text-xl">{run.name ?? "Run"}</p>
      <p className="text-sm text-ink-muted">{formatDate(run.start_time_local)}</p>
    </div>
  );
}

function MetricTable({ metrics }: { metrics: MetricComparison[] }) {
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
              <td className="px-3 py-3 text-right whitespace-nowrap text-ink-muted">{formatMetric(m, m.earlier)}</td>
              <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatMetric(m, m.later)}</td>
              <td className="px-4 py-3 text-right sm:px-6">
                <ChangeChip metric={m} />
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

function ChangeChip({ metric }: { metric: MetricComparison }) {
  if (metric.change == null) {
    return <span className="text-sm text-ink-faint">Not on both runs</span>;
  }
  // The arrow carries the direction, so color is never the only signal.
  const arrow = metric.change > 0 ? "▲ " : metric.change < 0 ? "▼ " : "";
  const amount =
    metric.percent_change != null
      ? formatPercent(metric.percent_change)
      : formatMetric(metric, metric.change, true);
  return (
    <span
      title={formatMetric(metric, metric.change, true)}
      className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap ${
        VERDICT_STYLES[metric.verdict ?? ""] ?? VERDICT_STYLES.unchanged
      }`}
    >
      {arrow}
      {amount}
    </span>
  );
}

function formatMetric(metric: MetricComparison, value: number | null | undefined, signed = false): string {
  if (value == null) return "–";
  const sign = signed && value > 0 ? "+" : signed && value < 0 ? "−" : "";
  const amount = Math.abs(value);
  if (metric.key === "avg_pace_s_per_mi") return `${sign}${formatPace(amount)}`;
  const digits = metric.unit === "mi" || metric.unit.includes("/") || metric.unit === "m" ? 2 : metric.unit ? 0 : 1;
  return `${sign}${formatNumber(amount, digits, metric.unit ? ` ${metric.unit}` : "")}`;
}
