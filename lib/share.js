export function buildShareURL(settings) {
  const params = new URLSearchParams();
  params.set('leaves', String(settings.leaveDays));
  params.set('period', settings.planningPeriod);
  params.set('pref', settings.preference);
  if (settings.weekendPolicy && settings.weekendPolicy !== 'standard') {
    params.set('weekend', settings.weekendPolicy);
  }
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://smartleaves.in/';
  return `${base}?${params.toString()}`;
}

export function parseShareURL(search = '') {
  const params = new URLSearchParams(search);
  const leaves = parseInt(params.get('leaves'), 10);
  const period = params.get('period');
  const pref = params.get('pref');
  const weekend = params.get('weekend');

  if (isNaN(leaves) || !period || !pref) return null;

  return {
    leaveDays: leaves,
    planningPeriod: period,
    preference: pref,
    weekendPolicy: weekend || 'standard'
  };
}

export async function sharePlan({ title, text, url, icsBlob }) {
  if (navigator.share) {
    const shareData = { title, text, url };
    if (icsBlob && navigator.canShare?.({ files: [new File([icsBlob], 'plan.ics', { type: 'text/calendar' })] })) {
      shareData.files = [new File([icsBlob], 'smart-leaves-plan.ics', { type: 'text/calendar' })];
    }
    await navigator.share(shareData);
    return true;
  }
  return false;
}
