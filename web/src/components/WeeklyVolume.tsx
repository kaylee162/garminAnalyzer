import type { WeekVolume } from "@garmin-analyzer/api-client";
import { formatTotalTime } from "../format";
import { sportLook } from "../sports";

// The API's sport groups, bottom of each bar first. Fixed, so a sport keeps its place and hue.
const STACK_ORDER = ["run", "walk", "bike", "swim", "other"];
const HOUR_STEPS = [0.5, 1, 2, 5, 10, 20];
const SECONDS_PER_HOUR = 3600;
// Columns this close to either edge anchor their tooltip to that edge, so it never spills out.
const EDGE_COLUMNS = 3;

/** Hours trained each week, stacked by sport. */
export function WeeklyVolume({ weeks }: { weeks: WeekVolume[] }) {
  const totals = weeks.map(weekTotal);
  const ticks = hourTicks(Math.max(...totals, 0) / SECONDS_PER_HOUR);
  const topSeconds = (ticks.at(-1) ?? 1) * SECONDS_PER_HOUR;
  const sportsShown = STACK_ORDER.filter((sport) => weeks.some((w) => w.time_s_by_sport[sport]));

  return (
    <section aria-labelledby="weekly-title">
      <h2 id="weekly-title" className="section-title">
        Weekly volume
      </h2>
      <p className="mt-1 text-ink-muted">Time spent training each week, by sport.</p>

      <div className="card mt-5 min-w-0 p-4 sm:px-6 sm:pt-5 sm:pb-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-bold">Last {weeks.length} weeks</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {sportsShown.map((sport) => (
              <li key={sport} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: sportLook(sport).color }} />
                {sportLook(sport).title}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="flex gap-2">
          {/* Y axis: tick labels, top to bottom. */}
          <div className="relative h-[220px] w-8 shrink-0 text-right text-[11px] text-ink-faint tabular-nums">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2"
                style={{ bottom: `${(tick * SECONDS_PER_HOUR * 100) / topSeconds}%` }}
              >
                {tick}h
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-[220px]">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute inset-x-0 border-t border-line"
                  style={{ bottom: `${(tick * SECONDS_PER_HOUR * 100) / topSeconds}%` }}
                />
              ))}
              <div className="absolute inset-0 flex gap-1 sm:gap-2">
                {weeks.map((week, i) => (
                  <WeekBar
                    key={week.week_start}
                    week={week}
                    total={totals[i] ?? 0}
                    topSeconds={topSeconds}
                    align={i < EDGE_COLUMNS ? "start" : i >= weeks.length - EDGE_COLUMNS ? "end" : "center"}
                  />
                ))}
              </div>
            </div>
            {/* Every third date on phones, counted back from this week, so the labels never run into
                each other. Each label centers on its bar and may spill past the bar's width. */}
            <div className="mt-2 flex gap-1 text-[11px] text-ink-faint sm:gap-2">
              {weeks.map((week, i) => (
                <span
                  key={week.week_start}
                  className={`flex min-w-0 flex-1 justify-center whitespace-nowrap ${
                    (weeks.length - 1 - i) % 3 !== 0 ? "invisible sm:visible" : ""
                  }`}
                >
                  {weekLabel(week.week_start)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The numbers behind the chart, for screen readers. Tables ignore a 1px width, so a div hides it. */}
        <div className="sr-only">
          <table>
            <caption>Time spent training each week, by sport</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                {sportsShown.map((sport) => (
                  <th key={sport} scope="col">
                    {sportLook(sport).title}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => (
                <tr key={week.week_start}>
                  <th scope="row">{weekLabel(week.week_start)}</th>
                  {sportsShown.map((sport) => (
                    <td key={sport}>{formatTotalTime(week.time_s_by_sport[sport] ?? 0)}</td>
                  ))}
                  <td>{formatTotalTime(totals[i] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type WeekBarProps = {
  week: WeekVolume;
  total: number;
  topSeconds: number;
  align: "start" | "center" | "end";
};

function WeekBar({ week, total, topSeconds, align }: WeekBarProps) {
  const segments = STACK_ORDER.flatMap((sport) => {
    const seconds = week.time_s_by_sport[sport];
    return seconds ? [{ sport, seconds }] : [];
  });
  const height = (total * 100) / topSeconds;
  const tooltipPosition = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  return (
    // The whole column is the hover target, so short bars are as easy to point at as tall ones.
    <div className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
      {/* Bottom segment first; a 2px gap keeps neighboring sports apart. */}
      <div
        className="flex w-full max-w-10 flex-col-reverse gap-[2px] transition-opacity group-hover:opacity-85"
        style={{ height: `${height}%` }}
      >
        {segments.map((s, i) => (
          <div
            key={s.sport}
            className={`min-h-[2px] ${i === segments.length - 1 ? "rounded-t-[4px]" : ""}`}
            style={{ flexGrow: s.seconds, flexBasis: 0, backgroundColor: sportLook(s.sport).color }}
          />
        ))}
      </div>
      <div
        className={`pointer-events-none absolute z-10 mb-2 hidden w-max rounded-xl border border-line-strong bg-surface-raised px-3 py-2 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] group-hover:block ${tooltipPosition}`}
        style={{ bottom: `${height}%` }}
      >
        <p className="text-xs text-ink-muted">Week of {weekLabel(week.week_start)}</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums">{formatTotalTime(total)}</p>
        {[...segments].reverse().map((s) => (
          <p key={s.sport} className="mt-1 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: sportLook(s.sport).color }} />
            <span className="font-semibold text-ink tabular-nums">{formatTotalTime(s.seconds)}</span>
            <span className="text-ink-faint">{sportLook(s.sport).title}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function weekTotal(week: WeekVolume): number {
  return Object.values(week.time_s_by_sport).reduce((sum, seconds) => sum + seconds, 0);
}

/** 0 up to a round number of hours covering `maxHours`, using the smallest step that needs four or fewer gaps. */
function hourTicks(maxHours: number): number[] {
  const step = HOUR_STEPS.find((s) => Math.ceil(maxHours / s) <= 4) ?? HOUR_STEPS.at(-1)!;
  const count = Math.max(Math.ceil(maxHours / step), 1);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** "Oct 19". The API sends a plain YYYY-MM-DD; parsing it as local midnight keeps the day from shifting. */
function weekLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
