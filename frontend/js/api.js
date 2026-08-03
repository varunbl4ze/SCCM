const API_BASE_URL = 'http://127.0.0.1:5000/api';

/**
 * Core request helper.
 * @param {string} path - path relative to API_BASE_URL, e.g. '/auth/login'
 * @param {object} options
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [options.method='GET']
 * @param {object} [options.body] - JSON-serializable request body
 * @param {boolean} [options.auth=false] - attach the stored bearer token
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function apiRequest(path, options = {}) {
  const { method = 'GET', body, auth = false } = options;

  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getToken(); // provided by auth.js
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // Backend unreachable — surface a clear, actionable message rather
    // than letting a raw TypeError bubble up to the UI.
    throw new Error(
      'Could not reach the server. Make sure the Flask backend is running at ' + API_BASE_URL
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return { ok: true, status: response.status, data };
}

/* ---- Grouped, page-friendly API surface ---------------------------------*/
const API = {
  auth: {
    register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
    me: () => apiRequest('/auth/me', { method: 'GET', auth: true }),
  },

  complaints: {
    create: (payload) => apiRequest('/complaints/', { method: 'POST', body: payload }),

    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.user_id) params.set('user_id', filters.user_id);
      if (filters.category) params.set('category', filters.category);
      const qs = params.toString();
      return apiRequest(`/complaints/${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },

    get: (id) => apiRequest(`/complaints/${id}`, { method: 'GET' }),

    update: (id, payload) => apiRequest(`/complaints/${id}`, { method: 'PATCH', body: payload }),

    updateStatus: (id, status) =>
      apiRequest(`/complaints/${id}/status`, { method: 'PATCH', body: { status } }),

    remove: (id) => apiRequest(`/complaints/${id}`, { method: 'DELETE' }),
  },

  /* --------------------------------------------------------------------
     NOT YET IMPLEMENTED ON THE BACKEND — kept here, clearly marked, so
     the moment the corresponding Flask route exists you only need to
     fill in the path below and remove the thrown error.
     -------------------------------------------------------------------- */
  images: {
    // TODO: backend — wire to services/image_service.py once an upload
    // route (e.g. POST /api/complaints/<id>/image) exists. Until then,
    // complaint.js keeps the chosen file client-side only and shows a
    // note that the photo isn't persisted yet.
    upload: async () => {
      throw new Error('Image upload endpoint is not available on the backend yet.');
    },
  },

  comments: {
    // TODO: backend — wire to a future GET/POST /api/complaints/<id>/comments
    // route. complaint-details.js currently renders an empty state instead
    // of calling this.
    list: async () => {
      throw new Error('Comments endpoint is not available on the backend yet.');
    },
    add: async () => {
      throw new Error('Comments endpoint is not available on the backend yet.');
    },
  },

  profile: {
    // TODO: backend — wire to a future PATCH /api/auth/me or /api/users/<id>
    // route for editing name/phone, and a POST /api/auth/change-password
    // route. profile.js currently updates the local view only and shows
    // a note that changes aren't persisted yet.
    update: async () => {
      throw new Error('Profile update endpoint is not available on the backend yet.');
    },
    changePassword: async () => {
      throw new Error('Change-password endpoint is not available on the backend yet.');
    },
  },
};
