"""Race-time estimate and training plan, built from recent runs with written-down formulas.

1. Fitness: every recent run (and every "fastest split" Garmin found inside it, e.g. the
   fastest 5K) is scored with Jack Daniels' VDOT formula. The best score is the estimate,
   since easy runs understate fitness and only hard efforts show the ceiling.
2. Prediction: solve the VDOT formula backwards for the race distance, once for today's
   fitness and once for the fitness the plan should build by race day (see projected_vdot).
3. Paces: Daniels' training intensities (easy, marathon, threshold, interval, repetition)
   as fractions of VDOT, turned back into seconds per mile.
4. Plan: weeks are counted back from race day and split into base, build, peak and taper.
   Weekly mileage starts at what you run now and grows by at most 10% a week, with an
   easier week every fourth week, up to a peak that suits the race distance.

Everything here is data in, numbers out, so it can be tested without a database.
"""

import math
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import mean
from typing import Literal

from pydantic import BaseModel

from app.models import Activity
from app.units import METERS_PER_MILE

Race = Literal["5k", "10k", "20k", "half_marathon", "marathon"]
Phase = Literal["base", "build", "peak", "taper"]
WorkoutKind = Literal["easy", "strides", "long", "threshold", "intervals", "race_pace", "race"]


@dataclass(frozen=True)
class RaceSpec:
    label: str
    distance_m: float
    # Weekly mileage the plan builds toward if you aren't already running more.
    peak_weekly_mi: float
    longest_run_mi: float
    taper_weeks: int
    # Quality work per peak week: interval reps and their length in meters.
    interval_rep_m: int


RACES: dict[Race, RaceSpec] = {
    "5k": RaceSpec("5K", 5000, 25, 8, 1, 800),
    "10k": RaceSpec("10K", 10000, 30, 10, 1, 1000),
    "20k": RaceSpec("20K", 20000, 34, 12, 2, 1000),
    "half_marathon": RaceSpec("Half marathon", 21097.5, 35, 13, 2, 1200),
    "marathon": RaceSpec("Marathon", 42195, 45, 20, 3, 1600),
}

# Runs from the last six weeks count as "recent". Fitness older than that is stale.
RECENT_DAYS = 42
# Without recent runs, fall back to this many of the newest runs (and say so).
FALLBACK_RUNS = 10
# The VDOT formula is fit to races of roughly 3.5 minutes and longer.
MIN_EFFORT_S = 210
MIN_EFFORT_M = 1500

# Garmin's best efforts inside a run, keyed by raw JSON field, with their distance in meters.
FASTEST_SPLITS = {
    "fastestSplit_1609": 1609.344,
    "fastestSplit_5000": 5000.0,
    "fastestSplit_10000": 10000.0,
    "fastestSplit_21098": 21097.5,
    "fastestSplit_42195": 42195.0,
}

MAX_WEEKLY_GROWTH = 1.10
CUTBACK_EVERY = 4
CUTBACK_FACTOR = 0.8
MIN_WEEKLY_MI = 8.0
MIN_RUN_MI = 2.0
RACE_WEEK_EASY_MI = 4.0
MAX_PLAN_WEEKS = 30
# How much VDOT a full block of training can add, as a share of current VDOT. Less-fit
# runners improve faster: 10% at VDOT 35 or below, tapering to 3% at VDOT 60 and above.
GAIN_CEILING_LOW_FITNESS = (35.0, 0.10)
GAIN_CEILING_HIGH_FITNESS = (60.0, 0.03)
# Weeks for the gain to reach ~63% of its ceiling; later weeks add less and less.
GAIN_WEEKS_TIME_CONSTANT = 12
# Below this cadence (steps per minute), a gradual cadence increase usually helps.
LOW_CADENCE_SPM = 165
# Volume in the last weeks before the race, as a share of peak, ordered toward race day.
TAPER_FACTORS = {1: [0.6], 2: [0.75, 0.55], 3: [0.8, 0.65, 0.5]}

