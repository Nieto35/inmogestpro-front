// src/services/api.service.js
import axios from 'axios';
import toast from 'react-hot-toast';
import { getActiveTenantSlug } from '../utils/tenant';

// Base URL dinámica según el tenant activo
// getActiveTenantSlug() ya filtra palabras reservadas como 'dashboard'

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_VERSION = '/api/v1';

const getApiBase = () => {
  const slug = getActiveTenantSlug();
  const base = `${API_BASE_URL}${API_VERSION}`;
  return slug ? `${base}/${slug}` : base;
};

const api = axios.create({
  baseURL: getApiBase(),
  timeout: 30000,
  headers: { 'Content-Type':'application/json' },
});

// Actualizar baseURL en cada request para reflejar el tenant actual
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  return config;
});

// ── Control de sesión — UN SOLO flag global ───────────────────
let sessionExpired   = false;  // una vez expirada, no volver a intentar
let isRefreshing     = false;
let pendingRequests  = [];

const processQueue = (error, token = null) => {
  pendingRequests.forEach(p => error ? p.reject(error) : p.resolve(token));
  pendingRequests = [];
};

const handleSessionExpired = () => {
  if (sessionExpired) return;
  sessionExpired = true;

  processQueue(new Error('session_expired'), null);
  isRefreshing = false;

  localStorage.removeItem('inmogest_token');
  localStorage.removeItem('inmogest_refresh');

  // Redirigir UNA SOLA VEZ — preservando el slug del tenant en la URL
  if (!window.location.pathname.includes('/login')) {
    const slug = getActiveTenantSlug();
    const loginPath = slug ? `/${slug}/login` : '/login';
    window.location.replace(`${loginPath}?reason=session_expired`);
  }
};

// ── Request: adjuntar token ───────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Si sesión expirada, rechazar inmediatamente sin hacer la petición
    if (sessionExpired && !config.url?.includes('/auth/')) {
      return Promise.reject(new Error('session_expired'));
    }
    const token = localStorage.getItem('inmogest_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: manejar 401 ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    // Sin conexión al servidor — no mostrar si ya expiró
    if (!response) {
      if (!sessionExpired && !config?._silent) {
        toast.error('Sin conexión con el servidor. Verifica que el backend esté corriendo.');
      }
      return Promise.reject(error);
    }

    const url            = config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login')  ||
                           url.includes('/auth/logout') ||
                           url.includes('/auth/refresh')||
                           url.includes('/auth/me');
    const isRetry        = config?._retry;

    // ── 401: Sesión expirada ──────────────────────────────────
    if (response.status === 401 && !isAuthEndpoint && !isRetry) {

      // Si ya se marcó como expirada, no hacer nada más
      if (sessionExpired) return Promise.reject(error);

      // Si ya está intentando renovar, encolar
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token) => {
              config._retry = true;
              config.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(config));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('inmogest_refresh');

      if (refreshToken) {
        try {
          const refreshBase = getApiBase();
          const res = await axios.post(
            `${refreshBase}/auth/refresh`,
            { refreshToken },
            { timeout:5000 }
          );
          const newToken = res.data?.data?.token;
          if (newToken) {
            localStorage.setItem('inmogest_token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            processQueue(null, newToken);
            isRefreshing = false;

            config._retry = true;
            config.headers['Authorization'] = `Bearer ${newToken}`;
            return api(config);
          }
        } catch (_) {
          // refresh falló — sesión expirada definitivamente
        }
      }

      // No se pudo renovar — cerrar sesión
      handleSessionExpired();
      return Promise.reject(error);
    }

    // ── 403: Sin permisos ─────────────────────────────────────
    if (response.status === 403) {
      toast.error('No tienes permisos para realizar esta acción');
    }

    return Promise.reject(error);
  }
);

// ── Reset al hacer login exitoso ──────────────────────────────
export const resetSessionState = () => {
  sessionExpired  = false;
  isRefreshing    = false;
  pendingRequests = [];
};

export default api;

// ──────────────────────────────────────────────────────────────
// Servicios
// ──────────────────────────────────────────────────────────────

