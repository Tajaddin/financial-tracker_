import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
};

export const accounts = {
  getAll: () => api.get('/accounts'),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
  delete: (id) => api.delete(`/accounts/${id}`),
};

export const transactions = {
  getAll: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  import: (formData) => api.post('/transactions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const borrowings = {
  getAll: () => api.get('/borrowings'),
  create: (data) => api.post('/borrowings', data),
  markPaid: (id) => api.put(`/borrowings/${id}/paid`),
};

export const workSchedule = {
  getAll: (params) => api.get('/work-schedule', { params }),
  create: (data) => api.post('/work-schedule', data),
};

export default api;