# Which day of the week (0..6, 6 = same weekday as the race) gets which kind of run,
# by runs per week. "Q" is the main workout, "Q2" a second one in peak weeks, "L" the long run.
DAY_SLOTS: dict[int, dict[int, str]] = {
    3: {1: "Q", 3: "E", 6: "L"},
    4: {1: "Q", 3: "E", 4: "Q2", 6: "L"},
    5: {0: "E", 1: "Q", 3: "E", 4: "Q2", 6: "L"},
    6: {0: "E", 1: "Q", 2: "E", 3: "E", 4: "Q2", 6: "L"},
}


# --- Daniels / Gilbert VDOT formulas -----------------------------------------------------


def _vo2_at(velocity_m_per_min: float) -> float:
    """Oxygen cost (ml/kg/min) of running at a velocity."""
    v = velocity_m_per_min
    return -4.60 + 0.182258 * v + 0.000104 * v * v


def _fraction_sustainable(minutes: float) -> float:
    """Share of VO2max that can be held for a race lasting `minutes`."""
    return (
        0.8 + 0.1894393 * math.exp(-0.012778 * minutes) + 0.2989558 * math.exp(-0.1932605 * minutes)
    )


def vdot(distance_m: float, time_s: float) -> float:
    minutes = time_s / 60
    return _vo2_at(distance_m / minutes) / _fraction_sustainable(minutes)


def _velocity_for_vo2(vo2: float) -> float:
    """Inverse of _vo2_at: meters per minute that cost `vo2`."""
    a, b, c = 0.000104, 0.182258, -4.60 - vo2
    return (-b + math.sqrt(b * b - 4 * a * c)) / (2 * a)


def predict_time_s(score: float, distance_m: float) -> float:
    """Race time at which `distance_m` scores exactly `score`, found by bisection."""
    low, high = 60.0, 60.0 * 60 * 10
    for _ in range(100):
        mid = (low + high) / 2
        # A faster time means a higher score, so a score that's too high means go slower.
        if vdot(distance_m, mid) > score:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def pace_at_fraction(score: float, fraction: float) -> float:
    """Seconds per mile when running at `fraction` of VDOT."""
    return METERS_PER_MILE / _velocity_for_vo2(score * fraction) * 60


# --- fitness from recent runs ------------------------------------------------------------


class Effort(BaseModel):
    """The run (or the stretch of a run) the fitness estimate came from."""

    activity_id: int
    activity_name: str | None
    date: date
    label: str
    distance_mi: float
    time_s: float
    vdot: float


class RecentTraining(BaseModel):
    """What your recent running looks like, averaged over the runs used."""

    run_count: int
    days_covered: int
    weekly_mi: float
    runs_per_week: float
    longest_run_mi: float
    avg_pace_s_per_mi: float | None
    avg_hr: float | None
    avg_cadence: float | None
    avg_stride_m: float | None
    # True when there were no runs in the last six weeks and older runs were used instead.
    stale: bool


def recent_runs(runs: list[Activity], today: date) -> tuple[list[Activity], bool]:
    """Runs from the last RECENT_DAYS days, or the newest few if there are none (stale=True)."""
    cutoff = today - timedelta(days=RECENT_DAYS)
    recent = [r for r in runs if r.start_time_local.date() > cutoff and r.distance_m]
    if recent:
        return recent, False
    newest = sorted(
        (r for r in runs if r.distance_m), key=lambda r: r.start_time_local, reverse=True
    )
    return newest[:FALLBACK_RUNS], True


def best_effort(runs: list[Activity]) -> Effort | None:
    efforts = [effort for run in runs for effort in _efforts(run)]
    return max(efforts, key=lambda e: e.vdot, default=None)


