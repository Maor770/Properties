import { api } from './api.js';
import { mountTopbar, fmtCurrency, fmtRatio, fmtNumber, fmtAddress, statusClass, stabClass, escapeHtml, STATUSES, BOROUGHS, toast } from './utils.js';

mountTopbar('properties');

const tbody = document.querySelector('#props-table tbody');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('filter-status');
const boroughEl = document.getElementById('filter-borough');
const clearBtn = document.getElementById('clear-filters');

for (const s of STATUSES) statusEl.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`);
for (const b of BOROUGHS) boroughEl.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);

let all = [];
let filesByProp = new Map();

async function refresh() {
  try {
    const { properties } = await api.list();
    all = properties;
    // For files column, fetch each property's files lazily — simplest: include count via batch
    filesByProp = new Map();
    const detailReqs = await Promise.all(properties.map(p => api.get(p.id).then(r => [p.id, r.files]).catch(() => [p.id, []])));
    for (const [id, files] of detailReqs) filesByProp.set(id, files);
    render();
  } catch (e) {
    toast('Failed to load properties: ' + e.message, 'error');
  }
}

function render() {
  const q = (searchEl.value || '').toLowerCase().trim();
  const status = statusEl.value;
  const borough = boroughEl.value;
  const filtered = all.filter(p => {
    if (status && p.status !== status) return false;
    if (borough && p.borough !== borough) return false;
    if (q) {
      const hay = `${p.address || ''} ${p.bbl || ''} ${p.notes || ''} ${p.next_step || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="19" class="empty">No properties match.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(row).join('');
}

function row(p) {
  const gap = p.gap_pct !== null && p.gap_pct !== undefined ? (p.gap_pct * 100).toFixed(1) + '%' : '-';
  const files = filesByProp.get(p.id) || [];
  const filesCell = files.length
    ? files.slice(0, 3).map(f => `<a href="${escapeHtml(f.public_url)}" target="_blank" rel="noopener">${escapeHtml(f.filename)}</a>`).join('<br>') + (files.length > 3 ? `<br><a href="/property.html?id=${p.id}">+${files.length - 3} more</a>` : '')
    : '-';
  return `
    <tr>
      <td><span class="badge ${statusClass(p.status)}">${escapeHtml(p.status)}</span></td>
      <td><a href="/property.html?id=${p.id}" title="${escapeHtml(p.address)}">${escapeHtml(fmtAddress(p.address))}</a></td>
      <td>${escapeHtml(p.next_step || '')}</td>
      <td class="num">${fmtCurrency(p.my_max_price)}</td>
      <td class="num">${fmtCurrency(p.asking_price)}</td>
      <td class="num">${gap}</td>
      <td class="num">${p.units ?? '-'}</td>
      <td class="num">${fmtCurrency(p.annual_noi)}</td>
      <td class="num">${fmtRatio(p.dscr)}</td>
      <td class="num">${fmtCurrency(p.annual_cash_flow)}</td>
      <td class="num">${p.coc_return ? Number(p.coc_return).toFixed(1) + '%' : '-'}</td>
      <td><span class="badge ${stabClass(p.rent_stabilized)}">${escapeHtml(p.rent_stabilized || 'Not Checked')}</span></td>
      <td>${escapeHtml(p.bbl || '')}</td>
      <td>${escapeHtml(p.borough || '')}</td>
      <td class="num">${p.year_built ?? '-'}</td>
      <td class="num">${fmtCurrency(p.last_offer)}</td>
      <td class="notes" title="${escapeHtml(p.notes || '')}">${escapeHtml(p.notes || '')}</td>
      <td>${escapeHtml(p.last_updated || '')}</td>
      <td>${filesCell}</td>
    </tr>
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
