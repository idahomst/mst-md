// Thin JSON client for api.php. Throws ApiError with the HTTP status.

const csrf = document.querySelector('meta[name="csrf-token"]').content;

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(action, { query, body } = {}) {
  const url = new URL('api.php', location.href);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, body === undefined
      ? { headers: { Accept: 'application/json' } }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify(body),
        });
  } catch {
    throw new ApiError('You appear to be offline — changes are kept until the connection is back', 0);
  }

  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

export const api = {
  tree:         ()                     => request('tree'),
  read:         (path)                 => request('read', { query: { path } }),
  search:       (q)                    => request('search', { query: { q } }),
  save:         (path, content, version, force = false) => request('save', { body: { path, content, version, force } }),
  createNote:   (folder, name)         => request('createNote', { body: { folder, name } }),
  createFolder: (parent, name)         => request('createFolder', { body: { parent, name } }),
  move:         (from, to)             => request('move', { body: { from, to } }),
  remove:       (path)                 => request('delete', { body: { path } }),
};
