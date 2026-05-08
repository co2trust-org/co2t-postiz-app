import { parseIntegrationTimezoneOffsetMinutes } from '@gitroom/nestjs-libraries/integrations/integration.timezone-offset';

describe('parseIntegrationTimezoneOffsetMinutes', () => {
  it('parses integer offset strings (dayjs utcOffset)', () => {
    expect(parseIntegrationTimezoneOffsetMinutes('-300')).toBe(-300);
    expect(parseIntegrationTimezoneOffsetMinutes('480')).toBe(480);
    expect(parseIntegrationTimezoneOffsetMinutes('0')).toBe(0);
  });

  it('treats blank timezone like legacy unary + on empty string (+"" → 0)', () => {
    expect(parseIntegrationTimezoneOffsetMinutes('')).toBe(0);
    expect(parseIntegrationTimezoneOffsetMinutes('   ')).toBe(0);
  });

  it('returns undefined when timezone is absent', () => {
    expect(parseIntegrationTimezoneOffsetMinutes(undefined)).toBeUndefined();
    expect(parseIntegrationTimezoneOffsetMinutes(null)).toBeUndefined();
  });

  it('resolves a valid IANA zone to an offset in minutes', () => {
    const n = parseIntegrationTimezoneOffsetMinutes('America/New_York');
    expect(typeof n).toBe('number');
    expect(Number.isFinite(n)).toBe(true);
  });

  it('returns undefined for invalid IANA identifiers', () => {
    expect(parseIntegrationTimezoneOffsetMinutes('Not/AZone')).toBeUndefined();
  });
});
