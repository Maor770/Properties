import { jsonResponse, errorResponse, FILE_CATEGORIES, logEvent } from '../../_shared.js';

function sanitize(name) {
  return String(name).replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'file';
}

export async function onRequestPost({ env, request }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return errorResponse('Expected multipart/form-data');
  }

  const form = await request.formData();
  const propertyId = Number(form.get('property_id'));
  if (!propertyId) return errorResponse('property_id required');
  const category = (form.get('category') || 'other').toString();
  if (!FILE_CATEGORIES.includes(category)) return errorResponse('invalid category');

  const property = await env.DB.prepare('SELECT id, address FROM properties WHERE id = ?').bind(propertyId).first();
  if (!property) return errorResponse('property not found', 404);

  const file = form.get('file');
  if (!file || typeof file === 'string') return errorResponse('file required');

  const baseUrl = env.FILES_PUBLIC_BASE;
  if (!baseUrl) return errorResponse('FILES_PUBLIC_BASE env var not configured', 500);

  const safe = sanitize(file.name || 'file');
  const stamp = Date.now();
  const key = `properties/${propertyId}/${category}/${stamp}-${safe}`;

  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  const publicUrl = `${baseUrl.replace(/\/$/, '')}/${key}`;
  const inserted = await env.DB.prepare(
    'INSERT INTO property_files (property_id, category, filename, r2_key, public_url, size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(propertyId, category, safe, key, publicUrl, file.size || 0, file.type || null).run();

  await logEvent(env.DB, propertyId, `File uploaded — ${category}: ${safe}`);

  return jsonResponse({
    file: {
      id: inserted.meta.last_row_id,
      property_id: propertyId,
      category,
      filename: safe,
      r2_key: key,
      public_url: publicUrl,
      size: file.size || 0,
      mime_type: file.type || null,
    },
  }, { status: 201 });
}
