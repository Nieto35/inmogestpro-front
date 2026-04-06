// src/store/currencyStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCurrencyStore = create(
  persist(
    (set, get) => ({
      code:   'COP',
      symbol: '$',
      name:   'Peso Colombiano',
      locale: 'es-CO',

      setCurrency: (code, symbol, name, locale) =>
        set({ code, symbol, name, locale }),

      format: (value) => {
        const { code, locale } = get();
        try {
          return new Intl.NumberFormat(locale || 'es-CO', {
            style:                 'currency',
            currency:              code || 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value || 0);
        } catch {
          return `$ ${Number(value||0).toLocaleString()}`;
        }
      },
    }),
    { name: 'inmogest-currency' }
  )
);

export default useCurrencyStore;