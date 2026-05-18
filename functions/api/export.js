import { computeGapPct } from '../_shared.js';

const HEADERS = [
  'Status', 'Address', 'Next Step',
  'My Max Price ($)', 'Asking Price ($)', 'Gap %',
  'Units', 'Annual NOI ($)', 'DSCR', 'Annual Cash Flow ($)', 'CoC Return (%)',
  'Rent Stabilized',
  'BBL', 'Borough', 'Year Built',
  'Last Offer ($)', 'Notes', 'Last Updated', 'Files',
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function row(p, files) {
  const gap = computeGapPct(p.asking_price, p.my_max_price);
  const fileLinks = (files || []).map(f => `${f.filename}: ${f.public_url}`).join(' | ');
  return [
    p.status, p.address, p.next_step,
    p.my_max_price, p.asking_price, gap !== null ? (gap * 100).toFixed(1) + '%' : '',
    p.units, p.annual_noi, p.dscr, p.annual_cash_flow,
    p.coc_return !== null && p.coc_return !== undefined ? p.coc_return : '',
    p.rent_stabilized,
    p.bbl, p.borough, p.year_built,
    p.last_offer, p.notes, p.last_updated, fileLinks,
  ];
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();

  const { results: properties } = await env.DB.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
  const { results: allFiles } = await env.DB.prepare('SELECT * FROM property_files ORDER BY uploaded_at ASC').all();
  const filesByProp = new Map();
  for (const f of allFiles) {
    if (!filesByProp.has(f.property_id)) filesByProp.set(f.property_id, []);
    filesByProp.get(f.property_id).push(f);
  }

  if (format === 'json') {
    return new Response(JSON.stringify({
      headers: HEADERS,
      rows: properties.map(p => row(p, filesByProp.get(p.id))),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // CSV with UTF-8 BOM so Excel/Sheets parse correctly
  const lines = [HEADERS.join(',')];
  for (const p of properties) {
    lines.push(row(p, filesByProp.get(p.id)).map(csvEscape).join(','));
  }
  const csv = '﻿' + lines.join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="properties-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
