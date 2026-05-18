import { jsonResponse, errorResponse } from '../_shared.js';

const BORO_CODE_TO_ABBR = { '1': 'MN', '2': 'BX', '3': 'BK', '4': 'QN', '5': 'SI' };
const BORO_NAME_TO_ABBR = {
  'manhattan': 'MN', 'bronx': 'BX', 'brooklyn': 'BK', 'queens': 'QN',
  'staten island': 'SI',
};

async function fetchJson(url, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function geosearch(address) {
  const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
  const data = await fetchJson(url);
  if (!data || !data.features || !data.features.length) return null;
  const f = data.features[0];
  const p = f.properties || {};
  return {
    bbl: p.pad_bbl || p.addendum?.pad?.bbl || null,
    bin: p.pad_bin || p.addendum?.pad?.bin || null,
    borough_code: p.borough_gid ? String(p.borough_gid).split('/').pop() : null,
    borough_name: p.borough || null,
    name: p.name || null,
    label: p.label || null,
    coordinates: f.geometry?.coordinates || null,
  };
}

function detectRentStabilized(pluto) {
  if (!pluto) return { value: 'Not Checked', reason: 'No PLUTO data' };
  const units = parseInt(pluto.unitsres || pluto.unitsRes || '0', 10);
  const yearBuilt = parseInt(pluto.yearbuilt || pluto.yearBuilt || '0', 10);
  const bldgClass = (pluto.bldgclass || pluto.bldgClass || '').toUpperCase();

  // Condo / coop / SF
  if (bldgClass.startsWith('R')) return { value: 'No', reason: 'Condominium (R-class)' };
  if (bldgClass === 'D4') return { value: 'No', reason: 'Cooperative (D4)' };
  if (units < 6) return { value: 'No', reason: `Only ${units} units (< 6)` };
  if (units >= 6 && yearBuilt > 0 && yearBuilt < 1974 && (bldgClass.startsWith('C') || bldgClass.startsWith('D'))) {
    return { value: 'Likely', reason: `${units} units, built ${yearBuilt}, class ${bldgClass}` };
  }
  if (units >= 6 && yearBuilt >= 1974) {
    return { value: 'Possible', reason: `${units} units, built ${yearBuilt} (post-1974)` };
  }
  return { value: 'Possible', reason: `${units} units, year built unknown` };
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON'); }
  const address = (body.address || '').trim();
  if (!address) return errorResponse('address required');

  const geo = await geosearch(address);
  if (!geo || !geo.bbl) {
    return jsonResponse({ ok: false, error: 'BBL not found for that address', geo });
  }
  const bbl = geo.bbl;
  const borough = BORO_CODE_TO_ABBR[geo.borough_code] || (geo.borough_name && BORO_NAME_TO_ABBR[geo.borough_name.toLowerCase()]) || null;

  const [pluto, valuation, hpdViolations, dobViolations] = await Promise.all([
    fetchJson(`https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=${bbl}`),
    fetchJson(`https://data.cityofnewyork.us/resource/8y4t-faws.json?$where=${encodeURIComponent(`bble='${bbl}'`)}&$limit=1`),
    fetchJson(`https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$where=${encodeURIComponent(`bbl='${bbl}' AND violationstatus='Open'`)}&$limit=50`),
    fetchJson(`https://data.cityofnewyork.us/resource/3h2n-5cm9.json?$where=${encodeURIComponent(`bbl='${bbl}'`)}&$limit=50`),
  ]);

  const plutoRow = pluto && pluto[0] ? pluto[0] : null;
  const valuationRow = valuation && valuation[0] ? valuation[0] : null;

  const stab = detectRentStabilized(plutoRow);
  if (valuationRow) {
    const codes = [valuationRow.ex_cd1, valuationRow.ex_cd2].filter(Boolean).map(c => String(c).toUpperCase());
    if (codes.some(c => c.includes('421') || c.includes('J51') || c.includes('J-51'))) {
      stab.value = 'Confirmed';
      stab.reason = `Tax exemption found: ${codes.join(', ')}`;
    }
  }

  return jsonResponse({
    ok: true,
    geo,
    bbl,
    borough,
    pluto: plutoRow,
    valuation: valuationRow,
    hpd_open_count: Array.isArray(hpdViolations) ? hpdViolations.length : 0,
    dob_count: Array.isArray(dobViolations) ? dobViolations.length : 0,
    rent_stabilized: stab,
    suggested: {
      address: geo.label || geo.name || address,
      bbl,
      borough,
      year_built: plutoRow ? parseInt(plutoRow.yearbuilt || '0', 10) || null : null,
      units: plutoRow ? parseInt(plutoRow.unitsres || '0', 10) || null : null,
      rent_stabilized: stab.value,
    },
  });
}
