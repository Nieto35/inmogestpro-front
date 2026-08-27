// src/config/modules.js
//
// CATALOGO DE MODULOS Y SUS PERMISOS POR DEFECTO
//
// Un solo lugar, importado por el menu (Layout.jsx) y por las guardas de
// ruta (App.jsx). Antes vivia dentro de Layout y las rutas tenian su propia
// lista fija: por eso se desincronizaban y aparecian enlaces que llevaban a
// pantallas bloqueadas.
//
// Los iconos NO estan aqui a proposito — son cosa de la presentacion y
// viven en Layout.jsx.
// El rol `supervisor` estaba en la base y en las rutas del backend —que ya
// filtra sus contratos asignados y lo deja marcar hitos de entrega— pero no
// figuraba en NINGUNA entrada del menú. Entraba y veía la pantalla vacía.
//
// Módulos comunes a las dos pestañas. `scope` los diferencia en la URL para
// que Inmuebles muestre listas separadas: los de venta no se ven en Arriendos
// y viceversa, tal como se definió.
const SHARED_ITEMS = [
  { path: 'dashboard',    label: 'Dashboard', roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'contracts',    label: 'Contratos',        roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'clients',      label: 'Clientes',           roles: ['admin','gerente','contador','abogado','readonly'] },
  { path: 'properties',   label: 'Inmuebles',            roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'payments',     label: 'Pagos',      roles: ['admin','gerente','contador'] },
  { path: 'interactions', label: 'Interacciones',           roles: ['admin','gerente','contador','asesor','abogado','supervisor'] },
  { path: 'advisors',     label: 'Asesores',       roles: ['admin','gerente','contador','readonly'] },
  { path: 'commissions',  label: 'Comisiones',      roles: ['admin','gerente','contador','asesor','supervisor'] },
  { path: 'reports',      label: 'Reportes',       roles: ['admin','gerente','contador','readonly'] },
];

// Módulos administrativos: no pertenecen a ninguna de las dos operaciones.
const ADMIN_ITEMS = [
  // Auditoría es solo del gerente: el backend lo impone con
  // `router.use(authorize('gerente'))`. El menú listaba también al abogado,
  // así que le mostraba un enlace que terminaba en pantalla bloqueada.
  { path: 'audit', label: 'Auditoría',   roles: ['gerente'] },
  { path: 'users', label: 'Usuarios', roles: ['gerente'] },
];

// Proyectos y Manzanas solo existen en Ventas: agrupar por proyecto es cosa
// de constructoras. Propietarios solo existe en Arriendos: es quien recibe
// el canon, y en una venta no hay a quién girarle nada.
const SCOPES = {
  ventas: {
    label: 'Ventas',
    extra: [
      { path: 'projects', label: 'Proyectos', roles: ['admin','gerente','contador','readonly','supervisor'], after: 'clients' },
      { path: 'blocks',   label: 'Manzanas',   roles: ['admin','gerente','contador','readonly','supervisor'], after: 'projects' },
    ],
  },
  arriendos: {
    label: 'Arriendos',
    extra: [
      { path: 'owners',      label: 'Propietarios', roles: ['admin','gerente','contador','asesor','readonly'], after: 'clients' },
      // Liquidaciones va junto a Pagos: es la contraparte del cobro. Ahí se
      // ve lo que hay que girarle al propietario de lo ya recaudado.
      { path: 'settlements', label: 'Liquidaciones',      roles: ['admin','gerente','contador','readonly'],          after: 'payments' },
      // Aniversarios de canon, contratos por vencer y arrendatarios en mora.
      { path: 'rental-alerts', label: 'Alertas',        roles: ['admin','gerente','contador','asesor','readonly'], after: 'settlements' },
    ],
  },
};

// Construye el menú de una pestaña insertando sus módulos propios en el
// orden acordado.
//
// La inserción es recursiva a propósito: un módulo propio puede colgar de
// otro módulo propio. Manzanas va después de Proyectos, y Proyectos no es
// compartido, así que recorrer solo SHARED_ITEMS dejaba a Manzanas fuera.
const buildNav = (scope) => {
  const { extra } = SCOPES[scope];
  const out = [];
  const pushWithChildren = (item) => {
    out.push(item);
    for (const ex of extra) if (ex.after === item.path) pushWithChildren(ex);
  };
  for (const item of SHARED_ITEMS) pushWithChildren(item);
  return [...out, ...ADMIN_ITEMS];
};

export const ROLES = ['admin','gerente','contador','asesor','abogado','supervisor','readonly'];

// Todos los modulos en una sola lista, sin importar la pestaña.
export const TODOS_LOS_MODULOS = [
  ...SHARED_ITEMS,
  ...Object.values(SCOPES).flatMap(s => s.extra),
  ...ADMIN_ITEMS,
];

// Nivel de un rol sobre un modulo: la excepcion de la empresa, o el valor
// del codigo si no hay ninguna.
//
// Sin excepciones el resultado es identico al comportamiento de siempre.
export const nivelDeModulo = (modulo, rol, overrides = []) => {
  const ex = overrides.find(o => o.role === rol && o.module === modulo);
  if (ex) return ex.level;
  const m = TODOS_LOS_MODULOS.find(x => x.path === modulo);
  if (!m) return 'total';          // pantalla sin modulo asociado: no se restringe
  return m.roles.includes(rol) ? 'total' : 'sin_acceso';
};

export { SHARED_ITEMS, ADMIN_ITEMS, SCOPES, buildNav };
