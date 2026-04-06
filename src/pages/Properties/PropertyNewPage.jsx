// src/pages/Properties/PropertyNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, AlertTriangle, Plus } from 'lucide-react';
import { propertiesService, projectsService } from '../../services/api.service';
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

const TYPES = ['apartamento','casa','lote','local','bodega','oficina'];

const PropertyNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient = useQueryClient();
  const [saving, setSaving]   = useState(false);
  const [quantity, setQuantity] = useState('1'); // NUEVO: cantidad
  const [form, setForm] = useState({
    project_id:    '',
    unit_number:   '',
    base_unit_name:'',
    unit_start_number: '1',
    property_type: 'apartamento',
    purpose:       'venta',
    m2_construction:'',
    m2_terrain:    '',
    floor_number:  '',
    bedrooms:      '2',
    bathrooms:     '1',
    parking_spots: '1',
    storage_room:  false,
    base_price:    '',
    rental_price:  '',
    status:        'disponible',
    notes:         '',
  });
  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsService.getAll(),
  });
  const projects = projectsData?.data?.data || [];

  // Calcular disponibilidad del proyecto seleccionado
  const selectedProject = projects.find(p => p.id === form.project_id);
  const maxUnits    = selectedProject ? parseInt(selectedProject.total_units)      || 0 : 0;
  const currentProp = selectedProject ? parseInt(selectedProject.total_properties) || 0 : 0;
  const available   = maxUnits > 0 ? maxUnits - currentProp : null;
  const qty         = parseInt(quantity) || 1;
  const overLimit   = available !== null && qty > available;
  const isBulk      = qty > 1;

  const handleSubmit = async () => {
    if (!form.project_id || !form.base_price)
      return toast.error('Proyecto y precio son requeridos');
    if (!isBulk && !form.unit_number)
      return toast.error('El número de unidad es requerido');
    if (isBulk && !form.base_unit_name)
      return toast.error('El nombre base de la unidad es requerido (ej: Apto, Casa, Local)');
    if (overLimit)
      return toast.error(`Solo quedan ${available} cupos en este proyecto`);

    setSaving(true);
    try {
      if (isBulk) {
        // Creación en lote
        const res = await propertiesService.createBulk({
          project_id:        form.project_id,
          quantity:          qty,
          base_unit_name:    form.base_unit_name,
          unit_start_number: parseInt(form.unit_start_number) || 1,
          property_type:     form.property_type,
          m2_construction:   form.m2_construction ? parseFloat(form.m2_construction) : null,
          m2_terrain:        form.m2_terrain      ? parseFloat(form.m2_terrain)      : null,
          floor_number:      form.floor_number    ? parseInt(form.floor_number)       : null,
          bedrooms:          form.bedrooms        ? parseInt(form.bedrooms)           : null,
          bathrooms:         form.bathrooms       ? parseInt(form.bathrooms)          : null,
          parking_spots:     form.parking_spots   ? parseInt(form.parking_spots)      : 0,
          storage_room:      form.storage_room,
          base_price:        parseFloat(form.base_price),
          status:            form.status,
          features: {
            purpose:      form.purpose,
            rental_price: form.rental_price ? parseFloat(form.rental_price) : null,
          },
        });
        const created = res.data?.data?.length || qty;
        toast.success(`✅ ${created} inmueble${created !== 1 ? 's' : ''} creado${created !== 1 ? 's' : ''} correctamente`);
      } else {
        // Uno solo
        await propertiesService.create({
          project_id:      form.project_id,
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
          status:          form.status,
          features: {
            purpose:      form.purpose,
            rental_price: form.rental_price ? parseFloat(form.rental_price) : null,
            notes:        form.notes || null,
          },
        });
        toast.success('Inmueble creado exitosamente');
      }

      queryClient.invalidateQueries({ queryKey:['properties'] });
      queryClient.invalidateQueries({ queryKey:['projects'] });
      navigate(to('properties'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el inmueble');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(to('properties'))} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16}/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
            Nuevo Inmueble
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Registrar unidad en un proyecto
          </p>
        </div>
        <button onClick={handleSubmit} disabled={saving || overLimit} className="btn btn-primary">
          <Save size={15}/>
          {saving ? 'Guardando...' : isBulk ? `Crear ${qty} inmuebles` : 'Guardar Inmueble'}
        </button>
      </div>

      {/* Identificación */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm pb-3"
          style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
          Identificación
        </h3>

        {/* Proyecto */}
        <Field label="Proyecto" required>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
            className="input text-sm">
            <option value="">Seleccionar proyecto...</option>
            {projects.map(p => {
              const total   = parseInt(p.total_units)      || 0;
              const current = parseInt(p.total_properties) || 0;
              const avail   = total > 0 ? total - current : null;
              const full    = avail !== null && avail <= 0;
              return (
                <option key={p.id} value={p.id} disabled={full}>
                  {p.name} ({p.code})
                  {avail !== null
                    ? full ? ' — COMPLETO'
                    : ` — ${avail} cupo${avail !== 1 ? 's' : ''} disponible${avail !== 1 ? 's' : ''}`
                    : ''}
                </option>
              );
            })}
          </select>

          {/* Indicador de capacidad */}
          {selectedProject && maxUnits > 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
              style={{
                background: overLimit ? 'rgba(239,68,68,0.08)' : available === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${overLimit ? 'rgba(239,68,68,0.3)' : available === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`,
                color: overLimit ? '#ef4444' : available === 0 ? '#10b981' : '#60a5fa',
              }}>
              {overLimit
                ? <><AlertTriangle size={12}/> Excedes el límite: solo quedan {available} cupos disponibles</>
                : available === 0
                ? <>✅ Proyecto completo — todas las {maxUnits} unidades están creadas</>
                : <>📦 Puedes crear hasta <strong>{available}</strong> inmueble{available !== 1 ? 's' : ''} más en este proyecto</>}
            </div>
          )}
        </Field>

        {/* ── CANTIDAD — lo más importante ── */}
        <div className="p-4 rounded-xl"
          style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
          <Field label="¿Cuántos inmuebles con estas características?" required
            hint={isBulk ? `Se crearán ${qty} inmuebles numerados automáticamente` : 'Para crear uno solo, deja en 1'}>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => setQuantity(String(Math.max(1, qty - 1)))}
                className="btn btn-secondary btn-sm w-9 h-9 flex items-center justify-center text-lg font-bold">−</button>
              <input type="number" value={quantity}
                onChange={e => {
                  const val = parseInt(e.target.value) || 1;
                  if (available !== null) setQuantity(String(Math.min(val, available)));
                  else setQuantity(String(Math.max(1, val)));
                }}
                className="input text-center text-xl font-bold" min="1"
                max={available || 999}
                style={{ width:'80px', height:'44px' }}/>
              <button onClick={() => setQuantity(String(Math.min(qty + 1, available || 999)))}
                className="btn btn-secondary btn-sm w-9 h-9 flex items-center justify-center text-lg font-bold">+</button>
              {available !== null && (
                <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  máx. {available}
                </span>
              )}
            </div>
          </Field>
        </div>

        {/* Número de unidad — solo si es 1 */}
        {!isBulk && (
          <Field label="Número / Identificación de unidad" required>
            <input value={form.unit_number} onChange={e => set('unit_number', e.target.value)}
              className="input text-sm" placeholder="Apto 301, Casa 12, Local 5..."/>
          </Field>
        )}

        {/* Nombre base y número inicial — solo si son varios */}
        {isBulk && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre base de unidad" required
              hint='Ej: "Apto", "Casa", "Local" — se añade el número automáticamente'>
              <input value={form.base_unit_name} onChange={e => set('base_unit_name', e.target.value)}
                className="input text-sm" placeholder="Apto, Casa, Local..."/>
            </Field>
            <Field label="Número inicial" hint="El primer inmueble tendrá este número">
              <input type="number" value={form.unit_start_number}
                onChange={e => set('unit_start_number', e.target.value)}
                className="input text-sm" min="1" placeholder="101"/>
            </Field>
          </div>
        )}

        {/* Preview de nombres si son varios */}
        {isBulk && form.base_unit_name && (
          <div className="px-3 py-2 rounded-lg text-xs"
            style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981' }}>
            Se crearán:{' '}
            {Array.from({ length: Math.min(qty, 5) }, (_, i) =>
              `${form.base_unit_name} ${(parseInt(form.unit_start_number) || 1) + i}`
            ).join(', ')}
            {qty > 5 ? ` ... (+${qty - 5} más)` : ''}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de inmueble" required>
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)}
              className="input text-sm">
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Propósito" required>
            <select value={form.purpose} onChange={e => set('purpose', e.target.value)}
              className="input text-sm">
              <option value="venta">Venta</option>
              <option value="arriendo">Arriendo</option>
              <option value="ambos">Venta y Arriendo</option>
            </select>
          </Field>
        </div>

        <Field label="Estado inicial">
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="input text-sm">
            <option value="disponible">Disponible</option>
            <option value="reservado">Reservado</option>
          </select>
        </Field>
      </div>

      {/* Características */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm pb-3"
          style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
          Características
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Área construida (m²)" required>
            <input type="number" value={form.m2_construction}
              onChange={e => set('m2_construction', e.target.value)}
              className="input text-sm" min="0" placeholder="65"/>
          </Field>
          <Field label="Área terreno (m²)">
            <input type="number" value={form.m2_terrain}
              onChange={e => set('m2_terrain', e.target.value)}
              className="input text-sm" min="0" placeholder="120"/>
          </Field>
          <Field label="Piso">
            <input type="number" value={form.floor_number}
              onChange={e => set('floor_number', e.target.value)}
              className="input text-sm" min="1" placeholder="3"/>
          </Field>
          <Field label="Alcobas">
            <input type="number" value={form.bedrooms}
              onChange={e => set('bedrooms', e.target.value)}
              className="input text-sm" min="0" placeholder="2"/>
          </Field>
          <Field label="Baños">
            <input type="number" value={form.bathrooms}
              onChange={e => set('bathrooms', e.target.value)}
              className="input text-sm" min="0" placeholder="1"/>
          </Field>
          <Field label="Parqueaderos">
            <input type="number" value={form.parking_spots}
              onChange={e => set('parking_spots', e.target.value)}
              className="input text-sm" min="0" placeholder="1"/>
          </Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.storage_room}
            onChange={e => set('storage_room', e.target.checked)}
            className="w-4 h-4 rounded"/>
          <span className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            Incluye depósito/cuarto útil
          </span>
        </label>
      </div>

      {/* Precios */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm pb-3"
          style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
          Precios
        </h3>
        <Field label={form.purpose === 'arriendo' ? 'Valor comercial' : 'Precio de venta'} required>
          <input type="number" value={form.base_price}
            onChange={e => set('base_price', e.target.value)}
            className="input text-sm" min="0" step="1000" placeholder="0"/>
        </Field>
        {form.purpose !== 'venta' && (
          <Field label="Canon de arriendo mensual">
            <input type="number" value={form.rental_price}
              onChange={e => set('rental_price', e.target.value)}
              className="input text-sm" min="0" step="100" placeholder="0"/>
          </Field>
        )}
        {!isBulk && (
          <Field label="Notas adicionales">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              className="input text-sm resize-none" rows={2}
              placeholder="Observaciones, características especiales..."/>
          </Field>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(to('properties'))} className="btn btn-secondary">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving || overLimit} className="btn btn-primary">
          <Save size={15}/>
          {saving
            ? 'Guardando...'
            : isBulk
            ? `✓ Crear ${qty} inmueble${qty !== 1 ? 's' : ''}`
            : 'Guardar Inmueble'}
        </button>
      </div>
    </div>
  );
};

export default PropertyNewPage;