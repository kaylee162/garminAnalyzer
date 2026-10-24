import type { Dashboard } from "@garmin-analyzer/api-client";
import { formatCount, formatTotalTime } from "../format";
import { StatCard } from "./OverallStats";

/** All-time totals across every sport. `dashboard` is undefined while loading. */
export function AllTimeStats({ dashboard }: { dashboard: Dashboard | undefined }) {
  const totals = dashboard?.totals;
  const since = dashboard?.first_activity_at;

  return (
    <section aria-labelledby="all-time-title">
      <h2 id="all-time-title" className="eyebrow">
        All time{since && ` · since ${new Date(since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}
      </h2>
      {/* One strip split by 1px gaps, so the dividers come from the grid's background. */}
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
        <StatCard title="Activities" value={totals && formatCount(totals.count)} />
        <StatCard title="Time" value={totals && formatTotalTime(totals.time_s)} swatch="bg-metric-time" />
        <StatCard
          title="Distance"
          value={totals && formatCount(totals.distance_mi, 1)}
          unit="mi"
          swatch="bg-metric-distance"
        />
        <StatCard
          title="Elevation gain"
          value={totals && formatCount(totals.elevation_gain_ft)}
          unit="ft"
          swatch="bg-metric-elevation"
        />
        <StatCard title="Calories" value={totals && formatCount(totals.calories)} unit="kcal" />
        <StatCard title="Active days" value={dashboard && formatCount(dashboard.active_days)} />
      </div>
    </section>
  );
}
