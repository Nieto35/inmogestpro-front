// src/pages/Profile/ProfilePage.jsx
import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Save } from 'lucide-react';
import { authService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const ROLE_LABELS = { admin:'Administrador', gerente:'Gerente', contador:'Contador', asesor:'Asesor Comercial', readonly:'Solo Lectura' };

const ProfilePage = () => {
  const { user } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Contraseña actualizada. Por seguridad, inicie sesión nuevamente.');
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch {
      /* error manejado por interceptor */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>Mi Perfil</h1>

      {/* Info del usuario */}
      <div className="card">
        <div className="flex items-center gap-4 mb-5 pb-5" style={{ borderBottom:'1px solid var(--color-border)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ background:'rgba(37,99,235,0.2)', color:'#60a5fa' }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>{user?.fullName}</p>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{user?.email}</p>
            <span className="badge badge-activo mt-1">{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p style={{ color:'var(--color-text-muted)' }} className="text-xs mb-0.5">Usuario</p><p className="font-mono" style={{ color:'var(--color-text-primary)' }}>{user?.username}</p></div>
          <div><p style={{ color:'var(--color-text-muted)' }} className="text-xs mb-0.5">Rol</p><p style={{ color:'var(--color-text-primary)' }}>{ROLE_LABELS[user?.role]}</p></div>
        </div>
      </div>

      {/* Cambio de contraseña */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} style={{ color:'var(--color-text-accent)' }} />
          <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>Cambiar Contraseña</h3>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {[
            { key:'currentPassword', label:'Contraseña actual', show:showCurrent, toggle:() => setShowCurrent(s => !s) },
            { key:'newPassword', label:'Nueva contraseña', show:showNew, toggle:() => setShowNew(s => !s) },
            { key:'confirmPassword', label:'Confirmar nueva contraseña', show:showNew, toggle:() => {} },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>{f.label}</label>
              <div className="relative">
                <input
                  type={f.show ? 'text' : 'password'}
                  value={pwForm[f.key]}
                  onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="input pr-10 text-sm"
                  required
                />
                {f.key !== 'confirmPassword' && (
                  <button type="button" onClick={f.toggle} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:'var(--color-text-muted)' }}>
                    {f.show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="p-3 rounded-lg text-xs" style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.15)', color:'var(--color-text-muted)' }}>
            La contraseña debe tener mínimo 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales.
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            <Save size={14} /> {saving ? 'Guardando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};
export default ProfilePage;