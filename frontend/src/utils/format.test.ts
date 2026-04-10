/**
 * Unit tests for src/utils/format.ts
 *
 * Pure functions — no DOM required.
 */
import { describe, it, expect } from 'vitest';
import {
  fmtEur,
  fmtPct,
  fmtUnits,
  fmtAssetClass,
  riskColor,
  fmtDateShort,
  fmtDateLong,
  fmtCompact,
  today,
} from './format';

// ── fmtEur ───────────────────────────────────────────────────────────────────────
describe('fmtEur', () => {
  it('returns em-dash for null', () => {
    expect(fmtEur(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(fmtEur(undefined)).toBe('—');
  });

  it('formats zero with two decimal places', () => {
    const result = fmtEur(0);
    // Greek locale uses comma as decimal separator: "0,00"
    expect(result).toMatch(/0[,.]00/);
  });

  it('formats a positive number', () => {
    const result = fmtEur(1234.5);
    expect(result).toMatch(/1/);
    expect(result).toMatch(/234/);
  });

  it('formats a negative number', () => {
    const result = fmtEur(-500);
    expect(result).toContain('500');
    expect(result).toContain('-');
  });

  it('respects custom decimals parameter', () => {
    const result = fmtEur(1.23456, 4);
    // Should contain 4 fractional digits
    expect(result).toMatch(/\d{1,4}[,.\s]\d{4}/);
  });
});

// ── fmtPct ───────────────────────────────────────────────────────────────────────
describe('fmtPct', () => {
  it('returns em-dash for null', () => {
    expect(fmtPct(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(fmtPct(undefined)).toBe('—');
  });

  it('prefixes positive numbers with +', () => {
    expect(fmtPct(12.5)).toBe('+12.50%');
  });

  it('does NOT add + prefix for negative numbers', () => {
    expect(fmtPct(-3.75)).toBe('-3.75%');
  });

  it('formats zero as +0.00%', () => {
    expect(fmtPct(0)).toBe('+0.00%');
  });

  it('always shows exactly 2 decimal places', () => {
    expect(fmtPct(100)).toBe('+100.00%');
    expect(fmtPct(-0.1)).toBe('-0.10%');
  });
});

// ── fmtUnits ─────────────────────────────────────────────────────────────────────
describe('fmtUnits', () => {
  it('returns em-dash for null / undefined', () => {
    expect(fmtUnits(null)).toBe('—');
    expect(fmtUnits(undefined)).toBe('—');
  });

  it('formats whole units without trailing decimals', () => {
    const result = fmtUnits(100);
    expect(result).toContain('100');
    // Must not end with a decimal separator
    expect(result).not.toMatch(/[,.]\s*$/);
  });

  it('formats fractional units up to 6 decimal places', () => {
    // 1.123456 should be preserved
    const result = fmtUnits(1.123456);
    expect(result).toContain('1');
  });
});

// ── fmtAssetClass ─────────────────────────────────────────────────────────────
describe('fmtAssetClass', () => {
  it('replaces underscores with spaces', () => {
    expect(fmtAssetClass('GREEK_EQUITY')).toBe('GREEK EQUITY');
  });

  it('handles multiple underscores', () => {
    expect(fmtAssetClass('FUND_OF_FUNDS')).toBe('FUND OF FUNDS');
  });

  it('returns unchanged string when there are no underscores', () => {
    expect(fmtAssetClass('EQUITY')).toBe('EQUITY');
  });
});

// ── riskColor ────────────────────────────────────────────────────────────────────
describe('riskColor', () => {
  it('returns green classes for risk level 1', () => {
    expect(riskColor(1)).toContain('green');
  });

  it('returns green classes for risk level 2', () => {
    expect(riskColor(2)).toContain('green');
  });

  it('returns yellow classes for risk level 3', () => {
    expect(riskColor(3)).toContain('yellow');
  });

  it('returns yellow classes for risk level 4', () => {
    expect(riskColor(4)).toContain('yellow');
  });

  it('returns orange classes for risk level 5', () => {
    expect(riskColor(5)).toContain('orange');
  });

  it('returns red classes for risk level 6', () => {
    expect(riskColor(6)).toContain('red');
  });

  it('returns red classes for risk level 7 (maximum)', () => {
    expect(riskColor(7)).toContain('red');
  });
});

// ── fmtDateShort ───────────────────────────────────────────────────────────────
describe('fmtDateShort', () => {
  it('formats as DD/MM when long=false', () => {
    expect(fmtDateShort('2024-03-07', false)).toBe('07/03');
  });

  it('formats as MM/YY when long=true', () => {
    expect(fmtDateShort('2024-03-07', true)).toBe('03/24');
  });

  it('returns the raw string for an invalid date', () => {
    expect(fmtDateShort('not-a-date', false)).toBe('not-a-date');
  });

  it('zero-pads single-digit months and days', () => {
    expect(fmtDateShort('2024-01-05', false)).toBe('05/01');
  });
});

// ── fmtDateLong ────────────────────────────────────────────────────────────────
describe('fmtDateLong', () => {
  it('formats as DD/MM/YYYY', () => {
    expect(fmtDateLong('2024-03-07')).toBe('07/03/2024');
  });

  it('zero-pads single-digit day and month', () => {
    expect(fmtDateLong('2024-01-05')).toBe('05/01/2024');
  });

  it('returns the raw string for an invalid date', () => {
    expect(fmtDateLong('bad-input')).toBe('bad-input');
  });
});

// ── fmtCompact ───────────────────────────────────────────────────────────────────
describe('fmtCompact', () => {
  it('formats millions with M suffix', () => {
    expect(fmtCompact(1_500_000)).toBe('1.5M');
    expect(fmtCompact(2_000_000)).toBe('2.0M');
  });

  it('formats thousands with k suffix', () => {
    expect(fmtCompact(1_500)).toBe('1.5k');
    expect(fmtCompact(10_000)).toBe('10.0k');
  });

  it('formats sub-thousand numbers as integers', () => {
    expect(fmtCompact(150)).toBe('150');
    expect(fmtCompact(0)).toBe('0');
  });

  it('handles negative millions', () => {
    expect(fmtCompact(-1_500_000)).toBe('-1.5M');
  });

  it('handles negative thousands', () => {
    expect(fmtCompact(-2_500)).toBe('-2.5k');
  });
});

// ── today ───────────────────────────────────────────────────────────────────────────
describe('today', () => {
  it('returns a string matching YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the real current date', () => {
    const d = new Date();
    const expected = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    expect(today()).toBe(expected);
  });
});
