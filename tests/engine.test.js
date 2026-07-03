import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { holidayData, setHolidayData, deriveDayOfWeek } from '../lib/holidays.js';
import rawHolidays from '../data/holidays.json';
import {
  parseDate,
  formatDateISO,
  isHoliday,
  isWeekend,
  extendRangeToWeekends,
  getHolidaysForPeriod,
  getPeriodLabel,
  getLastAvailableDate,
  calculateLeaveOpportunities,
  selectOptimalPlan,
  sortOpportunities,
  countBridgeLeaves,
  applyHolidaySettings,
  opportunityKey,
  generateAlternativePlans,
} from '../lib/engine.js';

// Populate the shared holiday store from the canonical JSON before any
// describe block reads holidayData at collection time.
setHolidayData(rawHolidays);

function referenceToday() {
  return parseDate('2026-07-03');
}

/** Previous buggy implementation — must stay broken in positive-offset TZs. */
function brokenUtcDateKey(date) {
  return date.toISOString().split('T')[0];
}

describe('formatDateISO / isHoliday (P1.2 timezone regression)', () => {
  const holidays2026 = holidayData[2026];

  it('formatDateISO preserves local calendar date for parseDate input', () => {
    expect(formatDateISO(parseDate('2026-03-21'))).toBe('2026-03-21');
    expect(formatDateISO(parseDate('2026-08-15'))).toBe('2026-08-15');
  });

  it('isHoliday matches holidays on local-midnight dates', () => {
    const ramzan = parseDate('2026-03-21');
    expect(isHoliday(ramzan, holidays2026)).toBe(true);
  });

  it('does not rely on toISOString for date keys', () => {
    const date = parseDate('2026-03-21');
    const utcKey = brokenUtcDateKey(date);
    if (utcKey !== '2026-03-21') {
      expect(isHoliday(date, holidays2026)).toBe(true);
      expect(holidays2026.some(h => h.date === utcKey)).toBe(false);
    }
  });

  describe.each([
    ['Asia/Kolkata', '2026-03-21'],
    ['America/New_York', '2026-03-21'],
    ['Europe/London', '2026-03-21'],
    ['Pacific/Auckland', '2026-03-21'],
  ])('TZ=%s', (tz, expectedDate) => {
    const originalTz = process.env.TZ;

    beforeEach(() => {
      process.env.TZ = tz;
    });

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it(`isHoliday(${expectedDate}) is true regardless of host timezone`, () => {
      const date = parseDate(expectedDate);
      expect(formatDateISO(date)).toBe(expectedDate);
      expect(isHoliday(date, holidays2026)).toBe(true);
    });
  });
});

describe('extendRangeToWeekends (P1.3 bridge regression)', () => {
  it('does not extend backwards from a Saturday holiday (Ramzan Id 2026)', () => {
    const first = parseDate('2026-03-21');
    const last = parseDate('2026-03-31');
    const { start } = extendRangeToWeekends(first, last);

    expect(start.getDate()).toBe(21);
    expect(start.getMonth()).toBe(2);
    expect(start.getDay()).toBe(6);
  });

  it('includes previous weekend when bridge starts on Monday', () => {
    const monday = parseDate('2026-01-26'); // Republic Day, Monday
    const { start } = extendRangeToWeekends(monday, monday);

    expect(start.getDay()).toBe(6);
    expect(start.getDate()).toBe(24);
  });

  it('extends Friday end through Sunday', () => {
    const friday = parseDate('2026-04-03');
    const { end } = extendRangeToWeekends(friday, friday);

    expect(end.getDay()).toBe(0);
    expect(end.getDate()).toBe(5);
  });
});

