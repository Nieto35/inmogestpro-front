// src/pages/Owners/OwnersPage.jsx
//
// Propietarios: los dueños de los inmuebles que la inmobiliaria administra
// en arriendo. Es a quien se le gira el canon recaudado, por eso guarda
// datos bancarios que no existen en la ficha de un cliente.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserSquare2, Plus, Search, Pencil, Trash2, X, Home,
  AlertTriangle, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { ownersService, clientsService } from '../../services/api.service';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const DOC_TYPES = ['CC','CE','NIT','PA','RUC','DNI','OTRO'];
const ACCOUNT_TYPES = [
  { value:'',          label:'—' },
  { value:'ahorros',   label:'Ahorros' },
  { value:'corriente', label:'Corriente' },
];

const EMPTY = {
  document_type:'CC', document_number:'', full_name:'', email:'', mobile:'',
  phone:'', address:'', city:'', department:'',
  bank_name:'', bank_account_type:'', bank_account_number:'',
  client_id:'', notes:'', is_active:true,
};

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const OwnerModal = ({ owner, onClose, onSaved }) => {
  const isEdit = Boolean(owner?.id);
  const [form, setForm] = useState(() => owner ? { ...EMPTY, ...owner, client_id: owner.client_id || '' } : EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  // Enlazar con un cliente existente es opcional: sirve cuando el mismo
  // señor que arrienda su casa además compró un apartamento.
  const { data: clientsData } = useQuery({
    queryKey: ['clients','para-propietario'],
    queryFn:  () => clientsService.getAll({ limit: 200 }),
  });
  const clients = clientsData?.data?.data || [];

  const submit = async () => {
    if (!form.full_name.trim() || !form.document_number.trim())
      return toast.error('Nombre y número de documento son requeridos');
    setSaving(true);
    try {
      const payload = { ...form, client_id: form.client_id || null };
      if (isEdit) await ownersService.update(owner.id, payload);
      else        await ownersService.create(payload);
      toast.success(isEdit ? 'Propietario actualizado' : 'Propietario creado');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ background:'var(--color-bg-secondary)' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
            {isEdit ? 'Editar propietario' : 'Nuevo propietario'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70"
            style={{ color:'var(--color-text-muted)' }}><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-text-muted)' }}>Identificación</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Tipo" required>
                <select value={form.document_type} onChange={e => set('document_type', e.target.value)}
                  className="input text-sm w-full" disabled={isEdit}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Número" required>
                <input value={form.document_number} onChange={e => set('document_number', e.target.value)}
                  className="input text-sm w-full" disabled={isEdit}/>
              </Field>
              <Field label="Nombre completo" required>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  className="input text-sm w-full"/>
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-text-muted)' }}>Contacto</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Celular"><input value={form.mobile} onChange={e => set('mobile', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Teléfono fijo"><input value={form.phone} onChange={e => set('phone', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Correo"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Dirección"><input value={form.address} onChange={e => set('address', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Ciudad"><input value={form.city} onChange={e => set('city', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Departamento"><input value={form.department} onChange={e => set('department', e.target.value)} className="input text-sm w-full"/></Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-text-muted)' }}>Datos para el giro</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Banco"><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input text-sm w-full"/></Field>
              <Field label="Tipo de cuenta">
                <select value={form.bank_account_type} onChange={e => set('bank_account_type', e.target.value)} className="input text-sm w-full">
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Número de cuenta"><input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} className="input text-sm w-full"/></Field>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Enlazar con cliente" hint="Solo si esta persona además es cliente del sistema">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="input text-sm w-full">
                <option value="">Sin enlazar</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.document_number}</option>)}
              </select>
            </Field>
            {isEdit && (
              <Field label="Estado">
                <select value={String(form.is_active)} onChange={e => set('is_active', e.target.value === 'true')} className="input text-sm w-full">
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </Field>
            )}
          </div>

          <Field label="Observaciones">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="input text-sm w-full resize-none"/>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4" style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={submit} className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear propietario'}
          </button>
        </div>
      </div>
    </div>
  );
};

