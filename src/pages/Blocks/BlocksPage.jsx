// src/pages/Blocks/BlocksPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, RefreshCw, Plus, Edit, X, Save, Building2, LayoutGrid, List, Home } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import { blocksService, projectsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5"
      style={{ color: 'var(--color-text-secondary)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

// ── Modal Editar Manzana ─────────────────────────────────────
const EditBlockModal = ({ block, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code:        block.code        || '',
    name:        block.name        || '',
    description: block.description || '',
    block_type:  block.block_type  || 'manzana',
    total_units: String(block.total_units || ''),
    floor_count: String(block.floor_count || ''),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return toast.error('El nombre es requerido');
    if (!form.total_units || parseInt(form.total_units) < 1)
      return toast.error('El número de unidades es requerido');
    setSaving(true);
    try {
      await blocksService.update(block.id, {
        code:        form.code        || null,
        name:        form.name,
        description: form.description || null,
        block_type:  form.block_type,
        total_units: parseInt(form.total_units),
        floor_count: form.floor_count ? parseInt(form.floor_count) : null,
      });
      toast.success(`Manzana "${form.name}" actualizada`);
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
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', maxHeight: '90vh' }}>

        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: 'var(--color-navy)', borderBottom: '3px solid var(--color-gold)' }}>
          <div>
            <h2 className="font-bold" style={{ color: '#F5F3EE', fontFamily: 'var(--font-display)' }}>
              Editar Manzana / Edificio
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(200,168,75,0.7)' }}>
              {block.code} · {block.name}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ color: 'rgba(245,243,238,0.7)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                className="input text-sm" placeholder="MZN-A" />
            </Field>
            <Field label="Nombre *">
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input text-sm" placeholder="Manzana A" />
            </Field>
            <Field label="Tipo">
              <select value={form.block_type} onChange={e => set('block_type', e.target.value)}
                className="input text-sm">
                <option value="manzana">Manzana</option>
                <option value="edificio">Edificio</option>
                <option value="torre">Torre</option>
                <option value="bloque">Bloque</option>
                <option value="etapa">Etapa</option>
              </select>
            </Field>
            <Field label="Total de inmuebles *"
              hint="Tope máximo de inmuebles en esta manzana">
              <input type="number" value={form.total_units}
                onChange={e => set('total_units', e.target.value)}
                className="input text-sm" min="1" placeholder="20" />
            </Field>
            <Field label="Número de pisos">
              <input type="number" value={form.floor_count}
                onChange={e => set('floor_count', e.target.value)}
                className="input text-sm" min="1" placeholder="5" />
            </Field>
            <div className="col-span-2">
              <Field label="Descripción">
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="input text-sm resize-none w-full" rows={2}
                  placeholder="Descripción de la manzana..." />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── Página principal ─────────────────────────────────────────
const BlocksPage = () => {
  const navigate  = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const canCreate = hasRole('admin', 'gerente');
  const canEdit   = hasRole('admin', 'gerente');

  const [projectId,  setProjectId]  = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [viewMode,   setViewMode]   = useState(
    () => localStorage.getItem('blocks_view') || 'grid'
  );
  const changeView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('blocks_view', mode);
  };

  // Proyectos
  const { data: projData } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsService.getAll(),
  });
  const projects = projData?.data?.data || [];

  // Manzanas del proyecto seleccionado
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['blocks', projectId],
    queryFn:  () => blocksService.getByProject(projectId),
    enabled:  !!projectId,
  });
  const blocks = (data?.data?.data || []).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const selectedProject = projects.find(p => p.id === projectId);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['blocks', projectId] });
    refetch();
  };

  const BLOCK_TYPE_LABEL = {
    manzana: 'Manzana',
    edificio: 'Edificio',
    torre: 'Torre',
    bloque: 'Bloque',
    etapa: 'Etapa',
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold"
            style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
            Manzanas / Edificios
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Agrupaciones intermedias entre proyecto e inmuebles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex rounded overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}>
            {[['grid', LayoutGrid], ['list', List]].map(([mode, Icon]) => (
              <button key={mode} onClick={() => changeView(mode)}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: viewMode === mode ? 'var(--color-navy)' : 'var(--color-bg-card)',
                  color: viewMode === mode ? 'var(--color-gold)' : 'var(--color-text-muted)',
                }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="btn btn-ghost btn-sm" title="Recargar">
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
          {canCreate && (
            <button onClick={() => navigate(to('blocks/new'))} className="btn btn-primary">
              <Plus size={15} /> Nueva Manzana
            </button>
          )}
        </div>
      </div>

      {/* Selector de proyecto */}
      <div className="card"
        style={{ borderLeft: '4px solid var(--color-gold)', padding: '16px 20px' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Filtrar por proyecto
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="input text-sm" style={{ maxWidth: '380px' }}>
            <option value="">Seleccionar proyecto...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
                {p.total_blocks ? ` — ${p.total_blocks} manzana${p.total_blocks !== 1 ? 's' : ''}` : ''}
              </option>
            ))}
          </select>
          {selectedProject && (
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span style={{ color: 'var(--color-text-muted)' }}>
                Manzanas definidas:
                <strong className="ml-1" style={{ color: 'var(--color-navy)' }}>
                  {selectedProject.total_blocks || '—'}
                </strong>
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                Creadas:
                <strong className="ml-1" style={{ color: 'var(--color-gold)' }}>
                  {blocks.length}
                </strong>
              </span>
              {selectedProject.total_blocks && blocks.length < selectedProject.total_blocks && (
                <span style={{ color: 'var(--color-warning)' }}>
                  Faltan {selectedProject.total_blocks - blocks.length} manzana{selectedProject.total_blocks - blocks.length !== 1 ? 's' : ''} por crear
                </span>
              )}
              {selectedProject.total_blocks && blocks.length >= selectedProject.total_blocks && (
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  ✓ Todas las manzanas creadas
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Estado vacío — sin proyecto */}
      {!projectId && (
        <div className="card text-center py-16"
          style={{ border: '2px dashed var(--color-border)' }}>
          <Layers size={40} className="mx-auto mb-3" style={{ color: 'var(--color-gold)', opacity: 0.5 }} />
          <p className="font-semibold" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
            Selecciona un proyecto para ver sus manzanas
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Las manzanas/edificios organizan los inmuebles dentro de un proyecto
          </p>
        </div>
      )}

      {/* Estado vacío — proyecto sin manzanas */}
      {projectId && !isFetching && blocks.length === 0 && (
        <div className="card text-center py-16"
          style={{ border: '2px dashed var(--color-border)' }}>
          <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--color-gold)', opacity: 0.5 }} />
          <p className="font-semibold" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
            Este proyecto no tiene manzanas aún
          </p>
          {canCreate && (
            <button onClick={() => navigate(to('blocks/new'))} className="btn btn-primary mt-4">
              <Plus size={15} /> Crear primera manzana
            </button>
          )}
        </div>
      )}

      {/* Grid / Lista */}
      {projectId && blocks.length > 0 && (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-3'}>
          {blocks.map(b => {
            const total    = parseInt(b.total_units)      || 0;
            const current  = parseInt(b.total_properties) || 0;
            const avail    = total > 0 ? Math.max(0, total - current) : 0;
            const pct      = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
            const typeLabel = BLOCK_TYPE_LABEL[b.block_type] || b.block_type || 'Manzana';
            const isFull   = total > 0 && current >= total;

            return viewMode === 'grid' ? (
              // ── Tarjeta ──────────────────────────────────────────────
              <div key={b.id} className="card hover:shadow-lg transition-all flex flex-col gap-3"
                style={{ borderTop: '3px solid var(--color-gold)' }}>

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--color-navy)', border: '1.5px solid var(--color-gold)' }}>
                    <Layers size={18} style={{ color: 'var(--color-gold)' }} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {b.code && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        {b.code}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(13,27,62,0.07)', color: 'var(--color-navy)', border: '1px solid rgba(13,27,62,0.12)' }}>
                      {typeLabel}
                    </span>
                  </div>
                </div>

                {/* Nombre */}
                <p className="font-semibold" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
                  {b.name}
                </p>
                {b.description && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{b.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                  {[
                    [total,   'Total',  'var(--color-navy)',   'rgba(13,27,62,0.06)'],
                    [current, 'Creados','var(--color-gold)',   'rgba(200,168,75,0.1)'],
                    [avail,   'Disp.',  isFull ? 'var(--color-success)' : 'var(--color-text-muted)', isFull ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)'],
                  ].map(([val, lbl, color, bg]) => (
                    <div key={lbl} className="rounded p-1.5"
                      style={{ background: bg, border: `1px solid ${color}22` }}>
                      <p className="font-bold" style={{ color }}>{val}</p>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Barra progreso */}
                {total > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--color-text-muted)' }}>{current} de {total} inmuebles</span>
                      <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isFull ? 'var(--color-success)' : 'var(--color-gold)' }} />
                    </div>
                    {isFull ? (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        ✓ Manzana completa
                      </p>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Capacidad restante: {avail} inmueble{avail !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {b.floor_count && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    🏢 {b.floor_count} piso{b.floor_count !== 1 ? 's' : ''}
                  </p>
                )}

                {/* Botones */}
                <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => navigate(to(`properties?block_id=${b.id}`))}
                    className="btn btn-outline btn-sm flex-1 text-xs">
                    <Home size={12} /> Ver inmuebles
                  </button>
                  {canEdit && (
                    <button onClick={() => setEditTarget(b)}
                      className="btn btn-secondary btn-sm text-xs">
                      <Edit size={12} /> Editar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // ── Fila lista ────────────────────────────────────────────
              <div key={b.id} className="card hover:shadow-md transition-all"
                style={{
                  borderLeft: '3px solid var(--color-gold)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                  style={{ background: 'var(--color-navy)', border: '1.5px solid var(--color-gold)' }}>
                  <Layers size={14} style={{ color: 'var(--color-gold)' }} />
                </div>

                <div style={{ minWidth: '160px', flex: '1' }}>
                  <div className="flex items-center gap-2">
                    {b.code && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        {b.code}
                      </span>
                    )}
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
                      {b.name}
                    </p>
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(13,27,62,0.06)', color: 'var(--color-text-muted)' }}>
                      {typeLabel}
                    </span>
                  </div>
                  {b.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{b.description}</p>
                  )}
                </div>

                {/* Stats inline */}
                <div className="hidden sm:flex items-center gap-4 text-xs flex-shrink-0">
                  <div className="text-center" style={{ minWidth: '50px' }}>
                    <p className="font-bold" style={{ color: 'var(--color-navy)' }}>{total}</p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>Total</p>
                  </div>
                  <div className="text-center" style={{ minWidth: '50px' }}>
                    <p className="font-bold" style={{ color: 'var(--color-gold)' }}>{current}</p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>Creados</p>
                  </div>
                  <div className="text-center" style={{ minWidth: '50px' }}>
                    <p className="font-bold" style={{ color: isFull ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{avail}</p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>Disp.</p>
                  </div>
                </div>

                {/* Barra progreso */}
                {total > 0 && (
                  <div className="hidden md:flex flex-col gap-1 flex-shrink-0" style={{ width: '100px' }}>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--color-text-muted)' }}>{current} uds.</span>
                      <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isFull ? 'var(--color-success)' : 'var(--color-gold)' }} />
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => navigate(to(`properties?block_id=${b.id}`))}
                    className="btn btn-outline btn-sm text-xs">
                    <Home size={12} /> Inmuebles
                  </button>
                  {canEdit && (
                    <button onClick={() => setEditTarget(b)}
                      className="btn btn-secondary btn-sm text-xs">
                      <Edit size={12} /> Editar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal editar */}
      {editTarget && (
        <EditBlockModal
          block={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default BlocksPage;