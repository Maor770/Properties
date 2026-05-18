import { jsonResponse, errorResponse, logEvent } from '../../_shared.js';

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  const file = await env.DB.prepare('SELECT * FROM property_files WHERE id = ?').bind(id).first();
  if (!file) return errorResponse('not found', 404);

  try { await env.FILES.delete(file.r2_key); } catch { /* ignore */ }
  await env.DB.prepare('DELETE FROM property_files WHERE id = ?').bind(id).run();
  await logEvent(env.DB, file.property_id, `File removed — ${file.category}: ${file.filename}`);

  return jsonResponse({ ok: true });
}
