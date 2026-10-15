import { useState } from "react";
import type { TrendPoint } from "@garmin-analyzer/api-client";
import { useRunTrend } from "../api/activities";
import { formatDate, formatDuration, formatNumber } from "../format";
import { LineChart, type ChartSeries } from "./LineChart";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
  { value: "ytd", label: "Year to date" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const PACE_TICK_STEPS = [5, 10, 15, 30, 60, 120, 300];
const HR_TICK_STEPS = [2, 5, 10, 20, 50];

export function RunTrends() {
  const [range, setRange] = useState<Range>("30d");
  const start = rangeStart(range, new Date());
  const { data, isPending, isError, isPlaceholderData } = useRunTrend(toLocalDate(start));

  return (
    <section id="progress" className="mt-10 scroll-mt-20 sm:mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Progress</h2>
          <p className="mt-1 text-sm text-ink-muted">One dot per run.</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Time range</span>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="field">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isPending && <p className="mt-4 text-sm text-ink-faint">Loading…</p>}
      {isError && <p className="mt-4 text-sm text-bad">Could not load your runs.</p>}
      {data && data.length === 0 && (
        <p className="card mt-4 px-5 py-8 text-center text-sm text-ink-muted">No runs in this range.</p>
      )}
      {data && data.length > 0 && (
        <div className={`mt-4 grid gap-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
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
      <ChartCard title="Pace" note="Faster is higher">
        {hasValues(pace) ? (
          <LineChart
            label="Average pace of each run over time"
            dates={dates}
            start={start}
            end={end}
            series={pace}
            formatValue={(s) => `${formatDuration(s)} /mi`}
            tickSteps={PACE_TICK_STEPS}
            invert
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
    <div className="card min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{title}</h3>
        {note && <p className="text-xs text-ink-faint">{note}</p>}
        {legend && (
          <ul className="flex gap-4 text-xs text-ink-muted">
            {legend.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
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