def _efforts(run: Activity) -> list[Effort]:
    time_s = run.moving_time_s or run.duration_s
    candidates: list[tuple[str, float, float]] = []
    if run.distance_m and time_s:
        candidates.append(("Whole run", run.distance_m, time_s))
    raw = run.raw_json or {}
    for key, split_m in FASTEST_SPLITS.items():
        split_s = raw.get(key)
        if isinstance(split_s, int | float) and split_s > 0:
            candidates.append((f"Fastest {_distance_label(split_m)}", split_m, float(split_s)))

    return [
        Effort(
            activity_id=run.id,
            activity_name=run.name,
            date=run.start_time_local.date(),
            label=label,
            distance_mi=meters / METERS_PER_MILE,
            time_s=seconds,
            vdot=vdot(meters, seconds),
        )
        for label, meters, seconds in candidates
        if meters >= MIN_EFFORT_M and seconds >= MIN_EFFORT_S
    ]


def _distance_label(meters: float) -> str:
    return "mile" if meters < 2000 else f"{meters / 1000:g}K"


def summarize_training(runs: list[Activity], today: date, stale: bool) -> RecentTraining:
    first = min(r.start_time_local.date() for r in runs)
    # At least one week, so a single recent run doesn't read as a huge weekly total.
    days = max((today - first).days + 1, 7) if not stale else RECENT_DAYS
    weeks = days / 7
    miles = [r.distance_m / METERS_PER_MILE for r in runs if r.distance_m]
    total_time = sum((r.moving_time_s or r.duration_s or 0) for r in runs)

    def avg(values: list[float | None]) -> float | None:
        present = [v for v in values if v]
        return mean(present) if present else None

    return RecentTraining(
        run_count=len(runs),
        days_covered=days,
        weekly_mi=sum(miles) / weeks,
        runs_per_week=len(runs) / weeks,
        longest_run_mi=max(miles, default=0.0),
        avg_pace_s_per_mi=total_time / sum(miles) if total_time and miles else None,
        avg_hr=avg([r.avg_hr for r in runs]),
        avg_cadence=avg([r.avg_cadence for r in runs]),
        avg_stride_m=avg([r.avg_stride_m for r in runs]),
        stale=stale,
    )


# --- training paces ----------------------------------------------------------------------


class PaceZone(BaseModel):
    key: str
    label: str
    purpose: str
    # A range in seconds per mile; fast is the smaller number.
    fast_s_per_mi: float
    slow_s_per_mi: float


# Daniels' intensities as fractions of VDOT (fast end, slow end).
_ZONE_FRACTIONS = {
    "easy": ("Easy", "Aerobic base and recovery. Conversational.", 0.74, 0.62),
    "threshold": ("Threshold", "Comfortably hard; raises the pace you can hold.", 0.88, 0.85),
    "interval": ("Interval", "Hard 3–5 minute reps; builds VO2max.", 1.0, 0.97),
}
# Daniels keeps interval reps to about 5 minutes; slower runners get shorter reps.
MAX_INTERVAL_REP_S = 300
INTERVAL_REP_OPTIONS_M = (1600, 1200, 1000, 800, 600, 400)
# Daniels' repetition pace: about 6 seconds per 400 m faster than interval pace.
REP_FASTER_S_PER_MI = 24


def training_paces(score: float, race_pace_s_per_mi: float) -> list[PaceZone]:
    zones = {
        key: PaceZone(
            key=key,
            label=label,
            purpose=purpose,
            fast_s_per_mi=pace_at_fraction(score, fast),
            slow_s_per_mi=pace_at_fraction(score, slow),
        )
        for key, (label, purpose, fast, slow) in _ZONE_FRACTIONS.items()
    }
    marathon = predict_time_s(score, 42195) / (42195 / METERS_PER_MILE)
    interval = zones["interval"]
    return [
        zones["easy"],
        PaceZone(
            key="marathon",
            label="Marathon",
            purpose="Steady, long efforts at predicted marathon pace.",
            fast_s_per_mi=marathon - 5,
            slow_s_per_mi=marathon + 5,
        ),
        zones["threshold"],
        interval,
        PaceZone(
            key="repetition",
            label="Repetition",
            purpose="Short fast reps with full recovery; speed and form.",
            fast_s_per_mi=interval.fast_s_per_mi - REP_FASTER_S_PER_MI,
            slow_s_per_mi=interval.slow_s_per_mi - REP_FASTER_S_PER_MI,
        ),
        PaceZone(
            key="race",
            label="Goal race",
            purpose="The pace the prediction says you can hold on race day.",
            fast_s_per_mi=race_pace_s_per_mi - 3,
            slow_s_per_mi=race_pace_s_per_mi + 3,
        ),
    ]


