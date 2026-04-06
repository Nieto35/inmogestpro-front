// src/utils/currency.js — formatCurrency global usando el store de moneda
import useCurrencyStore from '../store/currencyStore';

/**
 * Formatea un valor numérico con la moneda configurada en el sistema.
 * Usar en componentes: import { formatCurrency } from '../../utils/currency';
 */
export const formatCurrency = (value) => {
  const { code, locale } = useCurrencyStore.getState();
  try {
    return new Intl.NumberFormat(locale || 'es-CO', {
      style:                 'currency',
      currency:              code  || 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `$ ${Number(value || 0).toLocaleString()}`;
  }
};

/**
 * Hook para usar formatCurrency reactivamente en componentes React.
 * Cuando el admin cambia la moneda, todos los componentes que usen este hook se actualizan.
 */
export const useCurrencyFormat = () => {
  const { format, code, symbol, name } = useCurrencyStore();
  return { formatCurrency: format, currencyCode: code, currencySymbol: symbol, currencyName: name };
};