export const authService = {
  login:   (d)  => api.post('/auth/login',  d),
  logout:  ()   => api.post('/auth/logout'),
  refresh: (rt) => api.post('/auth/refresh', { refreshToken:rt }),
  me:      ()   => api.get('/auth/me'),
};

export const clientsService = {
  getAll:   (p)    => api.get('/clients',        { params:p }),
  getById:  (id)   => api.get(`/clients/${id}`),
  create:   (d)    => api.post('/clients', d),
  update:   (id,d) => api.put(`/clients/${id}`, d),
  search:   (q)    => api.get('/clients',        { params:{ search:q, limit:10 } }),
  delete:   (id)   => api.delete(`/clients/${id}`),
};

export const projectsService = {
  getAll:          (p) => api.get('/projects',              { params:p }),
  getById:         (id)=> api.get(`/projects/${id}`),
  create:          (d) => api.post('/projects', d),
  update:          (id,d)=> api.put(`/projects/${id}`, d),
  getAvailability: ()  => api.get('/projects/availability'),
};

export const propertiesService = {
  getAll:       (p)     => api.get('/properties',            { params:p }),
  getById:      (id)    => api.get(`/properties/${id}`),
  create:       (d)     => api.post('/properties', d),
  update:       (id,d)  => api.put(`/properties/${id}`, d),
  updateStatus: (id,st) => api.patch(`/properties/${id}/status`, { status:st }),
  getDetail:    (id)    => api.get(`/properties/${id}/detail`),
  createBulk:   (d)     => api.post('/properties/bulk', d),
};

export const contractsService = {
  getAll:             (p)      => api.get('/contracts',                    { params:p }),
  getById:            (id)     => api.get(`/contracts/${id}`),
  create:             (d)      => api.post('/contracts', d),
  update:             (id,d)   => api.put(`/contracts/${id}`, d),
  addPayment:         (id,d)   => api.post(`/contracts/${id}/payments`, d),
  changeStatus:       (id,s,r) => api.patch(`/contracts/${id}/status`,     { status:s, reason:r }),
  markOverdue:        ()       => api.post('/contracts/mark-overdue'),
  regenerateSchedule: (id)     => api.post(`/contracts/${id}/regenerate-schedule`),
  uploadDocument:     (id,fd)  => api.post(`/contracts/${id}/upload`,      fd, { headers:{'Content-Type':'multipart/form-data'} }),
};

export const paymentsService = {
  getAll:     (p)     => api.get('/payments',              { params:p }),
  create:     (d)     => api.post('/payments', d),
  uploadFile: (id,fd) => api.post(`/payments/${id}/upload`,fd, { headers:{'Content-Type':'multipart/form-data'} }),
  getOverdue: ()      => api.get('/payments/overdue'),
  void:       (id,r)  => api.patch(`/payments/${id}/void`, { reason:r }),
};

export const advisorsService = {
  getAll:          (p)    => api.get('/advisors',                    { params:p }),
  getById:         (id)   => api.get(`/advisors/${id}`),
  create:          (d)    => api.post('/advisors', d),
  update:          (id,d) => api.put(`/advisors/${id}`, d),
  getCommissions:  (id,p) => api.get(`/advisors/${id}/commissions`,  { params:p }),
};

export const reportsService = {
  getMonthly:         (p) => api.get('/reports/monthly',             { params:p }),
  getAnnual:          (p) => api.get('/reports/annual',              { params:p }),
  getSalesPerAdvisor: (p) => api.get('/reports/sales-by-advisor',    { params:p }),
  getPortfolio:       (p) => api.get('/reports/portfolio',           { params:p }),
  getOverdue:         (p) => api.get('/reports/overdue',             { params:p }),
  getDashboardKPIs:   ()  => api.get('/reports/kpis'),
  getAdvisorKPIs:     ()  => api.get('/reports/kpis/advisor'),
  getVacancy:         ()  => api.get('/reports/vacancy'),
  getLiquidacion:     (p) => api.get('/reports/liquidacion-mensual', { params:p }),
  getCartera:         ()  => api.get('/reports/cartera'),
};

export const auditService = {
  getAll:      (p) => api.get('/audit/logs',  { params:p }),
  getLogs:     (p) => api.get('/audit/logs',  { params:p }),
  verify:      ()  => api.get('/audit/verify'),
  verifyChain: (p) => api.get('/audit/verify', { params:p }),
};