# --- the plan ----------------------------------------------------------------------------


class Workout(BaseModel):
    date: date
    kind: WorkoutKind
    title: str
    description: str
    distance_mi: float
    pace_zone: str
    fast_s_per_mi: float
    slow_s_per_mi: float


class PlanWeek(BaseModel):
    number: int
    phase: Phase
    start_date: date
    total_mi: float
    workouts: list[Workout]


class TrainingPlan(BaseModel):
    race: Race
    race_label: str
    race_date: date
    race_distance_mi: float
    weeks_until_race: int
    fitness: Effort
    # What you could run today.
    predicted_time_s: float
    predicted_pace_s_per_mi: float
    # What the plan should get you to by race day, if you follow it.
    projected_vdot: float
    projected_time_s: float
    projected_pace_s_per_mi: float
    recent: RecentTraining
    paces: list[PaceZone]
    weeks: list[PlanWeek]
    notes: list[str]


class NoRunsError(ValueError):
    pass


def build_plan(runs: list[Activity], race: Race, race_date: date, today: date) -> TrainingPlan:
    if race_date <= today:
        raise ValueError("Pick a race date after today")
    used, stale = recent_runs(runs, today)
    effort = best_effort(used)
    if effort is None:
        raise NoRunsError(
            "No runs of at least a mile and 3.5 minutes to estimate fitness from. Sync first."
        )

    spec = RACES[race]
    predicted = predict_time_s(effort.vdot, spec.distance_m)
    race_mi = spec.distance_m / METERS_PER_MILE
    race_pace = predicted / race_mi
    paces = {z.key: z for z in training_paces(effort.vdot, race_pace)}
    recent = summarize_training(used, today, stale)

    week_count = min(math.ceil((race_date - today).days / 7), MAX_PLAN_WEEKS)
    phases = _phases(week_count, spec.taper_weeks)
    volumes = _weekly_volumes(phases, recent.weekly_mi, spec)
    runs_per_week = min(max(round(recent.runs_per_week) + (1 if race == "marathon" else 0), 3), 6)
    training_weeks = sum(1 for phase in phases if phase != "taper")
    projected = projected_vdot(effort.vdot, training_weeks, max(volumes), spec.peak_weekly_mi)
    projected_time = predict_time_s(projected, spec.distance_m)
    race_day_zone = PaceZone(
        key="race",
        label="Race day",
        purpose="Projected race-day pace after the plan.",
        fast_s_per_mi=projected_time / race_mi - 3,
        slow_s_per_mi=projected_time / race_mi + 3,
    )
    # Weeks end on race day, so the long run lands on the race's weekday.
    first_start = race_date - timedelta(days=7 * week_count - 1)

    weeks = []
    for i, (phase, volume) in enumerate(zip(phases, volumes, strict=True)):
        start = first_start + timedelta(days=7 * i)
        is_race_week = i == week_count - 1
        progress = _phase_progress(phases, i)
        workouts = _week_workouts(
            spec, phase, progress, volume, runs_per_week, start, paces, race_day_zone, is_race_week
        )
        workouts = [w for w in workouts if w.date > today]
        weeks.append(
            PlanWeek(
                number=i + 1,
                phase=phase,
                start_date=start,
                total_mi=round(sum(w.distance_mi for w in workouts), 1),
                workouts=workouts,
            )
        )

    return TrainingPlan(
        race=race,
        race_label=spec.label,
        race_date=race_date,
        race_distance_mi=race_mi,
        weeks_until_race=week_count,
        fitness=effort,
        predicted_time_s=predicted,
        predicted_pace_s_per_mi=race_pace,
        projected_vdot=projected,
        projected_time_s=projected_time,
        projected_pace_s_per_mi=projected_time / race_mi,
        recent=recent,
        paces=list(paces.values()),
        weeks=weeks,
        notes=_notes(recent, spec, volumes, week_count, race_date, today),
    )


