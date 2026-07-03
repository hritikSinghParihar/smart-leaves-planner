// Holiday data is sourced from data/holidays.json (canonical: date + name only).
// dayOfWeek is DERIVED from the date here so the two can never drift apart.
//
// Browser: call loadHolidayData() once at startup (fetches the JSON).
// Node/tests: import the JSON directly and call setHolidayData(raw).
//
// `holidayData` is a live binding — importers (e.g. engine.js) see updates
// made by setHolidayData()/loadHolidayData() without re-importing.

// Runtime store, populated by setHolidayData()/loadHolidayData().
export let holidayData = {};

/** Derive the day of week (0=Sun .. 6=Sat) from a YYYY-MM-DD string, at local midnight. */
export function deriveDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** Map raw {year: [{date, name}]} into {year: [{date, name, dayOfWeek}]}. */
export function enrichHolidays(raw) {
  const enriched = {};
  for (const year of Object.keys(raw)) {
    enriched[year] = (raw[year] || []).map(h => ({
      date: h.date,
      name: h.name,
      dayOfWeek: deriveDayOfWeek(h.date),
    }));
  }
  return enriched;
}

/** Populate the shared holidayData store from raw JSON. Returns the enriched map. */
export function setHolidayData(raw) {
  holidayData = enrichHolidays(raw);
  return holidayData;
}

/**
 * Fetch the canonical holiday JSON and populate holidayData.
 * Resolves the URL relative to this module so it works regardless of page path.
 */
export async function loadHolidayData(url = new URL('../data/holidays.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load holiday data (HTTP ${response.status})`);
  }
  const raw = await response.json();
  return setHolidayData(raw);
}
