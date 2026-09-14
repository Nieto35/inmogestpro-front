// src/config/paymentMethods.js
//
// Métodos de pago: UNA sola lista para toda la aplicación.
//
// Antes cada pantalla tenía la suya —Pagos, detalle de contrato y
// Liquidaciones— y no coincidían: Liquidaciones ofrecía «otro» y le
// faltaban PSE y tarjeta. Al añadir un método había que acordarse de tres
// sitios, y el día que uno se olvidaba el usuario lo veía en una pantalla
// y no en otra.
//
// Los valores tienen que coincidir con el CHECK de `payments.payment_method`
// en la base de datos (scripts/update-master-schema-function.sql). Si se
// añade uno aquí, hay que añadirlo allá con una migración.
export const PAYMENT_METHODS = [
  { value:'transferencia', label:'Transferencia bancaria' },
  { value:'pse',           label:'PSE'                   },
  { value:'efectivo',      label:'Efectivo'               },
  { value:'deposito',      label:'Depósito'               },
  { value:'cheque',        label:'Cheque'                 },
  { value:'tarjeta',       label:'Tarjeta'                },
];

// Liquidaciones al propietario: el giro puede salir por cualquiera de los
// anteriores, y además admite «otro» porque esa tabla no tiene CHECK y a
// veces se paga por medios que no son de cobro (compensación, cruce).
export const SETTLEMENT_METHODS = [
  ...PAYMENT_METHODS,
  { value:'otro', label:'Otro' },
];

// Etiqueta legible de un valor. Si llega algo desconocido —un valor viejo,
// un dato importado— se muestra tal cual en vez de romper.
const LABELS = Object.fromEntries(SETTLEMENT_METHODS.map(m => [m.value, m.label]));
export const methodLabel = (value) => LABELS[value] || value || '—';

export const DEFAULT_METHOD = 'transferencia';
