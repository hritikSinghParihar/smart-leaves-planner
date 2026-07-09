// Analytics consent (S4).
// Google Analytics is OFF by default and only loads after explicit consent.
// The user's choice is remembered in localStorage. IP anonymization is on.

const GA_ID = 'G-HB2QNZN7D0';
const STORAGE_KEY = 'sl-analytics-consent';

let gaLoaded = false;

function loadGoogleAnalytics() {
  if (gaLoaded) return;
  gaLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
}

function getConsent() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}

function setConsent(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
}

function initConsent() {
  const consent = getConsent();
  if (consent === 'granted') { loadGoogleAnalytics(); return; }
  if (consent === 'denied') { return; }

  const banner = document.getElementById('consentBanner');
  if (!banner) return;
  banner.classList.remove('hidden');

  const acceptBtn = document.getElementById('consentAcceptBtn');
  const declineBtn = document.getElementById('consentDeclineBtn');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      setConsent('granted');
      banner.classList.add('hidden');
      loadGoogleAnalytics();
    });
  }
  if (declineBtn) {
    declineBtn.addEventListener('click', () => {
      setConsent('denied');
      banner.classList.add('hidden');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConsent);
} else {
  initConsent();
}
