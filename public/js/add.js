import { api } from './api.js';
import { mountTopbar, STATUSES, STAB_VALUES, BOROUGHS, escapeHtml, toast } from './utils.js';

mountTopbar('add');

const statusSelect = document.getElementById('status-select');
for (const s of STATUSES) statusSelect.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`);
const stabSelect = document.getElementById('stab-select');
for (const s of STAB_VALUES) stabSelect.insertAdjacentHTML('beforeend', `<option value="${s}" ${s==='Not Checked'?'selected':''}>${s}</option>`);
const boroughSelect = document.getElementById('borough-select');
for (const b of BOROUGHS) boroughSelect.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);

const lookupBtn = document.getElementById('lookup-btn');
const lookupInput = document.getElementById('lookup-address');
const lookupResult = document.getElementById('lookup-result');
const form = document.getElementById('prop-form');

let lastLookup = null;

lookupBtn.addEventListener('click', async () => {
  const addr = lookupInput.value.trim();
  if (!addr) { toast('Enter an address first', 'error'); return; }
  lookupBtn.disabled = true;
  lookupBtn.textContent = 'Looking up...';
  lookupResult.style.display = 'block';
  lookupResult.innerHTML = '<div class="empty">Calling NYC APIs...</div>';
  try {
    const data = await api.lookup(addr);
    lastLookup = data;
    if (!data.ok) {
      lookupResult.innerHTML = `<div class="empty" style="color:var(--red);">${escapeHtml(data.error || 'Lookup failed')}</div>`;
      return;
    }
    const s = data.suggested;
    lookupResult.innerHTML = `
      <div class="kv">
        <dt>Address</dt><dd>${escapeHtml(s.address || '')}</dd>
        <dt>BBL</dt><dd>${escapeHtml(s.bbl || '')}</dd>
        <dt>Borough</dt><dd>${escapeHtml(s.borough || '')}</dd>
        <dt>Year Built</dt><dd>${s.year_built ?? '-'}</dd>
        <dt>Units (Res)</dt><dd>${s.units ?? '-'}</dd>
        <dt>Rent Stabilized</dt><dd>${escapeHtml(s.rent_stabilized)} — <span style="color:var(--muted);">${escapeHtml(data.rent_stabilized?.reason || '')}</span></dd>
        <dt>Open HPD Violations</dt><dd>${data.hpd_open_count}</dd>
        <dt>DOB Records</dt><dd>${data.dob_count}</dd>
      </div>
      <button class="btn secondary small" id="apply-lookup" type="button" style="margin-top:10px;">Use these values</button>
    `;
    document.getElementById('apply-lookup').addEventListener('click', applyLookup);
    applyLookup();
  } catch (e) {
    lookupResult.innerHTML = `<div class="empty" style="color:var(--red);">Lookup error: ${escapeHtml(e.message)}</div>`;
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = 'Lookup';
  }
});

function applyLookup() {
  if (!lastLookup || !lastLookup.suggested) return;
  const s = lastLookup.suggested;
  setField('address', s.address);
  setField('bbl', s.bbl);
  setField('borough', s.borough);
  setField('year_built', s.year_built);
  setField('units', s.units);
  if (s.rent_stabilized) setField('rent_stabilized', s.rent_stabilized);
  toast('Fields pre-filled from NYC data');
}

function setField(name, value) {
  if (value === null || value === undefined) return;
  const el = form.querySelector(`[name="${name}"]`);
  if (el) el.value = value;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) {
    if (v !== '') data[k] = v;
  }
  if (lastLookup && lastLookup.ok) {
    data.enrichment_json = JSON.stringify({
      bbl: lastLookup.bbl,
      hpd_open_count: lastLookup.hpd_open_count,
      dob_count: lastLookup.dob_count,
      rent_stab_reason: lastLookup.rent_stabilized?.reason,
      fetched_at: new Date().toISOString(),
    });
  }
  try {
    const { property } = await api.create(data);
    toast('Property saved');
    setTimeout(() => { window.location.href = `/property.html?id=${property.id}`; }, 400);
  } catch (err) {
    toast('Save failed: ' + err.message, 'error');
  }
});
