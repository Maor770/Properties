import { api } from './api.js';
import {
  mountTopbar, fmtCurrency, fmtPct, fmtRatio, statusClass, stabClass, escapeHtml,
  STATUSES, STAB_VALUES, BOROUGHS, FILE_CATEGORIES, toast, qs,
} from './utils.js';

mountTopbar(null);

const root = document.getElementById('property-root');
const propertyId = Number(qs('id'));
if (!propertyId) {
  root.innerHTML = '<div class="empty card">Missing property id.</div>';
  throw new Error('no id');
}

let state = { property: null, files: [], log: [] };

async function load() {
  try {
    const data = await api.get(propertyId);
    state = data;
    render();
  } catch (e) {
    root.innerHTML = `<div class="empty card" style="color:var(--red);">${escapeHtml(e.message)}</div>`;
  }
}

function render() {
  const p = state.property;
  const gap = p.gap_pct !== null && p.gap_pct !== undefined ? (p.gap_pct * 100).toFixed(1) + '%' : '-';
  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:16px; flex-wrap:wrap;">
      <div>
        <h2 style="margin-bottom:6px;">${escapeHtml(p.address)}</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <span class="badge ${statusClass(p.status)}">${escapeHtml(p.status)}</span>
          <span class="badge ${stabClass(p.rent_stabilized)}">Rent: ${escapeHtml(p.rent_stabilized || 'Not Checked')}</span>
          ${p.borough ? `<span class="nyc-pill">${escapeHtml(p.borough)}</span>` : ''}
          ${p.bbl ? `<span class="nyc-pill">BBL ${escapeHtml(p.bbl)}</span>` : ''}
          ${p.year_built ? `<span class="nyc-pill">Built ${p.year_built}</span>` : ''}
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <a class="btn" href="/calculator.html?id=${p.id}">Edit in Calculator</a>
        <button class="btn danger" id="delete-btn" type="button">Delete</button>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="card" style="margin-bottom:18px;">
          <div class="section-title"><h3>Pricing & Analysis</h3><button class="btn small secondary" id="edit-btn" type="button">Edit</button></div>
          <dl class="kv">
            <dt>Asking Price</dt><dd>${fmtCurrency(p.asking_price)}</dd>
            <dt>My Max Price</dt><dd>${fmtCurrency(p.my_max_price)}</dd>
            <dt>Gap %</dt><dd>${gap}</dd>
            <dt>Units</dt><dd>${p.units ?? '-'}</dd>
            <dt>Annual NOI</dt><dd>${fmtCurrency(p.annual_noi)}</dd>
            <dt>DSCR</dt><dd>${fmtRatio(p.dscr)}</dd>
            <dt>Annual Cash Flow</dt><dd>${fmtCurrency(p.annual_cash_flow)}</dd>
            <dt>CoC Return</dt><dd>${p.coc_return ? Number(p.coc_return).toFixed(1) + '%' : '-'}</dd>
            <dt>Last Offer</dt><dd>${fmtCurrency(p.last_offer)}</dd>
            <dt>Next Step</dt><dd>${escapeHtml(p.next_step || '-')}</dd>
            <dt>Notes</dt><dd>${escapeHtml(p.notes || '-')}</dd>
            <dt>Last Updated</dt><dd>${escapeHtml(p.last_updated || '-')}</dd>
          </dl>
        </div>

        <div class="card">
          <div class="section-title"><h3>Files</h3></div>
          <div class="dropzone" id="dropzone">
            <div><strong>Drag & drop</strong> files here, or click to select.</div>
            <div style="font-size:12px; margin-top:6px;">Each file gets a public link — usable in the dashboard and exported Sheet.</div>
            <select id="upload-category" style="margin-top:10px; padding:6px 10px; border:1px solid var(--border); border-radius:6px;">
              ${FILE_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
            <input type="file" id="file-input" style="display:none;" multiple>
          </div>
          <ul class="files-list" id="files-list" style="margin-top:14px;"></ul>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:18px;">
          <h3>Quick Update</h3>
          <form id="quick-form" class="form-grid" style="grid-template-columns: 1fr;">
            <label>Status
              <select name="status">
                ${STATUSES.map(s => `<option value="${s}" ${s===p.status?'selected':''}>${s}</option>`).join('')}
              </select>
            </label>
            <label>Rent Stabilized
              <select name="rent_stabilized">
                ${STAB_VALUES.map(s => `<option value="${s}" ${s===p.rent_stabilized?'selected':''}>${s}</option>`).join('')}
              </select>
            </label>
            <label>Next Step
              <input type="text" name="next_step" value="${escapeHtml(p.next_step || '')}">
            </label>
            <label>Last Offer ($)
              <input type="number" step="1000" name="last_offer" value="${p.last_offer ?? ''}">
            </label>
            <label>Notes
              <textarea name="notes">${escapeHtml(p.notes || '')}</textarea>
            </label>
            <button class="btn" type="submit">Save</button>
          </form>
        </div>

        <div class="card">
          <h3>Activity Log</h3>
          <ul class="log-list" id="log-list"></ul>
        </div>
      </div>
    </div>
  `;

  renderFiles();
  renderLog();
  bind();
}

function renderFiles() {
  const list = document.getElementById('files-list');
  if (!state.files.length) {
    list.innerHTML = '<li style="color:var(--muted);">No files yet.</li>';
    return;
  }
  list.innerHTML = state.files.map(f => `
    <li>
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <span class="cat">${escapeHtml(f.category)}</span>
        <a href="${escapeHtml(f.public_url)}" target="_blank" rel="noopener" title="${escapeHtml(f.filename)}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.filename)}</a>
        <span style="color:var(--muted); font-size:12px;">${f.size ? formatSize(f.size) : ''}</span>
      </div>
      <button class="btn small danger" data-file-id="${f.id}" type="button">Remove</button>
    </li>
  `).join('');
  list.querySelectorAll('button[data-file-id]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Remove this file?')) return;
      const id = Number(b.getAttribute('data-file-id'));
      try {
        await api.deleteFile(id);
        toast('File removed');
        await load();
      } catch (e) { toast('Failed: ' + e.message, 'error'); }
    });
  });
}

function renderLog() {
  const list = document.getElementById('log-list');
  if (!state.log.length) {
    list.innerHTML = '<li style="color:var(--muted);">No activity yet.</li>';
    return;
  }
  list.innerHTML = state.log.map(l => `
    <li><span class="ts">${escapeHtml(l.timestamp)}</span>${escapeHtml(l.message)}</li>
  `).join('');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function bind() {
  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete this property and all its files? This cannot be undone.')) return;
    try {
      await api.remove(propertyId);
      toast('Deleted');
      setTimeout(() => { window.location.href = '/'; }, 400);
    } catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  });

  document.getElementById('edit-btn').addEventListener('click', () => {
    window.location.href = `/calculator.html?id=${propertyId}`;
  });

  document.getElementById('quick-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const patch = {};
    for (const [k, v] of fd.entries()) patch[k] = v;
    try {
      await api.update(propertyId, patch);
      toast('Saved');
      await load();
    } catch (err) { toast('Save failed: ' + err.message, 'error'); }
  });

  const dz = document.getElementById('dropzone');
  const input = document.getElementById('file-input');
  const catSel = document.getElementById('upload-category');
  dz.addEventListener('click', (e) => { if (e.target.tagName !== 'SELECT') input.click(); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', async e => {
    e.preventDefault(); dz.classList.remove('dragover');
    await uploadFiles(Array.from(e.dataTransfer.files), catSel.value);
  });
  input.addEventListener('change', async () => {
    await uploadFiles(Array.from(input.files), catSel.value);
    input.value = '';
  });
}

async function uploadFiles(files, category) {
  for (const f of files) {
    try {
      toast(`Uploading ${f.name}…`);
      await api.uploadFile(propertyId, f, category);
    } catch (e) {
      toast(`Upload failed for ${f.name}: ${e.message}`, 'error');
    }
  }
  await load();
  toast('Upload done');
}

load();