const OwnersPage = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const canEdit   = hasRole('admin','gerente','contador','asesor');
  const canDelete = hasRole('admin','gerente');

  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(null); // null | {} | owner

  const { data, isLoading } = useQuery({
    queryKey: ['owners', search, page],
    queryFn:  () => ownersService.getAll({ search, page, limit: 25 }),
  });

  const owners = data?.data?.data || [];
  const pag    = data?.data?.pagination || { total:0, pages:1, page:1 };

  const remove = async (owner) => {
    if (!window.confirm(`¿Eliminar al propietario "${owner.full_name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await ownersService.delete(owner.id);
      toast.success('Propietario eliminado');
      queryClient.invalidateQueries({ queryKey:['owners'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar', { duration: 8000, style:{ maxWidth:'520px' } });
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey:['owners'] });
    setModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"
            style={{ color:'var(--color-text-primary)', fontFamily:'var(--font-display)' }}>
            <UserSquare2 size={20} style={{ color:'var(--color-text-accent)' }}/>
            Propietarios
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            Dueños de los inmuebles en administración · {pag.total} registrado{pag.total === 1 ? '' : 's'}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setModal({})} className="btn btn-primary flex items-center gap-1.5">
            <Plus size={15}/> Nuevo propietario
          </button>
        )}
      </div>

      <div className="card p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--color-text-muted)' }}/>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o documento…" className="input w-full pl-9"/>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 flex items-center justify-center gap-2" style={{ color:'var(--color-text-muted)' }}>
          <Loader2 size={16} className="animate-spin"/> Cargando…
        </div>
      ) : owners.length === 0 ? (
        <div className="card p-8 text-center">
          <UserSquare2 size={32} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)', opacity:.4 }}/>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            {search ? 'Ningún propietario coincide con la búsqueda.' : 'Todavía no hay propietarios registrados.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background:'var(--color-bg-tertiary)' }}>
                  {['Propietario','Documento','Contacto','Inmuebles','Cuenta',''].map((h,i) => (
                    <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                      style={{ color:'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {owners.map(o => (
                  <tr key={o.id} style={{ borderTop:'1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color:'var(--color-text-primary)' }}>{o.full_name}</div>
                      {!o.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase"
                          style={{ background:'rgba(148,163,184,0.15)', color:'#94a3b8' }}>Inactivo</span>
                      )}
                      {o.client_name && (
                        <div className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                          También cliente: {o.client_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>
                      {o.document_type} {o.document_number}
                    </td>
                    <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>
                      {o.mobile || o.phone || '—'}
                      {o.email && <div className="text-xs" style={{ color:'var(--color-text-muted)' }}>{o.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                        style={{ background:'var(--color-bg-tertiary)', color:'var(--color-text-secondary)' }}>
                        <Home size={12}/> {o.properties_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color:'var(--color-text-muted)' }}>
                      {o.bank_name
                        ? `${o.bank_name}${o.bank_account_number ? ` · ${o.bank_account_number}` : ''}`
                        : <span className="text-amber-500">Sin datos de giro</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit && (
                        <button onClick={() => setModal(o)} title="Editar"
                          className="p-1.5 rounded hover:opacity-70" style={{ color:'var(--color-text-muted)' }}>
                          <Pencil size={14}/>
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(o)} title="Eliminar"
                          className="p-1.5 rounded hover:opacity-70 text-red-400">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pag.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderTop:'1px solid var(--color-border)' }}>
              <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                Página {pag.page} de {pag.pages}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={pag.page <= 1}
                  className="btn btn-secondary btn-sm disabled:opacity-40"><ChevronLeft size={14}/></button>
                <button onClick={() => setPage(p => Math.min(pag.pages, p+1))} disabled={pag.page >= pag.pages}
                  className="btn btn-secondary btn-sm disabled:opacity-40"><ChevronRight size={14}/></button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <OwnerModal
          owner={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default OwnersPage;
