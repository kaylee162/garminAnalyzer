"""Compare two activities metric by metric: raw change, percent change and a readable summary.

Values are compared in the units the API reports (miles, feet, seconds per mile), so the
numbers in a summary match what the web app shows next to it.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from app.models import Activity
from app.units import meters_to_feet, pace_s_per_mile

# Which way counts as an improvement. None means the metric is context-dependent
# (a longer run or a higher heart rate is neither better nor worse on its own).
Better = Literal["higher", "lower"]
Verdict = Literal["improved", "declined", "unchanged"]

# Changes smaller than this are reported as "unchanged" so float noise doesn't read as a trend.
UNCHANGED_TOLERANCE = 1e-9


class MetricComparison(BaseModel):
    key: str
    label: str
    unit: str
    earlier: float | None
    later: float | None
    # later - earlier, in the metric's unit. None unless both runs recorded the metric.
    change: float | None
    # Change relative to the earlier run, e.g. 11.2 for +11.2%. None when the earlier value is 0.
    percent_change: float | None
    better: Better | None
    verdict: Verdict | None
    summary: str | None


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    unit: str
    value: Callable[[Activity], float | None]
    better: Better | None = None
    digits: int = 1
    up: str = "increased"
    down: str = "decreased"
    format_amount: Callable[[float], str] | None = None

    def format(self, amount: float) -> str:
        if self.format_amount:
            return self.format_amount(amount)
        return f"{amount:,.{self.digits}f} {self.unit}"


def _format_duration(seconds: float) -> str:
    s = round(seconds)
    h, rest = divmod(s, 3600)
    m, sec = divmod(rest, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _moving_time(a: Activity) -> float | None:
    return a.moving_time_s or a.duration_s


METRICS: list[Metric] = [
    Metric(
        "avg_pace_s_per_mi",
        "Avg pace",
        "s/mi",
        lambda a: pace_s_per_mile(a.distance_m, _moving_time(a)),
        better="lower",
        up="slowed",
        down="quickened",
        format_amount=lambda s: f"{_format_duration(s)} /mi",
    ),
    Metric("avg_hr", "Avg heart rate", "bpm", lambda a: a.avg_hr, digits=0),
    Metric("max_hr", "Max heart rate", "bpm", lambda a: a.max_hr, digits=0),
    Metric("avg_power", "Avg power", "W", lambda a: a.avg_power, better="higher", digits=0),
    Metric("avg_cadence", "Cadence", "spm", lambda a: a.avg_cadence, digits=0),
    Metric("avg_stride_m", "Stride length", "m", lambda a: a.avg_stride_m, digits=2),
    Metric(
        "elevation_gain_ft",
        "Elevation gain",
        "ft",
        lambda a: meters_to_feet(a.elevation_gain_m),
        digits=0,
    ),
]


def compare_activities(earlier: Activity, later: Activity) -> list[MetricComparison]:
    """Every metric recorded on at least one of the two runs, changes measured from `earlier`."""
    results = []
    for metric in METRICS:
        before, after = metric.value(earlier), metric.value(later)
        if before is None and after is None:
            continue
        results.append(_compare(metric, before, after))
    return results


def _compare(metric: Metric, before: float | None, after: float | None) -> MetricComparison:
    change = percent = verdict = summary = None
    if before is not None and after is not None:
        change = after - before
        percent = change / before * 100 if before else None
        verdict = _verdict(metric.better, change)
        summary = _summary(metric, after, change, percent)
    return MetricComparison(
        key=metric.key,
        label=metric.label,
        unit=metric.unit,
        earlier=before,
        later=after,
        change=change,
        percent_change=percent,
        better=metric.better,
        verdict=verdict,
        summary=summary,
    )


def _verdict(better: Better | None, change: float) -> Verdict | None:
    if abs(change) <= UNCHANGED_TOLERANCE:
        return "unchanged"
    if better is None:
        return None
    went_up = change > 0
    return "improved" if went_up == (better == "higher") else "declined"


def _summary(metric: Metric, after: float, change: float, percent: float | None) -> str:
    """E.g. "Avg heart rate increased 11.2% (+15 bpm)"."""
    if abs(change) <= UNCHANGED_TOLERANCE:
        return f"{metric.label} unchanged ({metric.format(after).strip()})"
    verb = metric.up if change > 0 else metric.down
    sign = "+" if change > 0 else "−"
    amount = f"{sign}{metric.format(abs(change)).strip()}"
    if percent is None:
        return f"{metric.label} {verb} ({amount})"
    return f"{metric.label} {verb} {abs(percent):.1f}% ({amount})"
