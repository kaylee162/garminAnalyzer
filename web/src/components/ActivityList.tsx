import { useState } from "react";
import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { useActivityDetails, useAllActivities } from "../api/activities";
import { formatDate, formatDuration, formatNumber } from "../format";
import { capitalize, formatDistance, formatSpeed, type SportConfig } from "../sports";

type ActivityListProps = {
  config: SportConfig;
  selectedIds: number[];
  onToggle: (id: number) => void;
};

const COLUMN_COUNT = 7;
const COLLAPSED_COUNT = 3;

export function ActivityList({ config, selectedIds, onToggle }: ActivityListProps) {
  const { data, isPending, isError } = useAllActivities(config.sport);
  const [showAll, setShowAll] = useState(false);
  const activities = data ?? [];
  const visibleActivities = showAll ? activities : activities.slice(0, COLLAPSED_COUNT);
  const titleId = `${config.sport}-list-title`;

  return (
    <section aria-labelledby={titleId}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={titleId} className="section-title">
            Recent {config.nounPlural}
          </h2>
          <p className="mt-1 text-ink-muted">Tick two {config.nounPlural} to compare them.</p>
        </div>
        {selectedIds.length > 0 && (
          <span className="rounded-full bg-accent/15 px-3.5 py-2 text-[13px] font-bold text-accent">
            {selectedIds.length} of 2 selected
          </span>
        )}
      </div>
      {isPending && <p className="mt-5 text-sm text-ink-faint">Loading…</p>}
      {isError && <p className="mt-5 text-sm text-bad">Could not load {config.nounPlural}.</p>}
      {data && data.length === 0 && (
        <p className="card mt-5 px-5 py-10 text-center text-sm text-ink-muted">
          No {config.nounPlural} yet. Sync with Garmin to pull them in.
        </p>
      )}
      {activities.length > 0 && (
        <div className="card mt-5 overflow-hidden">
          <table className="w-full text-[15px] tabular-nums">
            <thead className="text-left text-xs font-bold tracking-wider whitespace-nowrap text-ink-faint uppercase">
              <tr>
                <th className="w-10 py-3.5 pr-1 pl-4 sm:pl-6">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="px-3 py-3.5 font-bold">{capitalize(config.noun)}</th>
                <th className="px-3 py-3.5 text-right font-bold">Distance</th>
                <th className="py-3.5 pr-1 pl-3 text-right font-bold sm:px-3">Time</th>
                <th className="hidden px-3 py-3.5 text-right font-bold md:table-cell">{config.speed.label}</th>
                <th className="hidden px-3 py-3.5 text-right font-bold md:table-cell">Avg HR</th>
                <th className="w-14 py-3.5 pr-3 pl-1 sm:pr-5">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleActivities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  config={config}
                  activity={activity}
                  selected={selectedIds.includes(activity.id)}
                  onToggle={() => onToggle(activity.id)}
                />
              ))}
            </tbody>
          </table>
          {activities.length > COLLAPSED_COUNT && (
            <div className="border-t border-line p-2 text-center">
              <button
                type="button"
                onClick={() => setShowAll((all) => !all)}
                aria-expanded={showAll}
                className="btn btn-ghost min-h-11 w-full rounded-xl text-ink"
              >
                {showAll ? "Show fewer" : `Show all ${activities.length} ${config.nounPlural}`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type ActivityRowProps = {
  config: SportConfig;
  activity: ActivitySummary;
  selected: boolean;
  onToggle: () => void;
};

function ActivityRow({ config, activity, selected, onToggle }: ActivityRowProps) {
  const [expanded, setExpanded] = useState(false);
  const name = activity.name ?? capitalize(config.noun);
  const date = formatDate(activity.start_time_local);

  return (
    <>
      <tr
        className={`border-t border-line transition-colors ${selected ? "bg-accent/[0.07]" : "hover:bg-surface-raised/60"}`}
      >
        <td className={`py-3.5 pr-1 pl-4 sm:pl-6 ${selected ? "shadow-[inset_3px_0_0_var(--color-accent)]" : ""}`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Compare ${name} on ${date}`}
            className="h-[18px] w-[18px] cursor-pointer"
          />
        </td>
        <td className="px-3 py-3.5">
          <p className="font-bold">{name}</p>
          <p className="mt-0.5 text-[13px] text-ink-faint">{date}</p>
        </td>
        <td className="px-3 py-3.5 text-right font-bold whitespace-nowrap">{formatDistance(config, activity.distance_mi)}</td>
        <td className="py-3.5 pr-1 pl-3 text-right whitespace-nowrap text-ink-muted sm:px-3">
          {formatDuration(activity.moving_time_s ?? activity.duration_s)}
        </td>
        <td className="hidden px-3 py-3.5 text-right whitespace-nowrap text-ink-muted md:table-cell">
          {formatSpeed(config, activity.avg_pace_s_per_mi)}
        </td>
        <td className="hidden px-3 py-3.5 text-right whitespace-nowrap text-ink-muted md:table-cell">
          {formatNumber(activity.avg_hr, 0)}
        </td>
        <td className="py-1.5 pr-3 pl-1 text-right sm:pr-5">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${name} on ${date}`}
            className={`inline-grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-surface-raised hover:text-ink ${
              expanded ? "bg-surface-raised text-ink" : "text-ink-faint"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-canvas/40">
          <td colSpan={COLUMN_COUNT} className="px-4 pt-2 pb-6 sm:pr-6 sm:pl-16">
            <ActivityDetails id={activity.id} noun={config.noun} />
          </td>
        </tr>
      )}
    </>
  );
}

function ActivityDetails({ id, noun }: { id: number; noun: string }) {
  const { data, isPending, isError } = useActivityDetails(id, true);

  if (isPending) return <p className="text-ink-faint">Loading details…</p>;
  if (isError) return <p className="text-bad">Could not load details for this {noun}.</p>;

  return (
    <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.sections.map((section) => (
        <div key={section.title}>
          <h3 className="eyebrow">{section.title}</h3>
          <dl className="mt-2.5 space-y-1.5 text-sm">
            {section.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{item.label}</dt>
                <dd className="text-right font-semibold">{item.display}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
