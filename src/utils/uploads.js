// src/utils/uploads.js
// ─────────────────────────────────────────────────────────────
// Constantes de subida de archivos para los textos de ayuda de la interfaz.
//
// ⚠️ DEBE COINCIDIR con el backend: inmogestpro-back/src/config/uploads.js
//    Si allá cambia MAX_FILE_SIZE_MB, actualizar aquí también.
//
// Antes cada pantalla escribía su propio texto ("máx 10 MB") y algunos no
// decían nada, mientras el backend aceptaba otro valor. Esto unifica el
// mensaje en un solo lugar.
// ─────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_MB = 30;

/** Texto estándar para documentos e imágenes. */
export const UPLOAD_HINT = `PDF, JPG o PNG — máx ${MAX_FILE_SIZE_MB} MB`;

/** Texto para el módulo de Interacciones, que además acepta audio y video. */
export const UPLOAD_HINT_MEDIA = `PDF, imagen, audio o video — máx ${MAX_FILE_SIZE_MB} MB`;

/**
 * Valida el tamaño en el navegador antes de enviar, para dar feedback
 * inmediato en lugar de esperar el rechazo del servidor.
 * @returns {string|null} mensaje de error, o null si el archivo es válido
 */
export const validateFileSize = (file) => {
  if (!file) return null;
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return `El archivo pesa ${sizeMb} MB y el máximo permitido es ${MAX_FILE_SIZE_MB} MB.`;
  }
  return null;
};