describe('calculateLeaveOpportunities bridge leave counts (P1.3)', () => {
  const holidays2026 = holidayData[2026];

  it('Mar 28–Apr 5 window needs exactly 3 leave days (P1.2 + P1.3 regression)', () => {
    const start = parseDate('2026-03-28');
    const end = parseDate('2026-04-05');
    expect(countBridgeLeaves(start, end, holidays2026)).toBe(3);
  });

  it('broken UTC date keys would over-count leaves in the same window', () => {
    const start = parseDate('2026-03-28');
    const end = parseDate('2026-04-05');
    const allDates = [];
    let d = new Date(start);
    while (d <= end) {
      allDates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    const brokenCount = allDates.filter(day => {
      const dow = day.getDay();
      if (dow === 0 || dow === 6) return false;
      const key = day.toISOString().split('T')[0];
      return !holidays2026.some(h => h.date === key);
    }).length;

    const fixedCount = countBridgeLeaves(start, end, holidays2026);
    expect(fixedCount).toBe(3);
    if (brokenCount !== fixedCount) {
      expect(brokenCount).toBeGreaterThan(fixedCount);
    }
  });

  it('Ramzan Id cluster bridge starts on the holiday (Mar 21), not a week earlier', () => {
    const opportunities = calculateLeaveOpportunities(holidays2026, 20, 'balanced');
    const ramzanBridge = opportunities.find(
      opp =>
        opp.holidaysIncluded.some(h => h.name === 'Ramzan Id') &&
        opp.holidaysIncluded.some(h => h.name === 'Good Friday')
    );

    expect(ramzanBridge).toBeDefined();
    expect(formatDateISO(ramzanBridge.startDate)).toBe('2026-03-21');
  });

  it('countBridgeLeaves agrees with opportunity leaveDaysNeeded', () => {
    const opportunities = calculateLeaveOpportunities(holidays2026, 20, 'balanced');
    const bridge = opportunities.find(opp => opp.leaveDaysNeeded >= 3);

    expect(bridge).toBeDefined();
    expect(
      countBridgeLeaves(bridge.startDate, bridge.endDate, holidays2026)
    ).toBe(bridge.leaveDaysNeeded);
  });
});

describe('getHolidaysForPeriod (P1.1 / P1.5)', () => {
  it('returns full 2026 calendar when period is 2026', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    expect(holidays).toHaveLength(holidayData[2026].length);
  });

  it('next_12 starts from reference today', () => {
    const { startDate } = getHolidaysForPeriod('next_12', referenceToday());
    expect(formatDateISO(startDate)).toBe('2026-07-03');
  });

  it('flags dataTruncated when window extends past 2028', () => {
    const nearEnd = new Date(2028, 6, 1);
    const { dataTruncated, lastAvailableDate } = getHolidaysForPeriod('next_12', nearEnd);

    expect(dataTruncated).toBe(true);
    expect(formatDateISO(lastAvailableDate)).toBe('2028-12-31');
  });

  it('does not flag truncation for a full in-range year', () => {
    const { dataTruncated } = getHolidaysForPeriod('2027', referenceToday());
    expect(dataTruncated).toBe(false);
  });
});

describe('getPeriodLabel', () => {
  it('formats known period keys', () => {
    expect(getPeriodLabel('2026')).toBe('(2026)');
    expect(getPeriodLabel('rest_2026')).toBe('(Rest of 2026)');
    expect(getPeriodLabel('next_12')).toBe('(Next 12 Months)');
  });
});

describe('isWeekend', () => {
  it('identifies Saturday and Sunday (standard policy)', () => {
    expect(isWeekend(new Date(2026, 0, 3))).toBe(true);
    expect(isWeekend(new Date(2026, 0, 5))).toBe(false);
  });

  it('treats Saturday as working day with saturday-working policy', () => {
    const saturday = new Date(2026, 0, 3);
    expect(isWeekend(saturday, 'saturday-working')).toBe(false);
    expect(isWeekend(new Date(2026, 0, 4), 'saturday-working')).toBe(true);
  });

  it('only 2nd and 4th Saturdays off with alternate-saturdays policy', () => {
    // Jan 2026: 2nd Sat = 10th, 4th Sat = 24th
    expect(isWeekend(new Date(2026, 0, 10), 'alternate-saturdays')).toBe(true);
    expect(isWeekend(new Date(2026, 0, 24), 'alternate-saturdays')).toBe(true);
    expect(isWeekend(new Date(2026, 0, 3), 'alternate-saturdays')).toBe(false);
    expect(isWeekend(new Date(2026, 0, 17), 'alternate-saturdays')).toBe(false);
  });
});

describe('applyHolidaySettings (P2.1)', () => {
  const base = holidayData[2026].slice(0, 3);

  it('adds custom holidays', () => {
    const result = applyHolidaySettings(base, {
      addedHolidays: [{ date: '2026-06-15', name: 'Company Day Off' }]
    });
    expect(result.some(h => h.name === 'Company Day Off')).toBe(true);
    expect(result.some(h => h.date === '2026-06-15')).toBe(true);
  });

  it('excludes national holidays', () => {
    const result = applyHolidaySettings(base, {
      excludedDates: ['2026-01-26']
    });
    expect(result.some(h => h.date === '2026-01-26')).toBe(false);
  });

  it('sorts holidays by date', () => {
    const result = applyHolidaySettings(base, {
      addedHolidays: [{ date: '2026-12-01', name: 'Year End' }]
    });
    for (let i = 1; i < result.length; i++) {
      expect(parseDate(result[i].date) >= parseDate(result[i - 1].date)).toBe(true);
    }
  });
});

describe('selectOptimalPlan', () => {
  it('never exceeds available leaves', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    const opportunities = calculateLeaveOpportunities(holidays, 10, 'balanced');
    const plan = selectOptimalPlan(opportunities, 10, 'balanced');

    expect(plan.totalLeavesUsed).toBeLessThanOrEqual(10);
  });

  it('uses zero leaves when none available', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    const opportunities = calculateLeaveOpportunities(holidays, 0, 'balanced');
    const plan = selectOptimalPlan(opportunities, 0, 'balanced');

    expect(plan.totalLeavesUsed).toBe(0);
  });
});

describe('getLastAvailableDate', () => {
  it('covers 2028 holiday data', () => {
    expect(formatDateISO(getLastAvailableDate())).toBe('2028-12-31');
  });
});

