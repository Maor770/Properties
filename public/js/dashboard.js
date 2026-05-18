import { api } from './api.js';
import { mountTopbar, fmtCurrency, fmtPct, fmtRatio, fmtNumber, statusClass, stabClass, escapeHtml, STATUSES, BOROUGHS, toast } from './utils.js';

mountTopbar('dashboard');

const cardsEl = document.getElementById('cards');
const kpiEl = document.getElementById('kpi-row');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('filter-status');
const boroughEl = document.getElementById('filter-borough');
const clearBtn = document.getElementById('clear-filters');

for (const s of STATUSES) statusEl.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`);
for (const b of BOROUGHS) boroughEl.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);

let allProperties = [];

async function refresh() {
  try {
    const { properties } = await api.list();
    allProperties = properties;
    render();
  } catch (e) {
    toast('Failed to load properties: ' + e.message, 'error');
  }
}

function render() {
  const q = (searchEl.value || '').toLowerCase().trim();
  const status = statusEl.value;
  const borough = boroughEl.value;

  const filtered = allProperties.filter(p => {
    if (status && p.status !== status) return false;
    if (borough && p.borough !== borough) return false;
    if (q) {
      const hay = `${p.address || ''} ${p.bbl || ''} ${p.notes || ''} ${p.next_step || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const total = filtered.length;
  const byStatus = {};
  let totalUnits = 0, totalNOI = 0, dscrSum = 0, dscrCount = 0;
  for (const p of filtered) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    if (p.units) totalUnits += Number(p.units);
    if (p.annual_noi) totalNOI += Number(p.annual_noi);
    if (p.dscr) { dscrSum += Number(p.dscr); dscrCount++; }
  }
  const avgDscr = dscrCount ? dscrSum / dscrCount : null;

  kpiEl.innerHTML = [
    kpi('Properties', total),
    kpi('Total Units', totalUnits.toLocaleString('en-US')),
    kpi('Total Annual NOI', fmtCurrency(totalNOI)),
    kpi('Avg DSCR', avgDscr ? fmtRatio(avgDscr) : '-'),
    kpi('Negotiating', byStatus['Negotiating'] || 0),
    kpi('Offers Sent', byStatus['Offer Sent'] || 0),
  ].join('');

  if (filtered.length === 0) {
    cardsEl.innerHTML = `<div class="empty card" style="grid-column: 1/-1;">No properties match. <a href="/calculator.html">Add your first property</a>.</div>`;
    return;
  }

  cardsEl.innerHTML = filtered.map(propCard).join('');
}

function kpi(label, value) {
  return `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function propCard(p) {
  const gapPct = p.gap_pct !== null && p.gap_pct !== undefined ? (p.gap_pct * 100).toFixed(1) + '%' : '-';
  return `
    <div class="prop-card">
      <div class="row">
        <h3>${escapeHtml(p.address)}</h3>
        <span class="badge ${statusClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>
      <div class="addr">${escapeHtml(p.borough || '')} ${p.units ? '• ' + p.units + ' units' : ''} ${p.year_built ? '• built ' + p.year_built : ''}</div>
      <div class="metrics">
        <div><span>Asking</span><span>${fmtCurrency(p.asking_price)}</span></div>
        <div><span>My Max</span><span>${fmtCurrency(p.my_max_price)}</span></div>
        <div><span>Gap</span><span>${gapPct}</span></div>
        <div><span>DSCR</span><span>${fmtRatio(p.dscr)}</span></div>
        <div><span>Annual NOI</span><span>${fmtCurrency(p.annual_noi)}</span></div>
        <div><span>Cash Flow</span><span>${fmtCurrency(p.annual_cash_flow)}</span></div>
        <div><span>CoC</span><span>${p.coc_return ? Number(p.coc_return).toFixed(1) + '%' : '-'}</span></div>
        <div><span>Rent Stab</span><span><span class="badge ${stabClass(p.rent_stabilized)}">${escapeHtml(p.rent_stabilized || 'Not Checked')}</span></span></div>
      </div>
      ${p.next_step ? `<div style="font-size:13px;"><strong>Next:</strong> ${escapeHtml(p.next_step)}</div>` : ''}
      <div class="actions">
        <a class="btn small secondary" href="/property.html?id=${p.id}">Open</a>
        <a class="btn small secondary" href="/calculator.html?id=${p.id}">Analyze</a>
      </div>
    </div>
  `;
}

searchEl.addEventListener('input', render);
statusEl.addEventListener('change', render);
boroughEl.addEventListener('change', render);
clearBtn.addEventListener('click', () => {
  searchEl.value = ''; statusEl.value = ''; boroughEl.value = '';
  render();
});

refresh();
