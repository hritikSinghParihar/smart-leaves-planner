import { formatDateISO } from './engine.js';

function formatICSDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeICS(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateICS(plan) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const events = plan.selectedOpportunities.map((opp, index) => {
    const uid = `smartleaves-${formatDateISO(opp.startDate)}-${index}@smartleaves.in`;
    const endExclusive = new Date(opp.endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const holidayNames = opp.holidaysIncluded.map(h => h.name).join(', ');

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatICSDate(opp.startDate)}`,
      `DTEND;VALUE=DATE:${formatICSDate(endExclusive)}`,
      `SUMMARY:${escapeICS(`Time Off — ${opp.totalDays} days`)}`,
      `DESCRIPTION:${escapeICS(`${opp.leaveDaysNeeded} leave day(s) needed. Holidays: ${holidayNames}`)}`,
      'END:VEVENT'
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart Leaves Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Smart Leaves Plan',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadICS(plan, filename = 'smart-leaves-plan.ics') {
  const content = generateICS(plan);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
