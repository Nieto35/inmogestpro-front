// src/pages/Projects/ProjectNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Layers, Building2, AlertTriangle } from 'lucide-react';
import { projectsService, blocksService } from '../../services/api.service';
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
  _id:         Date.now() + Math.random(),
  quantity:    '1',
  name_prefix: '',
  name_start:  'A',
  use_letters: true,
  block_type:  'manzana',
  total_units: '',
  floor_count: '',
  description: '',
});

const generateNames = (group) => {
  const qty = parseInt(group.quantity) || 0;
  if (!group.name_prefix || qty < 1) return [];
  return Array.from({ length: qty }, (_, i) => {
    const suffix = group.use_letters
      ? String.fromCharCode((group.name_start?.charCodeAt(0) || 65) + i)
      : String((parseInt(group.name_start) || 1) + i);
    return `${group.name_prefix} ${suffix}`;
  });
};

const ProjectNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;

  const [step,    setStep]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [project, setProject] = useState(null);
  const [groups,  setGroups]  = useState([emptyGroup()]);
  const [savingBlocks, setSavingBlocks] = useState(false);

  const [form, setForm] = useState({
    code: '', name: '', description: '', location: '', city: '', department: '',
    total_units: '', total_blocks: '', price_per_m2: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setGroup = (idx, k, v) =>
    setGroups(gs => gs.map((g, i) => i === idx ? { ...g, [k]: v } : g));
  const addGroup    = () => setGroups(gs => [...gs, emptyGroup()]);
  const removeGroup = (idx) => setGroups(gs => gs.filter((_, i) => i !== idx));

  // ── Paso 1: Crear proyecto ────────────────────────────────────
  const handleCreateProject = async () => {
    if (!form.code || !form.name || !form.city)
      return toast.error('Código, nombre y ciudad son requeridos');
    if (!form.total_blocks || parseInt(form.total_blocks) < 1)
      return toast.error('El número de manzanas/edificios es requerido');
    setSaving(true);
    try {
      const res = await projectsService.create({
        ...form,
        total_units:  form.total_units  ? parseInt(form.total_units)    : undefined,
        total_blocks: form.total_blocks ? parseInt(form.total_blocks)   : undefined,
        price_per_m2: form.price_per_m2 ? parseFloat(form.price_per_m2) : undefined,
      });
      setProject(res.data?.data);
      toast.success(`Proyecto "${form.name}" creado. Ahora agrega las manzanas.`);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear proyecto');
    } finally {
      setSaving(false);
    }
  };

  // ── Paso 2: Crear manzanas ────────────────────────────────────
  const totalBlocksToCreate = groups.reduce((s, g) => s + (parseInt(g.quantity) || 0), 0);
  const maxBlocks   = form.total_blocks ? parseInt(form.total_blocks) : null;
  const overLimit   = maxBlocks !== null && totalBlocksToCreate > maxBlocks;
  const remaining   = maxBlocks !== null ? maxBlocks - totalBlocksToCreate : null;

  const handleCreateBlocks = async () => {
    const invalid = groups.find(
      g => !g.name_prefix || !g.total_units || parseInt(g.total_units) < 1 || parseInt(g.quantity) < 1
    );
    if (invalid)
      return toast.error('Cada grupo debe tener nombre base, cantidad e inmuebles por manzana');
    if (overLimit)
      return toast.error(`Solo puedes crear ${maxBlocks} manzana${maxBlocks !== 1 ? 's' : ''} en este proyecto`);

    setSavingBlocks(true);
    let totalCreated = 0;
    const errors = [];

    for (const group of groups) {
      const names = generateNames(group);
      for (const name of names) {
        try {
          await blocksService.create({
            project_id:  project.id,
            name,
            block_type:  group.block_type,
            total_units: parseInt(group.total_units),
            floor_count: group.floor_count ? parseInt(group.floor_count) : null,
            description: group.description || null,
            code:        name.replace(/\s+/g, '-').toUpperCase(),
          });
          totalCreated++;
        } catch (err) {
          errors.push(err.response?.data?.message || `Error creando "${name}"`);
        }
      }
    }

    setSavingBlocks(false);
    if (errors.length > 0) errors.forEach(e => toast.error(e));
    if (totalCreated > 0) {
      toast.success(`¡${totalCreated} manzana${totalCreated !== 1 ? 's' : ''} creada${totalCreated !== 1 ? 's' : ''} exitosamente!`, { duration: 5000 });
      navigate(to('blocks'));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step === 1 ? navigate(to('projects')) : setStep(1)}
            className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold"
              style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
              {step === 1 ? 'Nuevo Proyecto' : `Manzanas de: ${form.name}`}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {step === 1 ? 'Paso 1 de 2 — Datos del proyecto' : 'Paso 2 de 2 — Crear manzanas / edificios'}
            </p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-1">
              <div className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                style={{
                  background: n === step ? 'var(--color-navy)' : n < step ? 'var(--color-gold)' : 'var(--color-bg-secondary)',
                  color: n <= step ? '#F5F3EE' : 'var(--color-text-muted)',
                  borderRadius: '50%',
                  border: n < step ? '2px solid var(--color-gold)' : 'none',
                }}>
                {n < step ? '✓' : n}
              </div>
              {n < 2 && (
                <div className="w-8 h-0.5"
                  style={{ background: n < step ? 'var(--color-gold)' : 'var(--color-border)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── PASO 1: Datos del proyecto ─────────────────────────── */}
      {step === 1 && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-sm pb-3"
            style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
            Información del proyecto
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" required>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                className="input text-sm" placeholder="ONT-01" />
            </Field>
            <Field label="Nombre del proyecto" required>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input text-sm" placeholder="Ontario" />
            </Field>
            <Field label="Ciudad" required>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                className="input text-sm" placeholder="Cali" />
            </Field>
            <Field label="Departamento">
              <input value={form.department} onChange={e => set('department', e.target.value)}
                className="input text-sm" placeholder="Valle del Cauca" />
            </Field>
            <div className="col-span-2">
              <Field label="Dirección / Ubicación">
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="input text-sm w-full" placeholder="Av. 6N # 23-45" />
              </Field>
            </div>

            {/* ─ Capacidad ─ */}
            <Field label="Nº de manzanas / edificios" required
              hint="Cuántas manzanas, torres o edificios tendrá el proyecto">
              <input type="number" value={form.total_blocks}
                onChange={e => set('total_blocks', e.target.value)}
                className="input text-sm" min="1" placeholder="5" />
            </Field>
            <Field label="Total de inmuebles"
              hint="Tope máximo de unidades en todo el proyecto">
              <input type="number" value={form.total_units}
                onChange={e => set('total_units', e.target.value)}
                className="input text-sm" min="1" placeholder="100" />
            </Field>
            <Field label="Precio por m²">
              <input type="number" value={form.price_per_m2}
                onChange={e => set('price_per_m2', e.target.value)}
                className="input text-sm" min="0" step="1000" placeholder="250000" />
            </Field>
            <div className="col-span-2">
              <Field label="Descripción">
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="input text-sm resize-none w-full" rows={2}
                  placeholder="Descripción del proyecto..." />
              </Field>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleCreateProject} disabled={saving} className="btn btn-primary">
              <Save size={15} /> {saving ? 'Creando...' : 'Crear Proyecto → Continuar'}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: Crear manzanas ────────────────────────────── */}
      {step === 2 && (
        <>
          {/* Info del proyecto */}
          <div className="card p-4 flex items-center gap-4"
            style={{ background: 'rgba(13,27,62,0.03)', borderLeft: '4px solid var(--color-gold)' }}>
            <Building2 size={24} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
                {form.name} <span className="font-mono text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{form.code}</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {form.total_blocks} manzana{parseInt(form.total_blocks) !== 1 ? 's' : ''} a crear
                {form.total_units ? ` · ${form.total_units} inmuebles totales` : ''}
              </p>
            </div>
          </div>

          {/* Grupos */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Grupos de manzanas
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Total:{' '}
                  <strong style={{ color: overLimit ? '#ef4444' : 'var(--color-text-primary)' }}>
                    {totalBlocksToCreate}
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
                          className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Field label="¿Cuántas manzanas?" required hint="Con mismas características">
                        <input type="number" value={group.quantity}
                          onChange={e => setGroup(idx, 'quantity', e.target.value)}
                          className="input text-sm" min="1" max={maxBlocks || 99} />
                      </Field>
                      <Field label="Tipo" required>
                        <select value={group.block_type}
                          onChange={e => setGroup(idx, 'block_type', e.target.value)}
                          className="input text-sm">
                          {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Inmuebles por manzana" required
                        hint="Tope máximo de unidades">
                        <input type="number" value={group.total_units}
                          onChange={e => setGroup(idx, 'total_units', e.target.value)}
                          className="input text-sm" min="1" placeholder="20" />
                      </Field>
                      <Field label="Nombre base" required hint='Ej: "Manzana", "Torre"'>
                        <input value={group.name_prefix}
                          onChange={e => setGroup(idx, 'name_prefix', e.target.value)}
                          className="input text-sm" placeholder="Manzana" />
                      </Field>
                      <Field label="Tipo de sufijo">
                        <select value={group.use_letters ? 'letras' : 'numeros'}
                          onChange={e => setGroup(idx, 'use_letters', e.target.value === 'letras')}
                          className="input text-sm">
                          <option value="letras">Letras (A, B, C…)</option>
                          <option value="numeros">Números (1, 2, 3…)</option>
                        </select>
                      </Field>
                      <Field label={group.use_letters ? 'Letra inicial' : 'Número inicial'}>
                        <input value={group.name_start}
                          onChange={e => setGroup(idx, 'name_start', e.target.value)}
                          className="input text-sm"
                          placeholder={group.use_letters ? 'A' : '1'}
                          maxLength={group.use_letters ? 1 : 4} />
                      </Field>
                      <Field label="Número de pisos">
                        <input type="number" value={group.floor_count}
                          onChange={e => setGroup(idx, 'floor_count', e.target.value)}
                          className="input text-sm" min="1" placeholder="5" />
                      </Field>
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
                          Manzanas a crear:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {previewNames.slice(0, 10).map((name, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded font-mono"
                              style={{ background: 'var(--color-bg-card)', color: 'var(--color-navy)', border: '1px solid var(--color-border)' }}>
                              {name}
                            </span>
                          ))}
                          {previewNames.length > 10 && (
                            <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
                              ... y {previewNames.length - 10} más
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                          Cada manzana: <strong>{group.total_units || '—'}</strong> inmueble{parseInt(group.total_units) !== 1 ? 's' : ''} máx.
                          {group.floor_count ? ` · ${group.floor_count} pisos` : ''}
                          {` · ${BLOCK_TYPES.find(t => t.value === group.block_type)?.label}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={addGroup}
              className="w-full py-4 border-2 border-dashed rounded transition-all flex items-center justify-center gap-2 text-sm"
              style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,168,75,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Plus size={16} /> Agregar otro grupo de manzanas con características diferentes
            </button>
          </div>

          {/* Resumen */}
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
                  Excedes el tope: quieres crear {totalBlocksToCreate} manzanas pero el proyecto solo permite {maxBlocks}.
                  Reduce {totalBlocksToCreate - maxBlocks}.
                </p>
              </div>
            )}
            {maxBlocks !== null && !overLimit && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {totalBlocksToCreate} de {maxBlocks} manzanas
                  </span>
                  <span style={{ color: remaining === 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {remaining === 0 ? '✓ Completo' : `Quedan ${remaining} cupo${remaining !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((totalBlocksToCreate / maxBlocks) * 100, 100)}%`, background: 'var(--color-gold)' }} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold"
                  style={{ color: overLimit ? 'var(--color-danger)' : 'var(--color-navy)', fontFamily: 'var(--font-display)' }}>
                  Total a crear: {totalBlocksToCreate} manzana{totalBlocksToCreate !== 1 ? 's' : ''}
                  {maxBlocks && ` (tope: ${maxBlocks})`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {groups.length} grupo{groups.length !== 1 ? 's' : ''} · Proyecto: {form.name}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigate(to('projects'))} className="btn btn-outline btn-sm">
                  Omitir → Ir a proyectos
                </button>
                <button onClick={handleCreateBlocks}
                  disabled={savingBlocks || totalBlocksToCreate === 0 || overLimit}
                  className="btn btn-primary">
                  <Layers size={15} />
                  {savingBlocks ? 'Creando...' : `Crear ${totalBlocksToCreate} Manzana${totalBlocksToCreate !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectNewPage;