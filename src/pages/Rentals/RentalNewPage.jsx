// src/pages/Rentals/RentalNewPage.jsx
//
// Crear un contrato de arriendo.
//
// La diferencia con una venta no está en el formulario sino en el dinero: el
// canon que se cobra es del PROPIETARIO, y la inmobiliaria solo se queda con
// su comisión. Por eso la pantalla muestra el reparto en vivo — quien firma
// tiene que ver, antes de guardar, cuánto le va a quedar a cada quien.
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, KeyRound, AlertTriangle, Info } from 'lucide-react';
import {
  rentalsService, clientsService, propertiesService,
  advisorsService, ownersService,
} from '../../services/api.service';
import { todayISO } from '../../utils/dates';
import toast from 'react-hot-toast';

const fmt = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

const Section = ({ title, children, cols = 2 }) => (
  <div className="card">
    <h3 className="font-semibold text-sm mb-4 pb-3"
      style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
      {title}
    </h3>
    <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>{children}</div>
  </div>
);

const RentalNewPage = () => {
  const navigate    = useNavigate();
  const { tenant }  = useParams();
  const queryClient = useQueryClient();
  const to = (p) => `/${tenant}/${p.replace(/^\//,'')}`;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id:'', property_id:'', advisor_id:'', owner_id:'',
    canon_amount:'', admin_fee_amount:'', deposit_amount:'',
    fee_type:'porcentaje', fee_value:'10',
    start_date: todayISO(), months_term:'12', payment_day:'5',
    increment_frequency:'anual', increment_type:'ipc', increment_pct:'',
    notes:'',
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const { data: clientsData } = useQuery({
    queryKey: ['clients','para-arriendo'],
    queryFn:  () => clientsService.getAll({ limit: 300 }),
  });
  const clients = clientsData?.data?.data || [];

  // Solo inmuebles que se pueden arrendar y están libres.
  const { data: propsData } = useQuery({
    queryKey: ['properties','arrendables'],
    queryFn:  () => propertiesService.getAll({ purpose:'arriendo' }),
  });
  const properties = (propsData?.data?.data || [])
    .filter(p => ['disponible','reservado'].includes(p.status));

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const advisors = (advisorsData?.data?.data || [])
    .filter(a => ['planta','externo','freelance','referido','asesor'].includes(a.advisor_type));

  const { data: ownersData } = useQuery({
    queryKey: ['owners','activos'],
    queryFn:  () => ownersService.getAll({ active:'true', limit: 300 }),
  });
  const owners = ownersData?.data?.data || [];

  const selectedProp = properties.find(p => p.id === form.property_id);

  // Al elegir inmueble se toma su propietario y su canon de referencia.
  const handleProperty = (pid) => {
    const p = properties.find(x => x.id === pid);
    setForm(f => ({
      ...f,
      property_id: pid,
      owner_id:    p?.owner_id || '',
      canon_amount: f.canon_amount || (p?.rental_price ? String(Math.round(p.rental_price)) : ''),
    }));
  };

  // Reparto en vivo. Es el dato que define el negocio: de lo que entra, esto
  // es tuyo y esto es del dueño.
  const reparto = useMemo(() => {
    const canon = parseFloat(form.canon_amount) || 0;
    const valor = parseFloat(form.fee_value)    || 0;
    if (canon <= 0) return null;
    const bruto = form.fee_type === 'fijo' ? valor : (canon * valor) / 100;
    const comision = Math.min(Math.round(bruto), Math.round(canon));
    return { canon, comision, propietario: canon - comision };
  }, [form.canon_amount, form.fee_type, form.fee_value]);

  const comisionExcede =
    form.fee_type === 'fijo' &&
    parseFloat(form.fee_value) > (parseFloat(form.canon_amount) || 0) &&
    parseFloat(form.canon_amount) > 0;

  const submit = async () => {
    if (!form.client_id)    return toast.error('Selecciona el arrendatario');
    if (!form.property_id)  return toast.error('Selecciona el inmueble');
    if (!form.owner_id)     return toast.error('El inmueble no tiene propietario. Vincúlalo primero.');
    if (!(parseFloat(form.canon_amount) > 0)) return toast.error('El canon debe ser mayor a 0');
    if (comisionExcede)     return toast.error('La comisión fija no puede superar el canon');

    setSaving(true);
    try {
      const res = await rentalsService.create({
        ...form,
        canon_amount:     parseFloat(form.canon_amount),
        admin_fee_amount: form.admin_fee_amount ? parseFloat(form.admin_fee_amount) : 0,
        deposit_amount:   form.deposit_amount   ? parseFloat(form.deposit_amount)   : 0,
        fee_value:        parseFloat(form.fee_value) || 0,
        months_term:      parseInt(form.months_term) || 12,
        payment_day:      parseInt(form.payment_day) || 5,
        increment_pct:    form.increment_pct ? parseFloat(form.increment_pct) : null,
        advisor_id:       form.advisor_id || null,
      });
      toast.success(res?.data?.message || 'Contrato de arriendo creado',
        { duration:8000, style:{ maxWidth:'560px' } });
      queryClient.invalidateQueries({ queryKey:['contracts'] });
      queryClient.invalidateQueries({ queryKey:['properties'] });
      queryClient.invalidateQueries({ queryKey:['rentals'] });
      navigate(`${to('contracts')}?scope=arriendos`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo crear el contrato',
        { duration:9000, style:{ maxWidth:'560px' } });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`${to('contracts')}?scope=arriendos`)}
          className="p-2 rounded hover:opacity-70" style={{ color:'var(--color-text-muted)' }}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"
            style={{ color:'var(--color-text-primary)', fontFamily:'var(--font-display)' }}>
            <KeyRound size={19} style={{ color:'var(--color-text-accent)' }}/>
            Nuevo contrato de arriendo
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            El canon que se cobre será del propietario; la inmobiliaria retiene su comisión
          </p>
        </div>
      </div>

      <Section title="1. Partes e inmueble">
        <Field label="Arrendatario" required hint="Quien va a habitar y pagar el canon">
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)}
            className="input text-sm w-full">
            <option value="">Selecciona un cliente…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.full_name} — {c.document_number}</option>
            ))}
          </select>
        </Field>

        <Field label="Inmueble" required
          hint="Solo se listan los marcados para arriendo y que estén libres">
          <select value={form.property_id} onChange={e => handleProperty(e.target.value)}
            className="input text-sm w-full">
            <option value="">Selecciona un inmueble…</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {[p.project_name, p.block_name, `Unidad ${p.unit_number}`].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Propietario" required
          hint="Se toma del inmueble. Es a quien se le gira el canon.">
          <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
            className="input text-sm w-full">
            <option value="">Sin propietario…</option>
            {owners.map(o => (
              <option key={o.id} value={o.id}>{o.full_name} — {o.document_number}</option>
            ))}
          </select>
        </Field>

        <Field label="Asesor">
          <select value={form.advisor_id} onChange={e => set('advisor_id', e.target.value)}
            className="input text-sm w-full">
            <option value="">Sin asesor</option>
            {advisors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </Field>
      </Section>

      {form.property_id && !form.owner_id && (
        <div className="card p-3 flex items-start gap-2"
          style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5"/>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            Este inmueble no tiene propietario vinculado. Sin propietario no hay a quién girarle
            el canon. Asígnalo desde <strong>Inmuebles</strong> o elígelo arriba.
          </p>
        </div>
      )}

      <Section title="2. Canon y comisión">
        <Field label="Canon mensual" required>
          <input type="number" value={form.canon_amount}
            onChange={e => set('canon_amount', e.target.value)}
            className="input text-sm w-full" min="0" step="1000" placeholder="0"/>
        </Field>

        <Field label="Administración" hint="Cuota de administración del conjunto, si aplica">
          <input type="number" value={form.admin_fee_amount}
            onChange={e => set('admin_fee_amount', e.target.value)}
            className="input text-sm w-full" min="0" step="1000" placeholder="0"/>
        </Field>

        <Field label="Tipo de comisión" required>
          <select value={form.fee_type} onChange={e => set('fee_type', e.target.value)}
            className="input text-sm w-full">
            <option value="porcentaje">Porcentaje del canon</option>
            <option value="fijo">Monto fijo mensual</option>
          </select>
        </Field>

        <Field label={form.fee_type === 'fijo' ? 'Valor de la comisión' : 'Porcentaje (%)'} required>
          <input type="number" value={form.fee_value}
            onChange={e => set('fee_value', e.target.value)}
            className="input text-sm w-full" min="0"
            step={form.fee_type === 'fijo' ? '1000' : '0.1'}
            max={form.fee_type === 'fijo' ? undefined : '100'}/>
        </Field>

        <Field label="Depósito / garantía" hint="Queda retenido hasta terminar el contrato">
          <input type="number" value={form.deposit_amount}
            onChange={e => set('deposit_amount', e.target.value)}
            className="input text-sm w-full" min="0" step="1000" placeholder="0"/>
        </Field>
      </Section>

      {/* Reparto en vivo — el dato que define el negocio */}
      {reparto && (
        <div className="card p-4"
          style={{ background:'rgba(200,168,75,0.06)', border:'1px solid rgba(200,168,75,0.25)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color:'#C8A84B' }}>
            Reparto de cada canon cobrado
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Entra a caja</p>
              <p className="text-lg font-semibold" style={{ color:'var(--color-text-primary)' }}>
                {fmt(reparto.canon)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Ingreso de la inmobiliaria</p>
              <p className="text-lg font-semibold" style={{ color:'#22c55e' }}>
                {fmt(reparto.comision)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Se le gira al propietario</p>
              <p className="text-lg font-semibold" style={{ color:'var(--color-text-accent)' }}>
                {fmt(reparto.propietario)}
              </p>
            </div>
          </div>
          {comisionExcede && (
            <p className="text-sm mt-3 pt-3 text-red-400"
              style={{ borderTop:'1px solid rgba(200,168,75,0.25)' }}>
              La comisión fija supera el canon. Corrígela antes de guardar.
            </p>
          )}
        </div>
      )}

      <Section title="3. Vigencia">
        <Field label="Fecha de inicio" required>
          <input type="date" value={form.start_date}
            onChange={e => set('start_date', e.target.value)} className="input text-sm w-full"/>
        </Field>
        <Field label="Plazo (meses)" required hint="Se genera un cobro por cada mes">
          <input type="number" value={form.months_term}
            onChange={e => set('months_term', e.target.value)}
            className="input text-sm w-full" min="1" max="120"/>
        </Field>
        <Field label="Día de pago" required hint="Del 1 al 28, para que exista en todos los meses">
          <input type="number" value={form.payment_day}
            onChange={e => set('payment_day', e.target.value)}
            className="input text-sm w-full" min="1" max="28"/>
        </Field>
      </Section>

      <Section title="4. Incremento del canon" cols={3}>
        <Field label="Cuándo sube" hint="Cada inmobiliaria lo maneja distinto">
          <select value={form.increment_frequency}
            onChange={e => set('increment_frequency', e.target.value)}
            className="input text-sm w-full">
            <option value="anual">Cada año</option>
            <option value="al_terminar">Al terminar el contrato</option>
            <option value="manual">Manual, cuando yo decida</option>
            <option value="ninguno">No sube</option>
          </select>
        </Field>
        <Field label="Sobre qué base">
          <select value={form.increment_type} onChange={e => set('increment_type', e.target.value)}
            className="input text-sm w-full">
            <option value="ipc">IPC del año</option>
            <option value="fijo">Porcentaje fijo</option>
            <option value="ninguno">Ninguna</option>
          </select>
        </Field>
        <Field label="Porcentaje" hint={form.increment_type === 'ipc' ? 'Opcional: se define al aplicarlo' : undefined}>
          <input type="number" value={form.increment_pct}
            onChange={e => set('increment_pct', e.target.value)}
            className="input text-sm w-full" min="0" step="0.1" placeholder="0.0"
            disabled={form.increment_type === 'ninguno'}/>
        </Field>
      </Section>

      <div className="card">
        <Field label="Observaciones">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} className="input text-sm w-full resize-none"
            placeholder="Condiciones especiales, acuerdos con el propietario…"/>
        </Field>
      </div>

      <div className="card p-3 flex items-start gap-2"
        style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)' }}>
        <Info size={15} style={{ color:'#3b82f6' }} className="flex-shrink-0 mt-0.5"/>
        <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
          Al guardar, el inmueble pasa a <strong>arrendado</strong> y se genera un cobro mensual
          por cada mes del plazo. Cuando el contrato termine, el inmueble vuelve a quedar
          disponible automáticamente.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(`${to('contracts')}?scope=arriendos`)}
          className="btn btn-secondary" disabled={saving}>
          Cancelar
        </button>
        <button onClick={submit} className="btn btn-primary flex items-center gap-1.5"
          disabled={saving || comisionExcede}>
          <Save size={15}/> {saving ? 'Creando…' : 'Crear contrato de arriendo'}
        </button>
      </div>
    </div>
  );
};

export default RentalNewPage;
