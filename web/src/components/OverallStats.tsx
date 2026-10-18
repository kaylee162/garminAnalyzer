import { useRunStats } from "../api/activities";
import { formatDuration, formatNumber } from "../format";

export function OverallStats() {
  const { data, isError } = useRunStats();

  if (isError) return <p className="text-sm text-bad">Could not load run averages.</p>;

  return (
    // One strip split by 1px gaps, so the dividers come from the grid's background.
    <section
      aria-label="Averages across all runs"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4"
    >
      <StatCard title="Runs logged" value={data && String(data.count)} />
      <StatCard
        title="Avg pace"
        value={data && formatDuration(data.avg_pace_s_per_mi)}
        unit="/mi"
        swatch="bg-metric-pace"
      />
      <StatCard
        title="Avg distance"
        value={data && formatNumber(data.avg_distance_mi, 2)}
        unit="mi"
        swatch="bg-metric-distance"
      />
      <StatCard title="Avg heart rate" value={data && formatNumber(data.avg_hr, 0)} unit="bpm" swatch="bg-metric-hr" />
    </section>
  );
}

type StatCardProps = {
  title: string;
  // Undefined while loading.
  value: string | undefined;
  unit?: string;
  swatch?: string;
};

function StatCard({ title, value, unit, swatch }: StatCardProps) {
  const missing = value === undefined || value === "–";
  return (
    <div className="bg-surface px-4 py-5 sm:px-6 sm:py-6">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted sm:text-[13px]">
        {swatch && <span aria-hidden="true" className={`h-[3px] w-2.5 shrink-0 rounded-full ${swatch}`} />}
        {title}
      </p>
      <p className="stat-number mt-3 text-[1.75rem] sm:text-[2.5rem]">
        {value === undefined ? <span className="text-ink-faint">…</span> : value}
        {unit && !missing && (
          <span className="ml-1 text-sm font-semibold tracking-normal text-ink-muted sm:text-base">{unit}</span>
        )}
      </p>
    </div>
  );
}
