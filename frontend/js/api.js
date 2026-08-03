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

    list: (filters = {}) => {
      const params = new URLSearchParams();

      if (filters.status) params.set('status', filters.status);
      if (filters.user_id) params.set('user_id', filters.user_id);
      if (filters.category) params.set('category', filters.category);

      const qs = params.toString();

      return apiRequest(`/api/complaints/${qs ? `?${qs}` : ''}`, { 
        method: 'GET' 
      });
    },

    get: (id) =>
      apiRequest(`/api/complaints/${id}`, { 
        method: 'GET' 
      }),

    update: (id, payload) =>
      apiRequest(`/api/complaints/${id}`, { 
        method: 'PATCH', 
        body: payload 
      }),

    updateStatus: (id, status) =>
      apiRequest(`/api/complaints/${id}/status`, { 
        method: 'PATCH', 
        body: { status } 
      }),

    remove: (id) =>
      apiRequest(`/api/complaints/${id}`, { 
        method: 'DELETE' 
      }),
  },

  images: {
    upload: async () => {
      throw new Error('Image upload endpoint is not available on the backend yet.');
    },
  },

  comments: {
    list: async () => {
      throw new Error('Comments endpoint is not available on the backend yet.');
    },

    add: async () => {
      throw new Error('Comments endpoint is not available on the backend yet.');
    },
  },

  profile: {
    update: async () => {
      throw new Error('Profile update endpoint is not available on the backend yet.');
    },

    changePassword: async () => {
      throw new Error('Change-password endpoint is not available on the backend yet.');
    },
  },
};
