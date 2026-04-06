// src/pages/Clients/ClientNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, User } from 'lucide-react';
import { clientsService } from '../../services/api.service';
import toast from 'react-hot-toast';

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const Section = ({ title, children }) => (
  <div className="card">
    <h3 className="font-semibold text-sm mb-4 pb-3" style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

const ClientNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    document_type: 'CC',
    document_number: '',
    full_name: '',
    email: '',
    mobile: '',
    phone: '',
    city: '',
    department: '',
    address: '',
    date_of_birth: '',
    occupation: '',
    monthly_income: '',
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.document_number || !form.full_name || !form.document_type) {
      toast.error('Tipo de documento, número y nombre completo son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await clientsService.create(form);
      toast.success(res.data?.message || 'Cliente creado exitosamente');
      navigate(to('clients'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(to('clients'))} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>Nuevo Cliente</h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Registrar comprador o interesado</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Save size={15} /> {saving ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>

      {/* Identificación */}
      <Section title="1. Identificación">
        <Field label="Tipo de documento" required>
          <select value={form.document_type} onChange={e => set('document_type', e.target.value)} className="input text-sm">
            <option value="CC">Cédula de Ciudadanía (CC)</option>
            <option value="CE">Cédula de Extranjería (CE)</option>
            <option value="NIT">NIT (Empresa)</option>
            <option value="PAS">Pasaporte</option>
            <option value="TI">Tarjeta de Identidad (TI)</option>
          </select>
        </Field>
        <Field label="Número de documento" required>
          <input type="text" value={form.document_number} onChange={e => set('document_number', e.target.value)}
            className="input text-sm" placeholder="1234567890" maxLength={20} />
        </Field>
        <Field label="Nombre completo" required className="md:col-span-2">
          <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
            className="input text-sm" placeholder="Apellidos y nombres completos" />
        </Field>
        <Field label="Fecha de nacimiento">
          <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} className="input text-sm" />
        </Field>
        <Field label="Ocupación">
          <input type="text" value={form.occupation} onChange={e => set('occupation', e.target.value)}
            className="input text-sm" placeholder="Ej: Empleado, Independiente, Empresario" />
        </Field>
      </Section>

      {/* Contacto */}
      <Section title="2. Información de Contacto">
        <Field label="Correo electrónico">
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className="input text-sm" placeholder="correo@ejemplo.com" />
        </Field>
        <Field label="Celular" required>
          <input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)}
            className="input text-sm" placeholder="3001234567" maxLength={15} />
        </Field>
        <Field label="Teléfono fijo">
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
            className="input text-sm" placeholder="6022345678" maxLength={15} />
        </Field>
        <Field label="Ingresos mensuales (COP)">
          <input type="number" value={form.monthly_income} onChange={e => set('monthly_income', e.target.value)}
            className="input text-sm" placeholder="3500000" min="0" />
        </Field>
      </Section>

      {/* Ubicación */}
      <Section title="3. Ubicación">
        <Field label="Ciudad">
          <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
            className="input text-sm" placeholder="Cali" />
        </Field>
        <Field label="Departamento">
          <input type="text" value={form.department} onChange={e => set('department', e.target.value)}
            className="input text-sm" placeholder="Valle del Cauca" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Dirección">
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              className="input text-sm" placeholder="Carrera 5 # 10-20, Barrio Centro" />
          </Field>
        </div>
      </Section>

      {/* Notas */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3" style={{ color:'var(--color-text-primary)' }}>4. Observaciones</h3>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          className="input text-sm resize-none w-full" rows={3}
          placeholder="Información adicional relevante del cliente..." />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(to('clients'))} className="btn btn-secondary">Cancelar</button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Save size={15} /> {saving ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  );
};
export default ClientNewPage;
