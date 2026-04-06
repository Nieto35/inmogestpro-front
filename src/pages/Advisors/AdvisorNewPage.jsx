// src/pages/Advisors/AdvisorNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, UserCheck } from 'lucide-react';
import { advisorsService, usersService } from '../../services/api.service';
import toast from 'react-hot-toast';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5"
      style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const AdvisorNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name:       '',
    email:           '',
    phone:           '',
    advisor_type:    'planta',
    user_id:         '',
  });
  const set = (k, v) => setForm(f => ({...f,[k]:v}));

  const { data: usersData } = useQuery({
    queryKey: ['users-advisors'],
    queryFn:  () => usersService.getAll(),
  });
  const advisorUsers = (usersData?.data?.data || []).filter(u => u.role === 'asesor' && u.is_active);

  const handleSubmit = async () => {
    if (!form.full_name) return toast.error('El nombre completo es requerido');
    setSaving(true);
    try {
      const res = await advisorsService.create({
        full_name:    form.full_name,
        email:        form.email    || null,
        phone:        form.phone    || null,
        advisor_type: form.advisor_type,
        user_id:      form.user_id  || null,
      });
      toast.success(res.data?.message || 'Asesor creado exitosamente');
      navigate(to('advisors'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el asesor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(to('advisors'))} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              Nuevo Asesor Comercial
            </h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Registrar asesor de ventas
            </p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
          <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Asesor'}
        </button>
      </div>

      {/* Datos */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-4 pb-3"
          style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
          Datos del Asesor
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Nombre completo" required>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="input text-sm w-full" placeholder="Apellidos y nombres" autoFocus/>
            </Field>
          </div>
          <Field label="Correo electrónico">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className="input text-sm" placeholder="asesor@email.com"/>
          </Field>
          <Field label="Teléfono / Celular">
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className="input text-sm" placeholder="3001234567"/>
          </Field>
          <div className="md:col-span-2">
            <Field label="Tipo de asesor" required>
              <select value={form.advisor_type} onChange={e => set('advisor_type', e.target.value)}
                className="input text-sm">
                <option value="planta">Planta (empleado directo)</option>
                <option value="freelance">Freelance / Externo</option>
                <option value="referido">Referido</option>
                <option value="gerente">Gerente</option>
                <option value="abogado">Abogado</option>
                <option value="externo">Externo</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Vincular usuario */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-2 pb-3"
          style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
          Vincular con Usuario del Sistema
        </h3>
        <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>
          Opcional. Si el asesor tiene cuenta en el sistema, vincularlo le permite
          ver sus contratos y comisiones al iniciar sesión.
        </p>
        <Field label="Usuario del sistema"
          hint="Solo aparecen usuarios con rol 'Asesor'. Créalo primero en Usuarios si no aparece.">
          <select value={form.user_id} onChange={e => set('user_id', e.target.value)}
            className="input text-sm">
            <option value="">Sin usuario vinculado</option>
            {advisorUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name} — @{u.username} ({u.email})
              </option>
            ))}
          </select>
        </Field>
        {form.user_id && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981' }}>
            <UserCheck size={15}/>
            El asesor podrá iniciar sesión y ver sus contratos.
          </div>
        )}
        {advisorUsers.length === 0 && (
          <div className="mt-3 p-3 rounded-lg text-xs"
            style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b' }}>
            💡 No hay usuarios con rol "Asesor". Ve a <strong>Usuarios → Nuevo Usuario</strong> y crea uno primero.
          </div>
        )}
      </div>

      {/* Info comisiones */}
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)' }}>
        <span className="text-lg flex-shrink-0">💡</span>
        <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
          Las comisiones se gestionan desde el módulo{' '}
          <strong style={{ color:'var(--color-text-secondary)' }}>Comisiones</strong>.
          Allí podrás registrar comisiones por porcentaje o monto fijo, dividirlas en cuotas
          y marcar cada pago cuando se le cancele al asesor.
        </p>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => navigate(to('advisors'))} className="btn btn-secondary">Cancelar</button>
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
          <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Asesor'}
        </button>
      </div>
    </div>
  );
};

export default AdvisorNewPage;