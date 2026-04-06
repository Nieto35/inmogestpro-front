// src/components/Layout/Layout.jsx
import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import useThemeStore from '../../store/themeStore';
import {
  LayoutDashboard, FileText, Users, Building2, Home,
  CreditCard, UserCheck, BarChart3, Shield, Settings,
  LogOut, Menu, X, ChevronDown, Building,
  ClipboardList, AlertTriangle, Phone, DollarSign,
  Sun, Moon, Globe,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../UI/NotificationBell';
import { getSavedTenantSlug } from '../../utils/tenant';

const NAV_ITEMS = [
  { path: 'dashboard',         label: 'Dashboard',      icon: LayoutDashboard, roles: ['admin','gerente','contador','asesor','abogado','readonly'] },
  { path: 'contracts',         label: 'Contratos',      icon: FileText,        roles: ['admin','gerente','contador','asesor','abogado','readonly'] },
  { path: 'clients',           label: 'Clientes',       icon: Users,           roles: ['admin','gerente','contador','asesor','abogado','readonly'] },
  { path: 'projects',          label: 'Proyectos',      icon: Building,        roles: ['admin','gerente','contador','readonly'] },
  { path: 'properties',        label: 'Inmuebles',      icon: Home,            roles: ['admin','gerente','contador','asesor','abogado','readonly'] },
  { path: 'payments',          label: 'Pagos',          icon: CreditCard,      roles: ['admin','gerente','contador'] },
  { path: 'interactions',      label: 'Interacciones',  icon: Phone,           roles: ['admin','gerente','contador','asesor','abogado'] },
  { path: 'advisors',          label: 'Asesores',       icon: UserCheck,       roles: ['admin','gerente','readonly'] },
  { path: 'commissions',       label: 'Comisiones',     icon: DollarSign,      roles: ['admin','gerente','contador'] },
  { path: 'reports',           label: 'Reportes',       icon: BarChart3,       roles: ['admin','gerente','contador','readonly'] },
  { path: 'audit',             label: 'Auditoría',      icon: Shield,          roles: ['admin','gerente','abogado'] },
  { path: 'users',             label: 'Usuarios',       icon: Settings,        roles: ['admin','gerente'] },
  { path: 'settings/currency', label: 'Moneda',         icon: Globe,           roles: ['admin','gerente'] },
];

const roleLabels = {
  admin: 'Administrador', gerente: 'Gerente', contador: 'Contador',
  asesor: 'Asesor', abogado: 'Abogado', readonly: 'Solo Lectura',
};

const roleBadgeColors = {
  admin: 'bg-red-500/20 text-red-400',       gerente: 'bg-purple-500/20 text-purple-400',
  contador: 'bg-blue-500/20 text-blue-400',  asesor: 'bg-green-500/20 text-green-400',
  abogado: 'bg-amber-500/20 text-amber-400', readonly: 'bg-gray-500/20 text-gray-400',
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

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

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
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <Building2 size={18} color="white" />
        </div>
        {(sidebarOpen || mobile) && (
          <div className="overflow-hidden">
            <div className="font-bold text-base leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              InmoGest
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Pro · v1.0
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={`${prefix}/${item.path}`}
            onClick={() => mobile && setMobileOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5
              text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
              }
            `}
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
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
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
              className="p-1.5 rounded hover:bg-slate-700 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded hover:bg-slate-700 transition-colors flex justify-center"
            title="Cerrar sesión"
          >
            <LogOut size={18} className="text-slate-400" />
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
            className="fixed inset-0 bg-black/60"
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
          className="flex items-center gap-4 px-4 md:px-6 h-14 flex-shrink-0 border-b"
          style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
        >
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded hover:bg-slate-700 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} style={{ color: 'var(--color-text-secondary)' }} />
          </button>

          {/* Desktop collapse button */}
          <button
            className="hidden md:flex p-2 rounded hover:bg-slate-700 transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={18} style={{ color: 'var(--color-text-secondary)' }} />
          </button>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Toggle tema claro/oscuro */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="btn btn-ghost btn-sm flex items-center gap-1.5 transition-all"
              style={{
                color: theme === 'dark' ? '#f59e0b' : '#6366f1',
                background: theme === 'dark' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                border: `1px solid ${theme === 'dark' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
                borderRadius: '10px',
                padding: '6px 12px',
              }}>
              {theme === 'dark'
                ? <><Sun size={15}/><span className="text-xs font-medium hidden sm:block">Claro</span></>
                : <><Moon size={15}/><span className="text-xs font-medium hidden sm:block">Oscuro</span></>}
            </button>
            <NotificationBell />

            <button
              onClick={() => navigate(`${prefix}/profile`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-700 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-sm">
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