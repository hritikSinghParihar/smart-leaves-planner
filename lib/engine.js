import { holidayData, loadHolidayData, setHolidayData } from './holidays.js';

export { holidayData, loadHolidayData, setHolidayData };

export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateShort(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getAvailableYears() {
  return Object.keys(holidayData).map(Number).sort((a, b) => a - b);
}

export function getLastAvailableDate() {
  const years = getAvailableYears();
  const lastYear = years[years.length - 1];
  return new Date(lastYear, 11, 31);
}

export function getAllHolidaysInRange(startDate, endDate) {
  const holidays = [];
  getAvailableYears().forEach(year => {
    (holidayData[year] || []).forEach(h => {
      const hDate = parseDate(h.date);
      if (hDate >= startDate && hDate <= endDate) {
        holidays.push(h);
      }
    });
  });
  return holidays;
}

export function extendRangeToWeekends(startDate, endDate, weekendPolicy = 'standard') {
  let start = new Date(startDate);
  let end = new Date(endDate);

  const startDay = start.getDay();
  if (startDay === 1) {
    if (weekendPolicy === 'saturday-working') {
      start = addDays(start, -1);
    } else {
      const prevSat = addDays(start, -2);
      start = isWeekend(prevSat, weekendPolicy) ? prevSat : addDays(start, -1);
    }
  }

  const endDay = end.getDay();
  if (endDay === 5) {
    end = addDays(end, 2);
  } else if (endDay >= 1 && endDay <= 4) {
    end = addDays(end, 7 - endDay);
  } else if (endDay === 6) {
    end = addDays(end, 1);
  }

  return { start, end };
}

export function getPeriodLabel(period) {
  if (period === 'next_12') return '(Next 12 Months)';
  const restMatch = period.match(/^rest_(\d{4})$/);
  if (restMatch) return `(Rest of ${restMatch[1]})`;
  if (/^\d{4}$/.test(period)) return `(${period})`;
  return '';
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDatesBetween(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  return dates;
}

export function getDayOfWeek(date) {
  return date.getDay();
}

function getSaturdayIndexInMonth(date) {
  let count = 0;
  const year = date.getFullYear();
  const month = date.getMonth();
  for (let d = 1; d <= date.getDate(); d++) {
    if (new Date(year, month, d).getDay() === 6) count++;
  }
  return count;
}

export function isWeekend(date, weekendPolicy = 'standard') {
  const day = date.getDay();
  if (day === 0) return true;
  if (day !== 6) return false;
  switch (weekendPolicy) {
    case 'saturday-working':
      return false;
    case 'alternate-saturdays':
      return getSaturdayIndexInMonth(date) === 2 || getSaturdayIndexInMonth(date) === 4;
    default:
      return true;
  }
}

export function applyHolidaySettings(baseHolidays, settings = {}) {
  const { addedHolidays = [], excludedDates = [] } = settings;
  const excluded = new Set(excludedDates);

  const holidays = baseHolidays
    .filter(h => !excluded.has(h.date))
    .map(h => ({ ...h }));

  for (const added of addedHolidays) {
    if (!holidays.some(h => h.date === added.date)) {
      const date = parseDate(added.date);
      holidays.push({
        date: added.date,
        name: added.name,
        dayOfWeek: getDayOfWeek(date),
        custom: true
      });
    }
  }

  holidays.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  return holidays;
}

export function isHoliday(date, holidays) {
  const dateStr = formatDateISO(date);
  return holidays.some(h => h.date === dateStr);
}

export function getHolidaysForPeriod(period, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let startDate, endDate, holidays = [];
  const lastAvailableDate = getLastAvailableDate();

  const restMatch = period.match(/^rest_(\d{4})$/);
  if (restMatch) {
    const year = parseInt(restMatch[1], 10);
    startDate = today;
    endDate = new Date(year, 11, 31);
    holidays = (holidayData[year] || []).filter(h => parseDate(h.date) >= startDate);
  } else if (period === 'next_12') {
    startDate = today;
    endDate = addDays(today, 365);
    holidays = getAllHolidaysInRange(startDate, endDate);
  } else if (/^\d{4}$/.test(period)) {
    const year = parseInt(period, 10);
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
    holidays = holidayData[year] || [];
  }

  const dataTruncated = endDate > lastAvailableDate;

  return { startDate, endDate, holidays, dataTruncated, lastAvailableDate };
}

export function calculateLeaveOpportunities(holidays, availableLeaves, preference, weekendPolicy = 'standard') {
  const opportunities = [];

  holidays.forEach((holiday, index) => {
    const holidayDate = parseDate(holiday.date);
    const dayOfWeek = holiday.dayOfWeek;

    let consecutiveHolidays = [holiday];
    for (let i = index + 1; i < holidays.length; i++) {
      const nextHoliday = holidays[i];
      const nextDate = parseDate(nextHoliday.date);
      const daysDiff = (nextDate - parseDate(consecutiveHolidays[consecutiveHolidays.length - 1].date)) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 5) {
        consecutiveHolidays.push(nextHoliday);
      } else {
        break;
      }
    }

    if (consecutiveHolidays.length > 1) {
      const firstDate = parseDate(consecutiveHolidays[0].date);
      const lastDate = parseDate(consecutiveHolidays[consecutiveHolidays.length - 1].date);

      const extended = extendRangeToWeekends(firstDate, lastDate, weekendPolicy);
      const startDate = extended.start;
      const endDate = extended.end;

      const allDates = getDatesBetween(startDate, endDate);
      const leaveDaysNeeded = allDates.filter(d => !isWeekend(d, weekendPolicy) && !isHoliday(d, holidays)).length;
      const totalDays = allDates.length;

      if (leaveDaysNeeded <= availableLeaves) {
        opportunities.push({
          startDate,
          endDate,
          totalDays,
          leaveDaysNeeded,
          holidaysIncluded: consecutiveHolidays,
          efficiency: totalDays / (leaveDaysNeeded || 1),
          type: totalDays >= 7 ? 'long' : 'weekend'
        });
      }
    }

    if (dayOfWeek === 5) {
      const startDate = new Date(holidayDate);
      const endDate = addDays(holidayDate, 2);
      opportunities.push({
        startDate,
        endDate,
        totalDays: 3,
        leaveDaysNeeded: 0,
        holidaysIncluded: [holiday],
        efficiency: Infinity,
        type: 'weekend'
      });
      if (availableLeaves >= 1) {
        opportunities.push({
          startDate: addDays(holidayDate, -1),
          endDate: addDays(holidayDate, 2),
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
        opportunities.push({
          startDate: new Date(holidayDate),
          endDate: addDays(holidayDate, 3),
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
      }
      if (availableLeaves >= 2) {
        opportunities.push({
          startDate: addDays(holidayDate, -1),
          endDate: addDays(holidayDate, 3),
          totalDays: 5,
          leaveDaysNeeded: 2,
          holidaysIncluded: [holiday],
          efficiency: 2.5,
          type: 'weekend'
        });
      }
    } else if (dayOfWeek === 1) {
      const startDate = addDays(holidayDate, -2);
      const endDate = new Date(holidayDate);
      opportunities.push({
        startDate,
        endDate,
        totalDays: 3,
        leaveDaysNeeded: 0,
        holidaysIncluded: [holiday],
        efficiency: Infinity,
        type: 'weekend'
      });
      if (availableLeaves >= 1) {
        opportunities.push({
          startDate: addDays(holidayDate, -3),
          endDate: new Date(holidayDate),
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
        opportunities.push({
          startDate: addDays(holidayDate, -2),
          endDate: addDays(holidayDate, 1),
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
      }
      if (availableLeaves >= 2) {
        opportunities.push({
          startDate: addDays(holidayDate, -3),
          endDate: addDays(holidayDate, 1),
          totalDays: 5,
          leaveDaysNeeded: 2,
          holidaysIncluded: [holiday],
          efficiency: 2.5,
          type: 'weekend'
        });
      }
    } else if (dayOfWeek === 4) {
      if (availableLeaves >= 1) {
        const startDate = new Date(holidayDate);
        const endDate = addDays(holidayDate, 3);
        opportunities.push({
          startDate,
          endDate,
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
      }
    } else if (dayOfWeek === 2) {
      if (availableLeaves >= 1) {
        const startDate = addDays(holidayDate, -3);
        const endDate = new Date(holidayDate);
        opportunities.push({
          startDate,
          endDate,
          totalDays: 4,
          leaveDaysNeeded: 1,
          holidaysIncluded: [holiday],
          efficiency: 4,
          type: 'weekend'
        });
      }
    } else if (dayOfWeek === 3) {
      if (availableLeaves >= 2) {
        const startDate = addDays(holidayDate, -4);
        const endDate = new Date(holidayDate);
        opportunities.push({
          startDate,
          endDate,
          totalDays: 5,
          leaveDaysNeeded: 2,
          holidaysIncluded: [holiday],
          efficiency: 2.5,
          type: 'weekend'
        });
      }
      if (availableLeaves >= 2) {
        const startDate = new Date(holidayDate);
        const endDate = addDays(holidayDate, 4);
        opportunities.push({
          startDate,
          endDate,
          totalDays: 5,
          leaveDaysNeeded: 2,
          holidaysIncluded: [holiday],
          efficiency: 2.5,
          type: 'weekend'
        });
      }
    }
  });

  const uniqueOpportunities = [];
  const seen = new Set();

  opportunities.forEach(opp => {
    const key = `${formatDateISO(opp.startDate)}-${formatDateISO(opp.endDate)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueOpportunities.push(opp);
    }
  });

  return uniqueOpportunities;
}

export function opportunityKey(opp) {
  return `${formatDateISO(opp.startDate)}-${formatDateISO(opp.endDate)}`;
}

function sortOpportunitiesForPreference(opportunities, preference) {
  if (preference === 'long') {
    return [...opportunities].sort((a, b) => b.totalDays - a.totalDays);
  }
  if (preference === 'trips') {
    return [...opportunities].sort((a, b) => b.efficiency - a.efficiency);
  }
  return [...opportunities].sort((a, b) => {
    const scoreA = a.totalDays * 0.6 + a.efficiency * 0.4;
    const scoreB = b.totalDays * 0.6 + b.efficiency * 0.4;
    return scoreB - scoreA;
  });
}

function opportunitiesOverlap(a, b) {
  return !(a.endDate < b.startDate || a.startDate > b.endDate);
}

export function selectOptimalPlan(opportunities, availableLeaves, preference, options = {}) {
  const { locked = [], excludedKeys = [] } = options;
  const excludedSet = new Set(excludedKeys);
  const lockedKeys = new Set(locked.map(opportunityKey));

  const pool = opportunities.filter(opp => {
    const key = opportunityKey(opp);
    return !excludedSet.has(key) && !lockedKeys.has(key);
  });

  let selectedOpportunities = [...locked];
  let remainingLeaves = availableLeaves - locked.reduce((sum, opp) => sum + opp.leaveDaysNeeded, 0);

  const sortedOpportunities = sortOpportunitiesForPreference(pool, preference);

  sortedOpportunities.forEach(opp => {
    if (opp.leaveDaysNeeded <= remainingLeaves) {
      const hasOverlap = selectedOpportunities.some(selected => opportunitiesOverlap(opp, selected));
      if (!hasOverlap) {
        selectedOpportunities.push(opp);
        remainingLeaves -= opp.leaveDaysNeeded;
      }
    }
  });

  selectedOpportunities.sort((a, b) => a.startDate - b.startDate);

  return {
    selectedOpportunities,
    totalLeavesUsed: availableLeaves - remainingLeaves,
    totalDaysOff: selectedOpportunities.reduce((sum, opp) => sum + opp.totalDays, 0),
    remainingLeaves
  };
}

export function generateAlternativePlans(opportunities, availableLeaves, preference, maxPlans = 3) {
  const strategies = [preference, 'long', 'trips', 'balanced'].filter(
    (s, i, arr) => arr.indexOf(s) === i
  );
  const plans = [];
  const seen = new Set();

  for (const strategy of strategies) {
    if (plans.length >= maxPlans) break;
    const plan = selectOptimalPlan(opportunities, availableLeaves, strategy);
    const key = plan.selectedOpportunities.map(opportunityKey).join('|');
    if (!seen.has(key) && plan.selectedOpportunities.length > 0) {
      seen.add(key);
      plans.push({ ...plan, strategy });
    }
  }

  return plans;
}

export function sortOpportunities(opportunities, sortType) {
  const sorted = [...opportunities];

  switch (sortType) {
    case 'date':
      sorted.sort((a, b) => a.startDate - b.startDate);
      break;
    case 'value': {
      const requiresLeaves = sorted.filter(opp => opp.leaveDaysNeeded > 0);
      const noLeaves = sorted.filter(opp => opp.leaveDaysNeeded === 0);
      requiresLeaves.sort((a, b) => b.efficiency - a.efficiency);
      noLeaves.sort((a, b) => b.totalDays - a.totalDays);
      return [...requiresLeaves, ...noLeaves];
    }
    case 'duration':
      sorted.sort((a, b) => b.totalDays - a.totalDays);
      break;
    case 'leaves':
      sorted.sort((a, b) => a.leaveDaysNeeded - b.leaveDaysNeeded);
      break;
  }

  return sorted;
}

/** Count leave days for a bridge range — used by regression tests. */
export function countBridgeLeaves(startDate, endDate, holidays, weekendPolicy = 'standard') {
  const allDates = getDatesBetween(startDate, endDate);
  return allDates.filter(d => !isWeekend(d, weekendPolicy) && !isHoliday(d, holidays)).length;
}
