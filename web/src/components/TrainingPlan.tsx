import { useEffect, useState, type FormEvent } from "react";
import type {
  PaceZone,
  PlanWeek,
  Race,
  SavedPlanSummary,
  TrainingPlan as Plan,
  Workout,
} from "@garmin-analyzer/api-client";
import { fetchSavedPlan, useBuildPlan, useDeletePlan, useSavePlan, useSavedPlans } from "../api/plan";
import { formatDuration, formatNumber, formatPace } from "../format";

const RACES: { value: Race; label: string }[] = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "20k", label: "20K" },
  { value: "half_marathon", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
];

const PHASE_COLORS: Record<PlanWeek["phase"], string> = {
  base: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  build: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  peak: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
  taper: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
};

// Workouts that aren't easy running get a colored marker so the week's key sessions stand out.
const KIND_COLORS: Record<Workout["kind"], string> = {
  easy: "bg-slate-400",
  strides: "bg-sky-400",
  long: "bg-indigo-400",
  threshold: "bg-amber-400",
  intervals: "bg-rose-400",
  race_pace: "bg-fuchsia-400",
  race: "bg-emerald-400",
};

const KIND_LABELS: Record<Workout["kind"], string> = {
  easy: "Easy",
  strides: "Easy + strides",
  long: "Long run",
  threshold: "Threshold",
  intervals: "Intervals",
  race_pace: "Goal pace",
  race: "Race",
};

// Weeks shown open when a plan first loads; the rest are collapsed.
const OPEN_WEEKS = 2;

// The plan on screen: freshly built (savedId null) or opened from the saved list.
type Draft = { savedId: number | null; name: string; plan: Plan };

export function TrainingPlan() {
  const [race, setRace] = useState<Race>("half_marathon");
  const [raceDate, setRaceDate] = useState(() => toIsoDate(addDays(new Date(), 12 * 7)));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const build = useBuildPlan();
  const saved = useSavedPlans();
  const save = useSavePlan();
  const remove = useDeletePlan();
  // Bumped whenever a different plan is shown, so half-finished edits in the old one don't carry over.
  const [shownVersion, setShownVersion] = useState(0);

  const show = (next: Draft) => {
    setShownVersion((v) => v + 1);
    setDraft(next);
    setDirty(false);
    save.reset();
  };

  const edit = (next: Draft) => {
    setDraft(next);
    setDirty(true);
  };

  const openSaved = async (id: number) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setOpenError(null);
    try {
      const result = await fetchSavedPlan(id);
      show({ savedId: result.id, name: result.name, plan: result.plan });
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "Could not open that plan");
    }
  };

  // The browser asks before closing the tab while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty && !window.confirm("Discard your unsaved changes and build a new plan?")) return;
    build.mutate(
      { race, raceDate },
      {
        onSuccess: (plan) =>
          show({ savedId: null, name: `${plan.race_label} on ${formatPlanDate(plan.race_date)}`, plan }),
      },
    );
  };

  const submitSave = () => {
    if (!draft) return;
    save.mutate(
      { id: draft.savedId, name: draft.name, plan: draft.plan },
      {
        onSuccess: (result) => {
          setDraft({ savedId: result.id, name: result.name, plan: result.plan });
          setDirty(false);
        },
      },
    );
  };

  const deleteSaved = (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    remove.mutate(id, {
      onSuccess: () => {
        // The plan stays on screen as an unsaved copy, so it can still be saved again.
        if (draft?.savedId === id) edit({ ...draft, savedId: null });
      },
    });
  };

  return (
    <section id="plan" className="mt-12 scroll-mt-20 sm:mt-16">
      <h2 className="text-xl font-bold tracking-tight">Training plan</h2>
      <p className="mt-1 max-w-2xl text-sm text-pretty text-ink-muted">
        Estimates your race time from your recent runs and lays out the weeks until race day. Edit any run, then save
        the plan to keep it.
      </p>

      {saved.data && saved.data.length > 0 && (
        <SavedPlans plans={saved.data} activeId={draft?.savedId ?? null} onOpen={openSaved} onDelete={deleteSaved} />
      )}
      {openError && <p className="mt-2 text-sm text-bad">{openError}</p>}

      <form onSubmit={submit} className="card mt-5 grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-end sm:p-5">
        <label className="flex flex-col gap-1.5 text-sm sm:min-w-44">
          <span className="text-xs font-medium text-ink-muted">Training for</span>
          <select value={race} onChange={(e) => setRace(e.target.value as Race)} className="field">
            {RACES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-ink-muted">Race date</span>
          <input
            type="date"
            required
            value={raceDate}
            min={toIsoDate(addDays(new Date(), 1))}
            onChange={(e) => setRaceDate(e.target.value)}
            className="field"
          />
        </label>
        <button type="submit" disabled={build.isPending} className="btn btn-primary py-2.5 sm:ml-auto">
          {build.isPending ? "Building…" : "Build new plan"}
        </button>
      </form>

      {build.isError && <p className="mt-4 text-sm text-bad">{build.error.message}</p>}
      {draft && (
        <>
          <PlanView key={shownVersion} plan={draft.plan} onChange={(plan) => edit({ ...draft, plan })} />
          <SaveBar
            draft={draft}
            dirty={dirty}
            saving={save.isPending}
            error={save.isError ? save.error.message : null}
            onRename={(name) => edit({ ...draft, name })}
            onSave={submitSave}
          />
        </>
      )}
    </section>
  );
}