export const usersService = {
  getAll:          (p)    => api.get('/users',          { params:p }),
  getById:         (id)   => api.get(`/users/${id}`),
  create:          (d)    => api.post('/users', d),
  update:          (id,d) => api.put(`/users/${id}`, d),
  resetPassword:   (id)   => api.post(`/users/${id}/reset-password`),
  toggleActive:    (id,v) => api.patch(`/users/${id}/active`, { is_active:v }),
};

export const configService = {
  get:    ()      => api.get('/config'),
  update: (data)  => api.patch('/config', data),
};

export const commissionsService = {
  getAll:       (p)        => api.get('/commissions',                      { params:p }),
  getOverdue:   ()         => api.get('/commissions/overdue'),
  getPayments:  (id)       => api.get(`/commissions/${id}/payments`),
  create:       (d)        => api.post('/commissions', d),
  markPaid:     (payId, d) => api.patch(`/commissions/payments/${payId}/pay`, d),
  markUnpaid:   (payId)    => api.patch(`/commissions/payments/${payId}/unpay`),
  delete:       (id)       => api.delete(`/commissions/${id}`),
};

export const interactionsService = {
  getAll:         (p)      => api.get('/interactions',                     { params:p }),
  create:         (d)      => api.post('/interactions', d),
  delete:         (id)     => api.delete(`/interactions/${id}`),
  uploadEvidence: (id, fd) => api.post(`/interactions/${id}/upload`,       fd, { headers:{'Content-Type':'multipart/form-data'} }),
  deleteDocument: (id,idx) => api.delete(`/interactions/${id}/documents/${idx}`),
};

// ── Super Admin Service ─────────────────────────────────────
const getSuperAdminBase = () => {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${API_VERSION}/super-admin`;
  }
  return `${API_VERSION}/super-admin`;
};

const saApi = axios.create({
  baseURL: getSuperAdminBase(),
  timeout: 30000,
  headers: { 'Content-Type':'application/json' }
});

saApi.interceptors.request.use(config => {
  config.baseURL = getSuperAdminBase();
  const token = localStorage.getItem('inmogest_sa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('🚀 SuperAdmin Request:', config.baseURL + config.url);
  return config;
});

saApi.interceptors.response.use(
    (response) => {
      console.log('📦 SuperAdmin Response completa:', response);
      console.log('📦 Response data:', response.data);

      // Si la respuesta tiene la estructura { success: true, data: { token, user } }
      if (response.data?.success && response.data?.data) {
        console.log('✅ Normalizando respuesta...');
        // Normalizar para que el token esté disponible en response.data.token
        if (response.data.data.token && !response.data.token) {
          response.data.token = response.data.data.token;
          console.log('📝 Token normalizado:', response.data.token.substring(0, 50) + '...');
        }
        if (response.data.data.user && !response.data.user) {
          response.data.user = response.data.data.user;
        }
      }
      return response;
    },
    (error) => {
      console.error('❌ SuperAdmin Error:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('inmogest_sa_token');
        if (!window.location.pathname.includes('/super-admin/login')) {
          window.location.replace('/super-admin/login?reason=session_expired');
        }
      }
      return Promise.reject(error);
    }
);

export const superAdminService = {
  login:                (d)   => saApi.post('/login',                           d),
  me:                   ()    => saApi.get('/me'),
  getDashboard:         ()    => saApi.get('/dashboard'),
  getTenants:           ()    => saApi.get('/tenants'),
  getTenantStats:       (s)   => saApi.get(`/tenants/${s}/stats`),
  getTenantManagers:    (s)   => saApi.get(`/tenants/${s}/managers`),
  resetManagerPassword: (s,d) => saApi.post(`/tenants/${s}/reset-manager-password`, d),
  createTenant:         (d)   => saApi.post('/tenants',                         d),
  updateTenant:         (s,d) => saApi.patch(`/tenants/${s}`,                   d),
  suspendTenant:        (s)   => saApi.post(`/tenants/${s}/suspend`),
  activateTenant:       (s)   => saApi.post(`/tenants/${s}/activate`),
  getPlans:             ()    => saApi.get('/plans'),
};