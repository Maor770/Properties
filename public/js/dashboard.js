import { api } from './api.js';
import { mountTopbar, fmtCurrency, fmtPct, fmtRatio, fmtNumber, fmtAddress, statusClass, stabClass, escapeHtml, STATUSES, BOROUGHS, toast } from './utils.js';

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
  const gapPct = p.gap_pct !== null && p.gap_pct !== undefined ? (p.gap_pct * 100).toFixed(1) + '%' : '–';
  const subtitleParts = [];
  if (p.borough) subtitleParts.push(p.borough);
  if (p.units) subtitleParts.push(p.units + ' units');
  if (p.year_built) subtitleParts.push('built ' + p.year_built);
  const subtitle = subtitleParts.join(' · ');
  const intakeLink = p.intake_file
    ? `<a class="card-intake" href="${escapeHtml(p.intake_file.public_url)}" target="_blank" rel="noopener" title="${escapeHtml(p.intake_file.filename)}">📎 ${escapeHtml(p.intake_file.filename.length > 24 ? p.intake_file.filename.slice(0, 22) + '…' : p.intake_file.filename)}</a>`
    : '';
  return `
    <div class="prop-card">
      <div class="card-head">
        <div class="card-title">
          <h3 title="${escapeHtml(p.address)}">${escapeHtml(fmtAddress(p.address))}</h3>
          ${subtitle ? `<div class="card-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <span class="badge ${statusClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>

      <div class="price-row">
        <div class="price-cell">
          <div class="cell-label">Asking</div>
          <div class="cell-val">${fmtCurrency(p.asking_price)}</div>
        </div>
        <div class="price-cell">
          <div class="cell-label">My Max</div>
          <div class="cell-val">${fmtCurrency(p.my_max_price)}</div>
        </div>
        <div class="price-cell">
          <div class="cell-label">Gap</div>
          <div class="cell-val">${gapPct}</div>
        </div>
      </div>

      <div class="metric-row">
        <div class="metric-cell"><div class="cell-label">NOI</div><div class="cell-val">${fmtCurrency(p.annual_noi)}</div></div>
        <div class="metric-cell"><div class="cell-label">Cash Flow</div><div class="cell-val">${fmtCurrency(p.annual_cash_flow)}</div></div>
        <div class="metric-cell"><div class="cell-label">DSCR</div><div class="cell-val">${fmtRatio(p.dscr)}</div></div>
        <div class="metric-cell"><div class="cell-label">CoC</div><div class="cell-val">${p.coc_return ? Number(p.coc_return).toFixed(1) + '%' : '–'}</div></div>
      </div>

      <div class="card-foot">
        <div class="card-foot-left">
          <span class="badge ${stabClass(p.rent_stabilized)}">${escapeHtml(p.rent_stabilized || 'Not Checked')}</span>
          ${intakeLink}
        </div>
        <div class="card-foot-right">
          <a class="btn small" href="/calculator.html?id=${p.id}">Open</a>
        </div>
      </div>
      ${p.next_step ? `<div class="card-next"><strong>Next:</strong> ${escapeHtml(p.next_step)}</div>` : ''}
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