function SavedPlans({
  plans,
  activeId,
  onOpen,
  onDelete,
}: {
  plans: SavedPlanSummary[];
  activeId: number | null;
  onOpen: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="eyebrow">Saved plans</p>
      <ul className="card mt-2 divide-y divide-line overflow-hidden">
        {plans.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-2 px-4 py-3 text-sm sm:gap-3 ${p.id === activeId ? "bg-accent/10" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-xs text-ink-faint">
                {raceLabel(p.race)} · race day {formatPlanDate(p.race_date)}
              </p>
            </div>
            {p.id === activeId ? (
              <span className="px-3 text-xs font-semibold text-accent">Showing</span>
            ) : (
              <button type="button" onClick={() => onOpen(p.id)} className="btn btn-secondary px-3 py-1.5">
                Open
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(p.id, p.name)}
              className="btn px-3 py-1.5 text-ink-faint hover:bg-bad/10 hover:text-bad"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveBar({
  draft,
  dirty,
  saving,
  error,
  onRename,
  onSave,
}: {
  draft: Draft;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onRename: (name: string) => void;
  onSave: () => void;
}) {
  const isNew = draft.savedId === null;
  const upToDate = !isNew && !dirty;
  const status = isNew ? "Not saved yet" : dirty ? "Unsaved changes" : "Saved";

  return (
    <div className="card sticky bottom-3 z-10 mt-6 bg-canvas/80 p-4 backdrop-blur-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-ink-muted">Plan name</span>
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => onRename(e.target.value)}
            className="field"
          />
        </label>
        <span className={`flex items-center gap-2 py-2.5 text-sm ${upToDate ? "text-good" : "text-warn"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${upToDate ? "bg-good" : "bg-warn"}`} />
          {status}
        </span>
        <button type="submit" disabled={saving || upToDate} className="btn btn-primary py-2.5">
          {saving ? "Saving…" : isNew ? "Save plan" : "Save changes"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}

function PlanView({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  const updateWeek = (index: number, week: PlanWeek) =>
    onChange({ ...plan, weeks: plan.weeks.map((w, i) => (i === index ? week : w)) });

  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
        <Prediction plan={plan} />
        <RecentStats plan={plan} />
      </div>
      {plan.notes.length > 0 && (
        <ul className="space-y-1 rounded-2xl border border-warn/25 bg-warn/10 px-4 py-3 text-sm text-amber-200">
          {plan.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <Paces paces={plan.paces} />
      <Weeks weeks={plan.weeks} paces={plan.paces} onChange={updateWeek} />
    </div>
  );
}

function Prediction({ plan }: { plan: Plan }) {
  const saved = plan.predicted_time_s - plan.projected_time_s;
  return (
    <div className="card flex flex-col justify-center bg-gradient-to-br from-good/15 to-transparent p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="eyebrow">If you raced today</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {formatDuration(plan.predicted_time_s)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-ink-muted">{formatPace(plan.predicted_pace_s_per_mi)}</p>
        </div>
        <div>
          <p className="eyebrow text-good">After the plan</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums text-good sm:text-3xl">
            {formatDuration(plan.projected_time_s)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-ink-muted">{formatPace(plan.projected_pace_s_per_mi)}</p>
        </div>
      </div>
      {saved >= 1 && (
        <p className="mt-4 w-fit rounded-full bg-good/15 px-3 py-1 text-xs font-semibold tabular-nums text-good">
          About {formatDuration(saved)} faster on race day
        </p>
      )}
    </div>
  );
}

function RecentStats({ plan }: { plan: Plan }) {
  const r = plan.recent;
  const stats: [string, string][] = [
    ["Weekly distance", formatNumber(r.weekly_mi, 1, " mi")],
    ["Runs per week", formatNumber(r.runs_per_week, 1)],
    ["Longest run", formatNumber(r.longest_run_mi, 1, " mi")],
    ["Avg pace", formatPace(r.avg_pace_s_per_mi)],
    ["Avg heart rate", formatNumber(r.avg_hr, 0, " bpm")],
    ["Avg cadence", formatNumber(r.avg_cadence, 0, " spm")],
    ["Avg stride", formatNumber(r.avg_stride_m, 2, " m")],
    ["Runs analyzed", String(r.run_count)],
  ];
  return (
    <div className="card p-5">
      <p className="eyebrow">
        Your last {r.days_covered} days{r.stale ? " (older runs)" : ""}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm tabular-nums sm:grid-cols-4">
        {stats.map(([name, value]) => (
          <div key={name}>
            <dt className="text-xs text-ink-faint">{name}</dt>
            <dd className="mt-0.5 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Paces({ paces }: { paces: PaceZone[] }) {
  return (
    <div>
      <h3 className="eyebrow">Training paces</h3>
      {/* Stacks on phones; label, pace and purpose line up in columns from sm up. */}
      <ul className="card mt-3 divide-y divide-line overflow-hidden text-sm tabular-nums">
        {paces.map((zone) => (
          <li
            key={zone.key}
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[10rem_11rem_1fr]"
          >
            <span className="font-semibold">{zone.label}</span>
            <span className="text-right font-medium whitespace-nowrap text-metric-pace sm:text-left">
              {formatPaceRange(zone.fast_s_per_mi, zone.slow_s_per_mi)}
            </span>
            <span className="col-span-2 text-ink-muted sm:col-span-1">{zone.purpose}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Weeks({
  weeks,
  paces,
  onChange,
}: {
  weeks: PlanWeek[];
  paces: PaceZone[];
  onChange: (index: number, week: PlanWeek) => void;
}) {
  return (
    <div>
      <h3 className="eyebrow">Week by week</h3>
      <div className="mt-3 space-y-2">
        {weeks.map((week, i) => (
          <WeekCard
            key={week.number}
            week={week}
            paces={paces}
            defaultOpen={i < OPEN_WEEKS}
            onChange={(next) => onChange(i, next)}
          />
        ))}
      </div>
    </div>
  );
}

function WeekCard({
  week,
  paces,
  defaultOpen,
  onChange,
}: {
  week: PlanWeek;
  paces: PaceZone[];
  defaultOpen: boolean;
  onChange: (week: PlanWeek) => void;
}) {
  // Index of the workout being edited. Rows are keyed by position, since two runs can share a day.
  const [editing, setEditing] = useState<number | null>(null);
  const days = Array.from({ length: 7 }, (_, d) => toIsoDate(addDays(parseIsoDate(week.start_date), d)));
  const lastDay = toIsoDate(addDays(parseIsoDate(week.start_date), 6));
  const today = toIsoDate(new Date());
  const isOver = lastDay < today;

  const setWorkouts = (workouts: Workout[]) =>
    onChange({ ...week, workouts, total_mi: round1(workouts.reduce((sum, w) => sum + w.distance_mi, 0)) });

  const finishEditing = () => {
    setWorkouts(byDate(week.workouts));
    setEditing(null);
  };

  const addRun = () => {
    const taken = new Set(week.workouts.map((w) => w.date));
    const upcoming = days.filter((d) => d >= today);
    const date = upcoming.find((d) => !taken.has(d)) ?? upcoming[0] ?? week.start_date;
    const easy = paces.find((p) => p.key === "easy");
    if (!easy) return;
    const workout: Workout = {
      date,
      kind: "easy",
      title: "Easy run",
      description: "Relaxed and conversational. Slower is fine.",
      distance_mi: 3,
      pace_zone: easy.key,
      fast_s_per_mi: easy.fast_s_per_mi,
      slow_s_per_mi: easy.slow_s_per_mi,
    };
    const workouts = byDate([...week.workouts, workout]);
    setWorkouts(workouts);
    setEditing(workouts.indexOf(workout));
  };

  return (
    <details open={defaultOpen} className={`group card overflow-hidden ${isOver ? "opacity-60" : ""}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
        <span className="text-ink-faint transition-transform group-open:rotate-90">›</span>
        <span className="font-bold">Week {week.number}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${PHASE_COLORS[week.phase]}`}
        >
          {week.phase}
        </span>
        <span className="ml-auto font-semibold tabular-nums">
          {week.total_mi.toFixed(1)} <span className="font-normal text-ink-faint">mi</span>
        </span>
      </summary>
      {week.workouts.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-faint">
          {isOver ? "This week is already over." : "No runs this week."}
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {week.workouts.map((w, i) =>
            editing === i ? (
              <WorkoutEditor
                key={i}
                workout={w}
                paces={paces}
                minDate={week.start_date}
                maxDate={lastDay}
                onChange={(next) => setWorkouts(week.workouts.map((x, j) => (j === i ? next : x)))}
                onDone={finishEditing}
                onDelete={() => {
                  setWorkouts(week.workouts.filter((_, j) => j !== i));
                  setEditing(null);
                }}
              />
            ) : (
              <WorkoutRow key={i} workout={w} onEdit={() => setEditing(i)} />
            ),
          )}
        </ul>
      )}
      {!isOver && (
        <div className="border-t border-line px-2 py-1.5">
          <button type="button" onClick={addRun} className="btn btn-ghost px-3 py-1.5 text-accent hover:text-accent">
            + Add run
          </button>
        </div>
      )}
    </details>
  );
}

function WorkoutRow({ workout, onEdit }: { workout: Workout; onEdit: () => void }) {
  return (
    // On phones the date sits above the workout; from sm up it gets its own column.
    <li className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[6.5rem_1fr_auto_auto]">
      <span className="col-span-3 text-xs font-medium text-ink-faint sm:col-span-1 sm:pt-0.5 sm:text-sm">
        {formatPlanDate(workout.date)}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_COLORS[workout.kind]}`} />
          {workout.title}
        </p>
        <p className="mt-0.5 text-ink-muted">{workout.description}</p>
      </div>
      <div className="text-right tabular-nums">
        <p className="font-semibold">{workout.distance_mi.toFixed(1)} mi</p>
        <p className="text-xs whitespace-nowrap text-ink-faint">
          {formatPaceRange(workout.fast_s_per_mi, workout.slow_s_per_mi)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${workout.title} on ${formatPlanDate(workout.date)}`}
        className="btn btn-ghost self-start px-2.5 py-1 text-xs"
      >
        Edit
      </button>
    </li>
  );
}

function WorkoutEditor({
  workout,
  paces,
  minDate,
  maxDate,
  onChange,
  onDone,
  onDelete,
}: {
  workout: Workout;
  paces: PaceZone[];
  minDate: string;
  maxDate: string;
  onChange: (workout: Workout) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  const set = (fields: Partial<Workout>) => onChange({ ...workout, ...fields });
  const setZone = (key: string) => {
    const zone = paces.find((p) => p.key === key);
    if (zone) set({ pace_zone: zone.key, fast_s_per_mi: zone.fast_s_per_mi, slow_s_per_mi: zone.slow_s_per_mi });
  };
  const input = "field px-2.5 py-1.5";

  return (
    <li className="bg-accent/5 px-4 py-4 text-sm shadow-[inset_3px_0_0_var(--color-accent)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onDone();
        }}
        className="grid gap-3 sm:grid-cols-[10rem_1fr_8rem]"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Date</span>
          <input
            type="date"
            required
            value={workout.date}
            min={minDate}
            max={maxDate}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Title</span>
          <input required value={workout.title} onChange={(e) => set({ title: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Distance (mi)</span>
          <input
            type="number"
            required
            min={0}
            step={0.1}
            value={workout.distance_mi}
            onChange={(e) => set({ distance_mi: Math.max(Number(e.target.value) || 0, 0) })}
            className={`${input} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">Type</span>
          <select
            value={workout.kind}
            onChange={(e) => set({ kind: e.target.value as Workout["kind"] })}
            className={input}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-ink-muted">Pace</span>
          <select value={workout.pace_zone} onChange={(e) => setZone(e.target.value)} className={input}>
            {/* Race day uses its own projected pace, which isn't one of the plan's zones. */}
            {!paces.some((p) => p.key === workout.pace_zone) && (
              <option value={workout.pace_zone}>
                Current ({formatPaceRange(workout.fast_s_per_mi, workout.slow_s_per_mi)})
              </option>
            )}
            {paces.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} ({formatPaceRange(p.fast_s_per_mi, p.slow_s_per_mi)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className="text-xs font-medium text-ink-muted">Description</span>
          <textarea
            rows={2}
            value={workout.description}
            onChange={(e) => set({ description: e.target.value })}
            className={input}
          />
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" className="btn btn-primary py-1.5">
            Done
          </button>
          <button type="button" onClick={onDelete} className="btn py-1.5 text-bad hover:bg-bad/10">
            Remove run
          </button>
        </div>
      </form>
    </li>
  );
}

function formatPaceRange(fast: number, slow: number): string {
  return `${formatDuration(fast)}–${formatPace(slow)}`;
}

/** Plan dates are calendar days ("2026-10-07"). Parse them as local dates so they don't shift a day. */
function formatPlanDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function raceLabel(race: Race): string {
  return RACES.find((r) => r.value === race)?.label ?? race;
}

function byDate(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
