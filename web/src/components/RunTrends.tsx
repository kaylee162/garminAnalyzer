import { useState } from "react";
import type { TrendPoint } from "@garmin-analyzer/api-client";
import { useRunTrend } from "../api/activities";
import { formatDate, formatDuration, formatNumber } from "../format";
import { LineChart, type ChartSeries } from "./LineChart";

const RANGES = [
  { value: "7d", short: "7D", label: "Last 7 days" },
  { value: "30d", short: "30D", label: "Last 30 days" },
  { value: "3m", short: "3M", label: "Last 3 months" },
  { value: "6m", short: "6M", label: "Last 6 months" },
  { value: "1y", short: "1Y", label: "Last year" },
  { value: "ytd", short: "YTD", label: "Year to date" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const PACE_TICK_STEPS = [5, 10, 15, 30, 60, 120, 300];
const HR_TICK_STEPS = [2, 5, 10, 20, 50];

export function RunTrends() {
  const [range, setRange] = useState<Range>("30d");
  const start = rangeStart(range, new Date());
  const { data, isPending, isError, isPlaceholderData } = useRunTrend(toLocalDate(start));

  return (
    <section id="progress" aria-labelledby="progress-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="progress-title" className="section-title">
            Progress
          </h2>
          <p className="mt-1 text-ink-muted">One dot per run.</p>
        </div>
        <div role="group" aria-label="Time range" className="flex flex-wrap gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line">
          {RANGES.map((r) => {
            const picked = r.value === range;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                aria-pressed={picked}
                aria-label={r.label}
                title={r.label}
                className={`min-h-9 rounded-full px-3.5 text-[13px] font-bold transition-colors ${
                  picked ? "bg-surface-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {r.short}
              </button>
            );
          })}
        </div>
      </div>

      {isPending && <p className="mt-5 text-sm text-ink-faint">Loading…</p>}
      {isError && <p className="mt-5 text-sm text-bad">Could not load your runs.</p>}
      {data && data.length === 0 && (
        <p className="card mt-5 px-5 py-10 text-center text-sm text-ink-muted">No runs in this range.</p>
      )}
      {data && data.length > 0 && (
        <div className={`mt-5 grid gap-5 lg:grid-cols-2 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
          <TrendCharts runs={data} start={start} />
        </div>
      )}
    </section>
  );
}

function TrendCharts({ runs, start }: { runs: TrendPoint[]; start: Date }) {
  const dates = runs.map((r) => new Date(r.start_time_local));
  const end = new Date();
  const describeRun = (i: number) => {
    const run = runs[i];
    return run ? `${formatDate(run.start_time_local)} · ${run.name ?? "Run"}` : "";
  };
  const pace: ChartSeries[] = [
    { label: "pace", color: "var(--color-metric-pace)", values: runs.map((r) => r.avg_pace_s_per_mi) },
  ];
  const heartRate: ChartSeries[] = [
    { label: "avg HR", color: "var(--color-chart-avg-hr)", values: runs.map((r) => r.avg_hr) },
    { label: "max HR", color: "var(--color-chart-max-hr)", values: runs.map((r) => r.max_hr) },
  ];

  return (
    <>
      <ChartCard title="Pace" note="Lower is faster">
        {hasValues(pace) ? (
          <LineChart
            label="Average pace of each run over time"
            dates={dates}
            start={start}
            end={end}
            series={pace}
            formatValue={(s) => `${formatDuration(s)} /mi`}
            tickSteps={PACE_TICK_STEPS}
            describePoint={describeRun}
          />
        ) : (
          <NoData />
        )}
      </ChartCard>
      <ChartCard title="Heart rate" legend={heartRate}>
        {hasValues(heartRate) ? (
          <LineChart
            label="Average and max heart rate of each run over time"
            dates={dates}
            start={start}
            end={end}
            series={heartRate}
            formatValue={(bpm) => formatNumber(bpm, 0, " bpm")}
            tickSteps={HR_TICK_STEPS}
            describePoint={describeRun}
          />
        ) : (
          <NoData />
        )}
      </ChartCard>
    </>
  );
}

type ChartCardProps = {
  title: string;
  note?: string;
  legend?: ChartSeries[];
  children: React.ReactNode;
};

function ChartCard({ title, note, legend, children }: ChartCardProps) {
  return (
    <div className="card min-w-0 p-4 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-bold">{title}</h3>
        {note && <p className="text-xs text-ink-faint">{note}</p>}
        {legend && (
          <ul className="flex gap-4 text-xs text-ink-muted">
            {legend.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className="h-[3px] w-3.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </div>
  );
}

function NoData() {
  return <p className="py-10 text-center text-sm text-ink-faint">None of these runs recorded this.</p>;
}

function hasValues(series: ChartSeries[]) {
  return series.some((s) => s.values.some((v) => v != null));
}

/** Midnight on the first day of the range, local time. */
function rangeStart(range: Range, today: Date): Date {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (range) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
  }
  return start;
}

/** YYYY-MM-DD in local time; toISOString would shift it to UTC. */
function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
