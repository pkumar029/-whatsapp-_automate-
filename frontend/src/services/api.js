// API Service — WhatsApp Automate Frontend
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// ─── Axios Instance ─────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wa_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor ────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wa_token')
    }
    return Promise.reject(error)
  }
)

// ─── WhatsApp API ─────────────────────────────────────────────
export const whatsappApi = {
  getStatus: () => api.get('/whatsapp/status'),
  connect: (data) => api.post('/whatsapp/connect', data),
  disconnect: () => api.post('/whatsapp/disconnect'),
  sendMessage: (data) => api.post('/whatsapp/send', data),
  getQR: () => api.get('/whatsapp/qr'),
}

// ─── Contacts API ─────────────────────────────────────────────
export const contactsApi = {
  getAll: (params) => api.get('/contacts', { params }),
  getById: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  search: (query) => api.get('/contacts/search', { params: { q: query } }),
  sync: () => api.post('/contacts/sync'),
}

// ─── Messages API ─────────────────────────────────────────────
export const messagesApi = {
  getAll: (params) => api.get('/messages', { params }),
  getById: (id) => api.get(`/messages/${id}`),
  send: (data) => api.post('/messages/send', data),
  getByContact: (contactId, params) => api.get(`/messages/contact/${contactId}`, { params }),
}

// ─── Automations API ─────────────────────────────────────────
export const automationsApi = {
  getAll: (params) => api.get('/automations', { params }),
  getById: (id) => api.get(`/automations/${id}`),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  delete: (id) => api.delete(`/automations/${id}`),
  activate: (id) => api.post(`/automations/${id}/activate`),
  deactivate: (id) => api.post(`/automations/${id}/deactivate`),
  run: (id) => api.post(`/automations/${id}/run`),
  getSteps: (id) => api.get(`/automations/${id}/steps`),
  addStep: (id, data) => api.post(`/automations/${id}/steps`, data),
  updateStep: (id, stepId, data) => api.put(`/automations/${id}/steps/${stepId}`, data),
  deleteStep: (id, stepId) => api.delete(`/automations/${id}/steps/${stepId}`),
}

// ─── Logs API ─────────────────────────────────────────────────
export const logsApi = {
  getAll: (params) => api.get('/logs', { params }),
  getById: (id) => api.get(`/logs/${id}`),
  getByAutomation: (automationId, params) => api.get(`/logs/automation/${automationId}`, { params }),
  clear: () => api.delete('/logs'),
}

// ─── Health API ───────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health', { baseURL: 'http://localhost:8000' }),
}

// ─── Dashboard Summary ────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
}

export default api