describe('Friday/Monday extension options (P2.3)', () => {
  it('offers 4-day extensions for Friday holidays', () => {
    const fridayHoliday = [{
      date: '2026-04-03',
      name: 'Good Friday',
      dayOfWeek: 5
    }];
    const opps = calculateLeaveOpportunities(fridayHoliday, 5, 'balanced');
    const fourDay = opps.filter(o => o.totalDays === 4 && o.leaveDaysNeeded === 1);
    expect(fourDay.length).toBeGreaterThanOrEqual(2);
  });

  it('offers 5-day extension for Friday holidays with 2 leaves', () => {
    const fridayHoliday = [{
      date: '2026-04-03',
      name: 'Good Friday',
      dayOfWeek: 5
    }];
    const opps = calculateLeaveOpportunities(fridayHoliday, 5, 'balanced');
    const fiveDay = opps.find(o => o.totalDays === 5 && o.leaveDaysNeeded === 2);
    expect(fiveDay).toBeDefined();
  });

  it('offers 4-day extensions for Monday holidays', () => {
    const mondayHoliday = [{
      date: '2026-01-26',
      name: 'Republic Day',
      dayOfWeek: 1
    }];
    const opps = calculateLeaveOpportunities(mondayHoliday, 5, 'balanced');
    const fourDay = opps.filter(o => o.totalDays === 4 && o.leaveDaysNeeded === 1);
    expect(fourDay.length).toBeGreaterThanOrEqual(2);
  });
});

describe('sortOpportunities best value (U7)', () => {
  it('sorts zero-leave items by duration descending', () => {
    const opps = [
      { startDate: parseDate('2026-01-01'), endDate: parseDate('2026-01-03'), leaveDaysNeeded: 0, totalDays: 3, efficiency: Infinity },
      { startDate: parseDate('2026-04-01'), endDate: parseDate('2026-04-05'), leaveDaysNeeded: 0, totalDays: 5, efficiency: Infinity },
      { startDate: parseDate('2026-06-01'), endDate: parseDate('2026-06-05'), leaveDaysNeeded: 2, totalDays: 5, efficiency: 2.5 },
    ];
    const sorted = sortOpportunities(opps, 'value');
    expect(sorted[0].leaveDaysNeeded).toBeGreaterThan(0);
    expect(sorted[1].totalDays).toBe(5);
    expect(sorted[2].totalDays).toBe(3);
  });
});

describe('alternative plans and lock/exclude (P2.5)', () => {
  it('generates multiple alternative plans when strategies differ', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    const opportunities = calculateLeaveOpportunities(holidays, 15, 'balanced');
    const alternatives = generateAlternativePlans(opportunities, 15, 'balanced', 3);
    expect(alternatives.length).toBeGreaterThanOrEqual(1);
    alternatives.forEach(plan => {
      expect(plan.totalLeavesUsed).toBeLessThanOrEqual(15);
    });
  });

  it('respects locked opportunities when re-optimizing', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    const opportunities = calculateLeaveOpportunities(holidays, 10, 'balanced');
    const basePlan = selectOptimalPlan(opportunities, 10, 'balanced');
    if (basePlan.selectedOpportunities.length === 0) return;

    const locked = [basePlan.selectedOpportunities[0]];
    const plan = selectOptimalPlan(opportunities, 10, 'balanced', { locked });
    expect(plan.selectedOpportunities.some(o =>
      opportunityKey(o) === opportunityKey(locked[0])
    )).toBe(true);
  });

  it('excludes opportunities from selection', () => {
    const { holidays } = getHolidaysForPeriod('2026', referenceToday());
    const opportunities = calculateLeaveOpportunities(holidays, 15, 'balanced');
    const basePlan = selectOptimalPlan(opportunities, 15, 'balanced');
    if (basePlan.selectedOpportunities.length === 0) return;

    const excludeKey = opportunityKey(basePlan.selectedOpportunities[0]);
    const plan = selectOptimalPlan(opportunities, 15, 'balanced', {
      excludedKeys: [excludeKey]
    });
    expect(plan.selectedOpportunities.some(o => opportunityKey(o) === excludeKey)).toBe(false);
  });
});

describe('holiday data source (P2.6)', () => {
  it('derives dayOfWeek consistent with the date for every holiday', () => {
    for (const year of Object.keys(holidayData)) {
      for (const h of holidayData[year]) {
        expect(h.dayOfWeek).toBe(deriveDayOfWeek(h.date));
        expect(parseDate(h.date).getDay()).toBe(h.dayOfWeek);
      }
    }
  });

  it('canonical JSON contains only date and name (no hardcoded dayOfWeek)', () => {
    for (const year of Object.keys(rawHolidays)) {
      for (const h of rawHolidays[year]) {
        expect(Object.keys(h).sort()).toEqual(['date', 'name']);
      }
    }
  });

  it('exposes the expected years', () => {
    expect(Object.keys(holidayData).map(Number).sort((a, b) => a - b))
      .toEqual([2025, 2026, 2027, 2028]);
  });
});
