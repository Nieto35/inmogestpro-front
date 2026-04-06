// src/utils/tenant.js
// ============================================================
// UTILIDADES MULTI-TENANT FRONTEND
// El slug del tenant se obtiene en este orden de prioridad:
// 1. Del token JWT (más confiable)
// 2. Del pathname de la URL
// 3. Del sessionStorage
// ============================================================

const RESERVED = new Set([
  'super-admin','login','dashboard','contracts','clients','projects',
  'properties','payments','advisors','commissions','reports','audit',
  'users','profile','interactions','settings','api','v1','uploads',
]);

/**
 * Decodifica el JWT sin verificar firma (solo para leer el payload)
 */
const decodeJWT = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch { return null; }
};

/**
 * Lee el tenantSlug del token JWT guardado en localStorage
 */
export const getTenantSlugFromToken = () => {
  const token = localStorage.getItem('inmogest_token');
  if (!token) return null;
  const payload = decodeJWT(token);
  return payload?.tenantSlug || null;
};

/**
 * Extrae el slug de la URL — solo si no es una palabra reservada
 */
export const getTenantSlugFromUrl = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (!parts.length) return null;
  const first = parts[0];
  if (RESERVED.has(first)) return null;
  return first;
};

/**
 * Guarda el slug en sessionStorage (solo si es válido)
 */
export const saveTenantSlug = (slug) => {
  if (slug && !RESERVED.has(slug)) {
    sessionStorage.setItem('inmogest_tenant', slug);
  }
};

export const getSavedTenantSlug = () =>
  sessionStorage.getItem('inmogest_tenant');

export const clearTenantSlug = () => {
  sessionStorage.removeItem('inmogest_tenant');
};

/**
 * Retorna el slug activo — prioridad: JWT > URL > sessionStorage
 */
export const getActiveTenantSlug = () =>
  getTenantSlugFromToken() ||
  getTenantSlugFromUrl()   ||
  getSavedTenantSlug();

/**
 * URL base de la API para el tenant actual
 */
export const getTenantApiBase = () => {
  const slug = getActiveTenantSlug();
  return slug ? `/api/v1/${slug}` : '/api/v1';
};