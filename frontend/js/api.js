const API_BASE_URL = 'https://sccm.onrender.com';

async function apiRequest(path, options = {}) {
  const { method = 'GET', body, auth = false } = options;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      'Could not reach the server. Make sure the Flask backend is running at ' + API_BASE_URL
    );
  }

  let data = null;

  const text = await response.text();

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return {
    ok: true,
    status: response.status,
    data
  };
}


const API = {

  auth: {
    register: (payload) =>
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: payload
      }),

    login: (payload) =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: payload
      }),

    me: () =>
      apiRequest('/api/auth/me', {
        method: 'GET',
        auth: true
      }),
  },


  complaints: {

    create: (payload) =>
      apiRequest('/api/complaints/', {
        method: 'POST',
        body: payload
      }),

    list: () =>
      apiRequest('/api/complaints/', {
        method: 'GET'
      }),

    get: (id) =>
      apiRequest(`/api/complaints/${id}`, {
        method: 'GET'
      }),

    updateStatus: (id, status) =>
      apiRequest(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        body: { status }
      }),

  }

};