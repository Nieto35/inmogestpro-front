// src/pages/Projects/ProjectsPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, RefreshCw, Plus, Edit, X, Save, MapPin, LayoutGrid, List, Layers } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { projectsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5"
      style={{ color:'var(--color-text-secondary)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

// ── Modal Editar Proyecto ────────────────────────────────────
const EditProjectModal = ({ project, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code:        project.code        || '',
    name:        project.name        || '',
    description: project.description || '',
    location:    project.location    || '',
    city:        project.city        || '',
    department:  project.department  || '',
    total_units:  String(project.total_units  || ''),
    total_blocks: String(project.total_blocks || ''),
    price_per_m2:String(project.price_per_m2|| ''),
  });
  const set = (k, v) => setForm(f => ({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.name) return toast.error('El nombre del proyecto es requerido');
    if (!form.city) return toast.error('La ciudad es requerida');
    setSaving(true);
    try {
      await projectsService.update(project.id, {
        code:         form.code,
        name:         form.name,
        description:  form.description  || null,
        location:     form.location     || null,
        city:         form.city,
        department:   form.department   || null,
        total_units:  form.total_units  ? parseInt(form.total_units)    : null,
        total_blocks: form.total_blocks ? parseInt(form.total_blocks)    : null,
        price_per_m2: form.price_per_m2 ? parseFloat(form.price_per_m2) : null,
      });
      toast.success(`Proyecto "${form.name}" actualizado`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)', maxHeight:'90vh' }}>

        {/* Header — azul noche + línea dorada */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background:'var(--color-navy)', borderBottom:'3px solid var(--color-gold)' }}>
          <div>
            <h2 className="font-bold" style={{ color:'#F5F3EE', fontFamily:'var(--font-display)' }}>
              Editar Proyecto
            </h2>
            <p className="text-xs mt-0.5" style={{ color:'rgba(200,168,75,0.7)' }}>
              {project.code} · {project.name}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ color:'rgba(245,243,238,0.7)' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código del proyecto">
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                className="input text-sm" placeholder="ONT-01"/>
            </Field>
            <Field label="Nombre del proyecto *">
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input text-sm" placeholder="Ontario"/>
            </Field>
            <Field label="Ciudad *">
              <input value={form.city} onChange={e => set('city', e.target.value)}
                className="input text-sm" placeholder="Cali"/>
            </Field>
            <Field label="Departamento">
              <input value={form.department} onChange={e => set('department', e.target.value)}
                className="input text-sm" placeholder="Valle del Cauca"/>
            </Field>
            <div className="col-span-2">
              <Field label="Dirección / Ubicación">
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="input text-sm w-full" placeholder="Av. 6N # 23-45"/>
              </Field>
            </div>
            <Field label="Nº de manzanas / edificios"
              hint="Cuántas manzanas o edificios tendrá este proyecto">
              <input type="number" value={form.total_blocks}
                onChange={e => set('total_blocks', e.target.value)}
                className="input text-sm" min="1" placeholder="5"/>
            </Field>
            <Field label="Total de unidades"
              hint="Tope máximo de inmuebles en todo el proyecto">
              <input type="number" value={form.total_units}
                onChange={e => set('total_units', e.target.value)}
                className="input text-sm" min="1" placeholder="50"/>
            </Field>
            <Field label="Precio por m² (COP)">
              <input type="number" value={form.price_per_m2}
                onChange={e => set('price_per_m2', e.target.value)}
                className="input text-sm" min="0" step="1000" placeholder="2500000"/>
            </Field>
            <div className="col-span-2">
              <Field label="Descripción">
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="input text-sm resize-none w-full" rows={2}
                  placeholder="Descripción del proyecto..."/>
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
            <Save size={14}/> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── Página principal ─────────────────────────────────────────
const ProjectsPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const canCreate   = hasRole('admin','gerente');
  const canEdit     = hasRole('admin','gerente');

  const [editTarget, setEditTarget] = useState(null);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('projects_view') || 'list'
  );
  const changeView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('projects_view', mode);
  };
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsService.getAll(),
  });
  const projects = data?.data?.data || [];

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['projects'] });
    refetch();
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {editTarget && (
        <EditProjectModal
          project={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold"
            style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            Proyectos
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-outline btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          <div className="flex rounded overflow-hidden"
            style={{ border:'1px solid var(--color-border)' }}>
            <button
              onClick={() => changeView('grid')}
              title="Vista cuadrícula"
              style={{
                height:'32px', width:'32px', display:'flex', alignItems:'center', justifyContent:'center',
                background: viewMode === 'grid' ? 'var(--color-navy)' : 'transparent',
                color:      viewMode === 'grid' ? 'var(--color-gold)' : 'var(--color-text-muted)',
                border:'none', cursor:'pointer', transition:'all 0.15s',
              }}>
              <LayoutGrid size={14}/>
            </button>
            <button
              onClick={() => changeView('list')}
              title="Vista lista"
              style={{
                height:'32px', width:'32px', display:'flex', alignItems:'center', justifyContent:'center',
                background: viewMode === 'list' ? 'var(--color-navy)' : 'transparent',
                color:      viewMode === 'list' ? 'var(--color-gold)' : 'var(--color-text-muted)',
                border:'none', borderLeft:'1px solid var(--color-border)', cursor:'pointer', transition:'all 0.15s',
              }}>
              <List size={14}/>
            </button>
          </div>
          {canCreate && (
            <button onClick={() => navigate(to('projects/new'))} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nuevo Proyecto
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {projects.length === 0 ? (
        <div className="card flex flex-col items-center py-16 gap-4">
          <Building size={48} style={{ color:'var(--color-text-muted)' }}/>
          <div className="text-center">
            <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
              No hay proyectos registrados
            </p>
            <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
              Crea el primer proyecto para comenzar
            </p>
          </div>
          {canCreate && (
            <button onClick={() => navigate(to('projects/new'))} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nuevo Proyecto
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'flex flex-col gap-2'}>
          {projects.map(p => {
            const total    = parseInt(p.total_units)     || 0;
            const props    = parseInt(p.total_properties)|| 0;
            const avail    = parseInt(p.available)       || 0;
            const promised = parseInt(p.promised)        || 0;
            const deeded   = parseInt(p.deeded)          || 0;
            const sold     = promised + deeded;
            const pct      = props > 0 ? Math.round((sold/props)*100) : 0;

            return viewMode === 'grid' ? (
              // ── Vista cuadrícula (tarjeta original) ──────────────
              <div key={p.id} className="card hover:shadow-lg transition-all"
                style={{ borderTop:'3px solid var(--color-gold)' }}>

                {/* Header tarjeta */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{
                      background:'var(--color-navy)',
                      border:'1.5px solid var(--color-gold)',
                    }}>
                    <Building size={18} style={{ color:'var(--color-gold)' }}/>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
                    {p.code}
                  </span>
                </div>

                {/* Info */}
                <p className="font-semibold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                  {p.name}
                </p>
                {p.city && (
                  <p className="text-xs flex items-center gap-1 mt-0.5 mb-3"
                    style={{ color:'var(--color-text-muted)' }}>
                    <MapPin size={10}/> {p.city}{p.department ? `, ${p.department}` : ''}
                  </p>
                )}

                {/* Manzanas badge */}
                {p.total_blocks > 0 && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs"
                    style={{ color:'var(--color-text-muted)' }}>
                    <Layers size={11} style={{ color:'var(--color-gold)' }}/>
                    <span>
                      {p.created_blocks || 0} de {p.total_blocks} manzana{p.total_blocks!==1?'s':''} creada{p.total_blocks!==1?'s':''}
                    </span>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-1.5 text-xs text-center mb-3">
                  {[
                    [avail,         'Disp.',     'var(--color-success)',  'var(--color-success-bg)'],
                    [p.reserved||0, 'Reserv.',   'var(--color-warning)',  'var(--color-warning-bg)'],
                    [promised,      'Promet.',   'var(--color-gold)',     'rgba(200,168,75,0.1)'],
                    [deeded,        'Escritur.', 'var(--color-navy)',     'rgba(13,27,62,0.06)'],
                  ].map(([val, lbl, color, bg]) => (
                    <div key={lbl} className="rounded p-1.5"
                      style={{ background: bg, border:`1px solid ${color}22` }}>
                      <p className="font-bold" style={{ color }}>{val}</p>
                      <p style={{ color:'var(--color-text-muted)', fontSize:'10px' }}>{lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Progreso */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color:'var(--color-text-muted)' }}>
                      {props} inmuebles{total > 0 && ` de ${total} totales`}
                    </span>
                    <span style={{ color:'var(--color-gold)', fontWeight:600 }}>{pct}% vendido</span>
                  </div>
                  <div className="h-1.5 rounded-full"
                    style={{ background:'var(--color-bg-secondary)' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width:`${pct}%`, background:'var(--color-gold)' }}/>
                  </div>
                  {total > 0 && props < total && (
                    <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                      Capacidad restante: {total - props} unidad{(total-props)!==1?'es':''}
                    </p>
                  )}
                  {total > 0 && props >= total && (
                    <p className="text-xs mt-1" style={{ color:'var(--color-success)', fontWeight:600 }}>
                      ✓ Proyecto completo — todas las unidades creadas
                    </p>
                  )}
                </div>

                {/* Botones */}
                <div className="flex gap-2 pt-3"
                  style={{ borderTop:'1px solid var(--color-border)' }}>
                  <button onClick={() => navigate(to('blocks'))}
                    className="btn btn-outline btn-sm flex-1 text-xs">
                    <Layers size={12}/> Ver manzanas
                  </button>
                  {canEdit && (
                    <button onClick={() => setEditTarget(p)}
                      className="btn btn-secondary btn-sm text-xs">
                      <Edit size={12}/> Editar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // ── Vista lista (fila compacta) ───────────────────────
              <div key={p.id} className="card hover:shadow-md transition-all"
                style={{
                  borderLeft:'3px solid var(--color-gold)',
                  padding:'12px 16px',
                  display:'flex',
                  alignItems:'center',
                  gap:'16px',
                }}>

                {/* Icono */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                  style={{ background:'var(--color-navy)', border:'1.5px solid var(--color-gold)' }}>
                  <Building size={14} style={{ color:'var(--color-gold)' }}/>
                </div>

                {/* Código + Nombre + Ciudad */}
                <div style={{ minWidth:'160px', flex:'1' }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
                      {p.code}
                    </span>
                    <p className="font-semibold text-sm" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                      {p.name}
                    </p>
                  </div>
                  {p.city && (
                    <p className="text-xs flex items-center gap-1 mt-0.5"
                      style={{ color:'var(--color-text-muted)' }}>
                      <MapPin size={9}/> {p.city}{p.department ? `, ${p.department}` : ''}
                    </p>
                  )}
                </div>

                {/* Stats inline */}
                <div className="hidden sm:flex items-center gap-3 text-xs flex-shrink-0">
                  {[
                    [avail,         'Disp.',     'var(--color-success)'],
                    [p.reserved||0, 'Reserv.',   'var(--color-warning)'],
                    [promised,      'Promet.',   'var(--color-gold)'],
                    [deeded,        'Escritur.', 'var(--color-navy)'],
                  ].map(([val, lbl, color]) => (
                    <div key={lbl} className="text-center" style={{ minWidth:'38px' }}>
                      <p className="font-bold" style={{ color }}>{val}</p>
                      <p style={{ color:'var(--color-text-muted)', fontSize:'10px' }}>{lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Barra progreso */}
                <div className="hidden md:flex flex-col gap-1 flex-shrink-0" style={{ width:'100px' }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color:'var(--color-text-muted)' }}>{props} uds.</span>
                    <span style={{ color:'var(--color-gold)', fontWeight:600 }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background:'var(--color-bg-secondary)' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width:`${pct}%`, background:'var(--color-gold)' }}/>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => navigate(to('blocks'))}
                    className="btn btn-outline btn-sm text-xs">
                    <Layers size={12}/> Ver manzanas
                  </button>
                  {canEdit && (
                    <button onClick={() => setEditTarget(p)}
                      className="btn btn-secondary btn-sm text-xs">
                      <Edit size={12}/> Editar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;