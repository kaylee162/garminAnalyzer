import type { Dashboard, Totals } from "@garmin-analyzer/api-client";
import type { ReactNode } from "react";
import { formatCount, formatTotalTime } from "../format";

/** This week, this year and the activity streak, side by side. */
export function PeriodSummary({ dashboard }: { dashboard: Dashboard }) {
  const { this_week, last_week, this_year, streak } = dashboard;

  return (
    <section aria-labelledby="period-title">
      <h2 id="period-title" className="section-title">
        At a glance
      </h2>
      <p className="mt-1 text-ink-muted">Weeks run Monday to Sunday.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <PeriodCard title="This week" totals={this_week}>
          Last week: {formatTotalTime(last_week.time_s)} over {activityCount(last_week.count)}
        </PeriodCard>
        <PeriodCard title={`${new Date().getFullYear()} so far`} totals={this_year}>
          {formatCount(this_year.elevation_gain_ft)} ft climbed · {formatCount(this_year.calories)} kcal
        </PeriodCard>
        <GlanceCard
          title="Streak"
          value={formatCount(streak.current_days)}
          unit={streak.current_days === 1 ? "day" : "days"}
          detail={streak.current_days > 0 ? "In a row with an activity" : "Log one today to start a streak"}
        >
          Longest ever: {streak.longest_days} {streak.longest_days === 1 ? "day" : "days"}
        </GlanceCard>
      </div>
    </section>
  );
}

function PeriodCard({ title, totals, children }: { title: string; totals: Totals; children: ReactNode }) {
  return (
    <GlanceCard
      title={title}
      value={formatTotalTime(totals.time_s)}
      detail={`${activityCount(totals.count)} · ${formatCount(totals.distance_mi, 1)} mi`}
    >
      {children}
    </GlanceCard>
  );
}

type GlanceCardProps = {
  title: string;
  value: string;
  unit?: string;
  detail: string;
  // A quieter line under a divider, for context such as last week's total.
  children: ReactNode;
};

function GlanceCard({ title, value, unit, detail, children }: GlanceCardProps) {
  return (
    <div className="card flex min-w-0 flex-col px-5 py-5 sm:px-6">
      <h3 className="text-[13px] font-semibold text-ink-muted">{title}</h3>
      <p className="stat-number mt-3 flex flex-wrap items-baseline gap-x-1.5 text-[2.25rem] sm:text-[2.5rem]">
        {value}
        {unit && <span className="text-base font-semibold tracking-normal text-ink-muted">{unit}</span>}
      </p>
      <p className="mt-2 text-sm font-semibold">{detail}</p>
      {/* Pushes the footer to the bottom, so the dividers line up across the row. */}
      <div aria-hidden="true" className="flex-1" />
      <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-faint">
        {children}
      </p>
    </div>
  );
}

function activityCount(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "activity" : "activities"}`;
}
