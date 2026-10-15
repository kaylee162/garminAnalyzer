import { useRunStats } from "../api/activities";
import { formatNumber, formatPace } from "../format";

export function OverallStats() {
  const { data, isError } = useRunStats();

  if (isError) return <p className="mt-6 text-sm text-bad">Could not load run averages.</p>;

  return (
    <section aria-label="Averages across all runs" className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
      <StatCard title="Avg pace" value={data && formatPace(data.avg_pace_s_per_mi)} dot="bg-metric-pace" />
      <StatCard
        title="Avg distance"
        value={data && formatNumber(data.avg_distance_mi, 2, " mi")}
        dot="bg-metric-distance"
      />
      <StatCard title="Avg heart rate" value={data && formatNumber(data.avg_hr, 0, " bpm")} dot="bg-metric-hr" />
    </section>
  );
}

type StatCardProps = {
  title: string;
  // Undefined while loading.
  value: string | undefined;
  dot: string;
};

function StatCard({ title, value, dot }: StatCardProps) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {title}
      </p>
      <p className="mt-2 text-lg font-extrabold tracking-tight tabular-nums sm:text-2xl">
        {value ?? <span className="text-ink-faint">…</span>}
      </p>
    </div>
  );
}
