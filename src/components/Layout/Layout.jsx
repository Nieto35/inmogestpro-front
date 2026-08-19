// src/components/Layout/Layout.jsx
import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import useThemeStore from '../../store/themeStore';
import {
  LayoutDashboard, FileText, Users, Home,
  CreditCard, UserCheck, BarChart3, Shield, Settings,
  LogOut, Menu, X, ChevronDown, Building,
  ClipboardList, AlertTriangle, Phone, DollarSign,
  Sun, Moon, Globe, Layers, KeyRound, UserSquare2, Wallet, Bell,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../UI/NotificationBell';
import { getSavedTenantSlug } from '../../utils/tenant';
// Logo real de la marca. El lockup completo se usa con el sidebar abierto;
// colapsado solo cabe la marca. Ambos son SVG: nítidos a cualquier tamaño.
import logoFull from '../../assets/logo-inmogest.svg';
import logoMark from '../../assets/logo-mark.svg';

// El rol `supervisor` estaba en la base y en las rutas del backend —que ya
// filtra sus contratos asignados y lo deja marcar hitos de entrega— pero no
// figuraba en NINGUNA entrada del menú. Entraba y veía la pantalla vacía.
//
// Módulos comunes a las dos pestañas. `scope` los diferencia en la URL para
// que Inmuebles muestre listas separadas: los de venta no se ven en Arriendos
// y viceversa, tal como se definió.
const SHARED_ITEMS = [
  { path: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard, roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'contracts',    label: 'Contratos',     icon: FileText,        roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'clients',      label: 'Clientes',      icon: Users,           roles: ['admin','gerente','contador','abogado','readonly'] },
  { path: 'properties',   label: 'Inmuebles',     icon: Home,            roles: ['admin','gerente','contador','asesor','abogado','readonly','supervisor'] },
  { path: 'payments',     label: 'Pagos',         icon: CreditCard,      roles: ['admin','gerente','contador'] },
  { path: 'interactions', label: 'Interacciones', icon: Phone,           roles: ['admin','gerente','contador','asesor','abogado','supervisor'] },
  { path: 'advisors',     label: 'Asesores',      icon: UserCheck,       roles: ['admin','gerente','contador','readonly'] },
  { path: 'commissions',  label: 'Comisiones',    icon: DollarSign,      roles: ['admin','gerente','contador','asesor','supervisor'] },
  { path: 'reports',      label: 'Reportes',      icon: BarChart3,       roles: ['admin','gerente','contador','readonly'] },
];

// Módulos administrativos: no pertenecen a ninguna de las dos operaciones.
const ADMIN_ITEMS = [
  // Auditoría es solo del gerente: el backend lo impone con
  // `router.use(authorize('gerente'))`. El menú listaba también al abogado,
  // así que le mostraba un enlace que terminaba en pantalla bloqueada.
  { path: 'audit', label: 'Auditoría', icon: Shield,   roles: ['gerente'] },
  { path: 'users', label: 'Usuarios',  icon: Settings, roles: ['gerente'] },
];

// Proyectos y Manzanas solo existen en Ventas: agrupar por proyecto es cosa
// de constructoras. Propietarios solo existe en Arriendos: es quien recibe
// el canon, y en una venta no hay a quién girarle nada.
const SCOPES = {
  ventas: {
    label: 'Ventas',
    icon:  Building,
    extra: [
      { path: 'projects', label: 'Proyectos', icon: Building, roles: ['admin','gerente','contador','readonly','supervisor'], after: 'clients' },
      { path: 'blocks',   label: 'Manzanas',  icon: Layers,   roles: ['admin','gerente','contador','readonly','supervisor'], after: 'projects' },
    ],
  },
  arriendos: {
    label: 'Arriendos',
    icon:  KeyRound,
    extra: [
      { path: 'owners',      label: 'Propietarios',  icon: UserSquare2, roles: ['admin','gerente','contador','asesor','readonly'], after: 'clients' },
      // Liquidaciones va junto a Pagos: es la contraparte del cobro. Ahí se
      // ve lo que hay que girarle al propietario de lo ya recaudado.
      { path: 'settlements', label: 'Liquidaciones', icon: Wallet,      roles: ['admin','gerente','contador','readonly'],          after: 'payments' },
      // Aniversarios de canon, contratos por vencer y arrendatarios en mora.
      { path: 'rental-alerts', label: 'Alertas',     icon: Bell,        roles: ['admin','gerente','contador','asesor','readonly'], after: 'settlements' },
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

const roleLabels = {
  admin: 'Administrador', gerente: 'Gerente', contador: 'Contador',
  asesor: 'Asesor', abogado: 'Abogado', readonly: 'Solo Lectura',
  supervisor: 'Supervisor',
};

// Badges de rol — tonos semánticos sobre fondo claro
const roleBadgeColors = {
  admin:    'bg-red-100 text-red-700',
  gerente:  'bg-purple-100 text-purple-700',
  contador: 'bg-blue-100 text-blue-700',
  asesor:   'bg-emerald-100 text-emerald-700',
  abogado:  'bg-amber-100 text-amber-700',
  supervisor: 'bg-cyan-100 text-cyan-700',
  readonly: 'bg-gray-100 text-gray-500',
};

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const { tenant } = useParams();
  const slug = tenant || getSavedTenantSlug() || '';
  const prefix = slug ? `/${slug}` : '';

  // Pestaña activa: Ventas o Arriendos. Se recuerda entre sesiones para que
  // quien solo administra arriendos no tenga que cambiarla cada vez.
  const [scope, setScope] = useState(
    () => localStorage.getItem('inmogest_scope') === 'arriendos' ? 'arriendos' : 'ventas'
  );
  const changeScope = (next) => {
    setScope(next);
    localStorage.setItem('inmogest_scope', next);
    navigate(`${prefix}/dashboard`);
  };

  const filteredNav = buildNav(scope).filter(item => item.roles.includes(user?.role));

  // Módulos con listas separadas por pestaña. Un contrato de arriendo no
  // puede aparecer en Ventas, ni sus cobros de canon en los pagos de venta.
  //
  // Clientes, Asesores, Comisiones e Interacciones NO están aquí a
  // propósito: comparten la misma información en ambas pestañas, como se
  // definió en el reparto de módulos.
  const SCOPED_PATHS = ['properties', 'contracts', 'payments', 'reports'];
  const linkTo = (path) =>
    SCOPED_PATHS.includes(path)
      ? `${prefix}/${path}?scope=${scope}`
      : `${prefix}/${path}`;

  const handleLogout = async () => {
    await logout();
  };

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`
        flex flex-col h-full
        ${mobile ? 'w-72' : sidebarOpen ? 'w-64' : 'w-16'}
        transition-all duration-300 ease-in-out
      `}
      style={{
        background: 'var(--color-bg-card)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo — azul noche con acento dorado */}
      <div
        className="flex items-center justify-center px-4"
        style={{
          background: 'var(--color-navy)',
          borderBottom: '3px solid var(--color-gold)',
          height: '68px',
        }}
      >
        <img
          src={(sidebarOpen || mobile) ? logoFull : logoMark}
          alt="InmoGest Pro"
          style={{
            display: 'block',
            width: (sidebarOpen || mobile) ? '100%' : '28px',
            maxWidth: (sidebarOpen || mobile) ? '208px' : '28px',
          }}
        />
      </div>

      {/* Selector Ventas / Arriendos */}
      <div className="px-2 pt-3">
        {(sidebarOpen || mobile) ? (
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded"
            style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}
          >
            {Object.entries(SCOPES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => changeScope(key)}
                className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: scope === key ? 'var(--color-navy)' : 'transparent',
                  color:      scope === key ? 'var(--color-gold)' : 'var(--color-text-muted)',
                }}
              >
                <cfg.icon size={13} />
                {cfg.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => changeScope(scope === 'ventas' ? 'arriendos' : 'ventas')}
            title={`Pestaña: ${SCOPES[scope].label} — clic para cambiar`}
            className="w-full flex justify-center py-2 rounded"
            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
          >
            {(() => { const I = SCOPES[scope].icon; return <I size={16} />; })()}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={linkTo(item.path)}
            onClick={() => mobile && setMobileOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded mb-0.5
              text-sm font-medium transition-all duration-150
              ${isActive
                ? 'border border-transparent'
                : 'border border-transparent'
              }
            `}
            style={({ isActive }) => ({
              background: isActive ? 'rgba(13,27,62,0.08)' : 'transparent',
              color: isActive ? 'var(--color-navy)' : 'var(--color-text-secondary)',
              borderLeft: isActive ? '3px solid var(--color-gold)' : '3px solid transparent',
              fontWeight: isActive ? 600 : 400,
            })}
            title={!sidebarOpen && !mobile ? item.label : undefined}
          >
            <item.icon size={18} className="flex-shrink-0" />
            {(sidebarOpen || mobile) && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
        {(sidebarOpen || mobile) ? (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-gold)',
                borderRadius: '2px',
                border: '1px solid var(--color-gold)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {user?.fullName}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeColors[user?.role] || ''}`}>
                {roleLabels[user?.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-navy-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded transition-colors flex justify-center"
            style={{ color: 'var(--color-text-muted)' }}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-col h-full">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-4 md:px-6 h-14 flex-shrink-0"
          style={{
            background: 'var(--color-bg-card)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Desktop collapse button */}
          <button
            className="hidden md:flex p-2 rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Toggle tema claro/oscuro */}
             {/*<button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="btn btn-ghost btn-sm flex items-center gap-1.5"
              style={{
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
              }}
            >
              {theme === 'dark'
                ? <><Sun size={14}/><span className="text-xs font-medium hidden sm:block">Claro</span></>
                : <><Moon size={14}/><span className="text-xs font-medium hidden sm:block">Oscuro</span></>
              }
            </button>*/}

            <NotificationBell />

            <button
              onClick={() => navigate(`${prefix}/profile`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-navy-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div
                className="w-7 h-7 flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{
                  background: 'var(--color-navy)',
                  color: 'var(--color-gold)',
                  borderRadius: '2px',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <span className="hidden sm:block text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.fullName?.split(' ')[0]}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--color-bg-primary)' }}
        >
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;