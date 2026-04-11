// src/pages/Contracts/ContractDetailPage.jsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, User, Home, CreditCard, Shield,
  Calendar, DollarSign, CheckCircle, Clock, AlertTriangle,
  RefreshCw, Plus, X, Save, Paperclip, Info, Upload, ExternalLink, Edit, Download
} from 'lucide-react';
import { contractsService } from '../../services/api.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'https://back.inmogestpro.com';
const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const STATUS_CONFIG = {
  activo:       { label:'Activo',       color:'#10b981', bg:'rgba(16,185,129,0.1)' },
  cancelado:    { label:'Cancelado',    color:'#ef4444', bg:'rgba(239,68,68,0.1)'  },
  escriturado:  { label:'Escriturado',  color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
  en_mora:      { label:'En Mora',      color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
  refinanciado: { label:'Refinanciado', color:'#a855f7', bg:'rgba(168,85,247,0.1)' },
};

const PAYMENT_METHODS = [
  { value:'transferencia', label:'Transferencia' },
  { value:'pse',           label:'PSE'           },
  { value:'efectivo',      label:'Efectivo'      },
  { value:'cheque',        label:'Cheque'        },
  { value:'tarjeta',       label:'Tarjeta'       },
];

const InfoBlock = ({ label, value, mono, extra }) => (
  <div>
    <p className="text-xs mb-0.5" style={{ color:'var(--color-text-muted)' }}>{label}</p>
    <p className={`text-sm font-medium ${mono?'font-mono':''}`}
      style={{ color:'var(--color-text-primary)' }}>{value||'—'}</p>
    {extra && <div className="mt-0.5">{extra}</div>}
  </div>
);

const SectionCard = ({ title, icon:Icon, children }) => (
  <div className="card">
    <div className="flex items-center gap-2 mb-4 pb-3"
      style={{ borderBottom:'1px solid var(--color-border)' }}>
      <Icon size={16} style={{ color:'var(--color-text-accent)' }}/>
      <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>{title}</h3>
    </div>
    {children}
  </div>
);

// Subir comprobante
const uploadPaymentFile = async (tenant, paymentId, file) => {
  const fd    = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('inmogest_token');
  const apiBase = () => `${API_URL}/api/v1/${tenant}`;
  const res   = await fetch(`${apiBase()}/payments/${paymentId}/upload`, {
    method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd,
  });
  return res.json();
};

// ── Modal Registrar Pago (desde detalle del contrato) ─────────
const PaymentModal = ({ contract, schedule, onClose, onSaved }) => {
  const [saving,     setSaving]     = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef();
  const { tenant }     = useParams();

  const pendingSchedule = (schedule||[]).filter(s => s.status !== 'pagado' && s.status !== 'condonado');

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

  const handleScheduleSelect = (sid) => {
    set('schedule_id', sid);
    if (sid) {
      const s = pendingSchedule.find(p => p.id === sid);
      if (s) {
        const remaining = parseFloat(s.amount) - parseFloat(s.paid_amount||0);
        set('amount', String(Math.round(remaining)));
      }
    }
  };

  // Indicador en tiempo real
  const selected     = pendingSchedule.find(s => s.id === form.schedule_id);
  const paidSoFar    = parseFloat(selected?.paid_amount||0);
  const cuotaTotal   = parseFloat(selected?.amount||0);
  const remaining    = cuotaTotal - paidSoFar;
  const pago         = parseFloat(form.amount||0);
  const afterPay     = paidSoFar + pago;
  const isOverpay    = afterPay > cuotaTotal && cuotaTotal > 0;
  const isFullPay    = afterPay >= cuotaTotal && cuotaTotal > 0;
  const isPartialPay = pago > 0 && !isFullPay && cuotaTotal > 0;

  const handleSubmit = async () => {
    if (!form.schedule_id) return toast.error('Debe seleccionar la cuota a pagar');
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!form.payment_date)   return toast.error('La fecha es requerida');
    if (!form.payment_method) return toast.error('El método de pago es requerido');

    setSaving(true);
    try {
      const res = await contractsService.addPayment(contract.id, {
        payment_date:   form.payment_date,
        amount:         parseFloat(form.amount),
        payment_method: form.payment_method,
        bank_reference: form.bank_reference||null,
        bank_name:      form.bank_name||null,
        schedule_id:    form.schedule_id,
        notes:          form.notes||null,
      });

      const paymentId  = res.data?.data?.id;
      const receiptNum = res.data?.data?.receipt_number;
      const cuotasPagadas = res.data?.data?.cuotas_pagadas || [];

      // Subir comprobante si se seleccionó
      if (uploadFile && paymentId) {
        try {
          await uploadPaymentFile(tenant, paymentId, uploadFile);
        } catch {
          toast.error('Pago registrado pero falló la subida del comprobante');
        }
      }

      let msg = `${receiptNum} registrado`;
      if (cuotasPagadas.length > 1)
        msg += ` — ${cuotasPagadas.length} cuotas pagadas (${cuotasPagadas.join(', ')})`;
      else if (res.data?.data?.is_partial)
        msg += ' — Pago parcial registrado';

      toast.success(msg, { duration:5000 });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10"
          style={{ borderColor:'var(--color-border)', background:'var(--color-bg-card)' }}>
          <div>
            <h2 className="font-bold" style={{ color:'var(--color-text-primary)' }}>Registrar Pago</h2>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {contract?.contract_number} · {contract?.client_name}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4">

          {/* Cuota — OBLIGATORIA */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color:'var(--color-text-secondary)' }}>
              Cuota a pagar <span className="text-red-400">*</span>
            </label>
            {pendingSchedule.length === 0 ? (
              <div className="p-3 rounded-lg text-sm text-center"
                style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981' }}>
                ✓ Todas las cuotas de este contrato están pagadas
              </div>
            ) : (
              <select value={form.schedule_id} onChange={e => handleScheduleSelect(e.target.value)}
                className="input text-sm"
                style={{ borderColor:!form.schedule_id ? 'rgba(239,68,68,0.5)' : undefined }}>
                <option value="">— Seleccionar cuota —</option>
                {pendingSchedule.map(s => {
                  const paid    = parseFloat(s.paid_amount||0);
                  const total   = parseFloat(s.amount);
                  const isPart  = paid > 0;
                  const remain  = total - paid;
                  return (
                    <option key={s.id} value={s.id}>
                      {`Cuota #${s.installment_number} · ${s.due_date?format(new Date(s.due_date),'dd/MM/yyyy'):'—'} · `}
                      {isPart
                        ? `Pendiente: ${formatCurrency(remain)} (abonado ${formatCurrency(paid)})`
                        : formatCurrency(total)}
                      {isPart ? ' ⚡ PARCIAL' : ''}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Info de la cuota seleccionada */}
            {selected && (
              <div className="mt-2 p-2.5 rounded-lg text-xs grid grid-cols-3 gap-2"
                style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)' }}>
                <div className="text-center">
                  <p style={{ color:'var(--color-text-muted)' }}>Total cuota</p>
                  <p className="font-bold" style={{ color:'var(--color-text-primary)' }}>{formatCurrency(cuotaTotal)}</p>
                </div>
                <div className="text-center">
                  <p style={{ color:'var(--color-text-muted)' }}>Ya pagado</p>
                  <p className="font-bold" style={{ color:paidSoFar>0?'#f59e0b':'var(--color-text-muted)' }}>
                    {formatCurrency(paidSoFar)}
                  </p>
                </div>
                <div className="text-center">
                  <p style={{ color:'var(--color-text-muted)' }}>Pendiente</p>
                  <p className="font-bold" style={{ color:'#ef4444' }}>{formatCurrency(remaining)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Fecha y monto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color:'var(--color-text-secondary)' }}>
                Fecha real del pago <span className="text-red-400">*</span>
              </label>
              <input type="date" value={form.payment_date}
                onChange={e => set('payment_date',e.target.value)} className="input text-sm"/>
              <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                Puedes poner una fecha anterior si el pago fue días atrás
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color:'var(--color-text-secondary)' }}>
                Monto <span className="text-red-400">*</span>
              </label>
              <input type="number" value={form.amount}
                onChange={e => set('amount',e.target.value)}
                className="input text-sm" min="1" step="1000"/>
            </div>
          </div>

          {/* Indicador parcial / completo / excedente */}
          {form.schedule_id && pago > 0 && (
            <div className="p-2.5 rounded-lg text-xs font-medium"
              style={{
                background: isOverpay  ? 'rgba(245,158,11,0.08)' : isPartialPay ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)',
                border:`1px solid ${isOverpay?'rgba(245,158,11,0.25)':isPartialPay?'rgba(59,130,246,0.25)':'rgba(16,185,129,0.25)'}`,
                color: isOverpay?'#f59e0b':isPartialPay?'#60a5fa':'#10b981',
              }}>
              {isOverpay
                ? `⚡ Excedente de ${formatCurrency(afterPay-cuotaTotal)} → se abonará en cascada a cuotas siguientes`
                : isPartialPay
                ? `⏳ Pago parcial — faltan ${formatCurrency(remaining-pago)} para completar esta cuota`
                : `✓ Cuota #${selected?.installment_number} quedará completamente pagada`}
            </div>
          )}

          {/* Método */}
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
                style={{ color:'var(--color-text-secondary)' }}>Banco</label>
              <input value={form.bank_name} onChange={e=>set('bank_name',e.target.value)}
                className="input text-sm" placeholder="Bancolombia"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color:'var(--color-text-secondary)' }}>Referencia</label>
              <input value={form.bank_reference} onChange={e=>set('bank_reference',e.target.value)}
                className="input text-sm" placeholder="TRF-123456"/>
            </div>
          </div>

          {/* Recibo automático */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
            style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)' }}>
            <Info size={13} className="text-emerald-400 flex-shrink-0"/>
            <span style={{ color:'var(--color-text-secondary)' }}>
              Número de recibo generado automáticamente: <strong style={{ color:'#10b981' }}>PA-XXXX</strong>
            </span>
          </div>

          {/* Comprobante */}
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color:'var(--color-text-secondary)' }}>
              Comprobante de pago
              <span className="ml-2 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                (PDF, JPG o PNG — máx 10 MB)
              </span>
            </label>
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
              style={{
                borderColor: uploadFile ? 'rgba(16,185,129,0.5)' : 'var(--color-border)',
                background:  uploadFile ? 'rgba(16,185,129,0.05)' : 'var(--color-bg-primary)',
              }}
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => setUploadFile(e.target.files[0]||null)}/>
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  <Paperclip size={15} className="text-emerald-400"/>
                  <span className="text-sm font-medium" style={{ color:'#10b981' }}>{uploadFile.name}</span>
                  <button onClick={e=>{ e.stopPropagation(); setUploadFile(null); fileRef.current.value=''; }}
                    className="ml-2 text-red-400 hover:text-red-300">
                    <X size={13}/>
                  </button>
                </div>
              ) : (
                <div>
                  <Paperclip size={18} className="mx-auto mb-1" style={{ color:'var(--color-text-muted)' }}/>
                  <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
                    Clic para adjuntar comprobante
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color:'var(--color-text-secondary)' }}>Observaciones</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
              className="input text-sm resize-none w-full" rows={2}
              placeholder="Observaciones del pago..."/>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSubmit}
              disabled={saving || !form.schedule_id || pendingSchedule.length===0}
              className="btn btn-primary flex-1">
              <Save size={14}/> {saving ? 'Guardando...' : 'Registrar Pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────


const ContractDetailPage = () => {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();
  const { hasRole }    = useAuthStore();
  const { tenant }     = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const apiBase = () => `${API_URL}/api/v1/${tenant}`;
  const canPay         = hasRole('admin','gerente','contador');
  const canUpload      = hasRole('admin','gerente','contador','asesor');
  const [showPayModal, setShowPayModal] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['contract', id],
    queryFn:  () => contractsService.getById(id),
  });

  const d                = data?.data?.data;
  const contract         = d?.contract;
  const payment_schedule = d?.payment_schedule || [];
  const allProperties    = d?.all_properties  || [];
  const payments         = d?.payments         || [];

  const handlePaymentSaved = () => {
    queryClient.invalidateQueries({ queryKey:['contract', id] });
    queryClient.invalidateQueries({ queryKey:['payments'] });
    queryClient.invalidateQueries({ queryKey:['dashboard-kpis'] });
    refetch();
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 gap-3"
      style={{ color:'var(--color-text-muted)' }}>
      <RefreshCw size={20} className="animate-spin"/>
      <span>Cargando contrato...</span>
    </div>
  );

  if (!contract) return (
    <div className="card flex flex-col items-center py-16 gap-3">
      <FileText size={40} style={{ color:'var(--color-text-muted)' }}/>
      <p style={{ color:'var(--color-text-secondary)' }}>Contrato no encontrado</p>
      <button onClick={() => navigate(to('contracts'))} className="btn btn-secondary btn-sm">
        <ArrowLeft size={14}/> Volver
      </button>
    </div>
  );

  const totalPaid   = payments.reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const paidCount   = payment_schedule.filter(p => p.status==='pagado').length;
  const netValue    = parseFloat(contract.net_value  || 0);
  const totalValue  = parseFloat(contract.total_value|| 0);
  const discount    = parseFloat(contract.discount   || 0);
  const progressPct = netValue > 0 ? Math.min(Math.round((totalPaid / netValue) * 100), 100) : 0;
  const statusCfg   = STATUS_CONFIG[contract.status] || { label:contract.status, color:'#94a3b8', bg:'rgba(148,163,184,0.1)' };

  return (
    <div className="space-y-5 animate-fade-in">
      {showPayModal && (
        <PaymentModal
          contract={contract}
          schedule={payment_schedule}
          onClose={() => setShowPayModal(false)}
          onSaved={handlePaymentSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(to('contracts'))} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono"
                style={{ color:'var(--color-text-accent)' }}>
                {contract.contract_number}
              </h1>
              <span className="badge"
                style={{ background:statusCfg.bg, color:statusCfg.color }}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Firmado el {contract.signing_date
                ? format(new Date(contract.signing_date),"d 'de' MMMM yyyy",{locale:es}) : '—'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching?'animate-spin':''}/>
          </button>
          {hasRole('admin','gerente','contador') && contract.status !== 'cancelado' && (
            <button onClick={() => navigate(to(`contracts/${id}/edit`))}
              className="btn btn-secondary btn-sm">
              <Edit size={14}/> Editar
            </button>
          )}
          {canPay && contract.status === 'activo' && (
            <button onClick={() => setShowPayModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14}/> Registrar Pago
            </button>
          )}
        </div>
      </div>

      {/* Barra progreso */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color:'var(--color-text-secondary)' }}>
            {paidCount} de {contract.installments_total} cuotas pagadas
          </span>
          <span className="text-sm font-bold"
            style={{ color:progressPct>=100?'#10b981':'#3b82f6' }}>
            {progressPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background:'var(--color-bg-primary)' }}>
          <div className="h-2 rounded-full transition-all" style={{
            width:`${progressPct}%`,
            background:progressPct>=100?'#10b981':'linear-gradient(90deg,#2563eb,#3b82f6)',
          }}/>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs"
          style={{ color:'var(--color-text-muted)' }}>
          <span>Recaudado: <strong style={{ color:'#10b981' }}>{formatCurrency(totalPaid)}</strong></span>
          <span>Pendiente: <strong style={{ color:'#f59e0b' }}>{formatCurrency(netValue - totalPaid)}</strong></span>
          <span>Total neto: <strong>{formatCurrency(netValue)}</strong></span>
        </div>
        {discount > 0 && (
          <div className="mt-2 text-xs text-center"
            style={{ color:'#a78bfa' }}>
            🎁 Descuento aplicado: <strong>{formatCurrency(discount)}</strong>
            {' '}· Precio original: <strong>{formatCurrency(totalValue)}</strong>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Cliente" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Nombre completo"  value={contract.client_name}/>
            <InfoBlock label="Documento"         value={`${contract.document_type||''} ${contract.document_number||''}`}/>
            <InfoBlock label="Teléfono"          value={contract.client_phone}/>
            <InfoBlock label="Correo"            value={contract.client_email}/>
          </div>
        </SectionCard>
        <SectionCard title={`Inmueble${allProperties.length > 1 ? 's' : ''}`} icon={Home}>
          {allProperties.length > 1 ? (
            <div className="space-y-3">
              {allProperties.map((prop, i) => (
                <div key={prop.id || i} className="p-3 rounded-xl"
                  style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa' }}>
                      Inmueble {i + 1}
                    </span>
                    <span className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
                      {prop.project_name} · {prop.unit_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoBlock label="Tipo"  value={prop.property_type}/>
                    <InfoBlock label="Área"  value={prop.m2_construction ? `${prop.m2_construction} m²` : '—'}/>
                    {prop.bedrooms > 0 && <InfoBlock label="Alcobas" value={prop.bedrooms}/>}
                    {prop.bathrooms > 0 && <InfoBlock label="Baños"  value={prop.bathrooms}/>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock label="Proyecto"  value={contract.project_name}/>
              <InfoBlock label="Unidad"    value={contract.property_unit}/>
              <InfoBlock label="Tipo"      value={contract.property_type}/>
              <InfoBlock label="Área"      value={contract.m2_construction ? `${contract.m2_construction} m²` : '—'}/>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Condiciones Financieras" icon={DollarSign}>
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Valor total"   value={formatCurrency(contract.total_value)} mono/>
            {discount > 0 && (
              <InfoBlock label="Descuento aplicado"
                value={`- ${formatCurrency(discount)}`} mono
                extra={<span style={{ color:'#a78bfa', fontSize:'11px' }}>
                  {totalValue > 0 ? Math.round(discount/totalValue*100) : 0}% de descuento
                </span>}/>
            )}
            <InfoBlock label={discount > 0 ? "Valor neto (con descuento)" : "Valor neto"}
              value={formatCurrency(contract.net_value)} mono/>
            {parseFloat(contract.down_payment||0) > 0 && (
              <InfoBlock label="Cuota inicial pactada"
                value={formatCurrency(contract.down_payment)} mono
                extra={<span style={{ color:'#10b981', fontSize:'11px' }}>
                  Incluida en el valor neto
                </span>}/>
            )}
            <InfoBlock label="Tipo de pago"  value={contract.payment_type}/>
            <InfoBlock label="Cuotas"        value={`${contract.installments_total} × ${formatCurrency(contract.installment_amount)}`} mono/>
          </div>
        </SectionCard>
        <SectionCard title="Asesor y Fechas" icon={Calendar}>
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Asesor"        value={contract.advisor_name}/>
            <InfoBlock label="Fecha firma"   value={contract.signing_date?format(new Date(contract.signing_date),'dd/MM/yyyy'):'—'}/>
            <InfoBlock label="Registrado por" value={contract.created_by_name}/>
            <InfoBlock label="Estado"        value={statusCfg.label}/>
          </div>
        </SectionCard>
      </div>

      {/* Hash no repudio + Documentos del contrato */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4" style={{ borderColor:'rgba(59,130,246,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={15} className="text-blue-400"/>
            <span className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
              Integridad del Contrato
            </span>
          </div>
          <p className="font-mono text-xs break-all" style={{ color:'#60a5fa' }}>
            {contract.contract_hash||'—'}
          </p>
        </div>

        {/* Documentos escaneados */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color:'var(--color-text-accent)' }}/>
              <span className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                Documentos del Contrato
              </span>
            </div>
            {canUpload && (
              <label className="btn btn-secondary btn-sm cursor-pointer text-xs">
                <Upload size={12}/> Subir
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    try {
                      const token = localStorage.getItem('inmogest_token');
                      const res = await fetch(`${apiBase()}/contracts/${id}/upload`, {
                        method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd,
                      });
                      const json = await res.json();
                      if (json.success) {
                        toast.success('Documento subido correctamente');
                        refetch();
                      } else { toast.error(json.message||'Error al subir'); }
                    } catch { toast.error('Error al subir el documento'); }
                    e.target.value = '';
                  }}/>
              </label>
            )}
          </div>
          {(!contract.documents || contract.documents.length === 0) ? (
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              Sin documentos adjuntos. Sube el contrato escaneado y firmado.
            </p>
          ) : (
            <div className="space-y-2">
              {(contract.documents||[]).map((doc,i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{ border:'1px solid var(--color-border)' }}>
                  <Paperclip size={12} style={{ color:'#60a5fa', flexShrink:0 }}/>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 truncate hover:underline" style={{ color:'#60a5fa' }}>
                    {doc.filename}
                  </a>
                  <a href={`${doc.url}`} target="_blank" rel="noopener noreferrer"
                    style={{ color:'var(--color-text-muted)' }}>
                    <ExternalLink size={11}/>
                  </a>
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Eliminar "${doc.filename}"?`)) return;
                      try {
                        const token = localStorage.getItem('inmogest_token');
                        const res = await fetch(`${apiBase()}/contracts/${contract.id}/documents/${i}`, {
                          method:'DELETE', headers:{ Authorization:`Bearer ${token}` }
                        });
                        const json = await res.json();
                        if (json.success) { toast.success('Documento eliminado'); refetch(); }
                        else toast.error(json.message || 'Error al eliminar');
                      } catch { toast.error('Error al eliminar'); }
                    }}
                    className="flex-shrink-0 hover:text-red-400 transition-colors"
                    title="Eliminar documento"
                    style={{ color:'var(--color-text-muted)' }}>
                    <X size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plan de pagos */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor:'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <CreditCard size={16} style={{ color:'var(--color-text-accent)' }}/>
            <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
              Plan de Pagos
              <span className="ml-2 text-xs font-normal"
                style={{ color:'var(--color-text-muted)' }}>
                ({payment_schedule.length} cuotas)
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {payment_schedule.length > 0 && (
              <button
                onClick={() => {
                  const wb = XLSX.utils.book_new();

                  // Hoja 1: Plan de cuotas
                  const scheduleRows = [
                    ['#','Vencimiento','Monto','Estado','Abonado','Saldo','Fecha Pago']
                  ];
                  payment_schedule.forEach(ps => {
                    const paid  = parseFloat(ps.paid_amount||0);
                    const total = parseFloat(ps.amount||0);
                    const isOverdue = (ps.status==='en_mora' || ps.status==='pendiente') &&
                      ps.due_date && new Date(ps.due_date) < new Date();
                    scheduleRows.push([
                      ps.installment_number,
                      ps.due_date ? format(new Date(ps.due_date),'dd/MM/yyyy') : '',
                      total,
                      ps.status==='pagado' ? 'Pagado'
                        : isOverdue ? 'En mora'
                        : ps.status==='condonado' ? 'Condonado'
                        : paid > 0 ? `Parcial (${Math.round(paid/total*100)}%)`
                        : 'Pendiente',
                      paid,
                      total - paid,
                      ps.paid_date ? format(new Date(ps.paid_date),'dd/MM/yyyy') : '',
                    ]);
                  });
                  // Totales
                  const totalPaidPS = payment_schedule.reduce((s,ps) => s+parseFloat(ps.paid_amount||0),0);
                  const totalAmtPS  = payment_schedule.reduce((s,ps) => s+parseFloat(ps.amount||0),0);
                  scheduleRows.push(['','','','TOTAL', totalPaidPS, totalAmtPS-totalPaidPS, '']);

                  const ws1 = XLSX.utils.aoa_to_sheet(scheduleRows);
                  ws1['!cols'] = [4,14,18,14,14,14,14].map(w => ({wch:w}));
                  XLSX.utils.book_append_sheet(wb, ws1, 'Plan de Cuotas');

                  // Hoja 2: Pagos recibidos
                  const payRows = [
                    ['Recibo','Fecha','Monto','Método','Banco/Ref','Registrado por']
                  ];
                  payments.forEach(p => {
                    payRows.push([
                      p.receipt_number || '',
                      p.payment_date ? format(new Date(p.payment_date),'dd/MM/yyyy') : '',
                      parseFloat(p.amount||0),
                      p.payment_method || '',
                      p.bank_reference || p.bank_name || '',
                      p.recorded_by_name || '',
                    ]);
                  });
                  const totalPayments = payments.reduce((s,p) => s+parseFloat(p.amount||0),0);
                  payRows.push(['','','TOTAL RECAUDADO', totalPayments,'','']);

                  const ws2 = XLSX.utils.aoa_to_sheet(payRows);
                  ws2['!cols'] = [12,12,16,14,18,18].map(w => ({wch:w}));
                  XLSX.utils.book_append_sheet(wb, ws2, 'Pagos Recibidos');

                  // Hoja 3: Resumen del contrato
                  const summary = [
                    ['Campo','Valor'],
                    ['Contrato',       contract.contract_number],
                    ['Cliente',        contract.client_name],
                    ['Proyecto',       contract.project_name],
                    ['Unidad',         contract.property_unit],
                    ['Asesor',         contract.advisor_name||'Sin asesor'],
                    ['Tipo pago',      contract.payment_type],
                    ['Estado',         contract.status],
                    ['Fecha firma',    contract.signing_date ? format(new Date(contract.signing_date),'dd/MM/yyyy') : ''],
                    ['Valor total',    parseFloat(contract.total_value||0)],
                    ['Valor neto',     parseFloat(contract.net_value||0)],
                    ['Total recaudado',payments.reduce((s,p)=>s+parseFloat(p.amount||0),0)],
                    ['Saldo pendiente',parseFloat(contract.net_value||0)-payments.reduce((s,p)=>s+parseFloat(p.amount||0),0)],
                    ['Cuotas pagadas', payment_schedule.filter(p=>p.status==='pagado').length],
                    ['Cuotas en mora', payment_schedule.filter(p=>p.status==='en_mora'||
                      (p.status==='pendiente'&&p.due_date&&new Date(p.due_date)<new Date())).length],
                  ];
                  const ws3 = XLSX.utils.aoa_to_sheet(summary);
                  ws3['!cols'] = [{wch:20},{wch:30}];
                  XLSX.utils.book_append_sheet(wb, ws3, 'Resumen');

                  XLSX.writeFile(wb, `Contrato_${contract.contract_number}_${format(new Date(),'yyyyMMdd')}.xlsx`);
                }}
                className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                style={{ color:'#10b981', borderColor:'rgba(16,185,129,0.3)' }}>
                <Download size={12}/> Exportar
              </button>
            )}
            {canPay && contract.status==='activo' && (
              <button onClick={() => setShowPayModal(true)} className="btn btn-primary btn-sm">
                <Plus size={13}/> Pago
              </button>
            )}
          </div>
        </div>
        {payment_schedule.length===0 ? (
          <div className="p-8 text-center">
            <p className="text-sm mb-3" style={{ color:'var(--color-text-muted)' }}>
              Este contrato no tiene plan de cuotas generado
            </p>
            {canPay && contract.status === 'activo' && (
              <button
                onClick={async () => {
                  try {
                    const res = await contractsService.regenerateSchedule(id);
                    toast.success(res.data?.message || 'Plan de pagos generado');
                    refetch();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Error al generar el plan de pagos');
                  }
                }}
                className="btn btn-primary btn-sm">
                <RefreshCw size={13}/> Generar Plan de Pagos
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Vencimiento</th><th>Monto</th>
                  <th>Estado</th><th>Abonado</th><th>Pendiente</th><th>Fecha Pago</th>
                </tr>
              </thead>
              <tbody>
                {payment_schedule.map(ps => {
                  const paid     = parseFloat(ps.paid_amount||0);
                  const total    = parseFloat(ps.amount||0);
                  const pct      = total > 0 ? Math.min(Math.round(paid/total*100),100) : 0;
                  const isPart   = paid > 0 && ps.status !== 'pagado';
                  // Mora real: vencida y no pagada (aunque el backend aún no la haya marcado)
                  const isOverdue= ps.status === 'en_mora' ||
                    (ps.status === 'pendiente' && ps.due_date &&
                     new Date(ps.due_date) < new Date(new Date().toDateString()) &&
                     ps.status !== 'pagado' && ps.status !== 'condonado');
                  return (
                    <tr key={ps.id}
                      style={{
                        background: isOverdue
                          ? 'rgba(239,68,68,0.07)'
                          : isPart
                          ? 'rgba(245,158,11,0.04)'
                          : undefined,
                        borderLeft: isOverdue
                          ? '4px solid #ef4444'
                          : isPart
                          ? '4px solid #f59e0b'
                          : ps.status==='pagado'
                          ? '4px solid #10b981'
                          : '4px solid transparent',
                      }}>
                      <td className="font-mono text-sm" style={{ color:'var(--color-text-muted)' }}>
                        {String(ps.installment_number).padStart(2,'0')}
                      </td>
                      <td className="text-sm font-medium" style={{
                          color: isOverdue ? '#ef4444' : 'var(--color-text-secondary)',
                          whiteSpace:'nowrap',
                        }}>
                        {ps.due_date?format(new Date(ps.due_date),'dd/MM/yyyy'):'—'}
                        {isOverdue && (
                          <span className="ml-1 text-xs">⚠</span>
                        )}
                      </td>
                      <td className="text-sm font-mono font-medium" style={{
                          color: isOverdue ? '#ef4444' : 'var(--color-text-primary)',
                        }}>
                        {formatCurrency(ps.amount)}
                      </td>
                      <td>
                        {ps.status==='pagado'    ? <span className="badge badge-pagado"><CheckCircle size={11}/> Pagado</span>
                        :ps.status==='condonado' ? <span className="badge badge-cancelado">Condonado</span>
                        :isOverdue               ? <span className="badge badge-en_mora"><AlertTriangle size={11}/> En mora</span>
                        :isPart                  ? <span className="badge badge-pendiente" style={{ color:'#f59e0b' }}><Clock size={11}/> Parcial {pct}%</span>
                        :                          <span className="badge badge-pendiente"><Clock size={11}/> Pendiente</span>}
                      </td>
                      <td className="text-sm font-mono"
                        style={{ color:paid>0?'#10b981':'var(--color-text-muted)' }}>
                        {paid > 0 ? formatCurrency(paid) : '—'}
                      </td>
                      <td className="text-sm font-mono"
                        style={{ color:ps.status==='pagado'?'var(--color-text-muted)':'#ef4444' }}>
                        {ps.status==='pagado' ? '—' : formatCurrency(total-paid)}
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                        {ps.paid_date?format(new Date(ps.paid_date),'dd/MM/yyyy'):'—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagos recibidos */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor:'var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Pagos Recibidos
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
              style={{ background:'rgba(16,185,129,0.1)', color:'#10b981' }}>
              {payments.length}
            </span>
          </h3>
          <span className="text-sm font-mono" style={{ color:'#10b981' }}>
            Total: {formatCurrency(totalPaid)}
          </span>
        </div>
        {payments.length===0 ? (
          <div className="p-8 text-center">
            <CreditCard size={32} className="mx-auto mb-2" style={{ color:'var(--color-text-muted)' }}/>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Sin pagos registrados
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Recibo</th><th>Fecha</th><th>Monto</th><th>Método</th>
                  <th>Banco</th><th>Referencia</th><th>Por</th><th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-sm font-bold" style={{ color:'#10b981' }}>
                      {p.receipt_number||'—'}
                      {p.notes?.includes('Cuota inicial') && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>
                          Inicial
                        </span>
                      )}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                      {p.payment_date?format(new Date(p.payment_date),'dd/MM/yyyy'):'—'}
                    </td>
                    <td className="text-sm font-mono font-bold text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                    <td><span className="badge badge-activo text-xs">{p.payment_method}</span></td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {p.bank_name||'—'}
                    </td>
                    <td className="text-sm font-mono" style={{ color:'var(--color-text-muted)' }}>
                      {p.bank_reference||'—'}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {p.recorded_by_name||'—'}
                    </td>
                    <td>
                      <div className="flex gap-1 items-center">
                        {Array.isArray(p.documents) && p.documents.length > 0 && (
                          p.documents.map((doc,di) => (
                            <a key={di}
                              href={`${doc.url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              title={doc.filename}
                              style={{ color:'#60a5fa' }}>
                              <Paperclip size={13}/>
                            </a>
                          ))
                        )}
                        {/* Subir evidencia */}
                        <label className="btn btn-ghost btn-sm cursor-pointer"
                          title="Subir comprobante"
                          style={{ color:'var(--color-text-muted)' }}>
                          <Upload size={13}/>
                          <input type="file" className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const fd = new FormData();
                              fd.append('file', file);
                              const token = localStorage.getItem('inmogest_token');
                              const res = await fetch(`${apiBase()}/payments/${p.id}/upload`, {
                                method:'POST',
                                headers:{ Authorization:`Bearer ${token}` },
                                body: fd,
                              });
                              const json = await res.json();
                              if (json.success) { toast.success('Comprobante subido'); refetch(); }
                              else toast.error(json.message || 'Error al subir');
                            }}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractDetailPage;