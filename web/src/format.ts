/** Display helpers. The API already sends miles and seconds; these only format them. */

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "–";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatPace(secondsPerMile: number | null | undefined): string {
  return secondsPerMile == null ? "–" : `${formatDuration(secondsPerMile)} /mi`;
}

export function formatNumber(value: number | null | undefined, digits = 0, unit = ""): string {
  if (value == null) return "–";
  return `${value.toFixed(digits)}${unit}`;
}

export function formatDate(iso: string): string {
  // start_time_local has no timezone: it is already the watch's local time.
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