def projected_vdot(
    current: float, training_weeks: int, peak_weekly_mi: float, target_weekly_mi: float
) -> float:
    """Fitness expected on race day after following the plan.

    A heuristic, not a law: the gain grows with weeks of training but levels off
    (1 - e^(-weeks / 12)), is larger for less-fit runners, and shrinks when the plan's peak
    mileage falls short of what suits the race (because the 10% rule capped it).
    """
    (low_vdot, low_gain), (high_vdot, high_gain) = (
        GAIN_CEILING_LOW_FITNESS,
        GAIN_CEILING_HIGH_FITNESS,
    )
    blend = min(max((current - low_vdot) / (high_vdot - low_vdot), 0.0), 1.0)
    ceiling = low_gain + (high_gain - low_gain) * blend
    time_factor = 1 - math.exp(-training_weeks / GAIN_WEEKS_TIME_CONSTANT)
    volume_factor = min(peak_weekly_mi / target_weekly_mi, 1.0)
    return current * (1 + ceiling * time_factor * volume_factor)


def _phases(week_count: int, taper_weeks: int) -> list[Phase]:
    """Split the weeks before the taper roughly 40/40/20 into base, build and peak."""
    taper = min(taper_weeks, max(week_count - 1, 1))
    training = week_count - taper
    base = round(training * 0.4)
    peak = round(training * 0.2)
    build = training - base - peak
    return ["base"] * base + ["build"] * build + ["peak"] * peak + ["taper"] * taper


def _phase_progress(phases: list[Phase], index: int) -> float:
    """0.0 in the first week of a phase, 1.0 in its last."""
    phase = phases[index]
    first = phases.index(phase)
    length = phases.count(phase)
    return (index - first) / (length - 1) if length > 1 else 1.0


def _weekly_volumes(phases: list[Phase], current_mi: float, spec: RaceSpec) -> list[float]:
    start = max(current_mi, MIN_WEEKLY_MI)
    peak = max(start, spec.peak_weekly_mi)
    volumes: list[float] = []
    level = start
    for i, phase in enumerate(phases):
        if phase == "taper":
            continue
        cutback = (i + 1) % CUTBACK_EVERY == 0 and phase != "peak"
        if cutback:
            # Hold the level through an easier week, so the week after isn't a big jump.
            volumes.append(level * CUTBACK_FACTOR)
            continue
        if i > 0:
            level = min(level * MAX_WEEKLY_GROWTH, peak)
        volumes.append(level)
    top = max(volumes, default=start)
    taper_count = phases.count("taper")
    volumes += [top * f for f in TAPER_FACTORS.get(taper_count, [0.6] * taper_count)]
    return volumes


