/* ==========================================================================
   api.js — single source of truth for talking to the Flask backend.
   Every network call in the app goes through `apiRequest()` below so that
   auth headers, error parsing, and the base URL only live in one place.

   Backend endpoints this file talks to (see the Flask project):
     POST   /api/auth/register
     POST   /api/auth/login
     GET    /api/auth/me
     POST   /api/complaints/
     GET    /api/complaints/            (?status=&user_id=&category=)
     GET    /api/complaints/<id>
     PUT    /api/complaints/<id>
     PATCH  /api/complaints/<id>/status
     DELETE /api/complaints/<id>
   ========================================================================== */

/**
 * Change this if your Flask app runs somewhere other than the default
 * `flask run` / `python app.py` address. Everything else in the frontend
 * is wired through this constant — nothing else hardcodes a host.
 */
const API_BASE_URL = 'hhttps://sccm.onrender.com';

/**
 * The backend serves uploaded images from its own root (e.g. /uploads/x.png),
 * not under /api. Since the frontend is typically served from a different
 * origin/port than Flask, image URLs returned by the API (like
 * complaint.image_url) need to be resolved against the Flask host, not the
 * page's own origin. Derived once from API_BASE_URL so there's still only
 * one place to change if your backend host changes.
 */
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Turn a host-relative path returned by the API (e.g. "/uploads/x.png")
 * into an absolute URL pointing at the Flask backend. Returns null/absolute
 * URLs unchanged so it's always safe to call.
 */
function resolveImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

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
    // POST /api/complaints/<id>/image — now live on the backend.
    // Sends the file as multipart/form-data under the field name "image"
    // and returns { message, image_url, complaint }.
    upload: async (complaintId, file) => {
      const formData = new FormData();
      formData.append('image', file);

      let response;
      try {
        response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/image`, {
          method: 'POST',
          body: formData, // no Content-Type header — the browser sets the multipart boundary
        });
      } catch (networkErr) {
        throw new Error(
          'Could not reach the server. Make sure the Flask backend is running at ' + API_BASE_URL
        );
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = (data && data.error) || `Image upload failed (${response.status})`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      return { ok: true, status: response.status, data };
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
    // PATCH /api/auth/me — now live. Works for citizens and admins alike.
    update: (payload) => apiRequest('/auth/me', { method: 'PATCH', body: payload, auth: true }),

    // POST /api/auth/change-password — now live.
    changePassword: (payload) => apiRequest('/auth/change-password', { method: 'POST', body: payload, auth: true }),
  },

  /* --------------------------------------------------------------------
     Admin-only surface. Every call here hits a route wrapped in the
     backend's @admin_required decorator (see routes/admin.py) — a
     citizen's token gets a 403 from the SERVER on every single one of
     these, regardless of what the admin UI does or doesn't show. The
     `auth: true` flag on each request attaches the bearer token exactly
     like the rest of the app.
     -------------------------------------------------------------------- */
  admin: {
    overview: () => apiRequest('/admin/overview', { method: 'GET', auth: true }),

    listComplaints: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.category) params.set('category', filters.category);
      if (filters.department_id) params.set('department_id', filters.department_id);
      if (filters.unassigned) params.set('unassigned', 'true');
      const qs = params.toString();
      return apiRequest(`/admin/complaints${qs ? `?${qs}` : ''}`, { method: 'GET', auth: true });
    },

    assignComplaint: (id, payload) =>
      apiRequest(`/admin/complaints/${id}/assign`, { method: 'PATCH', body: payload, auth: true }),

    updateComplaintStatus: (id, status) =>
      apiRequest(`/admin/complaints/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),

    listUsers: (role) =>
      apiRequest(`/admin/users${role ? `?role=${role}` : ''}`, { method: 'GET', auth: true }),

    changeUserRole: (userId, role) =>
      apiRequest(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role }, auth: true }),

    deleteUser: (userId) =>
      apiRequest(`/admin/users/${userId}`, { method: 'DELETE', auth: true }),

    listDepartments: () => apiRequest('/admin/departments', { method: 'GET', auth: true }),

    createDepartment: (payload) =>
      apiRequest('/admin/departments', { method: 'POST', body: payload, auth: true }),

    updateDepartment: (id, payload) =>
      apiRequest(`/admin/departments/${id}`, { method: 'PATCH', body: payload, auth: true }),

    deleteDepartment: (id) =>
      apiRequest(`/admin/departments/${id}`, { method: 'DELETE', auth: true }),

    analytics: () => apiRequest('/admin/analytics', { method: 'GET', auth: true }),

    sendNotification: (payload) =>
      apiRequest('/admin/notifications/send', { method: 'POST', body: payload, auth: true }),
  },
};
