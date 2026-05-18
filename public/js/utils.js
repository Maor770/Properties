export const STATUSES = ['Initial Review', 'Offer Sent', 'Negotiating', 'Passed'];
export const STAB_VALUES = ['Confirmed', 'Likely', 'Possible', 'No', 'Not Checked'];
export const BOROUGHS = ['BK', 'MN', 'QN', 'BX', 'SI'];
export const FILE_CATEGORIES = [
  { value: 'contracts', label: '01 — Contracts & Documents' },
  { value: 'photos', label: '02 — Photos' },
  { value: 'inspection', label: '03 — Inspection Reports' },
  { value: 'dscr', label: '04 — DSCR Analysis' },
  { value: 'correspondence', label: '05 — Correspondence' },
  { value: 'other', label: 'Other' },
];

export function fmtCurrency(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n < 0) return '(' + Math.round(-n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) + ')';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function fmtPct(v, digits = 1) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return (n * 100).toFixed(digits) + '%';
}

export function fmtPctRaw(v, digits = 1) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits) + '%';
}

export function fmtNumber(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US');
}

export function fmtRatio(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2);
}

export function statusClass(status) {
  switch (status) {
    case 'Initial Review': return 'status-initial';
    case 'Offer Sent': return 'status-offer';
    case 'Negotiating': return 'status-negotiating';
    case 'Passed': return 'status-passed';
    default: return 'status-initial';
  }
}

export function stabClass(value) {
  switch (value) {
    case 'Confirmed': return 'stab-confirmed';
    case 'Likely': return 'stab-likely';
    case 'Possible': return 'stab-possible';
    case 'No': return 'stab-no';
    default: return 'stab-unknown';
  }
}

let toastTimer = null;
export function toast(message, kind = 'info') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show' + (kind === 'error' ? ' error' : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

export function qs(name, url = window.location.href) {
  return new URL(url).searchParams.get(name);
}

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTopbar(active) {
  const nav = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/properties.html', label: 'Properties', key: 'properties' },
    { href: '/calculator.html', label: '+ Add Property', key: 'add' },
  ];
  return `
    <header class="topbar">
      <h1>NYC Properties Hub</h1>
      <nav>
        ${nav.map(n => `<a href="${n.href}" class="${n.key === active ? 'active' : ''}">${n.label}</a>`).join('')}
      </nav>
    </header>
  `;
}

export function mountTopbar(active) {
  const slot = document.getElementById('topbar');
  if (slot) slot.outerHTML = renderTopbar(active);
}
