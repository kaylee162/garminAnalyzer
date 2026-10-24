import { formatDuration, formatNumber } from "./format";

/** The sports that get their own page. Matches the API's sport groups. */
export type Sport = "run" | "walk" | "bike" | "swim";

const YARDS_PER_MILE = 1760;
const SECONDS_PER_HOUR = 3600;

export type SportConfig = {
  sport: Sport;
  // The sport's page title and nav label, e.g. "Running".
  title: string;
  href: string;
  // The sport's hue in charts, e.g. "var(--color-sport-run)".
  color: string;
  // Used in copy: "Recent runs", "Tick two rides to compare them".
  noun: string;
  nounPlural: string;
  // How each sport reads its speed. The API always sends seconds per mile; `fromPace` converts it.
  speed: {
    label: string;
    unit: string;
    fromPace: (secondsPerMile: number) => number;
    format: (value: number) => string;
    // Lower is better for paces, higher for speeds.
    better: "lower" | "higher";
    tickSteps: number[];
  };
  distance: {
    unit: string;
    fromMiles: (miles: number) => number;
    digits: number;
  };
  cadenceUnit: string;
};

const PACE_TICK_STEPS = [5, 10, 15, 30, 60, 120, 300];

const minutesPerMile: SportConfig["speed"] = {
  label: "Pace",
  unit: "/mi",
  fromPace: (s) => s,
  format: (s) => formatDuration(s),
  better: "lower",
  tickSteps: PACE_TICK_STEPS,
};

const miles: SportConfig["distance"] = { unit: "mi", fromMiles: (mi) => mi, digits: 2 };

export const SPORTS: Record<Sport, SportConfig> = {
  run: {
    sport: "run",
    title: "Running",
    href: "#/running",
    color: "var(--color-sport-run)",
    noun: "run",
    nounPlural: "runs",
    speed: minutesPerMile,
    distance: miles,
    cadenceUnit: "spm",
  },
  walk: {
    sport: "walk",
    title: "Walking",
    href: "#/walking",
    color: "var(--color-sport-walk)",
    noun: "walk",
    nounPlural: "walks",
    speed: minutesPerMile,
    distance: miles,
    cadenceUnit: "spm",
  },
  bike: {
    sport: "bike",
    title: "Biking",
    href: "#/biking",
    color: "var(--color-sport-bike)",
    noun: "ride",
    nounPlural: "rides",
    speed: {
      label: "Speed",
      unit: "mph",
      fromPace: (s) => SECONDS_PER_HOUR / s,
      format: (mph) => formatNumber(mph, 1),
      better: "higher",
      tickSteps: [0.5, 1, 2, 5, 10],
    },
    distance: miles,
    cadenceUnit: "rpm",
  },
  swim: {
    sport: "swim",
    title: "Swimming",
    href: "#/swimming",
    color: "var(--color-sport-swim)",
    noun: "swim",
    nounPlural: "swims",
    speed: {
      label: "Pace",
      unit: "/100yd",
      fromPace: (s) => s / (YARDS_PER_MILE / 100),
      format: (s) => formatDuration(s),
      better: "lower",
      tickSteps: PACE_TICK_STEPS,
    },
    distance: { unit: "yd", fromMiles: (mi) => mi * YARDS_PER_MILE, digits: 0 },
    cadenceUnit: "spm",
  },
};

export function formatSpeed(config: SportConfig, secondsPerMile: number | null | undefined): string {
  if (secondsPerMile == null) return "–";
  return `${config.speed.format(config.speed.fromPace(secondsPerMile))} ${config.speed.unit}`;
}

export function formatDistance(config: SportConfig, miles: number | null | undefined): string {
  if (miles == null) return "–";
  const { fromMiles, digits, unit } = config.distance;
  return formatNumber(fromMiles(miles), digits, ` ${unit}`);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The API's catch-all group (strength, yoga, …). It shows on the dashboard but has no page. */
export const OTHER_SPORT = { title: "Other", color: "var(--color-sport-other)" };

export function isSport(sport: string): sport is Sport {
  return sport in SPORTS;
}

/** The title and chart hue of any sport group the API sends, "other" included. */
export function sportLook(sport: string): { title: string; color: string } {
  return isSport(sport) ? SPORTS[sport] : OTHER_SPORT;
}
