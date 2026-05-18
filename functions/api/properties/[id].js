import {
  COLUMNS, STATUSES, STAB_VALUES, BOROUGHS,
  jsonResponse, errorResponse, pickColumns, computeGapPct, todayISO, safeNum, safeInt,
  getPropertyById, logEvent,
} from '../../_shared.js';

function describeChanges(before, after) {
  const tracked = ['status', 'next_step', 'my_max_price', 'asking_price', 'last_offer', 'notes', 'rent_stabilized'];
  const parts = [];
  for (const k of tracked) {
    if (k in after && before[k] !== after[k]) {
      parts.push(`${k}: ${before[k] ?? '-'} → ${after[k] ?? '-'}`);
    }
  }
  return parts;
}

export async function onRequestGet({ env, params }) {
  const id = Number(params.id);
  const property = await getPropertyById(env.DB, id);
  if (!property) return errorResponse('Not found', 404);
  property.gap_pct = computeGapPct(property.asking_price, property.my_max_price);

  const files = await env.DB.prepare('SELECT * FROM property_files WHERE property_id = ? ORDER BY uploaded_at DESC').bind(id).all();
  const log = await env.DB.prepare('SELECT * FROM property_log WHERE property_id = ? ORDER BY timestamp DESC').bind(id).all();
  return jsonResponse({ property, files: files.results, log: log.results });
}

export async function onRequestPut({ env, params, request }) {
  const id = Number(params.id);
  const existing = await getPropertyById(env.DB, id);
  if (!existing) return errorResponse('Not found', 404);

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON'); }

  if (body.status && !STATUSES.includes(body.status)) return errorResponse('invalid status');
  if (body.rent_stabilized && !STAB_VALUES.includes(body.rent_stabilized)) return errorResponse('invalid rent_stabilized');
  if (body.borough && !BOROUGHS.includes(body.borough)) return errorResponse('invalid borough');

  const data = pickColumns(body);
  for (const k of ['my_max_price', 'asking_price', 'annual_noi', 'dscr', 'annual_cash_flow', 'coc_return', 'last_offer']) {
    if (k in data) data[k] = safeNum(data[k]);
  }
  for (const k of ['units', 'year_built']) {
    if (k in data) data[k] = safeInt(data[k]);
  }
  if (typeof data.enrichment_json === 'object' && data.enrichment_json !== null) {
    data.enrichment_json = JSON.stringify(data.enrichment_json);
  }
  data.last_updated = todayISO();

  const cols = Object.keys(data);
  if (cols.length === 0) return errorResponse('No fields to update');
  const sql = `UPDATE properties SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...cols.map(c => data[c]), id).run();

  const changes = describeChanges(existing, data);
  if (changes.length) {
    await logEvent(env.DB, id, `Updated — ${changes.join('; ')}`);
  }

  const updated = await getPropertyById(env.DB, id);
  updated.gap_pct = computeGapPct(updated.asking_price, updated.my_max_price);
  return jsonResponse({ property: updated });
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  const existing = await getPropertyById(env.DB, id);
  if (!existing) return errorResponse('Not found', 404);

  const files = await env.DB.prepare('SELECT r2_key FROM property_files WHERE property_id = ?').bind(id).all();
  for (const f of files.results) {
    try { await env.FILES.delete(f.r2_key); } catch { /* ignore */ }
  }
  await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
