// src/pages/Contracts/ContractNewPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Search, CheckCircle } from 'lucide-react';
import { contractsService, clientsService, propertiesService, advisorsService } from '../../services/api.service';
import { useCurrencyFormat } from '../../utils/currency';
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

const Section = ({ num, title, children }) => (
  <div className="card">
    <h3 className="font-semibold text-sm mb-4 pb-3"
      style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
      {num}. {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

// ── Buscador de cliente ───────────────────────────────────────
const ClientSearch = ({ value, onChange }) => {
  const [q, setQ]     = useState('');
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['client-search', q],
    queryFn:  () => clientsService.search(q),
    enabled:  q.length >= 2,
  });
  const results = data?.data?.data || [];

  const select = (c) => {
    onChange(c);
    setQ(c.full_name);
    setOpen(false);
  };

  return (
    <div className="relative md:col-span-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color:'var(--color-text-muted)' }}/>
        <input type="text" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
          onFocus={() => setOpen(true)}
          className="input pl-9 text-sm w-full"
          placeholder="Escriba nombre o documento del cliente..."/>
        {value && (
          <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400"/>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 rounded-lg overflow-hidden shadow-xl"
          style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
          {results.map(c => (
            <button key={c.id} type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors flex justify-between"
              onClick={() => select(c)}>
              <span style={{ color:'var(--color-text-primary)' }}>{c.full_name}</span>
              <span style={{ color:'var(--color-text-muted)' }}>
                {c.document_type} {c.document_number}
              </span>
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle size={13} className="text-emerald-400"/>
          <span style={{ color:'#10b981' }}>{value.full_name}</span>
          <span style={{ color:'var(--color-text-muted)' }}>
            {value.document_type} {value.document_number}
          </span>
        </div>
      )}
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const ContractNewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const [saving, setSaving]           = useState(false);
  const [selectedClient, setClient]   = useState(null);
  const [selectedProps,  setSelProps] = useState([]); // array de inmuebles
  const selectedProp = selectedProps[0] || null; // backward compat

  const [form, setForm] = useState({
    advisor_id:         '',
    signing_date:       new Date().toISOString().split('T')[0],
    promise_date:       '',
    delivery_date:      '',
    contract_type:      'promesa',
    payment_type:       'credito',
    // Venta / crédito
    total_value:        '',
    discount:           '0',
    down_payment:       '0',
    financed_amount:    '',
    installments_total: '36',
    installment_amount: '',
    installment_day:    '1',
    bank_name:          '',
    bank_credit_number: '',
    interest_rate:      '',
    // Arriendo (campos extra)
    rental_months:      '12',   // duración en meses
    rental_canon:       '',     // canon mensual
    notes:              '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Detectar si es arriendo ───────────────────────────────
  const { formatCurrency } = useCurrencyFormat();
  const isArriendo = form.payment_type === 'arriendo' || form.contract_type === 'arriendo';

  // Datos de BD
  const { data: propsData } = useQuery({
    queryKey: ['properties-available'],
    queryFn:  () => propertiesService.getAll({ status:'disponible' }),
  });
  const availableProps = propsData?.data?.data || [];

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const advisors = advisorsData?.data?.data || [];

  // Al agregar/quitar propiedad del selector múltiple
  const handleAddProp = (propId) => {
    if (!propId || selectedProps.find(p => p.id === propId)) return;
    const prop = availableProps.find(p => p.id === propId);
    if (!prop) return;
    const newList = [...selectedProps, prop];
    setSelProps(newList);
    // Auto-sumar precios
    const total = newList.reduce((s, p) => s + parseFloat(p.base_price || 0), 0);
    set('total_value', String(total));
  };

  const handleRemoveProp = (propId) => {
    const newList = selectedProps.filter(p => p.id !== propId);
    setSelProps(newList);
    const total = newList.reduce((s, p) => s + parseFloat(p.base_price || 0), 0);
    set('total_value', total > 0 ? String(total) : '');
  };

  // Compatibilidad con selector simple (primer inmueble)
  const handlePropChange = (e) => {
    const id   = e.target.value;
    if (!id) return;
    handleAddProp(id);
  };

  // Calcular cuota venta
  const calcInstallment = () => {
    const net = parseFloat(form.total_value||0) - parseFloat(form.discount||0) - parseFloat(form.down_payment||0);
    const n   = parseInt(form.installments_total||1);
    if (net > 0 && n > 0) {
      set('installment_amount', String(Math.ceil(net / n)));
      set('financed_amount',    String(net));
    }
  };

  // Cambiar tipo de contrato → sincronizar tipo de pago
  const handleContractTypeChange = (val) => {
    set('contract_type', val);
    if (val === 'arriendo') {
      set('payment_type',       'arriendo');
      set('rental_months',      '12');
      set('installments_total', '12');
    } else if (form.payment_type === 'arriendo') {
      set('payment_type', 'credito');
    }
  };

  // Cambiar tipo de pago → sincronizar tipo de contrato
  const handlePaymentTypeChange = (val) => {
    set('payment_type', val);
    if (val === 'arriendo') {
      set('contract_type',      'arriendo');
      set('rental_months',      '12');
      set('installments_total', '12');
    } else if (form.contract_type === 'arriendo') {
      set('contract_type', 'promesa');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient)   return toast.error('Seleccione un cliente');
    if (!selectedProps.length) return toast.error('Seleccione al menos un inmueble');
    if (!form.signing_date)return toast.error('La fecha de firma es requerida');

    // Preparar datos según tipo
    let payload;
    if (isArriendo) {
      if (!form.rental_canon)  return toast.error('El canon de arriendo es requerido');
      if (!form.rental_months) return toast.error('La duración del contrato es requerida');

      const canon  = parseFloat(form.rental_canon);
      const months = parseInt(form.rental_months);
      const total  = canon * months;

      payload = {
        client_id:          selectedClient.id,
        property_id:        selectedProp.id,
        property_ids:       selectedProps.map(p => p.id),
        advisor_id:         form.advisor_id   || null,
        signing_date:       form.signing_date,
        promise_date:       form.promise_date || null,
        delivery_date:      form.delivery_date|| null,
        contract_type:      'arriendo',
        payment_type:       'arriendo',
        total_value:        total,
        discount:           0,
        net_value:          total,
        down_payment:       0,
        financed_amount:    0,
        installments_total: months,
        installment_amount: canon,
        installment_day:    parseInt(form.installment_day) || 1,
        notes:              form.notes || null,
      };
    } else {
      if (!form.total_value) return toast.error('El valor total es requerido');

      const tv   = parseFloat(form.total_value);
      const disc = parseFloat(form.discount)    || 0;
      const net  = tv - disc;
      const dp   = parseFloat(form.down_payment)|| 0;

      payload = {
        client_id:          selectedClient.id,
        property_id:        selectedProp.id,
        property_ids:       selectedProps.map(p => p.id),
        advisor_id:         form.advisor_id   || null,
        signing_date:       form.signing_date,
        promise_date:       form.promise_date || null,
        delivery_date:      form.delivery_date|| null,
        contract_type:      form.contract_type,
        payment_type:       form.payment_type,
        total_value:        tv,
        discount:           disc,
        net_value:          net,
        down_payment:       dp,
        financed_amount:    form.financed_amount ? parseFloat(form.financed_amount) : (net - dp),
        installments_total: parseInt(form.installments_total) || 1,
        installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : null,
        installment_day:    parseInt(form.installment_day) || 1,
        bank_name:          form.bank_name          || null,
        bank_credit_number: form.bank_credit_number || null,
        interest_rate:      form.interest_rate ? parseFloat(form.interest_rate) : null,
        notes:              form.notes              || null,
      };
    }

    setSaving(true);
    try {
      const res = await contractsService.create(payload);
      toast.success(res.data?.message || 'Contrato creado exitosamente');
      navigate(to('contracts'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el contrato');
    } finally {
      setSaving(false);
    }
  };

  // Cálculos en tiempo real para arriendo
  const arrendoTotal   = parseFloat(form.rental_canon||0) * parseInt(form.rental_months||0);
  const arrendoResumen = form.rental_canon && form.rental_months && parseInt(form.rental_months) > 0;

  // Valor neto para venta
  const netValue = parseFloat(form.total_value||0) - parseFloat(form.discount||0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(to('contracts'))} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              Nuevo Contrato
            </h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Complete todos los campos requeridos
            </p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Contrato'}
        </button>
      </div>

      {/* 1. Cliente */}
      <Section num="1" title="Cliente">
        <ClientSearch value={selectedClient} onChange={setClient}/>
      </Section>

      {/* 2. Inmuebles y Asesor */}
      <Section num="2" title="Inmuebles y Asesor">
        <Field label="Agregar inmueble(s)" required
          hint="Puedes agregar uno o varios inmuebles al mismo contrato. El valor total se calcula automáticamente.">
          <select
            value=""
            onChange={e => handleAddProp(e.target.value)}
            className="input text-sm">
            <option value="">+ Seleccionar inmueble para agregar...</option>
            {availableProps
              .filter(p => !selectedProps.find(sp => sp.id === p.id))
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_name} · Unidad {p.unit_number} · {p.property_type} · {formatCurrency(p.base_price)}
                </option>
              ))
            }
          </select>
        </Field>

        {/* Inmuebles seleccionados */}
        {selectedProps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color:'var(--color-text-muted)' }}>
              {selectedProps.length} inmueble{selectedProps.length !== 1 ? 's' : ''} seleccionado{selectedProps.length !== 1 ? 's' : ''}:
            </p>
            {selectedProps.map((p, i) => (
              <div key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color:'var(--color-text-primary)' }}>
                      {p.project_name}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa' }}>
                      Unidad {p.unit_number}
                    </span>
                    <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                      {p.property_type}
                    </span>
                  </div>
                  <p className="text-sm font-bold mt-0.5" style={{ color:'#10b981' }}>
                    {formatCurrency(p.base_price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveProp(p.id)}
                  className="flex-shrink-0 hover:text-red-400 transition-colors p-1"
                  style={{ color:'var(--color-text-muted)' }}
                  title="Quitar inmueble">
                  ✕
                </button>
              </div>
            ))}

            {/* Suma automática */}
            {selectedProps.length > 1 && (
              <div className="flex justify-between items-center px-3 py-2 rounded-lg"
                style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-xs font-semibold" style={{ color:'#10b981' }}>
                  Suma automática ({selectedProps.length} inmuebles):
                </span>
                <span className="text-sm font-bold" style={{ color:'#10b981' }}>
                  {formatCurrency(selectedProps.reduce((s, p) => s + parseFloat(p.base_price || 0), 0))}
                </span>
              </div>
            )}
          </div>
        )}

        <Field label="Asesor comercial">
          <select value={form.advisor_id} onChange={e => set('advisor_id', e.target.value)}
            className="input text-sm">
            <option value="">Sin asesor asignado</option>
            {advisors.map(a => (
              <option key={a.id} value={a.id}>
                {a.full_name} ({a.advisor_type})
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* 3. Condiciones del Contrato */}
      <Section num="3" title="Condiciones del Contrato">

        {/* Fechas */}
        <Field label="Fecha de firma" required>
          <input type="date" value={form.signing_date}
            onChange={e => set('signing_date', e.target.value)} className="input text-sm"/>
        </Field>
        <Field label="Fecha de promesa">
          <input type="date" value={form.promise_date}
            onChange={e => set('promise_date', e.target.value)} className="input text-sm"/>
        </Field>
        <Field label="Fecha de entrega">
          <input type="date" value={form.delivery_date}
            onChange={e => set('delivery_date', e.target.value)} className="input text-sm"/>
        </Field>

        {/* Tipo de contrato */}
        <Field label="Tipo de contrato">
          <select value={form.contract_type}
            onChange={e => handleContractTypeChange(e.target.value)}
            className="input text-sm">
            <option value="promesa">Promesa de compraventa</option>
            <option value="compraventa">Compraventa</option>
            <option value="leasing">Leasing habitacional</option>
            <option value="arriendo">Arriendo</option>
          </select>
        </Field>

        {/* Tipo de pago — sincronizado */}
        <Field label="Tipo de pago" required>
          <select value={form.payment_type}
            onChange={e => handlePaymentTypeChange(e.target.value)}
            className="input text-sm">
            <option value="credito">Crédito hipotecario</option>
            <option value="contado">Contado</option>
            <option value="leasing">Leasing habitacional</option>
            <option value="subsidio">Subsidio de vivienda</option>
            <option value="permuta">Permuta</option>
            <option value="corto_plazo">Corto plazo</option>
            <option value="arriendo">Arriendo mensual</option>
          </select>
        </Field>

        {/* ══════════════════════════════════════════════════
            MODO ARRIENDO — campos específicos
        ══════════════════════════════════════════════════ */}
        {isArriendo && (<>

          {/* Banner arriendo */}
          <div className="md:col-span-2 p-3 rounded-xl"
            style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color:'#10b981' }}>
              🏠 Contrato de Arriendo
            </p>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              El sistema generará automáticamente una cuota mensual por cada mes del contrato,
              permitiendo hacer seguimiento de pagos, mora y historial del arrendatario.
            </p>
          </div>

          <Field label="Canon de arriendo mensual " required
            hint="Valor que el arrendatario paga cada mes">
            <input type="number" value={form.rental_canon}
              onChange={e => {
                set('rental_canon', e.target.value);
                set('installment_amount', e.target.value);
              }}
              className="input text-sm" placeholder="1500000" min="0" step="1000" autoFocus/>
          </Field>

          <Field label="Duración del contrato (meses)" required
            hint="12 = 1 año · 24 = 2 años · 36 = 3 años">
            <input type="number" value={form.rental_months}
              onChange={e => {
                set('rental_months',      e.target.value);
                set('installments_total', e.target.value);
              }}
              className="input text-sm" placeholder="12" min="1" max="120"/>
          </Field>

          <Field label="Día de pago mensual"
            hint="Día del mes en que vence el canon (1–28)">
            <input type="number" value={form.installment_day}
              onChange={e => set('installment_day', e.target.value)}
              className="input text-sm" placeholder="1" min="1" max="28"/>
          </Field>

          {/* Resumen visual arriendo */}
          {arrendoResumen && (
            <div className="rounded-xl p-4"
              style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color:'var(--color-text-muted)' }}>
                Resumen del contrato de arriendo
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Canon mensual</p>
                  <p className="font-bold font-mono" style={{ color:'var(--color-text-primary)' }}>
                    {formatCurrency(parseFloat(form.rental_canon||0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Valor total del contrato</p>
                  <p className="font-bold font-mono" style={{ color:'#10b981' }}>
                    {formatCurrency(arrendoTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Duración</p>
                  <p className="font-bold" style={{ color:'var(--color-text-primary)' }}>
                    {form.rental_months} mes{parseInt(form.rental_months) !== 1 ? 'es' : ''}
                    {parseInt(form.rental_months) >= 12 && (
                      <span className="ml-1 font-normal text-xs" style={{ color:'var(--color-text-muted)' }}>
                        ({(parseInt(form.rental_months)/12).toFixed(1)} años)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Pago el día</p>
                  <p className="font-bold" style={{ color:'var(--color-text-primary)' }}>
                    {form.installment_day || 1} de cada mes
                  </p>
                </div>
              </div>
            </div>
          )}

        </>)}

        {/* ══════════════════════════════════════════════════
            MODO VENTA / CRÉDITO — campos normales
        ══════════════════════════════════════════════════ */}
        {!isArriendo && (<>

          <Field label="Valor total " required>
            <input type="number" value={form.total_value}
              onChange={e => set('total_value', e.target.value)}
              className="input text-sm" placeholder="250000000" min="0" step="1000"/>
          </Field>

          <Field label="Descuento ">
            <input type="number" value={form.discount}
              onChange={e => set('discount', e.target.value)}
              className="input text-sm" placeholder="0" min="0"/>
          </Field>

          {/* Valor neto calculado */}
          {parseFloat(form.total_value||0) > 0 && (
            <div className="md:col-span-2 px-3 py-2 rounded-lg text-sm"
              style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
              <span style={{ color:'var(--color-text-muted)' }}>Valor neto: </span>
              <span className="font-bold font-mono" style={{ color:'#10b981' }}>
                {formatCurrency(netValue)}
              </span>
            </div>
          )}

          <Field label="Cuota inicial ">
            <input type="number" value={form.down_payment}
              onChange={e => set('down_payment', e.target.value)}
              className="input text-sm" placeholder="0" min="0"/>
          </Field>

          <Field label="Número de cuotas">
            <input type="number" value={form.installments_total}
              onChange={e => set('installments_total', e.target.value)}
              className="input text-sm" placeholder="36" min="1" max="360"/>
          </Field>

          <Field label="Día de pago mensual">
            <input type="number" value={form.installment_day}
              onChange={e => set('installment_day', e.target.value)}
              className="input text-sm" placeholder="1" min="1" max="28"/>
          </Field>

          {/* Calcular cuota */}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={calcInstallment}
              className="btn btn-secondary btn-sm">
              Calcular cuota automáticamente
            </button>
            {form.installment_amount && (
              <span className="text-sm" style={{ color:'#10b981' }}>
                Cuota: <strong>{formatCurrency(parseFloat(form.installment_amount))}</strong> / mes
              </span>
            )}
          </div>

          <Field label="Valor cuota mensual "
            hint="O ingrésala manualmente si ya la conoces">
            <input type="number" value={form.installment_amount}
              onChange={e => set('installment_amount', e.target.value)}
              className="input text-sm" placeholder="Se calcula automáticamente" min="0"/>
          </Field>

        </>)}
      </Section>

      {/* 4. Financiación — solo para crédito */}
      {!isArriendo && form.payment_type === 'credito' && (
        <Section num="4" title="Datos de Financiación">
          <Field label="Entidad bancaria">
            <input type="text" value={form.bank_name}
              onChange={e => set('bank_name', e.target.value)}
              className="input text-sm" placeholder="Bancolombia, Davivienda..."/>
          </Field>
          <Field label="Número de crédito">
            <input type="text" value={form.bank_credit_number}
              onChange={e => set('bank_credit_number', e.target.value)}
              className="input text-sm" placeholder="CRE-123456"/>
          </Field>
          <Field label="Tasa de interés mensual (%)"
            hint="Solo informativo — referencia del crédito bancario">
            <input type="number" value={form.interest_rate}
              onChange={e => set('interest_rate', e.target.value)}
              className="input text-sm" placeholder="1.2" step="0.01" min="0" max="10"/>
          </Field>
        </Section>
      )}

      {/* 5. Observaciones */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3" style={{ color:'var(--color-text-primary)' }}>
          {isArriendo ? '4' : '5'}. Observaciones
        </h3>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          className="input text-sm resize-none w-full" rows={3}
          placeholder="Condiciones especiales, observaciones del contrato..."/>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate(to('contracts'))} className="btn btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Contrato'}
        </button>
      </div>

    </form>
  );
};

export default ContractNewPage;