import {
  parseDate,
  formatDate,
  formatDateISO,
  getAvailableYears,
  getPeriodLabel,
  addDays,
  getDatesBetween,
  isWeekend,
  isHoliday,
  getHolidaysForPeriod,
  calculateLeaveOpportunities,
  selectOptimalPlan,
  sortOpportunities,
  applyHolidaySettings,
  opportunityKey,
  generateAlternativePlans,
  loadHolidayData
} from './lib/engine.js';
import { downloadICS, generateICS } from './lib/ics.js';
import { buildShareURL, parseShareURL, sharePlan } from './lib/share.js';
import { buildCalendarData } from './lib/calendar.js';

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const tips = [
  "Book flights and hotels at least 2-3 months in advance for popular holiday periods",
  "Friday holidays are golden - they give you automatic 3-day weekends",
  "Thursday/Tuesday holidays need just 1 leave for 4-day weekends",
  "Combining consecutive holidays can give you week-long vacations with minimal leaves",
  "Plan international trips during longer breaks, domestic trips for long weekends",
  "Check if your office gives Saturday offs - this can double your long weekends",
  "Monsoon season (June-Sep) offers cheaper travel deals",
  "Popular destinations get crowded during Diwali and Dussehra - book early!"
];

// Global state
let currentPlan = null;
let allOpportunities = [];
let lockedOpportunities = [];
let excludedKeys = new Set();
let alternativePlans = [];
let selectedAlternativeIndex = 0;
let currentSortType = 'date';
let isDarkMode = false;
let userPreferences = {
  theme: 'light',
  sortPreference: 'date',
  lastCalculation: null
};

let companySettings = {
  weekendPolicy: 'standard',
  addedHolidays: [],
  excludedDates: []
};

// DOM Elements
const form = document.getElementById('holidayForm');
const resultsSection = document.getElementById('resultsSection');
const inputSection = document.getElementById('inputSection');
const loadingSkeleton = document.getElementById('loadingSkeleton');
const themeToggle = document.getElementById('themeToggle');
const generateBtn = document.getElementById('generateBtn');
const totalDaysOffEl = document.getElementById('totalDaysOff');
const leaveDaysUsedEl = document.getElementById('leaveDaysUsed');
const leaveRemainingEl = document.getElementById('leaveRemaining');
const leavePlanList = document.getElementById('leavePlanList');
const allHolidaysList = document.getElementById('allHolidaysList');
const holidayYearEl = document.getElementById('holidayYear');
const tipsList = document.getElementById('tipsList');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const shareBtn = document.getElementById('shareBtn');
const savePdfBtn = document.getElementById('savePdfBtn');
const printMetaEl = document.getElementById('printMeta');
const holidaysToggle = document.getElementById('holidaysToggle');
const holidaysContent = document.getElementById('holidaysContent');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const modalCopyBtn = document.getElementById('modalCopyBtn');
const modalDownloadIcsBtn = document.getElementById('modalDownloadIcsBtn');
const modalShareBtn = document.getElementById('modalShareBtn');
const sortControls = document.getElementById('sortControls');
const sortButtons = document.querySelectorAll('.sort-btn');
const downloadIcsBtn = document.getElementById('downloadIcsBtn');
const companySettingsToggle = document.getElementById('companySettingsToggle');
const companySettingsPanel = document.getElementById('companySettingsPanel');
const weekendPolicySelect = document.getElementById('weekendPolicy');
const customHolidayDate = document.getElementById('customHolidayDate');
const customHolidayName = document.getElementById('customHolidayName');
const addCustomHolidayBtn = document.getElementById('addCustomHolidayBtn');
const customHolidayList = document.getElementById('customHolidayList');
const excludedHolidaysList = document.getElementById('excludedHolidaysList');
const alternativePlansEl = document.getElementById('alternativePlans');
const alternativePlanTabs = document.getElementById('alternativePlanTabs');
const calendarView = document.getElementById('calendarView');
const ariaLiveRegion = document.getElementById('ariaLiveRegion');
const excludedBreaksPanel = document.getElementById('excludedBreaksPanel');

let modalPreviousFocus = null;

// Event Listeners
form.addEventListener('submit', handleFormSubmit);
resetBtn.addEventListener('click', handleReset);
exportBtn.addEventListener('click', handleExport);
shareBtn.addEventListener('click', handleWebShare);
if (savePdfBtn) savePdfBtn.addEventListener('click', handleSavePdf);
holidaysToggle.addEventListener('click', toggleHolidays);
modalClose.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);
modalCopyBtn.addEventListener('click', copyToClipboard);
if (modalDownloadIcsBtn) modalDownloadIcsBtn.addEventListener('click', handleDownloadICS);
if (modalShareBtn) modalShareBtn.addEventListener('click', handleWebShare);
if (downloadIcsBtn) downloadIcsBtn.addEventListener('click', handleDownloadICS);
themeToggle.addEventListener('click', toggleTheme);

if (companySettingsToggle) {
  companySettingsToggle.addEventListener('click', toggleCompanySettings);
}
if (addCustomHolidayBtn) {
  addCustomHolidayBtn.addEventListener('click', handleAddCustomHoliday);
}
if (weekendPolicySelect) {
  weekendPolicySelect.addEventListener('change', handleWeekendPolicyChange);
}

