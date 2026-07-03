import { describe, it, expect } from 'vitest';
import { parseDate } from '../lib/engine.js';
import { buildMonthGrid, buildCalendarData, getMonthsInRange } from '../lib/calendar.js';
import { holidayData, setHolidayData } from '../lib/holidays.js';
import rawHolidays from '../data/holidays.json';

setHolidayData(rawHolidays);

describe('calendar view (P2.4)', () => {
  const holidays2026 = holidayData[2026];

  it('getMonthsInRange spans multiple months', () => {
    const start = parseDate('2026-01-15');
    const end = parseDate('2026-03-10');
    const months = getMonthsInRange(start, end);
    expect(months).toHaveLength(3);
    expect(months[0]).toEqual({ year: 2026, month: 0 });
    expect(months[2]).toEqual({ year: 2026, month: 2 });
  });

  it('buildMonthGrid marks holidays and weekends', () => {
    const grid = buildMonthGrid(2026, 0, holidays2026, [], 'standard');
    const republicDay = grid.cells.find(c => c.inMonth && c.day === 26);
    expect(republicDay).toBeDefined();
    expect(republicDay.isHoliday).toBe(true);
    expect(republicDay.holidayName).toBe('Republic Day');
  });

  it('buildCalendarData marks planned leave days', () => {
    const opp = {
      startDate: parseDate('2026-01-22'),
      endDate: parseDate('2026-01-26'),
      holidaysIncluded: [{ date: '2026-01-26', name: 'Republic Day' }]
    };
    const start = parseDate('2026-01-01');
    const end = parseDate('2026-01-31');
    const months = buildCalendarData(start, end, holidays2026, [opp], 'standard');

    const jan = months[0];
    const thu22 = jan.cells.find(c => c.inMonth && c.day === 22);
    const mon26 = jan.cells.find(c => c.inMonth && c.day === 26);

    expect(thu22.isLeave).toBe(true);
    expect(mon26.isHoliday).toBe(true);
    expect(mon26.isLeave).toBe(false);
  });
});
