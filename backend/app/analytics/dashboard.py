"""The dashboard's synopsis: all-time and per-sport totals, recent periods, streaks, weekly volume.

Every total sums over activities that recorded the metric and skips the rest, so a
strength workout with no distance still counts toward time and activity count.
Dates are the watch's local dates (start_time_local), so a run at 11pm counts for that day.
"""

from collections.abc import Iterable
from datetime import date, datetime, timedelta

from pydantic import BaseModel

from app.models import Activity
from app.units import meters_to_feet, meters_to_miles

# Every sport group, in the order the dashboard lists them.
SPORTS = ("run", "walk", "bike", "swim", "other")
WEEKS_SHOWN = 12


class Totals(BaseModel):
    count: int
    # Moving time where recorded, else total time, like the activity list shows.
    time_s: float
    distance_mi: float
    elevation_gain_ft: float
    calories: int


class SportTotals(Totals):
    sport: str
    longest_distance_mi: float | None
    longest_time_s: float | None
    last_activity_at: datetime | None


class Streak(BaseModel):
    # Days in a row with at least one activity, ending today (or yesterday, if today is still open).
    current_days: int
    longest_days: int


class WeekVolume(BaseModel):
    # The Monday the week starts on.
    week_start: date
    # Seconds of activity per sport group; sports with no time that week are left out.
    time_s_by_sport: dict[str, float]


class DashboardSummary(BaseModel):
    totals: Totals
    active_days: int
    first_activity_at: datetime | None
    sports: list[SportTotals]
    # Monday to today.
    this_week: Totals
    # The whole Monday-to-Sunday week before this one.
    last_week: Totals
    # January 1 to today.
    this_year: Totals
    streak: Streak
    # The last WEEKS_SHOWN weeks, oldest first, ending with this week.
    weekly: list[WeekVolume]


def summarize(activities: list[Activity], today: date) -> DashboardSummary:
    this_monday = week_start(today)
    last_monday = this_monday - timedelta(days=7)
    active_dates = {a.start_time_local.date() for a in activities}

    return DashboardSummary(
        totals=totals(activities),
        active_days=len(active_dates),
        first_activity_at=min((a.start_time_local for a in activities), default=None),
        sports=[sport_totals(s, [a for a in activities if a.sport == s]) for s in SPORTS],
        this_week=totals(_between(activities, this_monday, today)),
        last_week=totals(_between(activities, last_monday, this_monday - timedelta(days=1))),
        this_year=totals(_between(activities, date(today.year, 1, 1), today)),
        streak=streak(active_dates, today),
        weekly=weekly_volume(activities, today),
    )


def totals(activities: Iterable[Activity]) -> Totals:
    activities = list(activities)
    return Totals(
        count=len(activities),
        time_s=sum(t for a in activities if (t := activity_time_s(a))),
        distance_mi=meters_to_miles(sum(a.distance_m or 0 for a in activities)) or 0.0,
        elevation_gain_ft=meters_to_feet(sum(a.elevation_gain_m or 0 for a in activities)) or 0.0,
        calories=sum(a.calories or 0 for a in activities),
    )


def sport_totals(sport: str, activities: list[Activity]) -> SportTotals:
    distances = [a.distance_m for a in activities if a.distance_m]
    times = [t for a in activities if (t := activity_time_s(a))]
    return SportTotals(
        sport=sport,
        **totals(activities).model_dump(),
        longest_distance_mi=meters_to_miles(max(distances, default=None)),
        longest_time_s=max(times, default=None),
        last_activity_at=max((a.start_time_local for a in activities), default=None),
    )


def streak(active_dates: set[date], today: date) -> Streak:
    longest = 0
    for day in active_dates:
        # Only count from the first day of each run of days, so each run is walked once.
        if day - timedelta(days=1) in active_dates:
            continue
        length = _days_in_a_row(active_dates, day, step=1)
        longest = max(longest, length)

    # A streak that ran through yesterday is still alive until today ends.
    end = today if today in active_dates else today - timedelta(days=1)
    current = _days_in_a_row(active_dates, end, step=-1)
    return Streak(current_days=current, longest_days=longest)


def weekly_volume(
    activities: list[Activity], today: date, weeks: int = WEEKS_SHOWN
) -> list[WeekVolume]:
    first_monday = week_start(today) - timedelta(weeks=weeks - 1)
    by_week: dict[date, dict[str, float]] = {
        first_monday + timedelta(weeks=i): {} for i in range(weeks)
    }
    for a in activities:
        week = by_week.get(week_start(a.start_time_local.date()))
        time_s = activity_time_s(a)
        if week is None or not time_s:
            continue
        week[a.sport] = week.get(a.sport, 0.0) + time_s
    return [WeekVolume(week_start=monday, time_s_by_sport=t) for monday, t in by_week.items()]


def activity_time_s(activity: Activity) -> float | None:
    return activity.moving_time_s or activity.duration_s


def week_start(day: date) -> date:
    """The Monday on or before `day`."""
    return day - timedelta(days=day.weekday())


def _between(activities: list[Activity], first: date, last: date) -> list[Activity]:
    return [a for a in activities if first <= a.start_time_local.date() <= last]


def _days_in_a_row(active_dates: set[date], start: date, step: int) -> int:
    length = 0
    day = start
    while day in active_dates:
        length += 1
        day += timedelta(days=step)
    return length
