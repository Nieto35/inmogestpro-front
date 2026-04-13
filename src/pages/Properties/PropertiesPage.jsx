// src/pages/Properties/PropertiesPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Plus, Building, Edit, X, Save } from 'lucide-react';
import { propertiesService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

// Colores semánticos de estado — justificados (semáforo funcional)
const STATUS_CFG = {
  disponible:  { label:'Disponible',  class:'badge-disponible',  color:'var(--color-success)' },
  reservado:   { label:'Reservado',   class:'badge-reservado',   color:'var(--color-warning)' },
  prometido:   { label:'Prometido',   class:'badge-prometido',   color:'var(--color-gold)'    },
  escriturado: { label:'Escriturado', class:'badge-escriturado', color:'var(--color-navy)'    },
  cancelado:   { label:'Cancelado',   class:'badge-cancelado',   color:'var(--color-danger)'  },
};

const CHANGE_TO = {
  disponible:  ['reservado'],
  reservado:   ['disponible','prometido'],
  prometido:   ['disponible','escriturado'],
  escriturado: [],
  cancelado:   ['disponible'],
};

// Configuración visual completa para botones de cambio de estado
// Fondo claro semántico + texto oscuro + hover con fondo sólido
const STATUS_BTN_CFG = {
  disponible:  {
    label: 'Disponible',
    bg:       '#e8f5ee',
    color:    '#1a5c35',
    border:   '#a3d4b8',
    hoverBg:  '#2D7A3A',
    hoverColor: '#ffffff',
  },
  reservado: {
    label: 'Reservado',
    bg:       '#fef6e4',
    color:    '#7a4f0a',
    border:   '#e8c97a',
    hoverBg:  '#92660A',
    hoverColor: '#ffffff',
  },
  prometido: {
    label: 'Prometido',
    bg:       'rgba(200,168,75,0.12)',
    color:    '#7a5a10',
    border:   'rgba(200,168,75,0.4)',
    hoverBg:  '#C8A84B',
    hoverColor: '#0D1B3E',
  },
  escriturado: {
    label: 'Escriturado',
    bg:       'rgba(13,27,62,0.07)',
    color:    '#0D1B3E',
    border:   'rgba(13,27,62,0.25)',
    hoverBg:  '#0D1B3E',
    hoverColor: '#F5F3EE',
  },
  cancelado: {
    label: 'Cancelado',
    bg:       '#fdf0f0',
    color:    '#8B2020',
    border:   '#e8a3a3',
    hoverBg:  '#C0392B',
    hoverColor: '#ffffff',
  },
};

const StatusButton = ({ newStatus, onClick, disabled, loading }) => {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_BTN_CFG[newStatus];
  if (!cfg) return null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: '30px',
        padding: '0 10px',
        fontSize: '0.75rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        borderRadius: 'var(--radius-sm)',
        border: `1.5px solid ${hovered ? cfg.hoverBg : cfg.border}`,
        background: hovered ? cfg.hoverBg : cfg.bg,
        color: hovered ? cfg.hoverColor : cfg.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
      }}>
      {loading ? '...' : `→ ${cfg.label}`}
    </button>
  );
};
const PURPOSE_CFG = {
  venta:          { label:'Venta',          color:'var(--color-navy)', bg:'rgba(13,27,62,0.07)'   },
  arriendo:       { label:'Arriendo',       color:'var(--color-gold)', bg:'rgba(200,168,75,0.10)' },
  venta_arriendo: { label:'Venta/Arriendo', color:'var(--color-navy)', bg:'rgba(13,27,62,0.05)'   },
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
      style={{ background:'rgba(13,27,62,0.55)' }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)', maxHeight:'90vh' }}>

        {/* Header — navy + gold */}
        <div className="flex items-center justify-between p-5 flex-shrink-0"
          style={{ background:'var(--color-navy)', borderBottom:'3px solid var(--color-gold)' }}>
          <div>
            <h2 className="font-bold" style={{ color:'#F5F3EE', fontFamily:'var(--font-display)' }}>
              Editar Inmueble
            </h2>
            <p className="text-xs mt-0.5" style={{ color:'rgba(200,168,75,0.7)' }}>
              {property.project_name} · {property.unit_number}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"
            style={{ color:'rgba(245,243,238,0.7)' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

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
                className="w-4 h-4"/>
              <label htmlFor="storage_edit" className="text-xs"
                style={{ color:'var(--color-text-secondary)' }}>
                Con depósito
              </label>
            </div>
          </div>

          <div className="pt-2 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-gold)', letterSpacing:'0.08em' }}>Precios</p>
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

          <Field label="Observaciones del inmueble">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              className="input text-sm resize-none w-full" rows={2}
              placeholder="Características especiales, vistas, restricciones..."/>
          </Field>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3 flex-shrink-0"
          style={{ borderColor:'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
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
  const queryClient     = useQueryClient();
  const { hasRole }     = useAuthStore();
  const canCreate       = hasRole('admin','gerente','contador');
  const canEdit         = hasRole('admin','gerente','contador');
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
          <h1 className="text-2xl font-bold"
            style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            Inmuebles
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {props.length} propiedad{props.length !== 1 ? 'es' : ''} encontrada{props.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-outline btn-sm">
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
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Proyecto</th>
                <th>Tipo</th>
                <th>Área · Hab · Baños</th>
                <th>Propósito</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Comprador / Arrendatario</th>
                <th>Avance</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {props.map(p => {
                const s         = STATUS_CFG[p.status] || { label:p.status, class:'badge-pendiente', color:'var(--color-text-muted)' };
                const purpose   = p.features?.purpose || 'venta';
                const purpCfg   = PURPOSE_CFG[purpose] || PURPOSE_CFG.venta;
                const canChange = canChangeStatus && CHANGE_TO[p.status]?.length > 0;
                const paidPct   = p.contract_value > 0
                  ? Math.min(Math.round((parseFloat(p.total_paid||0)/parseFloat(p.contract_value))*100),100)
                  : 0;

                return (
                  <tr key={p.id}>

                    {/* Unidad */}
                    <td>
                      <p className="text-sm font-bold font-mono"
                        style={{ color:'var(--color-navy)', whiteSpace:'nowrap' }}>
                        {p.unit_number || '—'}
                      </p>
                      {p.floor_number && (
                        <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                          Piso {p.floor_number}
                        </p>
                      )}
                    </td>

                    {/* Proyecto */}
                    <td>
                      <p className="text-sm font-medium"
                        style={{ color:'var(--color-navy)', whiteSpace:'nowrap' }}>
                        {p.project_name || '—'}
                      </p>
                    </td>

                    {/* Tipo */}
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                      {p.property_type || '—'}
                    </td>

                    {/* Área · Hab · Baños */}
                    <td>
                      <span className="text-xs"
                        style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                        {p.m2_construction ? `${p.m2_construction}m²` : '—'}
                        {' · '}
                        {p.bedrooms ?? '—'} hab
                        {' · '}
                        {p.bathrooms ?? '—'} baños
                        {p.parking_spots > 0 && ` · ${p.parking_spots} 🅿`}
                      </span>
                    </td>

                    {/* Propósito */}
                    <td>
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background:purpCfg.bg, color:purpCfg.color, border:`1px solid ${purpCfg.color}25`, whiteSpace:'nowrap' }}>
                        {purpCfg.label}
                      </span>
                    </td>

                    {/* Estado */}
                    <td>
                      <span className={`badge ${s.class}`}>{s.label}</span>
                    </td>

                    {/* Precio */}
                    <td style={{ whiteSpace:'nowrap' }}>
                      <p className="text-sm font-mono font-bold"
                        style={{ color:'var(--color-navy)' }}>
                        {formatCurrency(p.base_price)}
                      </p>
                      {p.features?.rental_price && (
                        <p className="text-xs font-mono"
                          style={{ color:'var(--color-gold)' }}>
                          {formatCurrency(p.features.rental_price)}/mes
                        </p>
                      )}
                    </td>

                    {/* Comprador / Arrendatario */}
                    <td>
                      {p.occupant_name ? (
                        <div style={{ minWidth:'120px' }}>
                          <p className="text-sm font-medium"
                            style={{ color:'var(--color-navy)' }}>
                            {p.occupant_name}
                          </p>
                          {p.occupant_contract && (
                            <p className="text-xs font-mono"
                              style={{ color:'var(--color-gold)' }}>
                              {p.occupant_contract}
                            </p>
                          )}
                          {p.occupant_phone && (
                            <p className="text-xs"
                              style={{ color:'var(--color-text-muted)' }}>
                              {p.occupant_phone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Avance del contrato */}
                    <td style={{ minWidth:'90px' }}>
                      {p.contract_value > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full"
                            style={{ background:'var(--color-bg-secondary)', minWidth:'50px' }}>
                            <div className="h-1.5 rounded-full transition-all"
                              style={{
                                width:`${paidPct}%`,
                                background: paidPct >= 100 ? 'var(--color-gold)' : 'var(--color-navy)',
                              }}/>
                          </div>
                          <span className="text-xs font-mono flex-shrink-0"
                            style={{ color: paidPct >= 100 ? 'var(--color-gold)' : 'var(--color-navy)' }}>
                            {paidPct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 flex-wrap" style={{ minWidth:'120px' }}>
                        {canEdit && (
                          <button
                            onClick={() => setEditTarget(p)}
                            className="btn btn-outline btn-sm text-xs"
                            style={{ height:'26px', padding:'0 8px', whiteSpace:'nowrap' }}>
                            <Edit size={11}/> Editar
                          </button>
                        )}
                        {canChange && CHANGE_TO[p.status].map(newStatus => (
                          <StatusButton
                            key={newStatus}
                            newStatus={newStatus}
                            onClick={() => handleStatusChange(p, newStatus)}
                            disabled={changingId === p.id}
                            loading={changingId === p.id}
                          />
                        ))}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PropertiesPage;