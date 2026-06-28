// API Service — WhatsApp Automate Frontend
import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7001/api/v1'
const ORIGIN_URL = BASE_URL.replace(/\/api\/v1\/?$/, '')

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
  getChats: () => api.get('/contacts/chats'),
  getGroupMembers: (id) => api.get(`/contacts/${id}/group-members`),
  getProfilePic: (id) => api.get(`/contacts/${id}/profile-pic`),
  exportCsv: () => api.get('/contacts/export', { responseType: 'blob' }),
  importCsv: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post('/contacts/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
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
  dryRun: (id) => api.post(`/automations/${id}/run`, null, { params: { dry_run: true } }),
  duplicate: (id) => api.post(`/automations/${id}/duplicate`),
  webhookTrigger: (id) => api.post(`/automations/${id}/webhook-trigger`),
  getHistory: (id, limit = 20) => api.get(`/automations/${id}/history`, { params: { limit } }),
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
  getSettings: () => api.get('/logs/settings'),
  saveSettings: (data) => api.put('/logs/settings', data),
  export: () => api.get('/logs/export', { responseType: 'blob' }),
}

// ─── Health API ───────────────────────────────────────────────
export const healthApi = {
  check: () => axios.get(`${ORIGIN_URL}/health`),
}

// ─── Campaigns & Queue API ─────────────────────────────────────
export const campaignsApi = {
  getAll: (params) => api.get('/campaigns', { params }),
  getById: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  resume: (id) => api.post(`/campaigns/${id}/resume`),
  cancel: (id) => api.post(`/campaigns/${id}/cancel`),
  getJobs: (id, params) => api.get(`/campaigns/${id}/jobs`, { params }),
  cancelJob: (campaignId, jobId) => api.post(`/campaigns/${campaignId}/jobs/${jobId}/cancel`),
  retryJob: (campaignId, jobId) => api.post(`/campaigns/${campaignId}/jobs/${jobId}/retry`),
}

// ─── Groups API (Phase 12) ────────────────────────────────────
export const groupsApi = {
  create: (data) => api.post('/contacts/group/create', data),
  addMembers: (data) => api.post('/contacts/group/add-members', data),
  removeMember: (data) => api.post('/contacts/group/remove-member', data),
  promote: (data) => api.post('/contacts/group/promote', data),
  demote: (data) => api.post('/contacts/group/demote', data),
  rename: (data) => api.post('/contacts/group/rename', data),
  setDescription: (data) => api.post('/contacts/group/set-description', data),
  getInviteLink: (groupId) => api.get('/contacts/group/invite-link', { params: { groupId } }),
  leave: (data) => api.post('/contacts/group/leave', data),
}

// ─── Status API (Phase 13) ────────────────────────────────────
export const statusApi = {
  list: () => api.get('/contacts/status/list'),
  post: (data) => api.post('/contacts/status/post', data),
}

// ─── Dashboard Summary ────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
}

export default api