def _week_workouts(
    spec: RaceSpec,
    phase: Phase,
    progress: float,
    volume: float,
    runs_per_week: int,
    start: date,
    paces: dict[str, PaceZone],
    race_day_zone: PaceZone,
    is_race_week: bool,
) -> list[Workout]:
    slots = DAY_SLOTS[runs_per_week]
    long_mi = _long_run_mi(spec, phase, volume)
    workouts: dict[int, Workout] = {}

    if "Q" in slots.values():
        day = _day_of(slots, "Q")
        workouts[day] = _main_workout(spec, phase, progress, start + timedelta(days=day), paces)
    if phase in ("peak", "taper") and "Q2" in slots.values() and not is_race_week:
        day = _day_of(slots, "Q2")
        workouts[day] = _race_pace_workout(
            spec, phase, progress, start + timedelta(days=day), paces
        )

    if is_race_week:
        workouts[6] = _workout(
            start + timedelta(days=6),
            "race",
            f"Race day: {spec.label}",
            "Start at your projected pace, not faster. Hold it, and pick it up in the last mile.",
            spec.distance_m / METERS_PER_MILE,
            race_day_zone,
        )
    else:
        workouts[6] = _long_run(spec, phase, long_mi, start + timedelta(days=6), paces)

    easy_days = [d for d, slot in slots.items() if d not in workouts]
    if is_race_week:
        # Keep race week light: drop the easy run the day before the race.
        easy_days = [d for d in easy_days if d != 5]
        used = sum(w.distance_mi for d, w in workouts.items() if d != 6)
    else:
        used = sum(w.distance_mi for w in workouts.values())
    if easy_days:
        # An easy run never outgrows most of the long run; race week stays short.
        cap = RACE_WEEK_EASY_MI if is_race_week else max(long_mi * 0.75, MIN_RUN_MI)
        each = min(max((volume - used) / len(easy_days), MIN_RUN_MI), cap)
        for d in easy_days:
            workouts[d] = _workout(
                start + timedelta(days=d),
                "easy",
                "Easy run",
                "Relaxed and conversational. Slower is fine.",
                each,
                paces["easy"],
            )
    return [workouts[d] for d in sorted(workouts)]


def _day_of(slots: dict[int, str], slot: str) -> int:
    return next(d for d, s in slots.items() if s == slot)


def _long_run_mi(spec: RaceSpec, phase: Phase, volume: float) -> float:
    # Longer races lean harder on the long run: up to 40% of the week for a marathon.
    share = 0.4 if spec.distance_m > 40000 else 0.33 if spec.distance_m > 20000 else 0.28
    if phase == "taper":
        return max(volume * share, MIN_RUN_MI)
    return min(max(volume * share, 3.0), spec.longest_run_mi)


def _long_run(
    spec: RaceSpec, phase: Phase, miles: float, day: date, paces: dict[str, PaceZone]
) -> Workout:
    if phase == "peak" and spec.distance_m > 20000:
        finish = round(min(miles * 0.3, 6))
        return _workout(
            day,
            "long",
            "Long run with goal-pace finish",
            f"Easy for the first {miles - finish:.0f} mi, then the last {finish} mi at goal pace.",
            miles,
            paces["easy"],
        )
    return _workout(
        day, "long", "Long run", "Steady and easy. Build time on your feet.", miles, paces["easy"]
    )


def _main_workout(
    spec: RaceSpec, phase: Phase, progress: float, day: date, paces: dict[str, PaceZone]
) -> Workout:
    warm, cool = 1.5, 1.0
    if phase == "base":
        return _workout(
            day,
            "strides",
            "Easy run + strides",
            "Easy miles, then 6 × 20 s fast but relaxed strides with a walk back between.",
            4.0,
            paces["easy"],
        )
    if phase == "build":
        tempo = round(2 + progress * (3 if spec.distance_m > 20000 else 2))
        return _workout(
            day,
            "threshold",
            f"Tempo: {tempo} mi at threshold",
            f"{warm:g} mi easy, {tempo} mi at threshold pace, {cool:g} mi easy.",
            warm + tempo + cool,
            paces["threshold"],
        )
    if phase == "peak":
        reps = round(4 + progress * 2)
        rep_m = _interval_rep_m(spec.interval_rep_m, paces["interval"].slow_s_per_mi)
        rep_mi = rep_m / METERS_PER_MILE
        return _workout(
            day,
            "intervals",
            f"Intervals: {reps} × {rep_m} m",
            f"{warm:g} mi easy, {reps} × {rep_m} m at interval pace with "
            f"equal-time jog recoveries, {cool:g} mi easy.",
            warm + cool + reps * rep_mi * 1.8,
            paces["interval"],
        )
    return _workout(
        day,
        "threshold",
        "Sharpener: 2 × 1 mi at threshold",
        "1 mi easy, 2 × 1 mi at threshold pace with 3 min jog, 1 mi easy. Stay fresh.",
        4.5,
        paces["threshold"],
    )


