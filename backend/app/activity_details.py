"""Turn the raw Garmin JSON stored for an activity into labelled, formatted detail rows.

Garmin sends 100+ fields per activity. The known ones are grouped into sections and
converted to the units the app uses (miles, feet, min/mi, °F). Any other numeric field
Garmin adds lands in an "Other" section, so nothing recorded is hidden. Identifiers,
owner info and GPS coordinates are left out on purpose.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from app.units import FEET_PER_METER, METERS_PER_MILE


class DetailItem(BaseModel):
    key: str
    label: str
    value: float | str
    # Ready to show, in the app's units, e.g. "8:48 /mi" or "1,208 ml".
    display: str


class DetailSection(BaseModel):
    title: str
    items: list[DetailItem]


# --- formatters --------------------------------------------------------------------------


def _duration(seconds: float) -> str:
    s = round(seconds)
    h, rest = divmod(s, 3600)
    m, sec = divmod(rest, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _pace_from_speed(mps: float) -> str:
    return f"{_duration(METERS_PER_MILE / mps)} /mi"


def _unit(unit: str, digits: int = 0) -> Callable[[float], str]:
    return lambda v: f"{v:,.{digits}f} {unit}".strip()


def _signed(v: float) -> str:
    return f"{v:+,.0f}"


_miles = lambda m: f"{m / METERS_PER_MILE:,.2f} mi"  # noqa: E731
_feet = lambda m: f"{m * FEET_PER_METER:,.0f} ft"  # noqa: E731
_feet_per_min = lambda mps: f"{mps * FEET_PER_METER * 60:,.0f} ft/min"  # noqa: E731
_fahrenheit = lambda c: f"{c * 9 / 5 + 32:.0f} °F"  # noqa: E731
_minutes = _unit("min")
_stride = lambda cm: f"{cm / 100:.2f} m"  # noqa: E731


@dataclass(frozen=True)
class Field:
    key: str
    label: str
    format: Callable[[float], str]
    # Garmin sends 0 for most metrics a device didn't record, so zeros are hidden unless
    # zero is a real reading (e.g. no time spent in heart rate zone 5).
    zero_is_real: bool = False


_zone_fields = lambda prefix, name: [  # noqa: E731
    Field(f"{prefix}{i}", f"{name} zone {i}", _duration, zero_is_real=True) for i in range(1, 6)
]

SECTIONS: list[tuple[str, list[Field]]] = [
    (
        "Overview",
        [
            Field("distance", "Distance", _miles),
            Field("movingDuration", "Moving time", _duration),
            Field("duration", "Timer time", _duration),
            Field("elapsedDuration", "Elapsed time", _duration),
            Field("lapCount", "Laps", _unit("")),
            Field("steps", "Steps", _unit("")),
            Field("calories", "Calories", _unit("kcal")),
            Field("bmrCalories", "Resting calories", _unit("kcal")),
            Field("waterEstimated", "Est. sweat loss", _unit("ml")),
            Field("differenceBodyBattery", "Body Battery change", _signed, zero_is_real=True),
            Field("moderateIntensityMinutes", "Moderate minutes", _minutes, zero_is_real=True),
            Field("vigorousIntensityMinutes", "Vigorous minutes", _minutes, zero_is_real=True),
        ],
    ),
    (
        "Pace",
        [
            Field("averageSpeed", "Avg pace", _pace_from_speed),
            Field("avgGradeAdjustedSpeed", "Grade adjusted pace", _pace_from_speed),
            Field("maxSpeed", "Best pace", _pace_from_speed),
            Field("fastestSplit_1000", "Fastest 1 km", _duration),
            Field("fastestSplit_1609", "Fastest mile", _duration),
            Field("fastestSplit_5000", "Fastest 5K", _duration),
            Field("fastestSplit_10000", "Fastest 10K", _duration),
            Field("fastestSplit_21098", "Fastest half marathon", _duration),
            Field("fastestSplit_42195", "Fastest marathon", _duration),
        ],
    ),
    (
        "Heart rate",
        [
            Field("averageHR", "Avg heart rate", _unit("bpm")),
            Field("maxHR", "Max heart rate", _unit("bpm")),
            *_zone_fields("hrTimeInZone_", "Time in HR"),
        ],
    ),
    (
        "Power",
        [
            Field("avgPower", "Avg power", _unit("W")),
            Field("normPower", "Normalized power", _unit("W")),
            Field("maxPower", "Max power", _unit("W")),
            *_zone_fields("powerTimeInZone_", "Time in power"),
        ],
    ),
    (
        "Running dynamics",
        [
            Field("averageRunningCadenceInStepsPerMinute", "Avg cadence", _unit("spm")),
            Field("maxRunningCadenceInStepsPerMinute", "Max cadence", _unit("spm")),
            Field("avgStrideLength", "Avg stride length", _stride),
            Field("avgVerticalOscillation", "Vertical oscillation", _unit("cm", 1)),
            Field("avgVerticalRatio", "Vertical ratio", _unit("%", 1)),
            Field("avgGroundContactTime", "Ground contact time", _unit("ms")),
        ],
    ),
    (
        "Elevation",
        [
            Field("elevationGain", "Total ascent", _feet),
            Field("elevationLoss", "Total descent", _feet),
            Field("minElevation", "Min elevation", _feet),
            Field("maxElevation", "Max elevation", _feet),
            Field("avgElevation", "Avg elevation", _feet),
            Field("maxVerticalSpeed", "Max vertical speed", _feet_per_min),
        ],
    ),
    (
        "Training effect",
        [
            Field("aerobicTrainingEffect", "Aerobic", _unit("", 1), zero_is_real=True),
            Field("anaerobicTrainingEffect", "Anaerobic", _unit("", 1), zero_is_real=True),
        ],
    ),
    (
        "Conditions",
        [
            Field("minTemperature", "Min temperature", _fahrenheit, zero_is_real=True),
            Field("maxTemperature", "Max temperature", _fahrenheit, zero_is_real=True),
        ],
    ),
]

# Text fields worth showing, by section title.
_TEXT_FIELDS: dict[str, list[tuple[str, str]]] = {
    "Overview": [("locationName", "Location")],
    "Training effect": [("trainingEffectLabel", "Primary benefit")],
}

_KNOWN_KEYS = {f.key for _, fields in SECTIONS for f in fields}

# Numeric fields that are ids, coordinates, timestamps or bookkeeping rather than metrics.
_IGNORED_KEYS = {
    "activityId",
    "ownerId",
    "deviceId",
    "timeZoneId",
    "sportTypeId",
    "beginTimestamp",
    "startLatitude",
    "startLongitude",
    "endLatitude",
    "endLongitude",
    "averageBikingCadenceInRevPerMinute",  # shown for rides only, via the cadence column
}


def activity_details(raw: dict[str, Any]) -> list[DetailSection]:
    sections = []
    for title, fields in SECTIONS:
        items = [_text_item(raw, key, label) for key, label in _TEXT_FIELDS.get(title, [])]
        items += [_number_item(raw, f) for f in fields]
        present = [item for item in items if item is not None]
        if present:
            sections.append(DetailSection(title=title, items=present))

    other = [_other_item(key, value) for key, value in raw.items()]
    if other_items := [item for item in other if item is not None]:
        sections.append(DetailSection(title="Other", items=other_items))
    return sections


def _number_item(raw: dict[str, Any], field: Field) -> DetailItem | None:
    value = _as_number(raw.get(field.key))
    if value is None or (value == 0 and not field.zero_is_real):
        return None
    return DetailItem(key=field.key, label=field.label, value=value, display=field.format(value))


def _text_item(raw: dict[str, Any], key: str, label: str) -> DetailItem | None:
    value = raw.get(key)
    if not isinstance(value, str) or not value:
        return None
    text = value.replace("_", " ").capitalize() if value.isupper() else value
    return DetailItem(key=key, label=label, value=value, display=text)


def _other_item(key: str, value: Any) -> DetailItem | None:
    if key in _KNOWN_KEYS or key in _IGNORED_KEYS:
        return None
    number = _as_number(value)
    if number is None or number == 0:
        return None
    display = f"{number:,.0f}" if number.is_integer() else f"{number:,.2f}"
    return DetailItem(key=key, label=_humanize(key), value=number, display=display)


def _as_number(value: Any) -> float | None:
    # bool is an int subclass; Garmin's many is*/has* flags aren't metrics.
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def _humanize(key: str) -> str:
    """avgDoubleCadence -> "Avg double cadence", fastestSplit_800 -> "Fastest split 800"."""
    words = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", key).replace("_", " ").split()
    return " ".join(words).capitalize()
