// src/pages/Projects/ProjectNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Trash2, Home, Building } from 'lucide-react';
import { projectsService, propertiesService } from '../../services/api.service';
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

// Lote de inmuebles vacío
const emptyLote = () => ({
  _id:             Date.now() + Math.random(),
  quantity:        '1',
  base_unit_name:  'Apto',
  unit_start_number:'101',
  property_type:   'apartamento',
  purpose:         'venta',
  m2_construction: '',
  m2_terrain:      '',
  floor_number:    '',
  bedrooms:        '2',
  bathrooms:       '1',
  parking_spots:   '1',
  storage_room:    false,
  base_price:      '',
  rental_price:    '',
});

const PROP_TYPES = [
  { value:'apartamento', label:'Apartamento' },
  { value:'casa',        label:'Casa'        },
  { value:'lote',        label:'Lote'        },
  { value:'local',       label:'Local'       },
  { value:'bodega',      label:'Bodega'      },
  { value:'oficina',     label:'Oficina'     },
];

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const ProjectNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();         
  const to = (path) => `/${tenant}/${path}`;
  const [step,    setStep]    = useState(1); // 1=proyecto, 2=inmuebles
  const [saving,  setSaving]  = useState(false);
  const [project, setProject] = useState(null); // proyecto creado
  const [lotes,   setLotes]   = useState([emptyLote()]); // grupos de inmuebles
  const [savingLotes, setSavingLotes] = useState(false);

  const [form, setForm] = useState({
    code:        '',
    name:        '',
    description: '',
    location:    '',
    city:        '',
    department:  '',
    total_units: '',
    price_per_m2:'',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  // Actualizar un campo de un lote
  const setLote = (idx, k, v) =>
    setLotes(ls => ls.map((l,i) => i===idx ? {...l,[k]:v} : l));

  const addLote = () => setLotes(ls => [...ls, emptyLote()]);
  const removeLote = (idx) => setLotes(ls => ls.filter((_,i) => i!==idx));

  // ── PASO 1: Crear proyecto ────────────────────────────────
  const handleCreateProject = async () => {
    if (!form.code || !form.name || !form.city)
      return toast.error('Código, nombre y ciudad son requeridos');
    setSaving(true);
    try {
      const res = await projectsService.create({
        ...form,
        total_units: form.total_units ? parseInt(form.total_units) : undefined,
        price_per_m2:form.price_per_m2 ? parseFloat(form.price_per_m2) : undefined,
      });
      const newProject = res.data?.data;
      setProject(newProject);
      toast.success(`Proyecto "${form.name}" creado. Ahora agrega los inmuebles.`);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear proyecto');
    } finally {
      setSaving(false);
    }
  };

  // ── PASO 2: Crear inmuebles en lote ──────────────────────
  const handleCreateProperties = async () => {
    const valid = lotes.every(l => l.base_price && parseFloat(l.base_price) > 0 && parseInt(l.quantity) >= 1);
    if (!valid) return toast.error('Cada grupo debe tener precio base y cantidad válidos');

    setSavingLotes(true);
    let totalCreated = 0;
    const errors = [];

    for (const lote of lotes) {
      try {
        const res = await propertiesService.createBulk({
          project_id:       project.id,
          quantity:         parseInt(lote.quantity),
          base_unit_name:   lote.base_unit_name || 'Unidad',
          unit_start_number:parseInt(lote.unit_start_number) || 1,
          property_type:    lote.property_type,
          m2_construction:  lote.m2_construction ? parseFloat(lote.m2_construction) : null,
          m2_terrain:       lote.m2_terrain      ? parseFloat(lote.m2_terrain)      : null,
          floor_number:     lote.floor_number    ? parseInt(lote.floor_number)       : null,
          bedrooms:         lote.bedrooms        ? parseInt(lote.bedrooms)           : null,
          bathrooms:        lote.bathrooms       ? parseInt(lote.bathrooms)          : null,
          parking_spots:    lote.parking_spots   ? parseInt(lote.parking_spots)      : 0,
          storage_room:     lote.storage_room,
          base_price:       parseFloat(lote.base_price),
          status:           'disponible',
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

    setSavingLotes(false);
    if (totalCreated > 0) {
      toast.success(`¡${totalCreated} inmueble${totalCreated!==1?'s':''} creado${totalCreated!==1?'s':''} exitosamente!`, { duration:5000 });
      navigate(to('projects'));
    }
    if (errors.length > 0) {
      errors.forEach(e => toast.error(e));
    }
  };

  const totalInmuebles = lotes.reduce((s,l) => s + (parseInt(l.quantity)||0), 0);
  const maxUnits  = form.total_units ? parseInt(form.total_units) : null;
  const overLimit = maxUnits !== null && totalInmuebles > maxUnits;
  const remaining = maxUnits !== null ? maxUnits - totalInmuebles : null;

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step===1 ? navigate(to('projects')) : setStep(1)}
            className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              {step===1 ? 'Nuevo Proyecto' : `Inmuebles de: ${form.name}`}
            </h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              {step===1 ? 'Paso 1 de 2 — Datos del proyecto' : 'Paso 2 de 2 — Agregar inmuebles en lote'}
            </p>
          </div>
        </div>
        {/* Indicador de pasos */}
        <div className="flex items-center gap-2">
          {[1,2].map(n => (
            <div key={n} className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: n === step ? 'var(--color-brand-600)' : n < step ? '#10b981' : 'var(--color-bg-secondary)',
                  color: n <= step ? 'white' : 'var(--color-text-muted)',
                }}>
                {n < step ? '✓' : n}
              </div>
              {n < 2 && <div className="w-8 h-px" style={{ background: step>1?'#10b981':'var(--color-border)' }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* ── PASO 1: Datos del Proyecto ── */}
      {step === 1 && (
        <>
          <div className="card">
            <h3 className="font-semibold text-sm mb-4 pb-3"
              style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
              <Building size={14} className="inline mr-2"/>
              Información del Proyecto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Código del proyecto" required hint="Ej: URB, CONJ, PROY, PARC (único e irrepetible)">
                <input value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())}
                  className="input text-sm font-mono" placeholder="URB" maxLength={10}/>
              </Field>
              <Field label="Nombre del proyecto" required>
                <input value={form.name} onChange={e=>set('name',e.target.value)}
                  className="input text-sm" placeholder="URBANIZACIÓN, PARCELACIÓN, CONJUNTO, PROYECTO..."/>
              </Field>
              <Field label="Ciudad o Municipio o Cantón" required>
                <input value={form.city} onChange={e=>set('city',e.target.value)}
                  className="input text-sm" placeholder="Cali"/>
              </Field>
              <Field label="Departamento o Provincia">
                <input value={form.department} onChange={e=>set('department',e.target.value)}
                  className="input text-sm" placeholder="Valle del Cauca"/>
              </Field>
              <Field label="Dirección / Ubicación">
                <input value={form.location} onChange={e=>set('location',e.target.value)}
                  className="input text-sm" placeholder="Calle 5 # 10-20"/>
              </Field>
              <Field label="Total de unidades (referencia)">
                <input type="number" value={form.total_units}
                  onChange={e=>set('total_units',e.target.value)}
                  className="input text-sm" placeholder="24" min="1"/>
              </Field>
              <Field label="Precio por m² (COP)">
                <input type="number" value={form.price_per_m2}
                  onChange={e=>set('price_per_m2',e.target.value)}
                  className="input text-sm" placeholder="2500000" min="0"/>
              </Field>
              <div className="md:col-span-2">
                <Field label="Descripción">
                  <textarea value={form.description} onChange={e=>set('description',e.target.value)}
                    className="input text-sm resize-none w-full" rows={2}
                    placeholder="Descripción del proyecto, características principales..."/>
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => navigate(to('projects'))} className="btn btn-secondary">
              Cancelar
            </button>
            <button onClick={handleCreateProject} disabled={saving} className="btn btn-primary">
              <Save size={15}/> {saving ? 'Guardando...' : 'Crear Proyecto y Continuar →'}
            </button>
          </div>
        </>
      )}

      {/* ── PASO 2: Grupos de inmuebles ── */}
      {step === 2 && project && (
        <>
          <div className="p-4 rounded-xl text-sm"
            style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', color:'var(--color-text-secondary)' }}>
            💡 Puedes crear múltiples grupos de inmuebles con características diferentes.
            Por ejemplo: <strong>4 aptos esquineros de 90m²</strong> y luego <strong>8 aptos estándar de 70m²</strong>.
            Cada grupo genera los inmuebles con nombres consecutivos automáticamente.
          </div>

          {lotes.map((lote, idx) => (
            <div key={lote._id} className="card">
              <div className="flex items-center justify-between mb-4 pb-3"
                style={{ borderBottom:'1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <Home size={16} style={{ color:'var(--color-text-accent)' }}/>
                  <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
                    Grupo {idx+1} de Inmuebles
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa' }}>
                    {parseInt(lote.quantity)||0} unidad{(parseInt(lote.quantity)||0)!==1?'es':''}
                  </span>
                </div>
                {lotes.length > 1 && (
                  <button onClick={() => removeLote(idx)}
                    className="btn btn-ghost btn-sm text-red-400 hover:text-red-300">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Field label="¿Cuántos inmuebles?" required
                  hint={maxUnits ? `Máx disponible: ${Math.max(0, maxUnits - (totalInmuebles - (parseInt(lote.quantity)||0)))}` : "Número de unidades a crear"}>
                  <input type="number" value={lote.quantity}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      if (maxUnits) {
                        const otherTotal = totalInmuebles - (parseInt(lote.quantity)||0);
                        const maxThis = Math.max(0, maxUnits - otherTotal);
                        setLote(idx, 'quantity', String(Math.min(val, maxThis)));
                      } else {
                        setLote(idx, 'quantity', e.target.value);
                      }
                    }}
                    className="input text-sm font-bold text-center" min="1"
                    max={maxUnits ? Math.max(0, maxUnits - (totalInmuebles - (parseInt(lote.quantity)||0))) : 100}/>
                </Field>
                <Field label="Nombre base" required
                  hint='Ej: "Apto", "Lote", "Casa", "Local"'>
                  <input value={lote.base_unit_name}
                    onChange={e=>setLote(idx,'base_unit_name',e.target.value)}
                    className="input text-sm" placeholder="Apto"/>
                </Field>
                <Field label="Número inicial"
                  hint='Primera unidad generada'>
                  <input type="number" value={lote.unit_start_number}
                    onChange={e=>setLote(idx,'unit_start_number',e.target.value)}
                    className="input text-sm" placeholder="101" min="1"/>
                </Field>
                <div className="flex items-end pb-0.5">
                  <div className="p-3 rounded-lg text-xs w-full"
                    style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                    <p style={{ color:'var(--color-text-muted)' }}>Se crearán:</p>
                    <p className="font-mono font-bold" style={{ color:'#10b981' }}>
                      {lote.base_unit_name} {lote.unit_start_number}
                      {parseInt(lote.quantity)>1 && ` → ${lote.base_unit_name} ${parseInt(lote.unit_start_number)+parseInt(lote.quantity)-1}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Tipo" required>
                  <select value={lote.property_type}
                    onChange={e=>setLote(idx,'property_type',e.target.value)}
                    className="input text-sm">
                    {PROP_TYPES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Propósito" required>
                  <select value={lote.purpose}
                    onChange={e=>setLote(idx,'purpose',e.target.value)}
                    className="input text-sm">
                    <option value="venta">Venta</option>
                    <option value="arriendo">Arriendo</option>
                    <option value="venta_arriendo">Venta o Arriendo</option>
                  </select>
                </Field>
                <Field label="m² construidos">
                  <input type="number" value={lote.m2_construction}
                    onChange={e=>setLote(idx,'m2_construction',e.target.value)}
                    className="input text-sm" placeholder="75" min="0" step="0.1"/>
                </Field>
                <Field label="Alcobas">
                  <input type="number" value={lote.bedrooms}
                    onChange={e=>setLote(idx,'bedrooms',e.target.value)}
                    className="input text-sm" placeholder="2" min="0"/>
                </Field>
                <Field label="Baños">
                  <input type="number" value={lote.bathrooms}
                    onChange={e=>setLote(idx,'bathrooms',e.target.value)}
                    className="input text-sm" placeholder="1" min="0"/>
                </Field>
                <Field label="Parqueaderos">
                  <input type="number" value={lote.parking_spots}
                    onChange={e=>setLote(idx,'parking_spots',e.target.value)}
                    className="input text-sm" placeholder="1" min="0"/>
                </Field>
                <Field label="Precio venta (COP)" required>
                  <input type="number" value={lote.base_price}
                    onChange={e=>setLote(idx,'base_price',e.target.value)}
                    className="input text-sm" placeholder="120000000" min="0"/>
                </Field>
                {(lote.purpose==='arriendo'||lote.purpose==='venta_arriendo') && (
                  <Field label="Canon arriendo/mes (COP)">
                    <input type="number" value={lote.rental_price}
                      onChange={e=>setLote(idx,'rental_price',e.target.value)}
                      className="input text-sm" placeholder="1500000" min="0"/>
                  </Field>
                )}
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id={`storage_${idx}`} checked={lote.storage_room}
                    onChange={e=>setLote(idx,'storage_room',e.target.checked)}
                    className="w-4 h-4 accent-blue-500"/>
                  <label htmlFor={`storage_${idx}`} className="text-sm"
                    style={{ color:'var(--color-text-secondary)' }}>
                    Incluye depósito
                  </label>
                </div>
              </div>

              {/* Preview de los nombres que se crearán */}
              {parseInt(lote.quantity) > 0 && lote.base_unit_name && lote.base_price && (
                <div className="mt-4 pt-3" style={{ borderTop:'1px solid var(--color-border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color:'var(--color-text-muted)' }}>
                    Vista previa de inmuebles a crear:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length:Math.min(parseInt(lote.quantity)||0, 12) }, (_,i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded font-mono"
                        style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                        {lote.base_unit_name} {parseInt(lote.unit_start_number||1)+i}
                      </span>
                    ))}
                    {(parseInt(lote.quantity)||0) > 12 && (
                      <span className="text-xs px-2 py-1 rounded"
                        style={{ color:'var(--color-text-muted)' }}>
                        ... y {parseInt(lote.quantity)-12} más
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-2" style={{ color:'var(--color-text-muted)' }}>
                    Precio: {formatCurrency(parseFloat(lote.base_price)||0)} c/u
                    {lote.m2_construction && ` · ${lote.m2_construction}m²`}
                    {` · ${PROP_TYPES.find(t=>t.value===lote.property_type)?.label}`}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Botón agregar grupo */}
          <button onClick={addLote}
            className="w-full py-4 border-2 border-dashed rounded-xl transition-colors hover:bg-slate-800 flex items-center justify-center gap-2 text-sm"
            style={{ borderColor:'var(--color-border)', color:'var(--color-text-muted)' }}>
            <Plus size={16}/> Agregar otro grupo de inmuebles con características diferentes
          </button>

          {/* Resumen total con validación de tope */}
          <div className="card p-4"
            style={{
              background: overLimit ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
              border: `1px solid ${overLimit ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`,
            }}>
            {/* Alerta de tope excedido */}
            {overLimit && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
                style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)' }}>
                <span style={{ color:'#ef4444', fontSize:'18px' }}>⚠️</span>
                <p className="text-sm font-semibold" style={{ color:'#ef4444' }}>
                  Excedes el tope: quieres crear {totalInmuebles} pero el proyecto solo permite {maxUnits}.
                  Reduce la cantidad en {totalInmuebles - maxUnits} unidad{totalInmuebles - maxUnits !== 1 ? 'es' : ''}.
                </p>
              </div>
            )}
            {/* Indicador de capacidad */}
            {maxUnits !== null && !overLimit && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color:'var(--color-text-muted)' }}>
                    {totalInmuebles} de {maxUnits} unidades
                  </span>
                  <span style={{ color: remaining === 0 ? '#10b981' : remaining <= 3 ? '#f59e0b' : 'var(--color-text-muted)' }}>
                    {remaining === 0 ? '✅ Proyecto completo' : `Quedan ${remaining} cupo${remaining!==1?'s':''}`}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background:'var(--color-bg-primary)' }}>
                  <div className="h-2 rounded-full transition-all"
                    style={{ width:`${Math.min((totalInmuebles/maxUnits)*100,100)}%`, background:'#10b981' }}/>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold" style={{ color: overLimit ? '#ef4444' : '#10b981' }}>
                  Total a crear: {totalInmuebles} inmueble{totalInmuebles!==1?'s':''}
                  {maxUnits && ` (tope: ${maxUnits})`}
                </p>
                <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                  {lotes.length} grupo{lotes.length!==1?'s':''} · Proyecto: {form.name}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigate(to('projects'))} className="btn btn-secondary btn-sm">
                  Omitir → Ir a proyectos
                </button>
                <button onClick={handleCreateProperties}
                  disabled={savingLotes || totalInmuebles === 0 || overLimit}
                  className="btn btn-primary"
                  title={overLimit ? `Reduce ${totalInmuebles - maxUnits} unidades para continuar` : ''}>
                  <Save size={15}/> {savingLotes ? 'Creando...' : `Crear ${totalInmuebles} Inmueble${totalInmuebles!==1?'s':''}`}
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