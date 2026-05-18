import {
  COLUMNS, STATUSES, STAB_VALUES, BOROUGHS,
  jsonResponse, errorResponse, pickColumns, computeGapPct, todayISO, safeNum, safeInt, logEvent,
} from '../../_shared.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const borough = url.searchParams.get('borough');
  const q = url.searchParams.get('q');

  const where = [];
  const binds = [];
  if (status) { where.push('status = ?'); binds.push(status); }
  if (borough) { where.push('borough = ?'); binds.push(borough); }
  if (q) { where.push('(address LIKE ? OR notes LIKE ? OR bbl LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const sql = `SELECT * FROM properties${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const stmt = binds.length ? env.DB.prepare(sql).bind(...binds) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  for (const r of results) {
    r.gap_pct = computeGapPct(r.asking_price, r.my_max_price);
  }
  return jsonResponse({ properties: results });
}

export async function onRequestPost({ env, request }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON'); }

  if (!body.address || !String(body.address).trim()) {
    return errorResponse('address is required');
  }
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
  data.last_updated = todayISO();
  if (!data.status) data.status = 'Initial Review';
  if (!data.rent_stabilized) data.rent_stabilized = 'Not Checked';
  if (typeof data.enrichment_json === 'object' && data.enrichment_json !== null) {
    data.enrichment_json = JSON.stringify(data.enrichment_json);
  }

  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(',');
  const sql = `INSERT INTO properties (${cols.join(',')}) VALUES (${placeholders})`;
  const result = await env.DB.prepare(sql).bind(...cols.map(c => data[c])).run();
  const id = result.meta.last_row_id;

  await logEvent(env.DB, id, `Created: ${data.address}`);

  const created = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
  created.gap_pct = computeGapPct(created.asking_price, created.my_max_price);
  return jsonResponse({ property: created }, { status: 201 });
}
