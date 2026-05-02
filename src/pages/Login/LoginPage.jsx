// src/pages/Login/LoginPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Building2, Eye, EyeOff, Lock, User, Shield, AlertCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { getActiveTenantSlug } from '../../utils/tenant';

const LoginPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const [searchParams] = useSearchParams();
  const { login, isLoading, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      toast.error('Su sesión ha expirado. Por favor inicie sesión nuevamente.');
      return;
    }
    if (isAuthenticated) {
      const s = tenant || getActiveTenantSlug();
      navigate(s ? `/${s}/dashboard` : '/dashboard');
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username.trim() || !form.password) {
      setError('Ingrese usuario y contraseña');
      return;
    }

    const result = await login(form);
    if (result.success) {
      toast.success('Bienvenido al sistema');
      const slug = tenant || getActiveTenantSlug();
      navigate(slug ? `/${slug}/dashboard` : '/dashboard');
    } else {
      setError(result.message || 'Credenciales incorrectas');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1d4ed8 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.3)',
              }}
            >
              <Building2 size={30} color="white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              InmoGest Pro
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Sistema de Gestión Inmobiliaria
            </p>
          </div>

          {/* Session expired banner */}
          {searchParams.get('reason') === 'session_expired' && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
            >
              <AlertCircle size={16} />
              Sesión expirada. Inicie sesión nuevamente.
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Usuario o correo electrónico
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError(''); }}
                  className="input pl-9"
                  placeholder="admin@inmogest.com"
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full justify-center mt-2"
              style={{ height: '44px', fontSize: '0.9375rem' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Security note */}
          <div
            className="flex items-center gap-2 mt-6 pt-5 text-xs"
            style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <Shield size={13} />
            <span>Acceso protegido · Auditoría activa · No repudio habilitado</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          © 2024 InmoGest Pro · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
};

export default LoginPage;