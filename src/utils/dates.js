// src/utils/dates.js
// ─────────────────────────────────────────────────────────────
// Helpers para manejar fechas del sistema sin problemas de zona
// horaria.
//
// CONTEXTO DEL BUG:
//   Antes hacíamos `format(new Date('2026-07-20'), 'dd/MM/yyyy')`.
//   El backend nos manda columnas DATE tal cual como string
//   "YYYY-MM-DD" (gracias al setTypeParser en pg). Pero
//   `new Date('2026-07-20')` en JavaScript interpreta esa fecha
//   como MEDIANOCHE UTC — y al formatearla en hora local (por
//   ejemplo Ecuador UTC-5), se corre al día anterior. Resultado:
//   "20/07/2026" se ve como "19/07/2026".
//
// SOLUCIÓN:
//   Parsear el string "YYYY-MM-DD" a un Date construido con
//   año/mes/día en hora LOCAL. Así el día es siempre el mismo
//   para todos los usuarios, independientemente de su TZ.
//
// USO:
//   Para columnas DATE de la BD (signing_date, payment_date,
//   due_date, paid_date, reservation_date, expiry_date,
//   date_of_birth, etc.):
//     import { formatDate } from '../utils/dates';
//     formatDate(c.signing_date);              // '20/07/2026'
//     formatDate(c.signing_date, 'dd/MM/yy');  // '20/07/26'
//
//   Para timestamps (created_at, occurred_at, recorded_at,
//   cancelled_at, last_login…) SEGUIR usando `format(new Date(...))`
//   porque esos SÍ deben mostrarse en la hora local de cada
//   usuario.
// ─────────────────────────────────────────────────────────────

import { format as dfnsFormat } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Convierte un string "YYYY-MM-DD" (o algo que empiece con eso,
 * como un ISO completo) en un Date construido en hora LOCAL.
 * Devuelve null si el valor es vacío o inválido.
 */
export const parseLocalDate = (value) => {
  if (!value) return null;
  const s = String(value).slice(0, 10); // toma YYYY-MM-DD aunque venga con hora
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/**
 * Formatea una fecha de calendario (DATE de la BD) al patrón dado.
 * Devuelve el placeholder si el valor no es una fecha válida.
 */
export const formatDate = (value, pattern = 'dd/MM/yyyy', placeholder = '—') => {
  const d = parseLocalDate(value);
  if (!d) return placeholder;
  return dfnsFormat(d, pattern, { locale: es });
};

/**
 * Devuelve el "hoy" como string "YYYY-MM-DD" según la zona horaria
 * LOCAL del navegador. Útil para prellenar inputs type="date" y
 * para valores por defecto de formularios.
 *
 * Antes usábamos `new Date().toISOString().slice(0,10)` que devuelve
 * la fecha en UTC — a las 11 pm de Ecuador nos daba el día siguiente.
 */
export const todayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
