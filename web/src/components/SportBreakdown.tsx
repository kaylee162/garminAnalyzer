import type { Dashboard, SportTotals } from "@garmin-analyzer/api-client";
import { formatCount, formatDate, formatTotalTime } from "../format";
import { capitalize, isSport, SPORTS, sportLook, type SportConfig } from "../sports";

/** How all-time training time splits between sports, then one card per sport page. */
export function SportBreakdown({ dashboard }: { dashboard: Dashboard }) {
  const totalTime = dashboard.totals.time_s;
  // Every group with time logged, "other" included, in the API's fixed order so hues never move.
  const shares = dashboard.sports.filter((s) => s.time_s > 0);

  return (
    <section aria-labelledby="sports-title">
      <h2 id="sports-title" className="section-title">
        By sport
      </h2>
      <p className="mt-1 text-ink-muted">Share of all your time spent training.</p>

      {totalTime > 0 && (
        <div className="card mt-5 px-5 py-5 sm:px-6">
          {/* A 2px gap between segments keeps neighbors apart without leaning on color alone. */}
          <div aria-hidden="true" className="flex h-3 gap-[2px] overflow-hidden rounded-full">
            {shares.map((s) => (
              <div
                key={s.sport}
                className="h-full min-w-1"
                style={{ flexGrow: s.time_s, flexBasis: 0, backgroundColor: sportLook(s.sport).color }}
              />
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {shares.map((s) => (
              <li key={s.sport} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sportLook(s.sport).color }}
                />
                <span className="font-semibold">{sportLook(s.sport).title}</span>
                <span className="text-ink-muted tabular-nums">
                  {Math.round((s.time_s / totalTime) * 100)}% · {formatTotalTime(s.time_s)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.sports.map(
          (totals) =>
            isSport(totals.sport) && (
              <li key={totals.sport} className="min-w-0">
                <SportCard config={SPORTS[totals.sport]} totals={totals} />
              </li>
            ),
        )}
      </ul>
    </section>
  );
}

function SportCard({ config, totals }: { config: SportConfig; totals: SportTotals }) {
  const empty = totals.count === 0;

  return (
    <a
      href={config.href}
      className="card group flex h-full flex-col px-5 py-5 transition-colors hover:border-line-strong hover:bg-surface-raised/60 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
          {config.title}
        </h3>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-4 w-4 text-ink-faint transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-ink"
        >
          <path d="M8 5l5 5-5 5" />
        </svg>
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-ink-faint">No {config.nounPlural} yet.</p>
      ) : (
        <>
          <p className="stat-number mt-4 text-[2rem]">{formatTotalTime(totals.time_s)}</p>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <Row label={capitalize(config.nounPlural)} value={formatCount(totals.count)} />
            <Row label="Distance" value={totalDistance(config, totals.distance_mi)} />
            <Row label={`Longest ${config.noun}`} value={totalDistance(config, totals.longest_distance_mi)} />
            <Row label="Last" value={totals.last_activity_at ? formatDate(totals.last_activity_at) : "–"} />
          </dl>
        </>
      )}
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="min-w-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

/** Miles to one decimal, or whole yards for swims, with thousands separators. */
function totalDistance(config: SportConfig, miles: number | null): string {
  if (miles == null) return "–";
  const { fromMiles, unit } = config.distance;
  return `${formatCount(fromMiles(miles), unit === "mi" ? 1 : 0)} ${unit}`;
}
