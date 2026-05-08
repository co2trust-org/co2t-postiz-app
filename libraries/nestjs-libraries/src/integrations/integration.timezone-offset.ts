import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Maps `ConnectIntegrationDto.timezone` (string) to numeric UTC offset minutes for
 * `IntegrationRepository` postingTimes (same convention as `dayjs.tz().utcOffset()`).
 *
 * - Integer strings (e.g. "-300" from the web client) are returned as numbers.
 * - Blank strings (including whitespace-only) return `0`, matching legacy `+body.timezone` on `""`.
 * - IANA zones (e.g. "America/New_York") resolve to the current offset via dayjs-timezone.
 */
export function parseIntegrationTimezoneOffsetMinutes(
  raw: string | null | undefined
): number | undefined {
  if (raw == null) {
    return undefined;
  }
  const s = String(raw).trim();
  if (!s) {
    // Match legacy `+body.timezone` on `""` / whitespace (`+''` → 0).
    return 0;
  }

  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  try {
    const zoned = dayjs.tz(new Date(), s);
    if (!zoned.isValid()) {
      return undefined;
    }
    return zoned.utcOffset();
  } catch {
    return undefined;
  }
}
