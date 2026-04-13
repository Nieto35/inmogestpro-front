// src/pages/Users/UsersPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings, RefreshCw, UserCheck, UserX, Shield,
  Plus, X, Save, Eye, EyeOff, KeyRound
} from 'lucide-react';
import { usersService } from '../../services/api.service';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_LABELS  = { admin:'Administrador', gerente:'Gerente', contador:'Contador', asesor:'Asesor Comercial', abogado:'Abogado', readonly:'Solo Lectura' };
const ROLE_COLORS = {
  admin:    'text-red-700 bg-red-100',
  gerente:  'text-purple-700 bg-purple-100',
  contador: 'text-blue-700 bg-blue-100',
  asesor:   'text-emerald-700 bg-emerald-100',
  abogado:  'text-amber-700 bg-amber-100',
  readonly: 'text-gray-500 bg-gray-100',
};

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

// ── Modal de creación ─────────────────────────────────────────
const NewUserModal = ({ onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    username: '', email: '', full_name: '',
    role: 'asesor', password: '', confirm_password: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.username || !form.email || !form.full_name || !form.role)
      return toast.error('Todos los campos marcados son requeridos');
    if (form.password && form.password !== form.confirm_password)
      return toast.error('Las contraseñas no coinciden');
    if (form.password && form.password.length < 8)
      return toast.error('La contraseña debe tener al menos 8 caracteres');

    setSaving(true);
    try {
      const res = await usersService.create({
        username: form.username,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        password: form.password || undefined,
      });
      toast.success(res.data.message);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>

        {/* Header — navy + gold */}
        <div className="flex items-center justify-between p-5 flex-shrink-0"
          style={{ background:'var(--color-navy)', borderBottom:'3px solid var(--color-gold)' }}>
          <h2 className="font-bold text-lg"
            style={{ color:'#F5F3EE', fontFamily:'var(--font-display)' }}>
            Nuevo Usuario
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"
            style={{ color:'rgba(245,243,238,0.7)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Nombre completo" required>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="input text-sm" placeholder="Juan Pérez García" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre de usuario" required>
                <input type="text" value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g,''))}
                  className="input text-sm" placeholder="jperez" />
              </Field>
              <Field label="Rol" required>
                <select value={form.role} onChange={e => set('role', e.target.value)} className="input text-sm">
                  <option value="asesor">Asesor Comercial</option>
                  <option value="abogado">Abogado</option>
                  <option value="contador">Contador</option>
                  <option value="gerente">Gerente</option>
                  <option value="readonly">Solo Lectura</option>
                  <option value="admin">Administrador</option>
                </select>
              </Field>
            </div>
            <Field label="Correo electrónico" required>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="input text-sm" placeholder="juan@empresa.com" />
            </Field>
            <Field label="Contraseña" >
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className="input text-sm pr-10" placeholder="Dejar vacío para usar Temporal@2024!" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:'var(--color-text-muted)' }}>
                  {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </Field>
            {form.password && (
              <Field label="Confirmar contraseña">
                <input type={showPwd ? 'text' : 'password'} value={form.confirm_password}
                  onChange={e => set('confirm_password', e.target.value)}
                  className="input text-sm" placeholder="Repetir contraseña" />
              </Field>
            )}
          </div>

          <div className="p-3 rounded text-xs"
            style={{ background:'rgba(13,27,62,0.04)', border:'1px solid var(--color-border)', borderLeft:'3px solid var(--color-gold)', color:'var(--color-text-muted)' }}>
            💡 Si no ingresa contraseña, se asignará <strong style={{ color:'var(--color-navy)' }}>Temporal@2024!</strong> — el usuario deberá cambiarla al ingresar.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn btn-outline">Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
              <Save size={14} /> {saving ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const UsersPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const users = data?.data?.data || [];

  const handleToggle = async (id, name, active) => {
    try {
      const res = await usersService.toggleActive(id);
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar estado');
    }
  };

  const handleResetPassword = async (id, name) => {
    if (!confirm(`¿Restablecer contraseña de "${name}"? La nueva contraseña será Temporal@2026!`)) return;
    try {
      const res = await usersService.resetPassword(id);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al restablecer contraseña');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {showModal && (
        <NewUserModal
          onClose={() => setShowModal(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold"
            style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            Gestión de Usuarios
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {users.length} usuario{users.length !== 1 ? 's' : ''} del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''} />
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Info de roles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="card p-3">
              <p className="text-xs mb-0.5" style={{ color:'var(--color-text-muted)' }}>{label}</p>
              <p className="text-xl font-bold font-mono" style={{ color:'var(--color-navy)' }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="table-container">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <Settings size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }} />
            <p style={{ color:'var(--color-text-secondary)' }}>No hay usuarios registrados</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm mt-3">
              <Plus size={14} /> Crear primer usuario
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre Completo</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último Acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-mono text-sm font-medium" style={{ color:'var(--color-gold)' }}>
                    {u.username}
                  </td>
                  <td className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                    {u.full_name}
                  </td>
                  <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                    {u.email}
                  </td>
                  <td>
                    <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || ''}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-activo' : 'badge-cancelado'}`}>
                      {u.is_active ? <><UserCheck size={11}/> Activo</> : <><UserX size={11}/> Inactivo</>}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color:'var(--color-text-muted)', whiteSpace:'nowrap' }}>
                    {u.last_login ? format(new Date(u.last_login), 'dd/MM/yy HH:mm') : 'Nunca'}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggle(u.id, u.full_name, u.is_active)}
                        className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-secondary'}`}
                        title={u.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                      >
                        {u.is_active ? <UserX size={13}/> : <UserCheck size={13}/>}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id, u.full_name)}
                        className="btn btn-ghost btn-sm"
                        title="Restablecer contraseña a Temporal@2026!"
                      >
                        <KeyRound size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Leyenda de roles */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-3 uppercase tracking-wide"
          style={{ color:'var(--color-gold)', letterSpacing:'0.08em' }}>
          Permisos por Rol
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs" style={{ color:'var(--color-text-muted)' }}>
          <div>🔴 <strong style={{ color:'var(--color-text-secondary)' }}>Administrador:</strong> acceso total al sistema</div>
          <div>🟣 <strong style={{ color:'var(--color-text-secondary)' }}>Gerente:</strong> contratos, clientes, pagos, reportes, auditoría</div>
          <div>🔵 <strong style={{ color:'var(--color-text-secondary)' }}>Contador:</strong> pagos, reportes, contratos (solo lectura)</div>
          <div>🟢 <strong style={{ color:'var(--color-text-secondary)' }}>Asesor:</strong> clientes, contratos propios, inmuebles</div>
          <div>⚪ <strong style={{ color:'var(--color-text-secondary)' }}>Solo Lectura:</strong> consulta sin modificar nada</div>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;