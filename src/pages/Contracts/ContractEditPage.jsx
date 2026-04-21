// src/pages/Contracts/ContractEditPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { contractsService, advisorsService, usersService } from '../../services/api.service';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

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

const Section = ({ title, children }) => (
  <div className="card">
    <h3 className="font-semibold text-sm mb-4 pb-3"
      style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

const PAYMENT_TYPES = [
  { value:'credito',     label:'Crédito hipotecario'    },
  { value:'contado',     label:'Contado'                },
  { value:'leasing',     label:'Leasing habitacional'   },
  { value:'subsidio',    label:'Subsidio de vivienda'   },
  { value:'permuta',     label:'Permuta'                },
  { value:'corto_plazo', label:'Corto plazo'            },
  { value:'arriendo',    label:'Arriendo'               },
];

const CONTRACT_TYPES = [
  { value:'promesa',     label:'Promesa de compraventa' },
  { value:'compraventa', label:'Compraventa'            },
  { value:'leasing',     label:'Leasing'                },
  { value:'arriendo',    label:'Arriendo'               },
];

const ContractEditPage = () => {
  const { id, tenant } = useParams();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const { hasRole }     = useAuthStore();
  const canEdit         = hasRole('admin','gerente','contador');
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;

  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState(null);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  // Cargar datos del contrato
  const { data, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn:  () => contractsService.getById(id),
  });

  // Cargar asesores
  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const advisors = advisorsData?.data?.data || [];

  // Cargar usuarios para abogados y supervisores
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersService.getAll(),
  });
  const allUsers    = usersData?.data?.data || [];
  const abogados    = allUsers.filter(u => u.role === 'abogado'    && u.is_active);
  const supervisores = allUsers.filter(u => u.role === 'supervisor' && u.is_active);

  const contract = data?.data?.data?.contract;

  // Pre-llenar formulario cuando llegan los datos
  useEffect(() => {
    if (contract && !form) {
      setForm({
        signing_date:       contract.signing_date?.split('T')[0]  || '',
        promise_date:       contract.promise_date?.split('T')[0]  || '',
        delivery_date:      contract.delivery_date?.split('T')[0] || '',
        contract_type:      contract.contract_type      || 'promesa',
        payment_type:       contract.payment_type       || 'credito',
        total_value:        String(contract.total_value || ''),
        discount:           String(contract.discount    || '0'),
        down_payment:       String(contract.down_payment|| '0'),
        financed_amount:    String(contract.financed_amount || ''),
        installments_total: String(contract.installments_total || '1'),
        installment_amount: String(contract.installment_amount || ''),
        installment_day:    String(contract.installment_day   || '1'),
        bank_name:          contract.bank_name          || '',
        bank_credit_number: contract.bank_credit_number || '',
        interest_rate:      String(contract.interest_rate || ''),
        advisor_id:         String(contract.advisor_id    || ''),
        abogado_id:         String(contract.abogado_id    || ''),
        supervisor_id:      String(contract.supervisor_id || ''),
        notes:              contract.notes              || '',
      });
    }
  }, [contract]);

  // Calcular valores derivados en tiempo real
  const netValue    = (parseFloat(form?.total_value||0) - parseFloat(form?.discount||0));
  const instAmount  = form?.installments_total > 1
    ? (netValue - parseFloat(form?.down_payment||0)) / parseInt(form?.installments_total||1)
    : 0;

  const calcInstallment = () => {
    if (form?.installments_total > 1) {
      const net    = netValue - parseFloat(form?.down_payment||0);
      const amount = Math.ceil(net / parseInt(form?.installments_total||1));
      set('installment_amount', String(amount));
      set('financed_amount',    String(net));
    }
  };

  const handleSubmit = async () => {
    if (!form.signing_date || !form.total_value || !form.payment_type)
      return toast.error('Fecha de firma, valor total y tipo de pago son requeridos');

    setSaving(true);
    try {
      await contractsService.update(id, {
        ...form,
        total_value:        parseFloat(form.total_value),
        discount:           parseFloat(form.discount)           || 0,
        down_payment:       parseFloat(form.down_payment)       || 0,
        financed_amount:    form.financed_amount ? parseFloat(form.financed_amount) : null,
        installments_total: parseInt(form.installments_total)   || 1,
        installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : null,
        installment_day:    parseInt(form.installment_day)      || 1,
        interest_rate:      form.interest_rate ? parseFloat(form.interest_rate) : null,
        advisor_id:         form.advisor_id    || null,
        abogado_id:         form.abogado_id    || null,
        supervisor_id:      form.supervisor_id || null,
        promise_date:       form.promise_date   || null,
        delivery_date:      form.delivery_date  || null,
      });
      toast.success('Contrato actualizado correctamente');
      queryClient.invalidateQueries({ queryKey:['contract', id] });
      queryClient.invalidateQueries({ queryKey:['contracts'] });
      navigate(to(`contracts/${id}`));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar el contrato');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) return (
    <div className="flex items-center justify-center py-20 gap-3"
      style={{ color:'var(--color-text-muted)' }}>
      <RefreshCw size={20} className="animate-spin"/>
      <span>Cargando contrato...</span>
    </div>
  );

  if (!canEdit) return (
    <div className="card flex flex-col items-center py-16 gap-3">
      <AlertTriangle size={40} className="text-red-400"/>
      <p style={{ color:'var(--color-text-secondary)' }}>
        No tienes permisos para editar contratos
      </p>
      <button onClick={() => navigate(to(`contracts/${id}`))} className="btn btn-secondary btn-sm">
        <ArrowLeft size={14}/> Volver
      </button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(to(`contracts/${id}`))} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              Editar Contrato
            </h1>
            <p className="text-sm font-mono" style={{ color:'var(--color-text-accent)' }}>
              {contract?.contract_number}
              <span className="ml-2 font-sans font-normal"
                style={{ color:'var(--color-text-muted)' }}>
                · {contract?.client_name}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(to(`contracts/${id}`))} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
            <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)' }}>
        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
        <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
          <strong style={{ color:'#f59e0b' }}>Atención:</strong> Editar un contrato ya creado
          queda registrado en auditoría. No modifiques el inmueble ni el cliente — esos campos
          no son editables para preservar la integridad. Si necesitas cambiarlos, cancela el
          contrato y crea uno nuevo.
        </p>
      </div>

      {/* Datos no editables (solo lectura) */}
      <div className="card p-4"
        style={{ background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.15)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color:'var(--color-text-muted)' }}>
          Datos fijos (no editables)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Cliente</p>
            <p className="font-medium" style={{ color:'var(--color-text-primary)' }}>
              {contract?.client_name}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Inmueble</p>
            <p className="font-medium" style={{ color:'var(--color-text-primary)' }}>
              {contract?.project_name}
              {contract?.block_name && (
                <span className="mx-1" style={{ color:'var(--color-text-muted)' }}>·</span>
              )}
              {contract?.block_name && (
                <span style={{ color:'#c084fc' }}>{contract.block_name}</span>
              )}
              <span className="mx-1" style={{ color:'var(--color-text-muted)' }}>·</span>
              Unidad {contract?.property_unit}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>N° Contrato</p>
            <p className="font-mono font-medium" style={{ color:'var(--color-text-accent)' }}>
              {contract?.contract_number}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Estado</p>
            <p className="font-medium" style={{ color:'var(--color-text-primary)' }}>
              {contract?.status}
            </p>
          </div>
        </div>
      </div>

      {/* Sección 1: Fechas y tipo */}
      <Section title="1. Fechas y Tipo de Contrato">
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
        <Field label="Tipo de contrato">
          <select value={form.contract_type}
            onChange={e => set('contract_type', e.target.value)} className="input text-sm">
            {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Tipo de pago" required>
          <select value={form.payment_type}
            onChange={e => set('payment_type', e.target.value)} className="input text-sm">
            {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Asesor comercial">
          <select value={form.advisor_id}
            onChange={e => set('advisor_id', e.target.value)} className="input text-sm">
            <option value="">Sin asesor asignado</option>
            {advisors.map(a => (
              <option key={a.id} value={a.id}>
                {a.full_name} ({a.advisor_type})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Abogado">
          <select value={form.abogado_id}
            onChange={e => set('abogado_id', e.target.value)} className="input text-sm">
            <option value="">Sin abogado asignado</option>
            {abogados.map(u => (
              <option key={u.id} value={String(u.id)}>{u.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Supervisor">
          <select value={form.supervisor_id}
            onChange={e => set('supervisor_id', e.target.value)} className="input text-sm">
            <option value="">Sin supervisor asignado</option>
            {supervisores.map(u => (
              <option key={u.id} value={String(u.id)}>{u.full_name}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Sección 2: Valores */}
      <Section title="2. Condiciones Financieras">
        <Field label="Valor total (COP)" required>
          <input type="number" value={form.total_value}
            onChange={e => set('total_value', e.target.value)}
            className="input text-sm" min="0" step="1000"/>
        </Field>
        <Field label="Descuento (COP)">
          <input type="number" value={form.discount}
            onChange={e => set('discount', e.target.value)}
            className="input text-sm" min="0" step="1000"/>
        </Field>

        {/* Valor neto calculado */}
        <div className="md:col-span-2 p-3 rounded-lg"
          style={{ background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Valor neto calculado</p>
          <p className="text-xl font-bold font-mono" style={{ color:'#10b981' }}>
            {formatCurrency(netValue)}
          </p>
        </div>

        <Field label="Cuota inicial (COP)">
          <input type="number" value={form.down_payment}
            onChange={e => set('down_payment', e.target.value)}
            className="input text-sm" min="0" step="1000"/>
        </Field>
        <Field label="Número de cuotas">
          <input type="number" value={form.installments_total}
            onChange={e => set('installments_total', e.target.value)}
            className="input text-sm" min="1" max="360"/>
        </Field>
        <div>
          <Field label="Valor por cuota (COP)"
            hint="Clic en 'Calcular' para actualizar automáticamente">
            <div className="flex gap-2">
              <input type="number" value={form.installment_amount}
                onChange={e => set('installment_amount', e.target.value)}
                className="input text-sm flex-1" min="0" step="1000"/>
              <button onClick={calcInstallment}
                className="btn btn-secondary btn-sm whitespace-nowrap text-xs">
                Calcular
              </button>
            </div>
          </Field>
        </div>
        <Field label="Día de pago mensual">
          <input type="number" value={form.installment_day}
            onChange={e => set('installment_day', e.target.value)}
            className="input text-sm" min="1" max="28"/>
        </Field>
      </Section>

      {/* Sección 3: Financiación */}
      <Section title="3. Datos de Financiación (opcional)">
        <Field label="Entidad bancaria">
          <input type="text" value={form.bank_name}
            onChange={e => set('bank_name', e.target.value)}
            className="input text-sm" placeholder="Bancolombia, Davivienda..."/>
        </Field>
        <Field label="N° crédito / referencia">
          <input type="text" value={form.bank_credit_number}
            onChange={e => set('bank_credit_number', e.target.value)}
            className="input text-sm" placeholder="CRE-12345"/>
        </Field>
        <Field label="Tasa del crédito bancario — referencia (%)"
          hint="Solo se guarda como referencia del crédito aprobado por el banco. No afecta el cálculo de las cuotas, ya que el banco es quien cobra los intereses directamente al cliente.">
          <input type="number" value={form.interest_rate}
            onChange={e => set('interest_rate', e.target.value)}
            className="input text-sm" min="0" max="5" step="0.01" placeholder="1.2"/>
        </Field>
      </Section>

      {/* Notas */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3"
          style={{ color:'var(--color-text-primary)' }}>
          Observaciones
        </h3>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          className="input text-sm resize-none w-full" rows={3}
          placeholder="Notas adicionales sobre el contrato..."/>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => navigate(to(`contracts/${id}`))} className="btn btn-secondary">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
          <Save size={15}/> {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
};

export default ContractEditPage;