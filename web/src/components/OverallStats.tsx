import { useActivityStats } from "../api/activities";
import { formatNumber } from "../format";
import { capitalize, type SportConfig } from "../sports";

export function OverallStats({ config }: { config: SportConfig }) {
  const { data, isError } = useActivityStats(config.sport);
  const { speed, distance } = config;

  if (isError) return <p className="text-sm text-bad">Could not load {config.noun} averages.</p>;

  return (
    // One strip split by 1px gaps, so the dividers come from the grid's background.
    <section
      aria-label={`Averages across all ${config.nounPlural}`}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4"
    >
      <StatCard title={`${capitalize(config.nounPlural)} logged`} value={data && String(data.count)} />
      <StatCard
        title={`Avg ${speed.label.toLowerCase()}`}
        value={data && (data.avg_pace_s_per_mi == null ? "–" : speed.format(speed.fromPace(data.avg_pace_s_per_mi)))}
        unit={speed.unit}
        swatch="bg-metric-pace"
      />
      <StatCard
        title="Avg distance"
        value={data && (data.avg_distance_mi == null ? "–" : formatNumber(distance.fromMiles(data.avg_distance_mi), distance.digits))}
        unit={distance.unit}
        swatch="bg-metric-distance"
      />
      <StatCard title="Avg heart rate" value={data && formatNumber(data.avg_hr, 0)} unit="bpm" swatch="bg-metric-hr" />
    </section>
  );
}

export type StatCardProps = {
  title: string;
  // Undefined while loading.
  value: string | undefined;
  unit?: string;
  swatch?: string;
};

export function StatCard({ title, value, unit, swatch }: StatCardProps) {
  const missing = value === undefined || value === "–";
  return (
    <div className="min-w-0 bg-surface px-4 py-5 sm:px-6 sm:py-6">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted sm:text-[13px]">
        {swatch && <span aria-hidden="true" className={`h-[3px] w-2.5 shrink-0 rounded-full ${swatch}`} />}
        {title}
      </p>
      {/* Long units (e.g. "/100yd") drop under the number on narrow cards instead of spilling out. */}
      <p className="stat-number mt-3 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-[1.75rem] sm:text-[2.5rem]">
        {value === undefined ? <span className="text-ink-faint">…</span> : value}
        {unit && !missing && (
          <span className="text-sm font-semibold tracking-normal text-ink-muted sm:text-base">{unit}</span>
        )}
      </p>
    </div>
  );
}
