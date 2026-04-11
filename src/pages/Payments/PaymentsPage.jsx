// src/pages/Payments/PaymentsPage.jsx
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, AlertTriangle, CheckCircle, RefreshCw,
  Search, Plus, X, Save, Paperclip, ExternalLink,
  Info
} from 'lucide-react';
import { paymentsService, contractsService } from '../../services/api.service';
import { getActiveTenantSlug } from '../../utils/tenant';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://back.inmogestpro.com';
const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const PAYMENT_METHODS = [
  { value:'transferencia', label:'Transferencia bancaria' },
  { value:'pse',           label:'PSE'                   },
  { value:'efectivo',      label:'Efectivo'               },
  { value:'cheque',        label:'Cheque'                 },
  { value:'tarjeta',       label:'Tarjeta'                },
];

// Subir comprobante

const uploadPaymentFile = async (tenantSlug, paymentId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('inmogest_token');
  const apiBase = () => `${API_URL}/api/v1/${tenantSlug}`;

  const res = await fetch(`${apiBase()}/payments/${paymentId}/upload`, {
    method: 'POST',
    headers: { Authorization:`Bearer ${token}` },
    body: formData,
  });
  return res.json();
};

// ── Modal registrar pago ─────────────────────────────────────
const PaymentModal = ({ onClose, onSaved }) => {
  const [step,      setStep]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [contract,  setContract]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [uploadFile,setUploadFile]= useState(null);
  const fileInputRef = useRef();
  const { tenant }     = useParams();

  const [form, setForm] = useState({
    payment_date:   new Date().toISOString().split('T')[0],
    amount:         '',
    payment_method: 'transferencia',
    bank_reference: '',
    bank_name:      '',
    schedule_id:    '',
    notes:          '',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  // Buscar contratos activos
  const { data: contractsData, isFetching: searching } = useQuery({
    queryKey: ['contracts-pay-search', search],
    queryFn:  () => contractsService.getAll({ search, status:'activo', limit:10 }),
    enabled:  search.length >= 2,
  });
  const contracts = contractsData?.data?.data || [];

  // Detalle del contrato seleccionado (cuotas)
  const { data: contractDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['contract-pay-detail', contract?.id],
    queryFn:  () => contractsService.getById(contract.id),
    enabled:  !!contract?.id,
  });
  const schedule = contractDetail?.data?.data?.payment_schedule || [];
  const pendingSchedule = schedule.filter(s => s.status !== 'pagado');

  const selectContract = (c) => {
    setContract(c);
    setForm(f => ({...f, schedule_id:'', amount:''}));
    setStep(2);
  };

  const handleScheduleSelect = (sid) => {
    set('schedule_id', sid);
    if (sid) {
      const s = pendingSchedule.find(p => p.id === sid);
      if (s) {
        // Pre-llenar con el saldo pendiente de la cuota
        const remaining = parseFloat(s.amount) - parseFloat(s.paid_amount||0);
        set('amount', String(Math.round(remaining)));
      }
    }
  };

  const handleSubmit = async () => {
    if (!form.schedule_id) return toast.error('Debe seleccionar la cuota a pagar');
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!form.payment_date)   return toast.error('La fecha de pago es requerida');
    if (!form.payment_method) return toast.error('El método de pago es requerido');

    setSaving(true);
    try {
      const res = await contractsService.addPayment(contract.id, {
        payment_date:   form.payment_date,
        amount:         parseFloat(form.amount),
        payment_method: form.payment_method,
        bank_reference: form.bank_reference || null,
        bank_name:      form.bank_name      || null,
        schedule_id:    form.schedule_id,
        notes:          form.notes          || null,
      });

      const paymentId  = res.data?.data?.id;
      const receiptNum = res.data?.data?.receipt_number;
      const isPartial  = res.data?.data?.is_partial;
      const excess     = res.data?.data?.excess;

      // Subir comprobante si se seleccionó
      if (uploadFile && paymentId) {
        try {
          await uploadPaymentFile(tenant, paymentId, uploadFile);
          toast.success(`Comprobante subido correctamente`);
        } catch {
          toast.error('El pago se registró pero falló al subir el comprobante');
        }
      }

      // Mensaje informativo
      if (isPartial) {
        toast.success(`${receiptNum} registrado — Pago parcial. Cuota pendiente por completar.`, { duration:5000 });
      } else if (excess > 0) {
        toast.success(`${receiptNum} registrado — Cuota completada. Excedente abonado a siguiente cuota.`, { duration:5000 });
      } else {
        toast.success(`${receiptNum} registrado correctamente`);
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  // Cuota seleccionada
  const selectedSchedule = pendingSchedule.find(s => s.id === form.schedule_id);
  const paidSoFar   = parseFloat(selectedSchedule?.paid_amount || 0);
  const cuotaTotal  = parseFloat(selectedSchedule?.amount      || 0);
  const remaining   = cuotaTotal - paidSoFar;
  const pago        = parseFloat(form.amount || 0);
  const afterPay    = paidSoFar + pago;
  const isOverpay   = afterPay > cuotaTotal && cuotaTotal > 0;
  const isFullPay   = afterPay >= cuotaTotal && cuotaTotal > 0;
  const isPartial   = pago > 0 && !isFullPay;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10"
          style={{ borderColor:'var(--color-border)', background:'var(--color-bg-card)' }}>
          <div>
            <h2 className="font-bold" style={{ color:'var(--color-text-primary)' }}>
              Registrar Pago
            </h2>
            {contract && (
              <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                Contrato: <span style={{ color:'var(--color-text-accent)' }}>{contract.contract_number}</span>
                {' · '}{contract.client_name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>

        <div className="p-5">

          {/* ── PASO 1: Buscar contrato ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                Busque el contrato activo al que desea registrar el pago:
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color:'var(--color-text-muted)' }}/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="input pl-9 text-sm" placeholder="Nombre del cliente o número de contrato..."
                  autoFocus/>
              </div>

              {searching && (
                <div className="text-center py-4" style={{ color:'var(--color-text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin mx-auto"/>
                </div>
              )}

              <div className="space-y-2">
                {contracts.map(c => (
                  <button key={c.id} onClick={() => selectContract(c)}
                    className="w-full text-left p-3 rounded-lg transition-colors hover:bg-slate-700"
                    style={{ border:'1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-medium"
                        style={{ color:'var(--color-text-accent)' }}>
                        {c.contract_number}
                      </span>
                      <span className="badge badge-activo text-xs">Activo</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                      {c.client_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                      {c.project_name}
                      {c.installment_amount > 0 && ` · Cuota: ${formatCurrency(c.installment_amount)}`}
                      {` · ${c.paid_installments}/${c.installments_total} cuotas pagadas`}
                    </p>
                  </button>
                ))}
                {search.length >= 2 && !searching && contracts.length === 0 && (
                  <p className="text-center text-sm py-4" style={{ color:'var(--color-text-muted)' }}>
                    No se encontraron contratos activos
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 2: Formulario de pago ── */}
          {step === 2 && contract && (
            <div className="space-y-4">

              {/* Resumen del contrato */}
              <div className="p-3 rounded-lg text-sm grid grid-cols-2 gap-2"
                style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                <div>
                  <span style={{ color:'var(--color-text-muted)' }}>Valor total: </span>
                  <span style={{ color:'var(--color-text-primary)' }}>{formatCurrency(contract.total_value)}</span>
                </div>
                <div>
                  <span style={{ color:'var(--color-text-muted)' }}>Recaudado: </span>
                  <span style={{ color:'#10b981' }}>{formatCurrency(contract.total_paid)}</span>
                </div>
                <div>
                  <span style={{ color:'var(--color-text-muted)' }}>Cuotas: </span>
                  <span style={{ color:'var(--color-text-primary)' }}>
                    {contract.paid_installments}/{contract.installments_total}
                  </span>
                </div>
                <div>
                  <span style={{ color:'var(--color-text-muted)' }}>Valor cuota: </span>
                  <span style={{ color:'var(--color-text-primary)' }}>
                    {formatCurrency(contract.installment_amount)}
                  </span>
                </div>
              </div>

              {/* Selección de cuota — OBLIGATORIA */}
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color:'var(--color-text-secondary)' }}>
                  Cuota a pagar <span className="text-red-400">*</span>
                  <span className="ml-2 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                    (obligatorio)
                  </span>
                </label>
                {pendingSchedule.length === 0 ? (
                  <div className="p-3 rounded-lg text-sm text-center"
                    style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981' }}>
                    ✓ Todas las cuotas de este contrato están pagadas
                  </div>
                ) : (
                  <select value={form.schedule_id} onChange={e => handleScheduleSelect(e.target.value)}
                    className="input text-sm"
                    style={{ borderColor: !form.schedule_id ? 'rgba(239,68,68,0.5)' : undefined }}>
                    <option value="">— Seleccionar cuota —</option>
                    {pendingSchedule.map(s => {
                      const paid    = parseFloat(s.paid_amount||0);
                      const total   = parseFloat(s.amount);
                      const remain  = total - paid;
                      const isPart  = paid > 0 && paid < total;
                      return (
                        <option key={s.id} value={s.id}>
                          Cuota #{s.installment_number}
                          {' · '}Vence: {s.due_date ? format(new Date(s.due_date),'dd/MM/yyyy') : '—'}
                          {' · '}{isPart ? `Pendiente: ${formatCurrency(remain)} (pagado ${formatCurrency(paid)} de ${formatCurrency(total)})` : formatCurrency(total)}
                          {isPart ? ' ⚡ PARCIAL' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* Info de la cuota seleccionada */}
                {selectedSchedule && (
                  <div className="mt-2 p-2.5 rounded-lg text-xs grid grid-cols-3 gap-2"
                    style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)' }}>
                    <div className="text-center">
                      <p style={{ color:'var(--color-text-muted)' }}>Total cuota</p>
                      <p className="font-bold" style={{ color:'var(--color-text-primary)' }}>
                        {formatCurrency(cuotaTotal)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p style={{ color:'var(--color-text-muted)' }}>Ya pagado</p>
                      <p className="font-bold" style={{ color: paidSoFar > 0 ? '#f59e0b' : 'var(--color-text-muted)' }}>
                        {formatCurrency(paidSoFar)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p style={{ color:'var(--color-text-muted)' }}>Pendiente</p>
                      <p className="font-bold" style={{ color:'#ef4444' }}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha y monto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color:'var(--color-text-secondary)' }}>
                    Fecha <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.payment_date}
                    onChange={e => set('payment_date',e.target.value)} className="input text-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color:'var(--color-text-secondary)' }}>
                    Monto (COP) <span className="text-red-400">*</span>
                  </label>
                  <input type="number" value={form.amount}
                    onChange={e => set('amount',e.target.value)}
                    className="input text-sm" min="1" step="1000"
                    placeholder={remaining > 0 ? String(Math.round(remaining)) : '0'}/>
                </div>
              </div>

              {/* Indicador de pago parcial / excedente */}
              {form.schedule_id && pago > 0 && (
                <div className="p-2.5 rounded-lg text-xs font-medium"
                  style={{
                    background: isOverpay ? 'rgba(245,158,11,0.08)' : isPartial ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)',
                    border: `1px solid ${isOverpay ? 'rgba(245,158,11,0.25)' : isPartial ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)'}`,
                    color:  isOverpay ? '#f59e0b' : isPartial ? '#60a5fa' : '#10b981',
                  }}>
                  {isOverpay
                    ? `⚡ Excedente de ${formatCurrency(afterPay - cuotaTotal)} → se abonará a la siguiente cuota`
                    : isPartial
                    ? `⏳ Pago parcial — Quedan ${formatCurrency(remaining - pago)} por pagar en esta cuota`
                    : `✓ Cuota ${selectedSchedule?.installment_number} quedará completamente pagada`}
                </div>
              )}

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color:'var(--color-text-secondary)' }}>
                  Método <span className="text-red-400">*</span>
                </label>
                <select value={form.payment_method}
                  onChange={e => set('payment_method',e.target.value)} className="input text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Banco y referencia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color:'var(--color-text-secondary)' }}>Banco / Entidad</label>
                  <input value={form.bank_name}
                    onChange={e => set('bank_name',e.target.value)}
                    className="input text-sm" placeholder="Bancolombia"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color:'var(--color-text-secondary)' }}>Referencia</label>
                  <input value={form.bank_reference}
                    onChange={e => set('bank_reference',e.target.value)}
                    className="input text-sm" placeholder="TRF-123456"/>
                </div>
              </div>

              {/* N° Recibo — automático */}
              <div className="p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)' }}>
                <Info size={14} className="text-emerald-400 flex-shrink-0"/>
                <span style={{ color:'var(--color-text-secondary)' }}>
                  El número de recibo se genera automáticamente: <strong style={{ color:'#10b981' }}>PA-XXXX</strong>
                </span>
              </div>

              {/* Comprobante (archivo) */}
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color:'var(--color-text-secondary)' }}>
                  Comprobante de pago
                  <span className="ml-2 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                    (PDF, JPG o PNG — máx 10 MB)
                  </span>
                </label>
                <div
                  className="relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
                  style={{
                    borderColor: uploadFile ? 'rgba(16,185,129,0.5)' : 'var(--color-border)',
                    background:  uploadFile ? 'rgba(16,185,129,0.05)' : 'var(--color-bg-primary)',
                  }}
                  onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setUploadFile(e.target.files[0] || null)}/>
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <Paperclip size={16} className="text-emerald-400"/>
                      <span className="text-sm font-medium" style={{ color:'#10b981' }}>
                        {uploadFile.name}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); setUploadFile(null); fileInputRef.current.value=''; }}
                        className="ml-2 text-red-400 hover:text-red-300">
                        <X size={14}/>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Paperclip size={20} className="mx-auto mb-1" style={{ color:'var(--color-text-muted)' }}/>
                      <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
                        Clic para seleccionar comprobante
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color:'var(--color-text-secondary)' }}>Observaciones</label>
                <textarea value={form.notes} onChange={e => set('notes',e.target.value)}
                  className="input text-sm resize-none w-full" rows={2}
                  placeholder="Observaciones del pago..."/>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setStep(1); setContract(null); setSearch(''); }}
                  className="btn btn-secondary flex-1 text-sm">
                  ← Cambiar contrato
                </button>
                <button onClick={handleSubmit}
                  disabled={saving || !form.schedule_id || pendingSchedule.length === 0}
                  className="btn btn-primary flex-1 text-sm">
                  <Save size={14}/> {saving ? 'Registrando...' : 'Registrar Pago'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const PaymentsPage = () => {
  const queryClient = useQueryClient();
  const [tab,       setTab]       = useState('payments');
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: paymentsData, refetch, isFetching } = useQuery({
    queryKey: ['payments', search],
    queryFn:  () => paymentsService.getAll({ search }),
  });

  const { data: overdueData } = useQuery({
    queryKey: ['payments-overdue'],
    queryFn:  () => paymentsService.getOverdue(),
  });

  const payments = paymentsData?.data?.data || [];
  const overdue  = overdueData?.data?.data  || [];

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['payments'] });
    queryClient.invalidateQueries({ queryKey:['contracts'] });
    queryClient.invalidateQueries({ queryKey:['dashboard-kpis'] });
    refetch();
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {showModal && (
        <PaymentModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>Pagos</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Registro y seguimiento de cartera
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const wb = XLSX.utils.book_new();
              const fm = v => parseFloat(v||0);
              // Hoja 1: Pagos recibidos
              const payRows = [['Recibo','Contrato','Cliente','Fecha Pago','Monto','Método','Registrado por']];
              payments.forEach(p => payRows.push([
                p.receipt_number||'',
                p.contract_number||'',
                p.client_name||'',
                p.payment_date ? format(new Date(p.payment_date),'dd/MM/yyyy') : '',
                fm(p.amount),
                p.payment_method||'',
                p.recorded_by_name||'',
              ]));
              payRows.push(['','','','TOTAL', payments.reduce((s,p)=>s+fm(p.amount),0),'','']);
              const ws1 = XLSX.utils.aoa_to_sheet(payRows);
              ws1['!cols'] = [12,16,22,14,16,14,18].map(w=>({wch:w}));
              XLSX.utils.book_append_sheet(wb, ws1, 'Pagos Recibidos');

              // Hoja 2: Cartera vencida (mora)
              if (overdue.length > 0) {
                const overdueRows = [['Contrato','Cliente','Teléfono','Proyecto','Asesor','Cuota','Monto','Vencimiento','Días Mora']];
                overdue.forEach(o => overdueRows.push([
                  o.contract_number||'',
                  o.client_name||'',
                  o.client_phone||'',
                  o.project_name||'',
                  o.advisor_name||'',
                  o.installment_number||'',
                  fm(o.amount),
                  o.due_date ? format(new Date(o.due_date),'dd/MM/yyyy') : '',
                  o.days_overdue||0,
                ]));
                overdueRows.push(['','','','','','','TOTAL MORA', overdue.reduce((s,o)=>s+fm(o.amount),0),'']);
                const ws2 = XLSX.utils.aoa_to_sheet(overdueRows);
                ws2['!cols'] = [16,22,14,18,18,8,16,14,10].map(w=>({wch:w}));
                XLSX.utils.book_append_sheet(wb, ws2, 'Cartera Vencida');
              }
              XLSX.writeFile(wb, `Pagos_${format(new Date(),'yyyyMMdd_HHmm')}.xlsx`);
            }}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            style={{ color:'#10b981', borderColor:'rgba(16,185,129,0.3)' }}>
            ⬇ Exportar Excel
          </button>
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14}/> Registrar Pago
          </button>
        </div>
      </div>

      {/* Alerta mora */}
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="font-semibold text-sm text-red-400">
              {overdue.length} cuota{overdue.length>1?'s':''} en mora
            </p>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {overdue.slice(0,3).map(o => `${o.client_name} (${o.days_overdue} días)`).join(' · ')}
              {overdue.length > 3 && ` · y ${overdue.length-3} más`}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background:'var(--color-bg-secondary)' }}>
        {[['payments','Pagos recibidos'],['overdue','Cartera vencida']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded text-sm font-medium transition-all"
            style={{
              background: tab===key ? 'var(--color-brand-600)' : 'transparent',
              color:      tab===key ? 'white' : 'var(--color-text-muted)',
            }}>
            {label}
            {key==='overdue' && overdue.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">
                {overdue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Pagos */}
      {tab === 'payments' && (
        <>
          <div className="card p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color:'var(--color-text-muted)' }}/>
              <input placeholder="Buscar por contrato, cliente o recibo (PA-XXXX)..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 text-sm" style={{ height:'36px' }}/>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="card flex flex-col items-center py-16 gap-4">
              <CreditCard size={48} style={{ color:'var(--color-text-muted)' }}/>
              <div className="text-center">
                <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
                  No hay pagos registrados
                </p>
                <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
                  Usa el botón "Registrar Pago" para añadir el primer pago
                </p>
              </div>
              <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
                <Plus size={14}/> Registrar Pago
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Recibo</th>
                    <th>Contrato</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th>Por</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td className="font-mono text-sm font-bold"
                        style={{ color:'#10b981', whiteSpace:'nowrap' }}>
                        {p.receipt_number || '—'}
                      </td>
                      <td className="font-mono text-sm"
                        style={{ color:'var(--color-text-accent)' }}>
                        {p.contract_number}
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-primary)' }}>
                        {p.client_name}
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                        {p.payment_date ? format(new Date(p.payment_date),'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="text-sm font-mono font-bold text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                      <td>
                        <span className="badge badge-activo text-xs">{p.payment_method}</span>
                      </td>
                      <td className="text-sm font-mono" style={{ color:'var(--color-text-muted)' }}>
                        {p.bank_reference || '—'}
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                        {p.recorded_by_name || '—'}
                      </td>
                      <td>
                        <div className="flex gap-1 items-center">
                          {Array.isArray(p.documents) && p.documents.length > 0 ? (
                            p.documents.map((doc,di) => (
                              <a key={di} href={`${doc.url}`} target="_blank" rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm" title={doc.filename}
                                style={{ color:'#60a5fa' }}>
                                <ExternalLink size={13}/>
                              </a>
                            ))
                          ) : (
                            <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab Cartera vencida */}
      {tab === 'overdue' && (
        <div className="table-container">
          {overdue.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400"/>
              <p style={{ color:'var(--color-text-secondary)' }}>
                ¡Sin cartera vencida! Todos los pagos están al día.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contrato</th><th>Cliente</th><th>Teléfono</th>
                  <th>Proyecto</th><th>Cuota #</th><th>Vencimiento</th>
                  <th>Monto</th><th>Días mora</th><th>Asesor</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-sm" style={{ color:'var(--color-text-accent)' }}>
                      {o.contract_number}
                    </td>
                    <td className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                      {o.client_name}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {o.client_phone || '—'}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {o.project_name || '—'}
                    </td>
                    <td className="text-sm text-center" style={{ color:'var(--color-text-secondary)' }}>
                      {o.installment_number}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                      {o.due_date ? format(new Date(o.due_date),'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="text-sm font-mono" style={{ color:'#ef4444' }}>
                      {formatCurrency(o.amount)}
                    </td>
                    <td><span className="badge badge-en_mora">{o.days_overdue} días</span></td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {o.advisor_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;