// Sort button listeners
sortButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const sortType = btn.getAttribute('data-sort');
    handleSortChange(sortType);
  });
});

// Initialize
document.addEventListener('DOMContentLoaded', initializeApp);

// DOM helpers (S2 — safe DOM APIs, no innerHTML for dynamic content)
function clearElement(el) {
  el.replaceChildren();
}

function createEmptyMessage(text) {
  const p = document.createElement('p');
  p.className = 'empty-message';
  p.textContent = text;
  return p;
}

function createBadge(className, text) {
  const span = document.createElement('span');
  span.className = `badge ${className}`;
  span.textContent = text;
  return span;
}

function createVisualBarSegment(className, flex, title, label) {
  const seg = document.createElement('div');
  seg.className = `visual-bar-segment ${className}`;
  seg.style.flex = String(flex);
  seg.title = title;
  seg.textContent = label;
  return seg;
}

// Sort Functions
function handleSortChange(sortType) {
  if (!currentPlan || sortType === currentSortType) return;
  
  currentSortType = sortType;
  userPreferences.sortPreference = sortType;
  savePreference('sortPreference', sortType);
  
  // Update active button
  sortButtons.forEach(btn => {
    const isActive = btn.getAttribute('data-sort') === sortType;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
  
  // Sort and re-render
  sortAndDisplayResults(currentPlan, sortType);
  showNotification(`Sorted by ${getSortLabel(sortType)}`, 'success');
}

function getSortLabel(sortType) {
  const labels = {
    'date': 'Date',
    'value': 'Best Value',
    'duration': 'Long Holidays',
    'leaves': 'Least Leaves'
  };
  return labels[sortType] || 'Date';
}

function sortAndDisplayResults(plan, sortType) {
  // Add fade out animation
  leavePlanList.style.opacity = '0';
  leavePlanList.style.transform = 'translateY(-10px)';
  
  setTimeout(() => {
    // Sort opportunities
    const sortedOpportunities = sortOpportunities(plan.selectedOpportunities, sortType);
    
    // Clear and re-render
    clearElement(leavePlanList);
    sortedOpportunities.forEach((opp, index) => {
      const item = createLeavePlanItem(opp, index, plan.availableLeaves);
      leavePlanList.appendChild(item);
    });
    
    // Fade in
    setTimeout(() => {
      leavePlanList.style.opacity = '1';
      leavePlanList.style.transform = 'translateY(0)';
    }, 50);
  }, 200);
}

function populatePeriodDropdown() {
  const select = document.getElementById('planningPeriod');
  if (!select) return;

  const today = new Date();
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentYear = todayNormalized.getFullYear();
  const currentMonth = todayNormalized.getMonth();
  const years = getAvailableYears();

  select.replaceChildren();

  if (currentMonth < 10) {
    const restOpt = document.createElement('option');
    restOpt.value = `rest_${currentYear}`;
    restOpt.textContent = `Rest of ${currentYear}`;
    select.appendChild(restOpt);
  }

  years.forEach(year => {
    if (year >= currentYear) {
      const opt = document.createElement('option');
      opt.value = String(year);
      opt.textContent = String(year);
      select.appendChild(opt);
    }
  });

  const next12Opt = document.createElement('option');
  next12Opt.value = 'next_12';
  next12Opt.textContent = 'Next 12 months';
  select.appendChild(next12Opt);

  if (years.includes(currentYear)) {
    select.value = String(currentYear);
  } else {
    const nextYear = years.find(y => y > currentYear);
    select.value = nextYear ? String(nextYear) : 'next_12';
  }
}

function handleFormSubmit(e) {
  e.preventDefault();

  const leaveDaysInput = document.getElementById('leaveDays');
  const leaveDays = parseInt(leaveDaysInput.value);

  // Form validation
  if (isNaN(leaveDays) || leaveDays < 0 || leaveDays > 50) {
    showNotification('Please enter a valid number of leave days (0-50)', 'error');
    leaveDaysInput.focus();
    return;
  }

  const planningPeriod = document.getElementById('planningPeriod').value;
  const preference = document.querySelector('input[name="preference"]:checked').value;

  try {
    // Show loading state
    showLoadingState();

    // Simulate calculation delay for better UX
    setTimeout(() => {
      try {
        // Get holidays for selected period
        const { startDate, endDate, holidays: baseHolidays, dataTruncated, lastAvailableDate } = getHolidaysForPeriod(planningPeriod);
        const holidays = applyHolidaySettings(baseHolidays, companySettings);

        const opportunities = calculateLeaveOpportunities(holidays, leaveDays, preference, companySettings.weekendPolicy);

        allOpportunities = opportunities;
        lockedOpportunities = [];
        excludedKeys = new Set();
        alternativePlans = generateAlternativePlans(opportunities, leaveDays, preference);

        currentPlan = selectOptimalPlan(opportunities, leaveDays, preference);
        currentPlan.holidays = holidays;
        currentPlan.period = planningPeriod;
        currentPlan.availableLeaves = leaveDays;
        currentPlan.preference = preference;
        currentPlan.dataTruncated = dataTruncated;
        currentPlan.lastAvailableDate = lastAvailableDate;
        currentPlan.startDate = startDate;
        currentPlan.endDate = endDate;
        selectedAlternativeIndex = 0;

        userPreferences.lastCalculation = {
          leaveDays,
          planningPeriod,
          preference,
          weekendPolicy: companySettings.weekendPolicy,
          timestamp: new Date().toISOString()
        };

        // Display results
        hideLoadingState();
        displayResults(currentPlan);

        // Scroll to results smoothly
        setTimeout(() => {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        if (dataTruncated) {
          showNotification(
            `Holiday data only available through ${formatDate(lastAvailableDate)}. Some dates in your window may be missing.`,
            'warning'
          );
        } else {
          showNotification('Holiday plan generated successfully!', 'success');
        }
      } catch (error) {
        hideLoadingState();
        showNotification('Error calculating holiday plan. Please try again.', 'error');
        console.error('Calculation error:', error);
      }
    }, 1200);
  } catch (error) {
    hideLoadingState();
    showNotification('An unexpected error occurred. Please try again.', 'error');
    console.error('Form submission error:', error);
  }
}

function displayResults(plan) {
  // Update summary cards
  totalDaysOffEl.textContent = plan.totalDaysOff;
  leaveDaysUsedEl.textContent = plan.totalLeavesUsed;
  leaveRemainingEl.textContent = plan.remainingLeaves;

  // Display leave plan
  clearElement(leavePlanList);
  if (plan.selectedOpportunities.length === 0) {
    leavePlanList.appendChild(createEmptyMessage(
      'No optimal leave opportunities found for your criteria. Try adjusting your available leaves or preference.'
    ));
  } else {
    plan.selectedOpportunities.forEach((opp, index) => {
      const item = createLeavePlanItem(opp, index, plan.availableLeaves);
      leavePlanList.appendChild(item);
    });
  }

  // Display all holidays
  holidayYearEl.textContent = getPeriodLabel(plan.period);
  
  clearElement(allHolidaysList);
  const holidayListDiv = document.createElement('div');
  holidayListDiv.className = 'holiday-list';

  plan.holidays.forEach(holiday => {
    const item = createHolidayItem(holiday);
    holidayListDiv.appendChild(item);
  });

  allHolidaysList.appendChild(holidayListDiv);

  clearElement(tipsList);
  tips.forEach(tip => {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsList.appendChild(li);
  });

  // Show results section
  resultsSection.classList.remove('hidden');
  
  // Show sort controls and set active button
  if (sortControls) {
    sortButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-sort') === currentSortType;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  renderAlternativePlans();
  renderCalendarView(plan);
  renderExcludedBreaks();
}

function renderExcludedBreaks() {
  if (!excludedBreaksPanel) return;

  if (excludedKeys.size === 0) {
    excludedBreaksPanel.classList.add('hidden');
    clearElement(excludedBreaksPanel);
    return;
  }

  excludedBreaksPanel.classList.remove('hidden');
  clearElement(excludedBreaksPanel);

  const heading = document.createElement('h4');
  heading.className = 'excluded-breaks-title';
  heading.textContent = `Excluded breaks (${excludedKeys.size})`;
  excludedBreaksPanel.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'excluded-breaks-list';

  allOpportunities
    .filter(opp => excludedKeys.has(opportunityKey(opp)))
    .forEach(opp => {
      const item = document.createElement('div');
      item.className = 'excluded-break-item';

      const label = document.createElement('span');
      label.textContent = `${formatDate(opp.startDate)} – ${formatDate(opp.endDate)} (${opp.totalDays} days)`;

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'btn btn--outline btn--sm';
      restoreBtn.textContent = '↩️ Restore';
      restoreBtn.addEventListener('click', () => handleExcludeToggle(opp));

      item.appendChild(label);
      item.appendChild(restoreBtn);
      list.appendChild(item);
    });

  excludedBreaksPanel.appendChild(list);
}

function createLeavePlanItem(opportunity, index, totalLeaves) {
  const div = document.createElement('div');
  div.className = 'leave-plan-item';

  const dateRange = `${formatDate(opportunity.startDate)} - ${formatDate(opportunity.endDate)}`;
  const duration = `${opportunity.totalDays} consecutive days`;

  const header = document.createElement('div');
  header.className = 'leave-plan-header';

  const datesBlock = document.createElement('div');
  datesBlock.className = 'leave-plan-dates';
  const dateRangeEl = document.createElement('div');
  dateRangeEl.className = 'leave-plan-date-range';
  dateRangeEl.textContent = dateRange;
  const durationEl = document.createElement('div');
  durationEl.className = 'leave-plan-duration';
  durationEl.textContent = duration;
  datesBlock.appendChild(dateRangeEl);
  datesBlock.appendChild(durationEl);

  const badgesBlock = document.createElement('div');
  badgesBlock.className = 'leave-plan-badges';
  if (opportunity.leaveDaysNeeded === 0) {
    badgesBlock.appendChild(createBadge('badge--value', '🎁 Natural Long Weekend'));
  } else if (opportunity.totalDays >= 7) {
    badgesBlock.appendChild(createBadge('badge--long', '🌟 Week-Long Break'));
  } else if (opportunity.efficiency >= 3.5) {
    badgesBlock.appendChild(createBadge('badge--value', '💎 Best Value'));
  } else {
    badgesBlock.appendChild(createBadge('badge--weekend', '🏖️ Long Weekend'));
  }

  header.appendChild(datesBlock);
  header.appendChild(badgesBlock);

  const holidayNames = opportunity.holidaysIncluded.map(h => h.name).join(', ');
  const allDates = getDatesBetween(opportunity.startDate, opportunity.endDate);
  const leaveDays = opportunity.leaveDaysNeeded;
  const holidayDays = opportunity.holidaysIncluded.length;
  const weekendDays = allDates.filter(d => isWeekend(d, companySettings.weekendPolicy)).length;

  const details = document.createElement('div');
  details.className = 'leave-plan-details';

  const leaveDetail = document.createElement('div');
  leaveDetail.className = 'leave-plan-detail';
  const leaveLabel = document.createElement('div');
  leaveLabel.className = 'leave-plan-detail-label';
  leaveLabel.textContent = 'Leave Required';
  const leaveValue = document.createElement('div');
  leaveValue.className = 'leave-plan-detail-value';
  const leaveStrong = document.createElement('strong');
  leaveStrong.textContent = String(opportunity.leaveDaysNeeded);
  leaveValue.appendChild(leaveStrong);
  leaveValue.appendChild(document.createTextNode(' days'));
  leaveDetail.appendChild(leaveLabel);
  leaveDetail.appendChild(leaveValue);

  const holidayDetail = document.createElement('div');
  holidayDetail.className = 'leave-plan-detail';
  const holidayLabel = document.createElement('div');
  holidayLabel.className = 'leave-plan-detail-label';
  holidayLabel.textContent = 'Holidays Included';
  const holidayValue = document.createElement('div');
  holidayValue.className = 'leave-plan-detail-value';
  holidayValue.textContent = holidayNames;
  holidayDetail.appendChild(holidayLabel);
  holidayDetail.appendChild(holidayValue);

  const weekendDetail = document.createElement('div');
  weekendDetail.className = 'leave-plan-detail';
  const weekendLabel = document.createElement('div');
  weekendLabel.className = 'leave-plan-detail-label';
  weekendLabel.textContent = 'Weekends Covered';
  const weekendValue = document.createElement('div');
  weekendValue.className = 'leave-plan-detail-value';
  weekendValue.textContent = `${weekendDays} days`;
  weekendDetail.appendChild(weekendLabel);
  weekendDetail.appendChild(weekendValue);

  details.appendChild(leaveDetail);
  details.appendChild(holidayDetail);
  details.appendChild(weekendDetail);

  const visualBar = document.createElement('div');
  visualBar.className = 'visual-bar';
  const leavePercent = (leaveDays / opportunity.totalDays) * 100;
  const holidayPercent = (holidayDays / opportunity.totalDays) * 100;
  const weekendPercent = (weekendDays / opportunity.totalDays) * 100;

  if (leaveDays > 0) {
    visualBar.appendChild(createVisualBarSegment(
      'visual-bar-segment--leave', leavePercent, `Leave: ${leaveDays} days`, `${leaveDays}L`
    ));
  }
  if (holidayDays > 0) {
    visualBar.appendChild(createVisualBarSegment(
      'visual-bar-segment--holiday', holidayPercent, `Holidays: ${holidayDays} days`, `${holidayDays}H`
    ));
  }
  if (weekendDays > 0) {
    visualBar.appendChild(createVisualBarSegment(
      'visual-bar-segment--weekend', weekendPercent, `Weekends: ${weekendDays} days`, `${weekendDays}W`
    ));
  }

  div.appendChild(header);
  div.appendChild(details);
  div.appendChild(visualBar);

  const actions = document.createElement('div');
  actions.className = 'leave-plan-actions';

  const key = opportunityKey(opportunity);
  const isLocked = lockedOpportunities.some(o => opportunityKey(o) === key);

  const lockBtn = document.createElement('button');
  lockBtn.type = 'button';
  lockBtn.className = `btn btn--outline btn--sm leave-plan-action${isLocked ? ' active' : ''}`;
  lockBtn.textContent = isLocked ? '🔒 Locked' : '🔓 Lock in plan';
  lockBtn.setAttribute('aria-pressed', String(isLocked));
  lockBtn.addEventListener('click', () => handleLockToggle(opportunity));

  const excludeBtn = document.createElement('button');
  excludeBtn.type = 'button';
  excludeBtn.className = 'btn btn--outline btn--sm leave-plan-action';
  excludeBtn.textContent = '✕ Exclude';
  excludeBtn.setAttribute('aria-pressed', 'false');
  excludeBtn.addEventListener('click', () => handleExcludeToggle(opportunity));

  actions.appendChild(lockBtn);
  actions.appendChild(excludeBtn);
  div.appendChild(actions);

  return div;
}

function createHolidayItem(holiday) {
  const div = document.createElement('div');
  div.className = 'holiday-item';

  const date = parseDate(holiday.date);
  const day = date.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const dayName = dayNames[holiday.dayOfWeek];

  const dateBlock = document.createElement('div');
  dateBlock.className = 'holiday-date';
  const dayEl = document.createElement('div');
  dayEl.className = 'holiday-day';
  dayEl.textContent = String(day);
  const monthEl = document.createElement('div');
  monthEl.className = 'holiday-month';
  monthEl.textContent = month;
  dateBlock.appendChild(dayEl);
  dateBlock.appendChild(monthEl);

  const infoBlock = document.createElement('div');
  infoBlock.className = 'holiday-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'holiday-name';
  nameEl.textContent = holiday.name;
  const dayNameEl = document.createElement('div');
  dayNameEl.className = 'holiday-day-name';
  dayNameEl.textContent = dayName;
  infoBlock.appendChild(nameEl);
  infoBlock.appendChild(dayNameEl);

  div.appendChild(dateBlock);
  div.appendChild(infoBlock);

  return div;
}

function toggleHolidays() {
  holidaysContent.classList.toggle('hidden');
  holidaysToggle.classList.toggle('active');
  const expanded = !holidaysContent.classList.contains('hidden');
  holidaysToggle.setAttribute('aria-expanded', String(expanded));
}

function getStrategyLabel(strategy) {
  const labels = {
    balanced: 'Balanced',
    long: 'Longest breaks',
    trips: 'Most trips'
  };
  return labels[strategy] || 'Balanced';
}

function renderAlternativePlans() {
  if (!alternativePlansEl || !alternativePlanTabs) return;

  if (alternativePlans.length <= 1) {
    alternativePlansEl.classList.add('hidden');
    clearElement(alternativePlanTabs);
    return;
  }

  alternativePlansEl.classList.remove('hidden');
  clearElement(alternativePlanTabs);

  alternativePlans.forEach((plan, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `alternative-plan-tab${index === selectedAlternativeIndex ? ' active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(index === selectedAlternativeIndex));
    tab.textContent = `${getStrategyLabel(plan.strategy)} (${plan.totalDaysOff}d, ${plan.totalLeavesUsed} leaves)`;
    tab.addEventListener('click', () => switchAlternativePlan(index));
    alternativePlanTabs.appendChild(tab);
  });
}

function switchAlternativePlan(index) {
  if (!alternativePlans[index] || index === selectedAlternativeIndex) return;

  selectedAlternativeIndex = index;
  lockedOpportunities = [];
  excludedKeys = new Set();

  const alt = alternativePlans[index];
  currentPlan = {
    ...alt,
    holidays: currentPlan.holidays,
    period: currentPlan.period,
    availableLeaves: currentPlan.availableLeaves,
    preference: currentPlan.preference,
    dataTruncated: currentPlan.dataTruncated,
    lastAvailableDate: currentPlan.lastAvailableDate,
    startDate: currentPlan.startDate,
    endDate: currentPlan.endDate
  };

  displayResults(currentPlan);
  showNotification(`Switched to ${getStrategyLabel(alt.strategy)} plan`, 'info');
}

function handleLockToggle(opportunity) {
  const key = opportunityKey(opportunity);
  const existing = lockedOpportunities.findIndex(o => opportunityKey(o) === key);

  if (existing >= 0) {
    lockedOpportunities.splice(existing, 1);
    showNotification('Break unlocked — re-optimizing plan', 'info');
  } else {
    lockedOpportunities.push(opportunity);
    showNotification('Break locked in — re-optimizing around it', 'success');
  }

  reoptimizePlan();
}

function handleExcludeToggle(opportunity) {
  const key = opportunityKey(opportunity);

  if (excludedKeys.has(key)) {
    excludedKeys.delete(key);
    showNotification('Break restored to pool', 'info');
  } else {
    excludedKeys.add(key);
    lockedOpportunities = lockedOpportunities.filter(o => opportunityKey(o) !== key);
    showNotification('Break excluded — finding alternatives', 'info');
  }

  reoptimizePlan();
}

function reoptimizePlan() {
  if (!currentPlan || !allOpportunities.length) return;

  const preference = currentPlan.preference || document.querySelector('input[name="preference"]:checked').value;
  const leaveDays = currentPlan.availableLeaves;

  const optimized = selectOptimalPlan(allOpportunities, leaveDays, preference, {
    locked: lockedOpportunities,
    excludedKeys: [...excludedKeys]
  });

  currentPlan = {
    ...optimized,
    holidays: currentPlan.holidays,
    period: currentPlan.period,
    availableLeaves: leaveDays,
    preference,
    dataTruncated: currentPlan.dataTruncated,
    lastAvailableDate: currentPlan.lastAvailableDate,
    startDate: currentPlan.startDate,
    endDate: currentPlan.endDate
  };

  totalDaysOffEl.textContent = currentPlan.totalDaysOff;
  leaveDaysUsedEl.textContent = currentPlan.totalLeavesUsed;
  leaveRemainingEl.textContent = currentPlan.remainingLeaves;

  sortAndDisplayResults(currentPlan, currentSortType);
  renderCalendarView(currentPlan);
  renderExcludedBreaks();
}

function renderCalendarView(plan) {
  if (!calendarView || !plan?.startDate) return;

  clearElement(calendarView);
  const months = buildCalendarData(
    plan.startDate,
    plan.endDate,
    plan.holidays,
    plan.selectedOpportunities,
    companySettings.weekendPolicy
  );

  months.forEach(monthData => {
    const monthEl = document.createElement('div');
    monthEl.className = 'calendar-month';

    const title = document.createElement('h4');
    title.className = 'calendar-month-title';
    title.textContent = `${monthData.monthName} ${monthData.year}`;
    monthEl.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', `${monthData.monthName} ${monthData.year}`);

    monthData.dayHeaders.forEach(header => {
      const th = document.createElement('div');
      th.className = 'calendar-day-header';
      th.textContent = header;
      th.setAttribute('role', 'columnheader');
      grid.appendChild(th);
    });

    monthData.cells.forEach(cell => {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.setAttribute('role', 'gridcell');

      if (!cell.inMonth) dayEl.classList.add('calendar-day--other-month');
      if (cell.isWeekend) dayEl.classList.add('calendar-day--weekend');
      if (cell.isHoliday) dayEl.classList.add('calendar-day--holiday');
      if (cell.isLeave) dayEl.classList.add('calendar-day--leave');
      if (cell.isPlanned && !cell.isLeave) dayEl.classList.add('calendar-day--planned');

      const num = document.createElement('span');
      num.className = 'calendar-day-num';
      num.textContent = String(cell.day);
      dayEl.appendChild(num);

      if (cell.holidayName && cell.inMonth) {
        dayEl.title = cell.holidayName;
        const dot = document.createElement('span');
        dot.className = 'calendar-day-dot';
        dot.setAttribute('aria-hidden', 'true');
        dayEl.appendChild(dot);
      }

      grid.appendChild(dayEl);
    });

    monthEl.appendChild(grid);
    calendarView.appendChild(monthEl);
  });
}

function handleReset() {
  form.reset();
  resultsSection.classList.add('hidden');
  loadingSkeleton.classList.add('hidden');
  currentPlan = null;
  allOpportunities = [];
  lockedOpportunities = [];
  excludedKeys = new Set();
  alternativePlans = [];
  selectedAlternativeIndex = 0;
  currentSortType = userPreferences.sortPreference || 'date';
  hideLoadingButton();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showNotification('Form reset successfully', 'info');
}

// Initialize App
async function initializeApp() {
  try {
    await loadHolidayData();
  } catch (err) {
    console.error('Could not load holiday data:', err);
    showNotification('Could not load holiday data. Please refresh the page.', 'error');
    return;
  }

  populatePeriodDropdown();
  loadCompanySettings();
  applyURLParams();

  // Load saved theme preference or check system preference
  const savedTheme = getSavedPreference('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = prefersDark ? 'dark' : 'light';
    applyTheme(defaultTheme);
    savePreference('theme', defaultTheme);
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = getSavedPreference('theme');
    // Only auto-switch if user hasn't manually set a preference
    if (!savedTheme) {
      const newTheme = e.matches ? 'dark' : 'light';
      applyTheme(newTheme);
    }
  });
  
  // Load saved sort preference
  const savedSort = getSavedPreference('sortPreference');
  if (savedSort) {
    currentSortType = savedSort;
    userPreferences.sortPreference = savedSort;
  }

  // Setup Intersection Observer for scroll animations
  setupScrollAnimations();

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.documentElement.style.setProperty('--duration-fast', '0ms');
    document.documentElement.style.setProperty('--duration-normal', '0ms');
  }

  console.log('Smart Holiday Planner initialized successfully!');
  console.log('Current theme:', isDarkMode ? 'dark' : 'light');
}

// Theme Toggle
function toggleTheme() {
  isDarkMode = !isDarkMode;
  const theme = isDarkMode ? 'dark' : 'light';
  applyTheme(theme);
  userPreferences.theme = theme;
  savePreference('theme', theme);
  
  showNotification(`${isDarkMode ? 'Dark' : 'Light'} mode enabled`, 'info');
}

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = themeToggle ? themeToggle.querySelector('.theme-toggle-icon') : null;
  
  if (theme === 'dark') {
    html.setAttribute('data-color-scheme', 'dark');
    isDarkMode = true;
    if (icon) {
      // Animate icon change
      icon.style.transform = 'rotate(180deg)';
      icon.style.opacity = '0';
      setTimeout(() => {
        icon.textContent = '☀️';
        icon.style.transform = 'rotate(360deg)';
        icon.style.opacity = '1';
      }, 150);
    }
  } else {
    html.setAttribute('data-color-scheme', 'light');
    isDarkMode = false;
    if (icon) {
      // Animate icon change
      icon.style.transform = 'rotate(180deg)';
      icon.style.opacity = '0';
      setTimeout(() => {
        icon.textContent = '🌙';
        icon.style.transform = 'rotate(360deg)';
        icon.style.opacity = '1';
      }, 150);
    }
  }
}

const STORAGE_PREFIX = 'smartleaves_';
const inMemoryStorage = {};

function savePreference(key, value) {
  userPreferences[key] = value;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (e) {
    inMemoryStorage[key] = value;
  }
}

function getSavedPreference(key) {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (stored !== null) return JSON.parse(stored);
  } catch (e) {
    // fall through to in-memory fallback
  }
  return inMemoryStorage[key];
}

function loadCompanySettings() {
  const saved = getSavedPreference('companySettings');
  if (saved) {
    companySettings = {
      weekendPolicy: saved.weekendPolicy || 'standard',
      addedHolidays: saved.addedHolidays || [],
      excludedDates: saved.excludedDates || []
    };
  }
  if (weekendPolicySelect) {
    weekendPolicySelect.value = companySettings.weekendPolicy;
  }
  renderCustomHolidayList();
}

function saveCompanySettings() {
  savePreference('companySettings', companySettings);
}

function toggleCompanySettings() {
  companySettingsPanel.classList.toggle('hidden');
  companySettingsToggle.classList.toggle('active');
  const expanded = !companySettingsPanel.classList.contains('hidden');
  companySettingsToggle.setAttribute('aria-expanded', String(expanded));
  if (expanded) {
    populateExcludedHolidaysList();
  }
}

function handleWeekendPolicyChange() {
  companySettings.weekendPolicy = weekendPolicySelect.value;
  saveCompanySettings();
}

function handleAddCustomHoliday() {
  const date = customHolidayDate.value;
  const name = customHolidayName.value.trim();

  if (!date) {
    showNotification('Please select a date for the custom holiday', 'error');
    return;
  }
  if (!name) {
    showNotification('Please enter a holiday name', 'error');
    return;
  }
  if (companySettings.addedHolidays.some(h => h.date === date)) {
    showNotification('This date is already in your custom holidays', 'warning');
    return;
  }

  companySettings.addedHolidays.push({ date, name });
  companySettings.addedHolidays.sort((a, b) => a.date.localeCompare(b.date));
  saveCompanySettings();
  renderCustomHolidayList();
  customHolidayDate.value = '';
  customHolidayName.value = '';
  showNotification(`Added "${name}" to your company holidays`, 'success');
}

function handleRemoveCustomHoliday(date) {
  companySettings.addedHolidays = companySettings.addedHolidays.filter(h => h.date !== date);
  saveCompanySettings();
  renderCustomHolidayList();
}

function renderCustomHolidayList() {
  if (!customHolidayList) return;
  clearElement(customHolidayList);

  if (companySettings.addedHolidays.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'form-text';
    empty.textContent = 'No custom holidays added yet';
    customHolidayList.appendChild(empty);
    return;
  }

  companySettings.addedHolidays.forEach(holiday => {
    const li = document.createElement('li');
    li.className = 'custom-holiday-item';

    const info = document.createElement('span');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'custom-holiday-item-name';
    nameSpan.textContent = holiday.name;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'custom-holiday-item-date';
    dateSpan.textContent = formatDate(parseDate(holiday.date));
    info.appendChild(nameSpan);
    info.appendChild(dateSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'custom-holiday-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => handleRemoveCustomHoliday(holiday.date));

    li.appendChild(info);
    li.appendChild(removeBtn);
    customHolidayList.appendChild(li);
  });
}

function populateExcludedHolidaysList() {
  if (!excludedHolidaysList) return;
  clearElement(excludedHolidaysList);

  const period = document.getElementById('planningPeriod')?.value || String(new Date().getFullYear());
  const { holidays: baseHolidays } = getHolidaysForPeriod(period);

  baseHolidays.forEach(holiday => {
    const label = document.createElement('label');
    label.className = 'excluded-holiday-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !companySettings.excludedDates.includes(holiday.date);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        companySettings.excludedDates = companySettings.excludedDates.filter(d => d !== holiday.date);
      } else {
        if (!companySettings.excludedDates.includes(holiday.date)) {
          companySettings.excludedDates.push(holiday.date);
        }
      }
      saveCompanySettings();
    });

    const text = document.createElement('span');
    text.textContent = `${holiday.name} (${formatDate(parseDate(holiday.date))})`;

    label.appendChild(checkbox);
    label.appendChild(text);
    excludedHolidaysList.appendChild(label);
  });
}

function applyURLParams() {
  const params = parseShareURL(window.location.search);
  if (!params) return;

  document.getElementById('leaveDays').value = params.leaveDays;
  if (document.getElementById('planningPeriod').querySelector(`option[value="${params.planningPeriod}"]`)) {
    document.getElementById('planningPeriod').value = params.planningPeriod;
  }
  const prefRadio = document.querySelector(`input[name="preference"][value="${params.preference}"]`);
  if (prefRadio) prefRadio.checked = true;
  if (params.weekendPolicy && weekendPolicySelect) {
    companySettings.weekendPolicy = params.weekendPolicy;
    weekendPolicySelect.value = params.weekendPolicy;
    saveCompanySettings();
  }
}

// Loading States
function showLoadingState() {
  const btnText = generateBtn.querySelector('.btn-text');
  const btnLoader = generateBtn.querySelector('.btn-loader');
  
  if (btnText && btnLoader) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
  }
  generateBtn.disabled = true;
  
  resultsSection.classList.add('hidden');
  loadingSkeleton.classList.remove('hidden');
}

function hideLoadingState() {
  hideLoadingButton();
  loadingSkeleton.classList.add('hidden');
}

function hideLoadingButton() {
  const btnText = generateBtn.querySelector('.btn-text');
  const btnLoader = generateBtn.querySelector('.btn-loader');
  
  if (btnText && btnLoader) {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
  generateBtn.disabled = false;
}

// Scroll Animations with Intersection Observer
function setupScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe cards and sections
  const animatedElements = document.querySelectorAll('.card, .summary-card');
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Notification System
function showNotification(message, type = 'info') {
  if (ariaLiveRegion) {
    ariaLiveRegion.textContent = message;
  }

  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  notification.textContent = message;
  
  // Style the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '10000',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    animation: 'slideInRight 0.3s ease',
    maxWidth: '400px',
    wordWrap: 'break-word'
  });

  // Set background color based on type
  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f97316',
    info: '#3b82f6'
  };
  notification.style.backgroundColor = colors[type] || colors.info;

  // Add to document
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (notification.isConnected) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

function getFormSettings() {
  return {
    leaveDays: parseInt(document.getElementById('leaveDays').value, 10),
    planningPeriod: document.getElementById('planningPeriod').value,
    preference: document.querySelector('input[name="preference"]:checked').value,
    weekendPolicy: companySettings.weekendPolicy
  };
}

function generatePlanText() {
  if (!currentPlan) return '';

  let text = `🎯 MY HOLIDAY PLAN\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `📊 SUMMARY\n`;
  text += `Total Days Off: ${currentPlan.totalDaysOff} days\n`;
  text += `Leave Days Used: ${currentPlan.totalLeavesUsed} days\n`;
  text += `Leave Days Remaining: ${currentPlan.remainingLeaves} days\n\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `📅 PLANNED BREAKS\n\n`;

  currentPlan.selectedOpportunities.forEach((opp, index) => {
    text += `${index + 1}. ${formatDate(opp.startDate)} - ${formatDate(opp.endDate)}\n`;
    text += `   Duration: ${opp.totalDays} days\n`;
    text += `   Leave Required: ${opp.leaveDaysNeeded} days\n`;
    text += `   Holidays: ${opp.holidaysIncluded.map(h => h.name).join(', ')}\n\n`;
  });

  text += `${'='.repeat(50)}\n\n`;
  text += `Generated by Smart Holiday Planner\n`;

  return text;
}

function openModal() {
  modalPreviousFocus = document.activeElement;
  modal.classList.remove('hidden');

  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length) focusable[0].focus();
}

function closeModal() {
  modal.classList.add('hidden');
  if (modalPreviousFocus && typeof modalPreviousFocus.focus === 'function') {
    modalPreviousFocus.focus();
  }
  modalPreviousFocus = null;
}

function trapModalFocus(e) {
  if (modal.classList.contains('hidden') || e.key !== 'Tab') return;

  const focusable = [...modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )].filter(el => !el.disabled);

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function handleSavePdf() {
  // Fill the print-only header from the current summary values, then open the
  // browser's print dialog (user picks "Save as PDF"). No dependencies needed.
  if (printMetaEl) {
    const totalDays = totalDaysOffEl ? totalDaysOffEl.textContent : '';
    const leavesUsed = leaveDaysUsedEl ? leaveDaysUsedEl.textContent : '';
    const generated = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    printMetaEl.textContent =
      `${totalDays} days off using ${leavesUsed} leave days \u00b7 Generated ${generated}`;
  }
  const previousTitle = document.title;
  document.title = 'SmartLeaves Holiday Plan';
  window.print();
  // Restore the on-screen title after the (blocking) print dialog closes.
  document.title = previousTitle;
}

function handleExport() {
  const text = generatePlanText();
  modalTitle.textContent = 'Export Your Holiday Plan';
  modalText.value = text;
  openModal();
}

function handleDownloadICS() {
  if (!currentPlan) {
    showNotification('Generate a plan first before downloading calendar', 'warning');
    return;
  }
  downloadICS(currentPlan);
  showNotification('Calendar file downloaded — import into Google/Outlook/Apple Calendar', 'success');
}

async function handleWebShare() {
  if (!currentPlan) {
    showNotification('Generate a plan first before sharing', 'warning');
    return;
  }

  const settings = getFormSettings();
  const url = buildShareURL(settings);
  const text = generatePlanText();
  const icsContent = generateICS(currentPlan);
  const icsBlob = new Blob([icsContent], { type: 'text/calendar' });

  try {
    const shared = await sharePlan({
      title: 'My Smart Leaves Plan',
      text,
      url,
      icsBlob
    });
    if (shared) {
      showNotification('Plan shared successfully!', 'success');
      closeModal();
    } else {
      const shareText = `${text}\n\n🔗 ${url}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        showNotification('Share link copied to clipboard', 'success');
      } else {
        modalTitle.textContent = 'Share Your Holiday Plan';
        modalText.value = shareText;
        openModal();
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      showNotification('Could not share — try copy or download instead', 'warning');
    }
  }
}

async function copyToClipboard() {
  const text = modalText.value;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      modalText.select();
      document.execCommand('copy');
    }
    const originalText = modalCopyBtn.textContent;
    modalCopyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
      modalCopyBtn.textContent = originalText;
    }, 2000);
  } catch {
    showNotification('Could not copy — please select and copy manually', 'error');
  }
}

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }

  trapModalFocus(e);

  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('leaveDays').focus();
  }
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);