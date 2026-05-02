// src/pages/Properties/PropertyBulkPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Home, Layers } from 'lucide-react';
import { propertiesService, projectsService, blocksService } from '../../services/api.service';
import toast from 'react-hot-toast';

const PROPERTY_TYPES = ['apartamento', 'casa', 'lote', 'solar', 'local', 'bodega', 'oficina'];

const emptyLote = () => ({
  id:               Date.now() + Math.random(),
  quantity:         '1',
  base_unit_name:   'Unidad',
  unit_start_number:'1',
  property_type:    'apartamento',
  purpose:          'venta',
  m2_construction:  '',
  m2_terrain:       '',
  floor_number:     '',
  bedrooms:         '',
  bathrooms:        '',
  parking_spots:    '0',
  storage_room:     false,
  base_price:       '',
  rental_price:     '',
});

const Field = ({ label, hint, children, required }) => (
  <div>
    <label className="block text-xs font-semibold mb-1"
      style={{ color: 'var(--color-text-secondary)' }}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const PropertyBulkPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState('');
  const [blockId,   setBlockId]   = useState('');
  const [lotes,     setLotes]     = useState([emptyLote()]);
  const [saving,    setSaving]    = useState(false);

  // ── Proyectos ────────────────────────────────────────────────
  const { data: projData } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsService.getAll(),
  });
  const projects = projData?.data?.data || [];

  // ── Manzanas ─────────────────────────────────────────────────
  const { data: blocksData } = useQuery({
    queryKey: ['blocks', projectId],
    queryFn:  () => blocksService.getByProject(projectId),
    enabled:  !!projectId,
  });
  const blocks = blocksData?.data?.data || [];

  const handleProjectChange = (pid) => {
    setProjectId(pid);
    setBlockId('');
  };

  // Capacidad de la manzana seleccionada
  const selectedBlock = blocks.find(b => b.id === blockId);
  const maxUnits    = selectedBlock ? parseInt(selectedBlock.total_units)      || 0 : 0;
  const currentProp = selectedBlock ? parseInt(selectedBlock.total_properties) || 0 : 0;
  const available   = maxUnits > 0 ? maxUnits - currentProp : null;
  const totalUnits  = lotes.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
  const overLimit   = available !== null && totalUnits > available;

  const updateLote = (id, key, val) =>
    setLotes(prev => prev.map(l => l.id === id ? { ...l, [key]: val } : l));
  const addLote    = () => setLotes(prev => [...prev, emptyLote()]);
  const removeLote = (id) => setLotes(prev => prev.filter(l => l.id !== id));

  const handleSave = async () => {
    if (!projectId) return toast.error('Selecciona un proyecto');
    if (!blockId)   return toast.error('Selecciona una manzana');
    if (lotes.length === 0) return toast.error('Agrega al menos un grupo');
    if (overLimit) return toast.error(`Excedes el límite: solo quedan ${available} cupos en esta manzana`);

    const invalid = lotes.find(l => !l.base_price || parseFloat(l.base_price) <= 0 || parseInt(l.quantity) < 1);
    if (invalid) return toast.error('Cada grupo debe tener precio y cantidad válidos');

    setSaving(true);
    let totalCreated = 0;
    const errors = [];

    for (const lote of lotes) {
      try {
        const res = await propertiesService.createBulk({
          project_id:        projectId,
          block_id:          blockId,
          quantity:          parseInt(lote.quantity),
          base_unit_name:    lote.base_unit_name || 'Unidad',
          unit_start_number: parseInt(lote.unit_start_number) || 1,
          property_type:     lote.property_type,
          m2_construction:   lote.m2_construction ? parseFloat(lote.m2_construction) : null,
          m2_terrain:        lote.m2_terrain      ? parseFloat(lote.m2_terrain)      : null,
          floor_number:      lote.floor_number    ? parseInt(lote.floor_number)       : null,
          bedrooms:          lote.bedrooms        ? parseInt(lote.bedrooms)           : null,
          bathrooms:         lote.bathrooms       ? parseInt(lote.bathrooms)          : null,
          parking_spots:     lote.parking_spots   ? parseInt(lote.parking_spots)      : 0,
          storage_room:      lote.storage_room,
          base_price:        parseFloat(lote.base_price),
          status:            'disponible',
          features: {
            purpose:      lote.purpose,
            rental_price: lote.rental_price ? parseFloat(lote.rental_price) : null,
          },
        });
        totalCreated += res.data?.data?.length || 0;
      } catch (err) {
        errors.push(err.response?.data?.message || 'Error en un grupo');
      }
    }

    setSaving(false);
    if (errors.length > 0) toast.error(`Errores: ${errors[0]}`);
    if (totalCreated > 0) {
      toast.success(`✅ ${totalCreated} inmueble${totalCreated !== 1 ? 's' : ''} creado${totalCreated !== 1 ? 's' : ''} correctamente`);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['blocks', projectId] });
      navigate(to('properties'));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(to('properties'))} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Creación de Inmuebles en Lote
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Crea múltiples inmuebles similares en una manzana en un solo paso
          </p>
        </div>
        <button onClick={handleSave}
          disabled={saving || !projectId || !blockId || overLimit}
          className="btn btn-primary">
          <Home size={15} />
          {saving ? 'Creando...' : `Crear ${totalUnits} inmueble${totalUnits !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* ── 1. Selección en cascada ─────────────────────────── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm pb-3"
          style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
          1. Ubicación (Proyecto → Manzana)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Proyecto */}
          <div>
            <label className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}>
              Proyecto <span className="text-red-400">*</span>
            </label>
            <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
              className="input text-sm w-full">
              <option value="">Seleccionar proyecto...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Manzana */}
          <div>
            <label className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}>
              Manzana / Edificio <span className="text-red-400">*</span>
            </label>
            <select
              value={blockId}
              onChange={e => setBlockId(e.target.value)}
              disabled={!projectId || blocks.length === 0}
              className="input text-sm w-full">
              <option value="">
                {!projectId
                  ? 'Primero selecciona un proyecto'
                  : blocks.length === 0
                  ? 'Este proyecto no tiene manzanas'
                  : 'Seleccionar manzana...'}
              </option>
              {blocks.map(b => {
                const total   = parseInt(b.total_units)      || 0;
                const current = parseInt(b.total_properties) || 0;
                const avail   = total > 0 ? total - current : null;
                const full    = avail !== null && avail <= 0;
                return (
                  <option key={b.id} value={b.id} disabled={full}>
                    {b.name}
                    {b.code ? ` (${b.code})` : ''}
                    {avail !== null
                      ? full
                        ? ' — COMPLETA'
                        : ` — ${avail} cupo${avail !== 1 ? 's' : ''}`
                      : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Indicador capacidad manzana */}
        {selectedBlock && maxUnits > 0 && (
          <div className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: overLimit ? 'rgba(239,68,68,0.08)' : available === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(13,27,62,0.04)',
              border: `1px solid ${overLimit ? 'rgba(239,68,68,0.3)' : available === 0 ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
            }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: 'var(--color-text-muted)' }}>
                <Layers size={11} className="inline mr-1" />
                {selectedBlock.name} — {currentProp} de {maxUnits} inmuebles creados
              </span>
              <span style={{
                color: overLimit ? '#ef4444' : available === 0 ? '#10b981' : 'var(--color-gold)',
                fontWeight: 600,
              }}>
                {overLimit
                  ? `⚠ Excede por ${totalUnits - available}`
                  : available === 0
                  ? '✓ Manzana completa'
                  : `${available} cupo${available !== 1 ? 's' : ''} disponible${available !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min((currentProp / maxUnits) * 100, 100)}%`,
                  background: available === 0 ? 'var(--color-success)' : overLimit ? '#ef4444' : 'var(--color-gold)',
                }} />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Grupos de Inmuebles ──────────────────────────── */}
      {blockId && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              2. Grupos de Inmuebles
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Total a crear:{' '}
                <strong style={{ color: overLimit ? '#ef4444' : 'var(--color-text-primary)' }}>
                  {totalUnits}
                </strong>
                {available !== null && (
                  <span style={{ color: 'var(--color-text-muted)' }}> / {available} cupos</span>
                )}
              </span>
              <button onClick={addLote} className="btn btn-secondary btn-sm">
                <Plus size={13} /> Agregar grupo
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {lotes.map((lote, idx) => (
              <div key={lote.id} className="p-4 rounded-xl"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-accent)' }}>
                    Grupo {idx + 1}
                  </span>
                  {lotes.length > 1 && (
                    <button onClick={() => removeLote(lote.id)}
                      className="btn btn-ghost btn-sm text-red-400">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <Field label="Cantidad" required>
                    <input type="number" value={lote.quantity}
                      min="1"
                      max={available !== null ? Math.max(0, available - (totalUnits - (parseInt(lote.quantity) || 0))) : 100}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        if (available !== null) {
                          const otherTotal = totalUnits - (parseInt(lote.quantity) || 0);
                          const maxThis = Math.max(0, available - otherTotal);
                          updateLote(lote.id, 'quantity', String(Math.min(val, maxThis)));
                        } else {
                          updateLote(lote.id, 'quantity', e.target.value);
                        }
                      }}
                      className="input text-sm" />
                  </Field>

                  <Field label="Tipo" required>
                    <select value={lote.property_type}
                      onChange={e => updateLote(lote.id, 'property_type', e.target.value)}
                      className="input text-sm">
                      {PROPERTY_TYPES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Propósito">
                    <select value={lote.purpose}
                      onChange={e => updateLote(lote.id, 'purpose', e.target.value)}
                      className="input text-sm">
                      <option value="venta">Venta</option>
                      <option value="arriendo">Arriendo</option>
                      <option value="ambos">Venta y Arriendo</option>
                    </select>
                  </Field>

                  <Field label="Nombre base unidad">
                    <input value={lote.base_unit_name}
                      onChange={e => updateLote(lote.id, 'base_unit_name', e.target.value)}
                      className="input text-sm" placeholder="Apto, Casa, Local..." />
                  </Field>

                  <Field label="Número inicial">
                    <input type="number" value={lote.unit_start_number}
                      onChange={e => updateLote(lote.id, 'unit_start_number', e.target.value)}
                      className="input text-sm" min="1" placeholder="101" />
                  </Field>

                  <Field label="Precio base" required>
                    <input type="number" value={lote.base_price}
                      onChange={e => updateLote(lote.id, 'base_price', e.target.value)}
                      className="input text-sm" min="0" step="1000" placeholder="0" />
                  </Field>

                  {lote.purpose !== 'venta' && (
                    <Field label="Precio arriendo">
                      <input type="number" value={lote.rental_price}
                        onChange={e => updateLote(lote.id, 'rental_price', e.target.value)}
                        className="input text-sm" min="0" step="100" placeholder="0" />
                    </Field>
                  )}

                  <Field label="Área construida (m²)">
                    <input type="number" value={lote.m2_construction}
                      onChange={e => updateLote(lote.id, 'm2_construction', e.target.value)}
                      className="input text-sm" min="0" placeholder="65" />
                  </Field>

                  <Field label="Área terreno (m²)">
                    <input type="number" value={lote.m2_terrain}
                      onChange={e => updateLote(lote.id, 'm2_terrain', e.target.value)}
                      className="input text-sm" min="0" placeholder="120" />
                  </Field>

                  <Field label="Piso">
                    <input type="number" value={lote.floor_number}
                      onChange={e => updateLote(lote.id, 'floor_number', e.target.value)}
                      className="input text-sm" min="1" placeholder="3" />
                  </Field>

                  <Field label="Alcobas">
                    <input type="number" value={lote.bedrooms}
                      onChange={e => updateLote(lote.id, 'bedrooms', e.target.value)}
                      className="input text-sm" min="0" placeholder="2" />
                  </Field>

                  <Field label="Baños">
                    <input type="number" value={lote.bathrooms}
                      onChange={e => updateLote(lote.id, 'bathrooms', e.target.value)}
                      className="input text-sm" min="0" placeholder="1" />
                  </Field>

                  <Field label="Parqueaderos">
                    <input type="number" value={lote.parking_spots}
                      onChange={e => updateLote(lote.id, 'parking_spots', e.target.value)}
                      className="input text-sm" min="0" placeholder="1" />
                  </Field>
                </div>

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={lote.storage_room}
                    onChange={e => updateLote(lote.id, 'storage_room', e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Incluye depósito / cuarto útil
                  </span>
                </label>

                {/* Preview */}
                {parseInt(lote.quantity) > 0 && lote.base_unit_name && (
                  <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                    Se crearán:{' '}
                    {Array.from({ length: Math.min(parseInt(lote.quantity), 4) }, (_, i) =>
                      `${lote.base_unit_name} ${(parseInt(lote.unit_start_number) || 1) + i}`
                    ).join(', ')}
                    {parseInt(lote.quantity) > 4 ? ` ... (+${parseInt(lote.quantity) - 4} más)` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder si no hay manzana seleccionada */}
      {!blockId && projectId && (
        <div className="card text-center py-10"
          style={{ border: '2px dashed var(--color-border)' }}>
          <Layers size={32} className="mx-auto mb-2" style={{ color: 'var(--color-gold)', opacity: 0.5 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Selecciona una manzana para definir los grupos de inmuebles
          </p>
        </div>
      )}

      {/* Botón guardar */}
      <div className="flex justify-end gap-3 pb-8">
        <button onClick={() => navigate(to('properties'))} className="btn btn-secondary">
          Cancelar
        </button>
        <button onClick={handleSave}
          disabled={saving || !projectId || !blockId || overLimit || totalUnits === 0}
          className="btn btn-primary">
          <Home size={15} />
          {saving ? 'Creando inmuebles...' : `Crear ${totalUnits} inmueble${totalUnits !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
};

export default PropertyBulkPage;