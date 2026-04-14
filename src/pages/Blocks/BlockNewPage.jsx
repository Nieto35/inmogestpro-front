// src/pages/Blocks/BlockNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Trash2, Layers, Building2, AlertTriangle } from 'lucide-react';
import { blocksService, projectsService } from '../../services/api.service';
import toast from 'react-hot-toast';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5"
      style={{ color: 'var(--color-text-secondary)' }}>
      {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const BLOCK_TYPES = [
  { value: 'manzana',  label: 'Manzana'  },
  { value: 'edificio', label: 'Edificio' },
  { value: 'torre',    label: 'Torre'    },
  { value: 'bloque',   label: 'Bloque'   },
  { value: 'etapa',    label: 'Etapa'    },
];

const emptyGroup = () => ({
  _id:          Date.now() + Math.random(),
  quantity:     '1',          // cuántas manzanas iguales crear
  name_prefix:  '',            // ej: "Manzana" → generará "Manzana A", "Manzana B"...
  name_start:   'A',           // letra/número de inicio
  use_letters:  true,          // true = letras, false = números
  block_type:   'manzana',
  total_units:  '',            // inmuebles por manzana
  floor_count:  '',
  description:  '',
});

// Genera los nombres de preview
const generateNames = (group) => {
  const qty = parseInt(group.quantity) || 0;
  if (!group.name_prefix || qty < 1) return [];
  const names = [];
  for (let i = 0; i < qty; i++) {
    let suffix;
    if (group.use_letters) {
      const startCode = group.name_start?.charCodeAt(0) || 65;
      suffix = String.fromCharCode(startCode + i);
    } else {
      const startNum = parseInt(group.name_start) || 1;
      suffix = String(startNum + i);
    }
    names.push(`${group.name_prefix} ${suffix}`);
  }
  return names;
};

const BlockNewPage = () => {
  const navigate  = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;

  const [projectId, setProjectId] = useState('');
  const [groups,    setGroups]    = useState([emptyGroup()]);
  const [saving,    setSaving]    = useState(false);

  const { data: projData } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsService.getAll(),
  });
  const projects = projData?.data?.data || [];

  const selectedProject = projects.find(p => p.id === projectId);
  const maxBlocks   = selectedProject ? parseInt(selectedProject.total_blocks) || 0 : 0;
  // total_blocks_created debería venir del backend; fallback 0
  const createdBlocks = selectedProject ? parseInt(selectedProject.created_blocks) || 0 : 0;
  const remainingBlocks = maxBlocks > 0 ? Math.max(0, maxBlocks - createdBlocks) : null;

  const totalToCreate = groups.reduce((s, g) => s + (parseInt(g.quantity) || 0), 0);
  const overLimit = remainingBlocks !== null && totalToCreate > remainingBlocks;

  const setGroup = (idx, k, v) =>
    setGroups(gs => gs.map((g, i) => i === idx ? { ...g, [k]: v } : g));
  const addGroup    = () => setGroups(gs => [...gs, emptyGroup()]);
  const removeGroup = (idx) => setGroups(gs => gs.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!projectId) return toast.error('Selecciona un proyecto');
    if (overLimit)  return toast.error(`Solo puedes crear ${remainingBlocks} manzana${remainingBlocks !== 1 ? 's' : ''} más en este proyecto`);

    const invalid = groups.find(
      g => !g.name_prefix || !g.total_units || parseInt(g.total_units) < 1 || parseInt(g.quantity) < 1
    );
    if (invalid) return toast.error('Cada grupo debe tener nombre base, cantidad e inmuebles por manzana');

    setSaving(true);
    let totalCreated = 0;
    const errors = [];

    for (const group of groups) {
      const names = generateNames(group);
      for (let i = 0; i < names.length; i++) {
        try {
          await blocksService.create({
            project_id:  projectId,
            name:        names[i],
            block_type:  group.block_type,
            total_units: parseInt(group.total_units),
            floor_count: group.floor_count ? parseInt(group.floor_count) : null,
            description: group.description || null,
            // código automático: prefijo + sufijo
            code: names[i].replace(/\s+/g, '-').toUpperCase(),
          });
          totalCreated++;
        } catch (err) {
          errors.push(err.response?.data?.message || `Error creando "${names[i]}"`);
        }
      }
    }

    setSaving(false);
    if (errors.length > 0) errors.forEach(e => toast.error(e));
    if (totalCreated > 0) {
      toast.success(`✅ ${totalCreated} manzana${totalCreated !== 1 ? 's' : ''} creada${totalCreated !== 1 ? 's' : ''} correctamente`, { duration: 5000 });
      navigate(to('blocks'));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(to('blocks'))} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold"
            style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
            Nueva Manzana / Edificio
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Crea una o varias manzanas con las mismas características en un solo paso
          </p>
        </div>
        <button onClick={handleSave}
          disabled={saving || !projectId || overLimit || totalToCreate === 0}
          className="btn btn-primary">
          <Save size={15} />
          {saving ? 'Creando...' : `Crear ${totalToCreate} manzana${totalToCreate !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Selección de proyecto */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm pb-3"
          style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
          1. Proyecto destino
        </h3>
        <Field label="Proyecto" required>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="input text-sm" style={{ maxWidth: '420px' }}>
            <option value="">Seleccionar proyecto...</option>
            {projects.map(p => {
              const totalB   = parseInt(p.total_blocks) || 0;
              const createdB = parseInt(p.created_blocks) || 0;
              const remB     = totalB > 0 ? totalB - createdB : null;
              const full     = remB !== null && remB <= 0;
              return (
                <option key={p.id} value={p.id} disabled={full}>
                  {p.name} ({p.code})
                  {remB !== null
                    ? full
                      ? ' — SIN CUPOS'
                      : ` — ${remB} cupo${remB !== 1 ? 's' : ''} disponible${remB !== 1 ? 's' : ''}`
                    : ''}
                </option>
              );
            })}
          </select>
        </Field>

        {/* Info capacidad proyecto */}
        {selectedProject && maxBlocks > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: overLimit ? 'rgba(239,68,68,0.07)' : remainingBlocks === 0 ? 'rgba(16,185,129,0.07)' : 'rgba(13,27,62,0.04)',
              border: `1px solid ${overLimit ? 'rgba(239,68,68,0.25)' : remainingBlocks === 0 ? 'rgba(16,185,129,0.25)' : 'var(--color-border)'}`,
            }}>
            <Building2 size={16} style={{ color: overLimit ? '#ef4444' : 'var(--color-gold)', flexShrink: 0 }} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--color-text-muted)' }}>
                  Manzanas creadas: {createdBlocks} de {maxBlocks} permitidas
                </span>
                <span style={{ color: overLimit ? '#ef4444' : remainingBlocks === 0 ? '#10b981' : 'var(--color-gold)', fontWeight: 600 }}>
                  {overLimit
                    ? `⚠ Excede por ${totalToCreate - remainingBlocks}`
                    : remainingBlocks === 0
                    ? '✓ Completo'
                    : `${remainingBlocks} disponible${remainingBlocks !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((createdBlocks / maxBlocks) * 100, 100)}%`,
                    background: remainingBlocks === 0 ? 'var(--color-success)' : 'var(--color-gold)',
                  }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grupos de manzanas */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            2. Grupos de manzanas
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Total a crear:{' '}
              <strong style={{ color: overLimit ? '#ef4444' : 'var(--color-text-primary)' }}>
                {totalToCreate}
              </strong>
            </span>
            <button onClick={addGroup} className="btn btn-secondary btn-sm">
              <Plus size={13} /> Agregar grupo
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {groups.map((group, idx) => {
            const previewNames = generateNames(group);
            const qty = parseInt(group.quantity) || 0;

            return (
              <div key={group._id} className="rounded-xl p-5 space-y-4"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>

                {/* Header grupo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}>
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Grupo {idx + 1}
                      {qty > 1 && (
                        <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-gold)' }}>
                          ({qty} manzanas iguales)
                        </span>
                      )}
                    </span>
                  </div>
                  {groups.length > 1 && (
                    <button onClick={() => removeGroup(idx)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Cantidad */}
                  <Field label="¿Cuántas manzanas?" required
                    hint="Con las mismas características">
                    <input type="number" value={group.quantity}
                      onChange={e => setGroup(idx, 'quantity', e.target.value)}
                      className="input text-sm" min="1"
                      max={remainingBlocks !== null ? remainingBlocks : 99}
                      placeholder="1" />
                  </Field>

                  {/* Tipo */}
                  <Field label="Tipo" required>
                    <select value={group.block_type}
                      onChange={e => setGroup(idx, 'block_type', e.target.value)}
                      className="input text-sm">
                      {BLOCK_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </Field>

                  {/* Inmuebles por manzana */}
                  <Field label="Inmuebles por manzana" required
                    hint="Tope máximo de unidades en cada manzana">
                    <input type="number" value={group.total_units}
                      onChange={e => setGroup(idx, 'total_units', e.target.value)}
                      className="input text-sm" min="1" placeholder="20" />
                  </Field>

                  {/* Nombre base */}
                  <Field label="Nombre base" required
                    hint='Ej: "Manzana", "Edificio", "Torre"'>
                    <input value={group.name_prefix}
                      onChange={e => setGroup(idx, 'name_prefix', e.target.value)}
                      className="input text-sm" placeholder="Manzana" />
                  </Field>

                  {/* Numeración: letra o número */}
                  <Field label="Tipo de sufijo">
                    <select value={group.use_letters ? 'letras' : 'numeros'}
                      onChange={e => setGroup(idx, 'use_letters', e.target.value === 'letras')}
                      className="input text-sm">
                      <option value="letras">Letras (A, B, C…)</option>
                      <option value="numeros">Números (1, 2, 3…)</option>
                    </select>
                  </Field>

                  {/* Inicio */}
                  <Field label={group.use_letters ? 'Letra inicial' : 'Número inicial'}>
                    <input value={group.name_start}
                      onChange={e => setGroup(idx, 'name_start', e.target.value)}
                      className="input text-sm"
                      placeholder={group.use_letters ? 'A' : '1'}
                      maxLength={group.use_letters ? 1 : 4} />
                  </Field>

                  {/* Pisos */}
                  <Field label="Número de pisos">
                    <input type="number" value={group.floor_count}
                      onChange={e => setGroup(idx, 'floor_count', e.target.value)}
                      className="input text-sm" min="1" placeholder="5" />
                  </Field>

                  {/* Descripción */}
                  <div className="md:col-span-2">
                    <Field label="Descripción">
                      <input value={group.description}
                        onChange={e => setGroup(idx, 'description', e.target.value)}
                        className="input text-sm w-full" placeholder="Descripción opcional..." />
                    </Field>
                  </div>
                </div>

                {/* Preview nombres */}
                {previewNames.length > 0 && (
                  <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      Vista previa de manzanas a crear:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewNames.slice(0, 12).map((name, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded font-mono"
                          style={{ background: 'var(--color-bg-card)', color: 'var(--color-navy)', border: '1px solid var(--color-border)' }}>
                          {name}
                        </span>
                      ))}
                      {previewNames.length > 12 && (
                        <span className="text-xs px-2 py-1 rounded"
                          style={{ color: 'var(--color-text-muted)' }}>
                          ... y {previewNames.length - 12} más
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                      Cada manzana con <strong>{group.total_units || '—'}</strong> inmueble{parseInt(group.total_units) !== 1 ? 's' : ''} máx.
                      {group.floor_count ? ` · ${group.floor_count} piso${parseInt(group.floor_count) !== 1 ? 's' : ''}` : ''}
                      {` · Tipo: ${BLOCK_TYPES.find(t => t.value === group.block_type)?.label}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Botón agregar grupo */}
        <button onClick={addGroup}
          className="w-full py-4 border-2 border-dashed rounded transition-all flex items-center justify-center gap-2 text-sm"
          style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,168,75,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Plus size={16} /> Agregar otro grupo de manzanas con características diferentes
        </button>
      </div>

      {/* Resumen total */}
      <div className="card p-4"
        style={{
          background: overLimit ? 'var(--color-danger-bg)' : 'rgba(13,27,62,0.03)',
          border: `1px solid ${overLimit ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
          borderLeft: `4px solid ${overLimit ? 'var(--color-danger)' : 'var(--color-gold)'}`,
        }}>
        {overLimit && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded"
            style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
              Excedes el tope: quieres crear {totalToCreate} pero el proyecto solo permite {remainingBlocks} más.
              Reduce {totalToCreate - remainingBlocks} manzana{totalToCreate - remainingBlocks !== 1 ? 's' : ''}.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold"
              style={{ color: overLimit ? 'var(--color-danger)' : 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
              Total a crear: {totalToCreate} manzana{totalToCreate !== 1 ? 's' : ''}
              {maxBlocks > 0 && ` (límite: ${maxBlocks})`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {groups.length} grupo{groups.length !== 1 ? 's' : ''}
              {selectedProject ? ` · Proyecto: ${selectedProject.name}` : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate(to('blocks'))} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button onClick={handleSave}
              disabled={saving || !projectId || totalToCreate === 0 || overLimit}
              className="btn btn-primary"
              title={overLimit ? `Reduce ${totalToCreate - remainingBlocks} manzanas para continuar` : ''}>
              <Save size={15} />
              {saving ? 'Creando...' : `Crear ${totalToCreate} Manzana${totalToCreate !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockNewPage;