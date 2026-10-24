import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { formatDate, formatDuration } from "../format";
import { formatDistance, isSport, OTHER_SPORT, SPORTS } from "../sports";

/** The newest few activities of any sport. Each links to its sport's page. */
export function RecentActivities({ activities }: { activities: ActivitySummary[] }) {
  return (
    <section aria-labelledby="recent-title">
      <h2 id="recent-title" className="section-title">
        Latest activities
      </h2>
      <p className="mt-1 text-ink-muted">Your last {activities.length}, across every sport.</p>
      <ul className="card mt-5 overflow-hidden">
        {activities.map((activity) => (
          <li key={activity.id} className="border-t border-line first:border-t-0">
            <RecentRow activity={activity} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentRow({ activity }: { activity: ActivitySummary }) {
  const config = isSport(activity.sport) ? SPORTS[activity.sport] : undefined;
  const look = config ?? OTHER_SPORT;
  const time = formatDuration(activity.moving_time_s ?? activity.duration_s);
  const content = (
    <>
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: look.color }} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold [overflow-wrap:anywhere]">{activity.name ?? look.title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-faint">
          {look.title} · {formatDate(activity.start_time_local)}
        </span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        {config && activity.distance_mi != null && (
          <span className="block font-bold">{formatDistance(config, activity.distance_mi)}</span>
        )}
        <span className="mt-0.5 block text-[13px] text-ink-muted">{time}</span>
      </span>
    </>
  );
  const rowClass = "flex min-h-16 items-center gap-3 px-4 py-3 text-[15px] sm:gap-4 sm:px-6";

  // "Other" activities have no page to open, so their row is plain text.
  if (!config) return <div className={rowClass}>{content}</div>;
  return (
    <a href={config.href} className={`${rowClass} transition-colors hover:bg-surface-raised/60`}>
      {content}
    </a>
  );
}
