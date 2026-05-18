async function handle(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  list(params = {}) {
    const q = new URLSearchParams(params).toString();
    return fetch('/api/properties' + (q ? '?' + q : '')).then(handle);
  },
  get(id) {
    return fetch(`/api/properties/${id}`).then(handle);
  },
  create(data) {
    return fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handle);
  },
  update(id, data) {
    return fetch(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handle);
  },
  remove(id) {
    return fetch(`/api/properties/${id}`, { method: 'DELETE' }).then(handle);
  },
  lookup(address) {
    return fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    }).then(handle);
  },
  uploadFile(propertyId, file, category = 'other') {
    const fd = new FormData();
    fd.append('property_id', propertyId);
    fd.append('category', category);
    fd.append('file', file);
    return fetch('/api/files/upload', { method: 'POST', body: fd }).then(handle);
  },
  deleteFile(id) {
    return fetch(`/api/files/${id}`, { method: 'DELETE' }).then(handle);
  },
  exportUrl() {
    return '/api/export?format=csv';
  },
};
