export const COLUMNS = [
  'status', 'address', 'next_step',
  'my_max_price', 'asking_price',
  'units', 'annual_noi', 'dscr', 'annual_cash_flow', 'coc_return',
  'rent_stabilized', 'bbl', 'borough', 'year_built',
  'last_offer', 'notes', 'last_updated', 'enrichment_json',
];

export const STATUSES = ['Initial Review', 'Offer Sent', 'Negotiating', 'Passed'];
export const STAB_VALUES = ['Confirmed', 'Likely', 'Possible', 'No', 'Not Checked'];
export const BOROUGHS = ['BK', 'MN', 'QN', 'BX', 'SI'];
export const FILE_CATEGORIES = [
  'contracts', 'photos', 'inspection', 'dscr', 'correspondence', 'other',
];

export function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, { status });
}

export function pickColumns(body) {
  const out = {};
  for (const c of COLUMNS) {
    if (body[c] !== undefined) out[c] = body[c];
  }
  return out;
}

export function computeGapPct(asking, myMax) {
  if (!asking || !myMax) return null;
  return (asking - myMax) / asking;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function safeNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function safeInt(v) {
  const n = safeNum(v);
  return n === null ? null : Math.trunc(n);
}

export async function getPropertyById(db, id) {
  return await db.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
}

export async function logEvent(db, propertyId, message) {
  await db.prepare('INSERT INTO property_log (property_id, message) VALUES (?, ?)')
    .bind(propertyId, message).run();
}
