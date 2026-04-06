// src/pages/Properties/PropertiesPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Search, RefreshCw, Plus, Building, Tag, Edit, X, Save } from 'lucide-react';
import { propertiesService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  disponible:  { label:'Disponible',  class:'badge-disponible',  color:'#10b981' },
  reservado:   { label:'Reservado',   class:'badge-reservado',   color:'#f59e0b' },
  prometido:   { label:'Prometido',   class:'badge-prometido',   color:'#a855f7' },
  escriturado: { label:'Escriturado', class:'badge-escriturado', color:'#3b82f6' },
  cancelado:   { label:'Cancelado',   class:'badge-cancelado',   color:'#ef4444' },
};

const CHANGE_TO = {
  disponible:  ['reservado'],
  reservado:   ['disponible','prometido'],
  prometido:   ['disponible','escriturado'],
  escriturado: [],
  cancelado:   ['disponible'],
};

const PURPOSE_CFG = {
  venta:          { label:'Venta',          color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
  arriendo:       { label:'Arriendo',       color:'#10b981', bg:'rgba(16,185,129,0.1)' },
  venta_arriendo: { label:'Venta/Arriendo', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
};

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium mb-1" style={{ color:'var(--color-text-muted)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

// ── Modal Editar Inmueble ─────────────────────────────────────
const EditPropertyModal = ({ property, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({
    unit_number:     property.unit_number    || '',
    property_type:   property.property_type  || 'apartamento',
    m2_construction: String(property.m2_construction || ''),
    m2_terrain:      String(property.m2_terrain      || ''),
    floor_number:    String(property.floor_number     || ''),
    bedrooms:        String(property.bedrooms         || ''),
    bathrooms:       String(property.bathrooms        || ''),
    parking_spots:   String(property.parking_spots    || '0'),
    storage_room:    property.storage_room            || false,
    base_price:      String(property.base_price       || ''),
    rental_price:    String(property.features?.rental_price || ''),
    purpose:         property.features?.purpose       || 'venta',
    notes:           property.features?.notes         || '',
  });
  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const handleSave = async () => {
    if (!form.base_price) return toast.error('El precio es requerido');
    setSaving(true);
    try {
      await propertiesService.update(property.id, {
        unit_number:     form.unit_number,
        property_type:   form.property_type,
        m2_construction: form.m2_construction ? parseFloat(form.m2_construction) : null,
        m2_terrain:      form.m2_terrain      ? parseFloat(form.m2_terrain)      : null,
        floor_number:    form.floor_number    ? parseInt(form.floor_number)       : null,
        bedrooms:        form.bedrooms        ? parseInt(form.bedrooms)           : null,
        bathrooms:       form.bathrooms       ? parseInt(form.bathrooms)          : null,
        parking_spots:   form.parking_spots   ? parseInt(form.parking_spots)      : 0,
        storage_room:    form.storage_room,
        base_price:      parseFloat(form.base_price),
        status:          property.status,
        features: {
          purpose:      form.purpose,
          rental_price: form.rental_price ? parseFloat(form.rental_price) : null,
          notes:        form.notes        || null,
        },
      });
      toast.success(`Inmueble "${form.unit_number}" actualizado`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)', maxHeight:'90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0"
          style={{ borderColor:'var(--color-border)' }}>
          <div>
            <h2 className="font-bold" style={{ color:'var(--color-text-primary)' }}>
              Editar Inmueble
            </h2>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {property.project_name} · {property.unit_number}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>

        {/* Body scrollable */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Identificación */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Número / identificación de unidad">
                <input value={form.unit_number} onChange={e => set('unit_number', e.target.value)}
                  className="input text-sm w-full" placeholder="Apto 301"/>
              </Field>
            </div>
            <Field label="Tipo de inmueble">
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)}
                className="input text-sm">
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
                <option value="lote">Lote</option>
                <option value="local">Local comercial</option>
                <option value="bodega">Bodega</option>
                <option value="oficina">Oficina</option>
              </select>
            </Field>
            <Field label="Propósito">
              <select value={form.purpose} onChange={e => set('purpose', e.target.value)}
                className="input text-sm">
                <option value="venta">Venta</option>
                <option value="arriendo">Arriendo</option>
                <option value="venta_arriendo">Venta o Arriendo</option>
              </select>
            </Field>
          </div>

          {/* Características */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Área construida (m²)">
              <input type="number" value={form.m2_construction}
                onChange={e => set('m2_construction', e.target.value)}
                className="input text-sm" placeholder="65" min="0" step="0.5"/>
            </Field>
            <Field label="Piso">
              <input type="number" value={form.floor_number}
                onChange={e => set('floor_number', e.target.value)}
                className="input text-sm" placeholder="3" min="1"/>
            </Field>
            <Field label="Parqueaderos">
              <input type="number" value={form.parking_spots}
                onChange={e => set('parking_spots', e.target.value)}
                className="input text-sm" placeholder="1" min="0"/>
            </Field>
            <Field label="Alcobas">
              <input type="number" value={form.bedrooms}
                onChange={e => set('bedrooms', e.target.value)}
                className="input text-sm" placeholder="2" min="0"/>
            </Field>
            <Field label="Baños">
              <input type="number" value={form.bathrooms}
                onChange={e => set('bathrooms', e.target.value)}
                className="input text-sm" placeholder="1" min="0"/>
            </Field>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="storage_edit" checked={form.storage_room}
                onChange={e => set('storage_room', e.target.checked)}
                className="w-4 h-4 accent-blue-500"/>
              <label htmlFor="storage_edit" className="text-xs"
                style={{ color:'var(--color-text-secondary)' }}>
                Con depósito
              </label>
            </div>
          </div>

          {/* Precios */}
          <div className="pt-2 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-text-muted)' }}>Precios</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={form.purpose === 'arriendo' ? 'Valor comercial (COP)' : 'Precio de venta (COP)'}
                hint="Requerido">
                <input type="number" value={form.base_price}
                  onChange={e => set('base_price', e.target.value)}
                  className="input text-sm" placeholder="120000000" min="0" step="1000"/>
              </Field>
              {(form.purpose === 'arriendo' || form.purpose === 'venta_arriendo') && (
                <Field label="Canon de arriendo mensual (COP)">
                  <input type="number" value={form.rental_price}
                    onChange={e => set('rental_price', e.target.value)}
                    className="input text-sm" placeholder="1500000" min="0"/>
                </Field>
              )}
            </div>
          </div>

          {/* Notas */}
          <Field label="Observaciones del inmueble">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              className="input text-sm resize-none w-full" rows={2}
              placeholder="Características especiales, vistas, restricciones..."/>
          </Field>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3 flex-shrink-0"
          style={{ borderColor:'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
            <Save size={14}/> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const PropertiesPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient   = useQueryClient();
  const { hasRole }   = useAuthStore();
  const canCreate     = hasRole('admin','gerente','contador');
  const canEdit       = hasRole('admin','gerente','contador');
  const canChangeStatus = hasRole('admin','gerente');

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [changingId,    setChangingId]    = useState(null);
  const [editTarget,    setEditTarget]    = useState(null);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['properties', search, statusFilter],
    queryFn:  () => propertiesService.getAll({ search, status: statusFilter }),
  });

  const allProps = data?.data?.data || [];
  const props    = purposeFilter
    ? allProps.filter(p => (p.features?.purpose || 'venta') === purposeFilter)
    : allProps;

  const handleStatusChange = async (property, newStatus) => {
    setChangingId(property.id);
    try {
      await propertiesService.updateStatus(property.id, newStatus);
      toast.success(`"${property.unit_number}" → ${STATUS_CFG[newStatus]?.label}`);
      queryClient.invalidateQueries({ queryKey:['properties'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar estado');
    } finally {
      setChangingId(null);
    }
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['properties'] });
    refetch();
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Modal editar */}
      {editTarget && (
        <EditPropertyModal
          property={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>
            Inmuebles
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {props.length} propiedad{props.length !== 1 ? 'es' : ''} encontrada{props.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          {canCreate && (
            <>
              <button onClick={() => navigate(to('properties/bulk'))} className="btn btn-secondary btn-sm">
                <Plus size={14}/> Crear en Lote
              </button>
              <button onClick={() => navigate(to('properties/new'))} className="btn btn-primary btn-sm">
                <Plus size={14}/> Nuevo Inmueble
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color:'var(--color-text-muted)' }}/>
          <input type="text" placeholder="Buscar proyecto o unidad..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm" style={{ height:'36px' }}/>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input text-sm" style={{ height:'36px', width:'auto' }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k,v]) =>
            <option key={k} value={k}>{v.label}</option>
          )}
        </select>
        <select value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)}
          className="input text-sm" style={{ height:'36px', width:'auto' }}>
          <option value="">Venta y Arriendo</option>
          <option value="venta">Solo Venta</option>
          <option value="arriendo">Solo Arriendo</option>
          <option value="venta_arriendo">Venta o Arriendo</option>
        </select>
      </div>

      {/* Contenido */}
      {isFetching && props.length === 0 ? (
        <div className="flex items-center justify-center py-20 gap-3"
          style={{ color:'var(--color-text-muted)' }}>
          <RefreshCw size={20} className="animate-spin"/>
          <span>Cargando inmuebles...</span>
        </div>
      ) : props.length === 0 ? (
        <div className="card flex flex-col items-center py-16 gap-4">
          <Building size={48} style={{ color:'var(--color-text-muted)' }}/>
          <div className="text-center">
            <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
              No hay inmuebles registrados
            </p>
            <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
              Crea un proyecto y agrega los inmuebles
            </p>
          </div>
          {canCreate && (
            <button onClick={() => navigate(to('properties/new'))} className="btn btn-primary btn-sm">
              <Plus size={14}/> Registrar Inmueble
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {props.map(p => {
            const s       = STATUS_CFG[p.status]  || { label:p.status, class:'badge-pendiente', color:'#94a3b8' };
            const purpose = p.features?.purpose   || 'venta';
            const purpCfg = PURPOSE_CFG[purpose]  || PURPOSE_CFG.venta;
            const canChange = canChangeStatus && CHANGE_TO[p.status]?.length > 0;

            return (
              <div key={p.id} className="card hover:shadow-lg transition-all">

                {/* Header tarjeta */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background:'rgba(59,130,246,0.1)' }}>
                    <Home size={18} className="text-blue-400"/>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${s.class}`}>{s.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background:purpCfg.bg, color:purpCfg.color }}>
                      <Tag size={9} className="inline mr-0.5"/>
                      {purpCfg.label}
                    </span>
                  </div>
                </div>

                {/* Nombre */}
                <p className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
                  {p.project_name}
                </p>
                <p className="text-sm mb-3" style={{ color:'var(--color-text-muted)' }}>
                  Unidad {p.unit_number} · {p.property_type}
                </p>

                {/* Características */}
                <div className="grid grid-cols-3 gap-1.5 text-xs text-center mb-3">
                  {[
                    [p.m2_construction ? `${p.m2_construction}m²` : '—', 'Área'],
                    [p.bedrooms ?? '—', 'Alcobas'],
                    [p.bathrooms ?? '—', 'Baños'],
                  ].map(([val, lbl]) => (
                    <div key={lbl} className="rounded p-1.5"
                      style={{ background:'var(--color-bg-primary)' }}>
                      <p className="font-bold" style={{ color:'var(--color-text-primary)' }}>{val}</p>
                      <p style={{ color:'var(--color-text-muted)' }}>{lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Precios */}
                <p className="text-sm font-bold font-mono mb-1"
                  style={{ color:'var(--color-text-accent)' }}>
                  {formatCurrency(p.base_price)}
                  {purpose !== 'venta' && (
                    <span className="text-xs font-normal ml-1">(valor comercial)</span>
                  )}
                </p>
                {p.features?.rental_price && (
                  <p className="text-xs font-mono mb-2" style={{ color:'#10b981' }}>
                    Arriendo: {formatCurrency(p.features.rental_price)}/mes
                  </p>
                )}

                {/* Ocupante */}
                {p.occupant_name && (
                  <div className="mt-2 pt-2 space-y-0.5"
                    style={{ borderTop:'1px solid var(--color-border)' }}>
                    <p className="text-xs font-semibold"
                      style={{ color:'var(--color-text-muted)' }}>
                      {p.payment_type === 'arriendo' ? '👤 Arrendatario' : '👤 Comprador'}
                    </p>
                    <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                      {p.occupant_name}
                    </p>
                    {p.occupant_phone && (
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        📞 {p.occupant_phone}
                      </p>
                    )}
                    {p.occupant_contract && (
                      <p className="text-xs font-mono mt-0.5"
                        style={{ color:'#60a5fa' }}>
                        📄 {p.occupant_contract}
                      </p>
                    )}
                    {p.contract_value > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full"
                          style={{ background:'var(--color-bg-primary)' }}>
                          <div className="h-1.5 rounded-full"
                            style={{
                              width:`${Math.min(Math.round((parseFloat(p.total_paid||0)/parseFloat(p.contract_value))*100),100)}%`,
                              background:'#10b981',
                            }}/>
                        </div>
                        <span className="text-xs" style={{ color:'#10b981' }}>
                          {Math.min(Math.round((parseFloat(p.total_paid||0)/parseFloat(p.contract_value))*100),100)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de acción */}
                <div className="mt-3 pt-3 flex flex-col gap-2"
                  style={{ borderTop:'1px solid var(--color-border)' }}>

                  {/* Botón editar */}
                  {canEdit && (
                    <button
                      onClick={() => setEditTarget(p)}
                      className="btn btn-secondary btn-sm w-full text-xs">
                      <Edit size={12}/> Editar inmueble
                    </button>
                  )}

                  {/* Cambiar estado */}
                  {canChange && (
                    <div>
                      <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
                        Cambiar estado:
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {CHANGE_TO[p.status].map(newStatus => (
                          <button key={newStatus}
                            onClick={() => handleStatusChange(p, newStatus)}
                            disabled={changingId === p.id}
                            className="btn btn-secondary btn-sm text-xs flex-1"
                            style={{ height:'26px', padding:'0 8px', color:STATUS_CFG[newStatus]?.color }}>
                            {changingId === p.id ? '...' : `→ ${STATUS_CFG[newStatus]?.label}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas */}
                {p.features?.notes && (
                  <p className="text-xs mt-2 truncate" style={{ color:'var(--color-text-muted)' }}
                    title={p.features.notes}>
                    📝 {p.features.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PropertiesPage;