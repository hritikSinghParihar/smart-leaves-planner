import { formatDateISO, isWeekend, isHoliday } from './engine.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getMonthsInRange(startDate, endDate) {
  const months = [];
  let year = startDate.getFullYear();
  let month = startDate.getMonth();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return months;
}

function buildLeaveDaySet(planOpportunities, holidays, weekendPolicy) {
  const leaveDays = new Set();
  if (!planOpportunities) return leaveDays;

  for (const opp of planOpportunities) {
    let d = new Date(opp.startDate);
    while (d <= opp.endDate) {
      if (!isWeekend(d, weekendPolicy) && !isHoliday(d, holidays)) {
        leaveDays.add(formatDateISO(d));
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return leaveDays;
}

function buildPlannedDaySet(planOpportunities) {
  const planned = new Set();
  if (!planOpportunities) return planned;

  for (const opp of planOpportunities) {
    let d = new Date(opp.startDate);
    while (d <= opp.endDate) {
      planned.add(formatDateISO(d));
      d.setDate(d.getDate() + 1);
    }
  }
  return planned;
}

/**
 * Build month grid data for calendar rendering.
 * Each cell: { date, day, inMonth, isWeekend, isHoliday, holidayName, isLeave, isPlanned }
 */
export function buildMonthGrid(year, month, holidays, planOpportunities, weekendPolicy = 'standard') {
  const firstOfMonth = new Date(year, month, 1);
  const startPad = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const leaveDays = buildLeaveDaySet(planOpportunities, holidays, weekendPolicy);
  const plannedDays = buildPlannedDaySet(planOpportunities);

  const holidayMap = new Map(holidays.map(h => [h.date, h.name]));

  const cells = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
    const iso = formatDateISO(d);
    cells.push({
      date: d,
      day: d.getDate(),
      inMonth: false,
      isWeekend: isWeekend(d, weekendPolicy),
      isHoliday: isHoliday(d, holidays),
      holidayName: holidayMap.get(iso) || null,
      isLeave: leaveDays.has(iso),
      isPlanned: plannedDays.has(iso)
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const iso = formatDateISO(d);
    cells.push({
      date: d,
      day,
      inMonth: true,
      isWeekend: isWeekend(d, weekendPolicy),
      isHoliday: isHoliday(d, holidays),
      holidayName: holidayMap.get(iso) || null,
      isLeave: leaveDays.has(iso),
      isPlanned: plannedDays.has(iso)
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(year, month + 1, i);
    const iso = formatDateISO(d);
    cells.push({
      date: d,
      day: d.getDate(),
      inMonth: false,
      isWeekend: isWeekend(d, weekendPolicy),
      isHoliday: isHoliday(d, holidays),
      holidayName: holidayMap.get(iso) || null,
      isLeave: leaveDays.has(iso),
      isPlanned: plannedDays.has(iso)
    });
  }

  return { year, month, monthName: MONTH_NAMES[month], dayHeaders: DAY_HEADERS, cells };
}

export function buildCalendarData(startDate, endDate, holidays, planOpportunities, weekendPolicy) {
  const months = getMonthsInRange(startDate, endDate);
  return months.map(({ year, month }) =>
    buildMonthGrid(year, month, holidays, planOpportunities, weekendPolicy)
  );
}