def _interval_rep_m(preferred_m: int, pace_s_per_mi: float) -> int:
    """The preferred rep length, shortened until one rep takes at most MAX_INTERVAL_REP_S."""
    for rep_m in sorted(INTERVAL_REP_OPTIONS_M, reverse=True):
        if rep_m <= preferred_m and rep_m / METERS_PER_MILE * pace_s_per_mi <= MAX_INTERVAL_REP_S:
            return rep_m
    return min(INTERVAL_REP_OPTIONS_M)


def _race_pace_workout(
    spec: RaceSpec, phase: Phase, progress: float, day: date, paces: dict[str, PaceZone]
) -> Workout:
    race_mi = spec.distance_m / METERS_PER_MILE
    at_pace = max(min(race_mi * (0.3 + 0.2 * progress), 8), 1.5)
    if phase == "taper":
        at_pace *= 0.6
    at_pace = round(at_pace, 1)
    return _workout(
        day,
        "race_pace",
        f"Goal pace: {at_pace:g} mi",
        f"1 mi easy, {at_pace:g} mi at goal race pace, 1 mi easy. Practice the rhythm.",
        at_pace + 2,
        paces["race"],
    )


def _workout(
    day: date,
    kind: WorkoutKind,
    title: str,
    description: str,
    miles: float,
    zone: PaceZone,
) -> Workout:
    return Workout(
        date=day,
        kind=kind,
        title=title,
        description=description,
        distance_mi=round(miles, 1),
        pace_zone=zone.key,
        fast_s_per_mi=zone.fast_s_per_mi,
        slow_s_per_mi=zone.slow_s_per_mi,
    )


def _notes(
    recent: RecentTraining,
    spec: RaceSpec,
    volumes: list[float],
    week_count: int,
    race_date: date,
    today: date,
) -> list[str]:
    notes = []
    if recent.stale:
        notes.append(
            f"No runs in the last {RECENT_DAYS} days, so the estimate uses older runs. "
            "Expect it to be optimistic until you sync some fresh ones."
        )
    if (race_date - today).days > MAX_PLAN_WEEKS * 7:
        notes.append(
            f"The race is more than {MAX_PLAN_WEEKS} weeks out; the plan covers the last "
            f"{MAX_PLAN_WEEKS}. Run easy until it starts."
        )
    min_weeks = {5000: 4, 10000: 6, 20000: 8, 21097.5: 8, 42195: 12}[spec.distance_m]
    if week_count < min_weeks:
        notes.append(
            f"{week_count} weeks is short for a {spec.label} build; the plan can't safely "
            "add much mileage, so the prediction is close to where you are now."
        )
    if volumes and max(volumes) < spec.peak_weekly_mi * 0.85:
        notes.append(
            f"Capped at +10% per week, mileage tops out at {max(volumes):.0f} mi/week, short of "
            f"the ~{spec.peak_weekly_mi:.0f} mi/week that suits a {spec.label}."
        )
    if recent.longest_run_mi < spec.distance_m / METERS_PER_MILE * 0.5 and spec.distance_m > 20000:
        notes.append(
            f"Your longest recent run is {recent.longest_run_mi:.1f} mi. Long-race predictions "
            "assume endurance you may not have yet, so treat the estimate as a ceiling."
        )
    if recent.avg_cadence and recent.avg_cadence < LOW_CADENCE_SPM:
        target = round(recent.avg_cadence * 1.05)
        notes.append(
            f"Average cadence is {recent.avg_cadence:.0f} spm. Nudging it toward {target} spm "
            "on easy runs (shorter, quicker steps) tends to reduce overstriding."
        )
    return notes
