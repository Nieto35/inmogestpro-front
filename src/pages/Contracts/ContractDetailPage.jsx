// src/pages/Contracts/ContractDetailPage.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, User, Home, CreditCard, Shield,
  Calendar, DollarSign, CheckCircle, Clock, AlertTriangle,
  RefreshCw, Plus, X, Save, Paperclip, Info, Upload, ExternalLink, Edit, Download
} from 'lucide-react';
import { contractsService, usersService, configService, paymentsService } from '../../services/api.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'https://back.inmogestpro.com';
const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const STATUS_CONFIG = {
  activo:       { label:'Activo',       color:'var(--color-success)', bg:'var(--color-success-bg)' },
  cancelado:    { label:'Cancelado',    color:'var(--color-danger)',  bg:'var(--color-danger-bg)'  },
  escriturado:  { label:'Escriturado',  color:'var(--color-navy)',    bg:'rgba(13,27,62,0.07)'     },
  en_mora:      { label:'En Mora',      color:'var(--color-warning)', bg:'var(--color-warning-bg)' },
  refinanciado: { label:'Refinanciado', color:'var(--color-gold)',    bg:'rgba(200,168,75,0.1)'    },
};

const PAYMENT_TYPE_LABELS = {
  credito:        'Crédito hipotecario',
  credito_simple: 'Crédito',
  contado:        'Contado',
  leasing:        'Leasing habitacional',
  subsidio:       'Subsidio de vivienda',
  permuta:        'Permuta',
  corto_plazo:    'Corto plazo',
  arriendo:       'Arriendo',
  financiado:     'Financiado',
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
const PaymentModal = ({ tenant, contract, schedule, onClose, onSaved }) => {
  const [saving,     setSaving]     = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef();

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
                style={{ background:'var(--color-success-bg)', border:'1px solid var(--color-success-border)', color:'var(--color-success)' }}>
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
                style={{ background:'rgba(13,27,62,0.04)', border:'1px solid var(--color-border)' }}>
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
                background: isOverpay  ? 'var(--color-warning-bg)' : isPartialPay ? 'rgba(13,27,62,0.04)' : 'var(--color-success-bg)',
                border:`1px solid ${isOverpay?'var(--color-warning-border)':isPartialPay?'var(--color-border)':'var(--color-success-border)'}`,
                color: isOverpay?'var(--color-warning)':isPartialPay?'var(--color-navy)':'var(--color-success)',
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
            style={{ background:'rgba(13,27,62,0.04)', border:'1px solid var(--color-border)' }}>
            <Info size={13} style={{ color:'var(--color-gold)', flexShrink:0 }}/>
            <span style={{ color:'var(--color-text-secondary)' }}>
              Número de recibo generado automáticamente: <strong style={{ color:'var(--color-navy)', fontFamily:'var(--font-mono)' }}>PA-XXXX</strong>
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
                borderColor: uploadFile ? 'var(--color-gold)' : 'var(--color-border)',
                background:  uploadFile ? 'rgba(200,168,75,0.05)' : 'var(--color-bg-primary)',
              }}
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => setUploadFile(e.target.files[0]||null)}/>
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  <Paperclip size={15} style={{ color:'var(--color-gold)' }}/>
                  <span className="text-sm font-medium" style={{ color:'var(--color-navy)' }}>{uploadFile.name}</span>
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

// ── Panel de hitos de entrega ─────────────────────────────────
const MILESTONES = [
  {
    key:   'terrain_delivery',
    label: 'Entrega de terreno',
    desc:  'Fecha en que se hace entrega física del terreno o inmueble al comprador',
    hasDate: true, // permite registrar la fecha en que ocurrió
  },
  {
    key:   'basic_services',
    label: 'Pagos de servicios básicos',
    desc:  'Confirmación de que los servicios públicos están al día (agua, luz, gas)',
    hasDate: false,
  },
  {
    key:   'additional_values',
    label: 'Pago de valores adicionales',
    desc:  'Pagos extra acordados: administración, impuestos, escrituración, etc.',
    hasDate: false,
  },
];

const MilestonesPanel = ({ contractId, tenant, deliveryDate, canEdit, onRefresh, milestones }) => {
  const [saving, setSaving] = useState(null); // key que se está guardando
  // Estado local — inicializado desde los milestones que vienen del contrato
  const [state, setState] = useState({
    terrain_delivery:  milestones.terrain_delivery  || { done:false, date:'' },
    basic_services:    milestones.basic_services    || { done:false, date:'' },
    additional_values: milestones.additional_values || { done:false, date:'' },
  });
  const API_URL = import.meta.env.VITE_API_URL || 'https://back.inmogestpro.com';

  const toggleMilestone = async (key) => {
    if (!canEdit) return;
    const current = state[key];
    const next = { ...current, done: !current.done };
    // Si se desmarca, limpiamos fecha
    if (!next.done) next.date = '';
    setState(prev => ({ ...prev, [key]: next }));

    setSaving(key);
    try {
      const token = localStorage.getItem('inmogest_token');
      const res = await fetch(
        `${API_URL}/api/v1/${tenant}/contracts/${contractId}/milestones`,
        {
          method:  'PATCH',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:    JSON.stringify({ key, done: next.done, date: next.date || null }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Error');
      onRefresh();
    } catch {
      // Revertir si falla
      setState(prev => ({ ...prev, [key]: current }));
      toast.error('No se pudo actualizar el hito');
    } finally {
      setSaving(null);
    }
  };

  const setDate = async (key, date) => {
    if (!canEdit) return;
    const current = state[key];
    const next = { ...current, date };
    setState(prev => ({ ...prev, [key]: next }));

    setSaving(key);
    try {
      const token = localStorage.getItem('inmogest_token');
      await fetch(
        `${API_URL}/api/v1/${tenant}/contracts/${contractId}/milestones`,
        {
          method:  'PATCH',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body:    JSON.stringify({ key, done: next.done, date: date || null }),
        }
      );
      onRefresh();
    } catch {
      setState(prev => ({ ...prev, [key]: current }));
      toast.error('No se pudo actualizar la fecha');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      {MILESTONES.map(m => {
        const ms      = state[m.key];
        const isDone  = ms.done;
        const isSaving= saving === m.key;

        return (
          <div key={m.key}
            className="flex items-start gap-3 p-3 rounded transition-all"
            style={{
              background: isDone ? 'rgba(200,168,75,0.07)' : 'var(--color-bg-secondary)',
              border:     `1px solid ${isDone ? 'rgba(200,168,75,0.3)' : 'var(--color-border)'}`,
            }}>

            {/* Botón marcar — estilo del sistema */}
            <button
              onClick={() => toggleMilestone(m.key)}
              disabled={!canEdit || isSaving}
              title={isDone ? 'Marcar como pendiente' : 'Marcar como realizado'}
              className="flex-shrink-0 mt-0.5 transition-all"
              style={{
                width:        '22px',
                height:       '22px',
                borderRadius: '4px',
                border:       `2px solid ${isDone ? 'var(--color-gold)' : 'var(--color-border)'}`,
                background:   isDone ? 'var(--color-gold)' : 'transparent',
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                cursor:       canEdit ? 'pointer' : 'default',
                opacity:      isSaving ? 0.5 : 1,
              }}>
              {isDone && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="#0D1B3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium"
                  style={{ color: isDone ? 'var(--color-navy)' : 'var(--color-text-secondary)' }}>
                  {m.label}
                </p>
                {isDone && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background:'rgba(200,168,75,0.15)', color:'var(--color-gold)', border:'1px solid rgba(200,168,75,0.3)' }}>
                    Realizado
                  </span>
                )}
              </div>

              {/* Fecha de entrega de terreno — campo especial */}
              {m.hasDate && isDone && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    Fecha en que se realizó:
                  </label>
                  <input
                    type="date"
                    value={ms.date || ''}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setDate(m.key, e.target.value)}
                    disabled={!canEdit}
                    className="input text-xs"
                    style={{ height:'28px', padding:'3px 8px', width:'140px' }}
                  />
                </div>
              )}

              {/* Fecha programada de entrega (del contrato) — solo en terrain_delivery */}
              {m.key === 'terrain_delivery' && deliveryDate && !isDone && (
                <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                  Programada para:{' '}
                  <span style={{ color:'var(--color-warning)', fontWeight:600 }}>
                    {format(new Date(deliveryDate), 'dd/MM/yyyy')}
                  </span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ── Modal para editar el plan de pagos ───────────────────────
const EditScheduleModal = ({ open, onClose, contract, paidCount, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    installments_total:  '',
    installment_amount:  '',
    first_due_date:      '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      installments_total: String(contract?.installments_total || ''),
      installment_amount: String(Math.round(parseFloat(contract?.installment_amount || 0))),
      first_due_date:     '',
    });
  }, [open, contract]);

  if (!open) return null;

  const pendingCount = (parseInt(form.installments_total) || 0) - paidCount;

  const handleSave = async () => {
    const total  = parseInt(form.installments_total);
    const amount = parseFloat(form.installment_amount);
    if (!total || total < 1) return toast.error('El total de cuotas debe ser al menos 1');
    if (!amount || amount <= 0) return toast.error('El monto por cuota debe ser mayor a 0');
    if (total <= paidCount) return toast.error(`El total (${total}) debe ser mayor que las cuotas pagadas (${paidCount})`);
    setSaving(true);
    try {
      const payload = { installments_total: total, installment_amount: amount };
      if (form.first_due_date) payload.first_due_date = form.first_due_date;
      const res = await contractsService.updateSchedule(contract.id, payload);
      toast.success(res.data?.message || 'Plan de pagos actualizado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar el plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl shadow-2xl"
        style={{ background:'var(--color-bg-primary)', border:'1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Edit size={15} style={{ color:'var(--color-text-accent)' }}/>
            <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
              Editar Plan de Pagos
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={14}/></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg text-xs"
            style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'var(--color-text-secondary)' }}>
            <strong>Cuotas pagadas ({paidCount}):</strong> no se modifican. Solo se recalculan las cuotas pendientes.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5"
                style={{ color:'var(--color-text-secondary)' }}>
                Total de cuotas <span className="text-red-400">*</span>
              </label>
              <input type="number" min={paidCount + 1} value={form.installments_total}
                onChange={e => setForm(f => ({...f, installments_total: e.target.value}))}
                className="input text-sm w-full"/>
              {pendingCount > 0 && (
                <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                  {pendingCount} cuotas pendientes
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5"
                style={{ color:'var(--color-text-secondary)' }}>
                Monto por cuota <span className="text-red-400">*</span>
              </label>
              <input type="number" min={1} value={form.installment_amount}
                onChange={e => setForm(f => ({...f, installment_amount: e.target.value}))}
                className="input text-sm w-full"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5"
              style={{ color:'var(--color-text-secondary)' }}>
              Vencimiento primera cuota pendiente
              <span className="ml-1 font-normal" style={{ color:'var(--color-text-muted)' }}>
                (opcional — si no se indica, se calcula desde la firma)
              </span>
            </label>
            <input type="date" value={form.first_due_date}
              onChange={e => setForm(f => ({...f, first_due_date: e.target.value}))}
              className="input text-sm w-full"/>
          </div>

          {pendingCount > 0 && parseFloat(form.installment_amount) > 0 && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
              <p style={{ color:'var(--color-text-muted)' }}>
                Total pendiente estimado:{' '}
                <strong style={{ color:'var(--color-text-primary)' }}>
                  {formatCurrency(pendingCount * parseFloat(form.installment_amount))}
                </strong>
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
            <Save size={13}/> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Modal de exportación de Plan de Cuotas ────────────────────
const ExportScheduleModal = ({
  open, onClose, onExport, allUsers, contract, isLoading,
}) => {
  // Datos de empresa que vienen del backend (solo lectura)
  const [company, setCompany] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Datos del firmante
  const [signerRole, setSignerRole] = useState('gerente');
  const [signerId,   setSignerId]   = useState('');
  const [signerDoc,  setSignerDoc]  = useState('');

  // Cargar datos de empresa desde /config al abrir el modal
  useEffect(() => {
    if (!open) return;
    setLoadingCompany(true);
    configService.get()
      .then(res => {
        setCompany(res.data?.data?.config || {});
      })
      .catch(() => {
        setCompany({});
      })
      .finally(() => setLoadingCompany(false));
  }, [open]);

  // Filtrar usuarios por rol
  const usersOfRole = useMemo(() => {
    if (!signerRole) return [];
    return (allUsers || []).filter(u => u.role === signerRole && u.is_active);
  }, [allUsers, signerRole]);

  // Al cambiar de rol, resetear el usuario seleccionado
  useEffect(() => {
    setSignerId('');
    setSignerDoc('');
  }, [signerRole]);

  // Al seleccionar un usuario, auto-llenar documento si viene en sus datos
  const selectedUser = useMemo(
    () => usersOfRole.find(u => String(u.id) === String(signerId)),
    [usersOfRole, signerId]
  );
  useEffect(() => {
    if (selectedUser) {
      setSignerDoc(
        selectedUser.document_number || selectedUser.identification || selectedUser.cedula || ''
      );
    }
  }, [selectedUser]);

  if (!open) return null;

  const handleExport = () => {
    if (!signerId) {
      return toast.error('Selecciona el usuario que firma por la empresa');
    }
    onExport({
      company: company || {},
      signer: {
        role:     signerRole,
        id:       signerId,
        name:     selectedUser?.full_name || '',
        document: signerDoc || '',
      },
    });
  };

  const ROLE_LABELS = {
    admin:      'Administrador',
    gerente:    'Gerente',
    contador:   'Contador',
    supervisor: 'Supervisor',
    asesor:     'Asesor',
    abogado:    'Abogado',
  };

  // Línea de info de la empresa para el preview
  const companyInfoLine = company ? [
    company.company_nit     && `NIT ${company.company_nit}`,
    company.company_city,
    company.company_phone,
  ].filter(Boolean).join(' · ') : '';

  // Nombre limpio de empresa (ignora residuos del backend viejo)
  const MODAL_RESIDUOS = ['Mi Inmobiliaria', 'mi inmobiliaria', '—'];
  const rawName = (company?.company_name || '').toString().trim();
  const displayCompanyName = (!rawName || MODAL_RESIDUOS.includes(rawName))
    ? (company?.company_slug || '')
    : rawName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background:'var(--color-bg-primary)', border:'1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between sticky top-0"
          style={{ background:'var(--color-bg-primary)', borderBottom:'1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color:'var(--color-text-accent)' }}/>
            <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
              Exportar Plan de Cuotas
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            <X size={14}/>
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)' }}>
            <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color:'#60a5fa' }}/>
            <p style={{ color:'var(--color-text-secondary)' }}>
              El Excel incluirá el encabezado con los datos de la empresa y un espacio para
              firmas al final del plan de cuotas.
            </p>
          </div>

          {/* Preview datos empresa (solo lectura — vienen del registro) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color:'var(--color-text-muted)' }}>
              Datos de la empresa
            </p>
            {loadingCompany ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-lg text-xs"
                style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)' }}>
                <RefreshCw size={12} className="animate-spin"/>
                Cargando datos de la empresa...
              </div>
            ) : (
              <div className="px-3 py-3 rounded-lg space-y-1"
                style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
                  {displayCompanyName || (
                    <span className="italic" style={{ color:'var(--color-text-muted)' }}>
                      Sin nombre configurado
                    </span>
                  )}
                </p>
                {companyInfoLine && (
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    {companyInfoLine}
                  </p>
                )}
                {!companyInfoLine && (
                  <p className="text-xs italic" style={{ color:'var(--color-text-muted)' }}>
                    Sin NIT, ciudad ni teléfono registrados
                  </p>
                )}
                <p className="text-xs pt-1" style={{ color:'var(--color-text-muted)', fontStyle:'italic' }}>
                  Para actualizar estos datos, contacta al administrador del sistema.
                </p>
              </div>
            )}
          </div>

          {/* Firmante */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-text-muted)' }}>
              Firmante por la empresa
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color:'var(--color-text-secondary)' }}>
                  Rol <span className="text-red-400">*</span>
                </label>
                <select value={signerRole}
                  onChange={e => setSignerRole(e.target.value)}
                  className="input text-sm w-full">
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color:'var(--color-text-secondary)' }}>
                  Usuario <span className="text-red-400">*</span>
                </label>
                <select value={signerId}
                  onChange={e => setSignerId(e.target.value)}
                  className="input text-sm w-full">
                  <option value="">
                    {usersOfRole.length === 0
                      ? `Sin usuarios con rol "${ROLE_LABELS[signerRole]}"`
                      : 'Seleccionar...'}
                  </option>
                  {usersOfRole.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color:'var(--color-text-secondary)' }}>
                  Documento de identidad del firmante
                  <span className="ml-1 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                    (opcional — se detecta del usuario si existe)
                  </span>
                </label>
                <input type="text" value={signerDoc}
                  onChange={e => setSignerDoc(e.target.value)}
                  className="input text-sm w-full" placeholder="CC 1.000.000"/>
              </div>
            </div>
          </div>

          {/* Preview de quién firma por el cliente */}
          {contract && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
              <p className="font-semibold mb-1" style={{ color:'var(--color-text-muted)' }}>
                Por el cliente firmará:
              </p>
              <p style={{ color:'var(--color-text-primary)' }}>
                {contract.client_name}
                {contract.document_number && (
                  <span className="ml-2" style={{ color:'var(--color-text-muted)' }}>
                    · {contract.document_type || 'CC'} {contract.document_number}
                  </span>
                )}
              </p>
            </div>
          )}

        </div>

        {/* Botones */}
        <div className="px-5 py-4 flex justify-end gap-2 sticky bottom-0"
          style={{ background:'var(--color-bg-primary)', borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button onClick={handleExport} disabled={isLoading || loadingCompany}
            className="btn btn-primary btn-sm">
            <Download size={13}/> {isLoading ? 'Generando...' : 'Generar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Página principal ──────────────────────────────────────────


const ContractDetailPage = () => {
  const { id, tenant }         = useParams();
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();
  const { hasRole, user }    = useAuthStore();
  const to = (path) => `/${tenant}/${path}`;
  const apiBase = () => `${API_URL}/api/v1/${tenant}`;
  const canPay         = hasRole('admin','gerente','contador');
  const canUpload      = hasRole('admin','gerente','contador','asesor');
  const isAsesor       = user?.role === 'asesor';
  const [showPayModal, setShowPayModal]         = useState(false);
  const [showExportModal, setShowExportModal]   = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['contract', id],
    queryFn:  () => contractsService.getById(id),
  });

  const d                = data?.data?.data;
  const contract         = d?.contract;
  const payment_schedule = d?.payment_schedule || [];
  const allProperties    = d?.all_properties  || [];
  const payments         = d?.payments         || [];

  // Cargar usuarios para resolver nombres de abogado y supervisor
  // Solo roles con permiso de ver usuarios (asesores no tienen acceso)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersService.getAll(),
    enabled:  !isAsesor,
  });
  const allUsers = usersData?.data?.data || [];

  // Resolver nombre de abogado y supervisor desde el ID
  const abogadoName = contract?.abogado_name
    || allUsers.find(u => String(u.id) === String(contract?.abogado_id))?.full_name
    || null;
  const supervisorName = contract?.supervisor_name
    || allUsers.find(u => String(u.id) === String(contract?.supervisor_id))?.full_name
    || null;

  const handlePaymentSaved = () => {
    queryClient.invalidateQueries({ queryKey:['contract', id] });
    queryClient.invalidateQueries({ queryKey:['payments'] });
    queryClient.invalidateQueries({ queryKey:['dashboard-kpis'] });
    refetch();
  };

  // ── Exportar Plan de Cuotas a Excel con encabezado + firmas ─
  const handleExport = ({ company, signer }) => {
    try {
      const wb = XLSX.utils.book_new();

      // ─────────────────────────────────────────────────────
      // HOJA 1: Plan de Cuotas con encabezado y firmas
      // ─────────────────────────────────────────────────────
      const rows = [];
      const merges = [];
      const NCOLS = 7; // columnas totales (#, Vencimiento, Monto, Estado, Abonado, Saldo, Fecha Pago)

      // ── Encabezado: empresa ──
      // Limpiar posibles residuos del backend viejo
      const RESIDUOS_EMPRESA = ['Mi Inmobiliaria', 'mi inmobiliaria', '—'];
      const rawCompanyName = (company.company_name || '').toString().trim();
      const companyName = (!rawCompanyName || RESIDUOS_EMPRESA.includes(rawCompanyName))
        ? (company.company_slug || 'Empresa')
        : rawCompanyName;

      rows.push([companyName, '', '', '', '', '', '']);
      merges.push({ s:{r:0,c:0}, e:{r:0,c:NCOLS-1} });

      const infoLinea = [
        company.company_nit     && `NIT ${company.company_nit}`,
        company.company_city,
        company.company_phone,
        company.company_email,
      ].filter(Boolean).join(' · ');
      rows.push([infoLinea, '', '', '', '', '', '']);
      merges.push({ s:{r:1,c:0}, e:{r:1,c:NCOLS-1} });

      rows.push(['', '', '', '', '', '', '']); // línea en blanco

      // ── Datos del contrato ──
      rows.push([`CONTRATO N° ${contract.contract_number || ''}`, '', '', '', '', '', '']);
      merges.push({ s:{r:3,c:0}, e:{r:3,c:NCOLS-1} });

      const clienteLinea = contract.client_name +
        (contract.document_number ? ` · ${contract.document_type || 'CC'} ${contract.document_number}` : '');
      rows.push([`Cliente: ${clienteLinea}`, '', '', '', '', '', '']);
      merges.push({ s:{r:4,c:0}, e:{r:4,c:NCOLS-1} });

      const inmuebleLinea = [
        contract.project_name,
        contract.block_name,
        contract.property_unit && `Unidad ${contract.property_unit}`,
      ].filter(Boolean).join(' · ');
      rows.push([`Inmueble: ${inmuebleLinea || '—'}`, '', '', '', '', '', '']);
      merges.push({ s:{r:5,c:0}, e:{r:5,c:NCOLS-1} });

      rows.push([
        `Valor total: ${formatCurrency(contract.total_value)}` +
        ` · Valor neto: ${formatCurrency(contract.net_value)}` +
        ` · Cuotas: ${contract.installments_total || payment_schedule.length}`,
        '', '', '', '', '', ''
      ]);
      merges.push({ s:{r:6,c:0}, e:{r:6,c:NCOLS-1} });

      rows.push([
        `Fecha firma: ${contract.signing_date ? format(new Date(contract.signing_date),'dd/MM/yyyy') : '—'}` +
        ` · Fecha exportación: ${format(new Date(),'dd/MM/yyyy')}`,
        '', '', '', '', '', ''
      ]);
      merges.push({ s:{r:7,c:0}, e:{r:7,c:NCOLS-1} });

      rows.push(['', '', '', '', '', '', '']); // línea en blanco
      rows.push(['PLAN DE AMORTIZACIÓN', '', '', '', '', '', '']);
      merges.push({ s:{r:9,c:0}, e:{r:9,c:NCOLS-1} });
      rows.push(['', '', '', '', '', '', '']);

      // ── Tabla de cuotas ──
      rows.push(['#','Vencimiento','Monto','Estado','Abonado','Saldo','Fecha Pago']);

      payment_schedule.forEach(ps => {
        const paid  = parseFloat(ps.paid_amount||0);
        const total = parseFloat(ps.amount||0);
        const isOverdue = (ps.status==='en_mora' || ps.status==='pendiente') &&
          ps.due_date && new Date(ps.due_date) < new Date();
        rows.push([
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
      rows.push(['','','','TOTAL', totalPaidPS, totalAmtPS-totalPaidPS, '']);

      // ── Espacio para firmas ──
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['', '', '', '', '', '', '']);

      // Líneas de firma (simuladas con guiones bajos ya que XLSX no soporta bordes sin estilos avanzados)
      const firmaLine = '______________________________';
      const firmaRowIdx = rows.length;
      rows.push([firmaLine, '', '', '', firmaLine, '', '']);
      merges.push({ s:{r:firmaRowIdx,c:0}, e:{r:firmaRowIdx,c:2} });
      merges.push({ s:{r:firmaRowIdx,c:4}, e:{r:firmaRowIdx,c:6} });

      const labelRowIdx = rows.length;
      rows.push(['Firma del cliente', '', '', '', `Firma por ${companyName}`, '', '']);
      merges.push({ s:{r:labelRowIdx,c:0}, e:{r:labelRowIdx,c:2} });
      merges.push({ s:{r:labelRowIdx,c:4}, e:{r:labelRowIdx,c:6} });

      const nameRowIdx = rows.length;
      rows.push([
        contract.client_name || '', '', '', '',
        signer.name || '', '', ''
      ]);
      merges.push({ s:{r:nameRowIdx,c:0}, e:{r:nameRowIdx,c:2} });
      merges.push({ s:{r:nameRowIdx,c:4}, e:{r:nameRowIdx,c:6} });

      const docRowIdx = rows.length;
      const clientDoc = contract.document_number
        ? `${contract.document_type || 'CC'} ${contract.document_number}`
        : '';
      const signerDoc = signer.document ? `CC ${signer.document}` : '';
      rows.push([clientDoc, '', '', '', signerDoc, '', '']);
      merges.push({ s:{r:docRowIdx,c:0}, e:{r:docRowIdx,c:2} });
      merges.push({ s:{r:docRowIdx,c:4}, e:{r:docRowIdx,c:6} });

      const roleRowIdx = rows.length;
      const ROLE_LABELS = {
        admin:'Administrador', gerente:'Gerente', contador:'Contador',
        supervisor:'Supervisor', asesor:'Asesor', abogado:'Abogado',
      };
      rows.push(['', '', '', '', ROLE_LABELS[signer.role] || signer.role, '', '']);
      merges.push({ s:{r:roleRowIdx,c:4}, e:{r:roleRowIdx,c:6} });

      // Crear la hoja
      const ws1 = XLSX.utils.aoa_to_sheet(rows);
      ws1['!cols']   = [6, 15, 18, 16, 15, 15, 15].map(w => ({ wch:w }));
      ws1['!merges'] = merges;

      XLSX.utils.book_append_sheet(wb, ws1, 'Plan de Cuotas');

      // ─────────────────────────────────────────────────────
      // HOJA 2: Pagos recibidos (sin encabezado, como estaba)
      // ─────────────────────────────────────────────────────
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

      // ─────────────────────────────────────────────────────
      // HOJA 3: Resumen (sin encabezado, como estaba)
      // ─────────────────────────────────────────────────────
      const summary = [
        ['Campo','Valor'],
        ['Contrato',       contract.contract_number],
        ['Cliente',        contract.client_name],
        ['Proyecto',       contract.project_name],
        ['Manzana',        contract.block_name || '—'],
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

      // Guardar
      XLSX.writeFile(wb, `Contrato_${contract.contract_number}_${format(new Date(),'yyyyMMdd')}.xlsx`);

      toast.success('Plan de cuotas exportado');
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exportando:', err);
      toast.error('Error al generar el archivo');
    }
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
          tenant={tenant}
          contract={contract}
          schedule={payment_schedule}
          onClose={() => setShowPayModal(false)}
          onSaved={handlePaymentSaved}
        />
      )}

      <ExportScheduleModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        allUsers={allUsers}
        contract={contract}
      />

      <EditScheduleModal
        open={showEditSchedule}
        onClose={() => setShowEditSchedule(false)}
        contract={contract}
        paidCount={paidCount}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey:['contract', id] });
          refetch();
        }}
      />

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
          <span className="text-sm font-bold font-mono"
            style={{ color: progressPct>=100 ? 'var(--color-gold)' : 'var(--color-navy)' }}>
            {progressPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background:'var(--color-bg-secondary)' }}>
          <div className="h-2 rounded-full transition-all" style={{
            width:`${progressPct}%`,
            background: progressPct>=100 ? 'var(--color-gold)' : 'var(--color-navy)',
          }}/>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs"
          style={{ color:'var(--color-text-muted)' }}>
          <span>Recaudado: <strong style={{ color:'var(--color-navy)' }}>{formatCurrency(totalPaid)}</strong></span>
          <span>Pendiente: <strong style={{ color:'var(--color-warning)' }}>{formatCurrency(netValue - totalPaid)}</strong></span>
          <span>Total neto: <strong style={{ color:'var(--color-navy)' }}>{formatCurrency(netValue)}</strong></span>
        </div>
        {discount > 0 && (
          <div className="mt-2 text-xs text-center"
            style={{ color:'var(--color-gold)' }}>
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background:'rgba(13,27,62,0.07)', color:'var(--color-navy)' }}>
                      Inmueble {i + 1}
                    </span>
                    <span className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
                      {prop.project_name}
                    </span>
                    {prop.block_name && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                        style={{ background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>
                        {prop.block_name}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background:'rgba(59,130,246,0.1)', color:'#60a5fa' }}>
                      Unidad {prop.unit_number}
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
              {contract.block_name && (
                <InfoBlock label="Manzana" value={contract.block_name}/>
              )}
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
                extra={<span style={{ color:'var(--color-gold)', fontSize:'11px' }}>
                  {totalValue > 0 ? Math.round(discount/totalValue*100) : 0}% de descuento
                </span>}/>
            )}
            <InfoBlock label={discount > 0 ? "Valor neto (con descuento)" : "Valor neto"}
              value={formatCurrency(contract.net_value)} mono/>
            {parseFloat(contract.down_payment||0) > 0 && (
              <InfoBlock label="Cuota inicial pactada"
                value={formatCurrency(contract.down_payment)} mono
                extra={<span style={{ color:'var(--color-text-muted)', fontSize:'11px' }}>
                  Incluida en el valor neto
                </span>}/>
            )}
            <InfoBlock label="Tipo de pago"  value={PAYMENT_TYPE_LABELS[contract.payment_type] || contract.payment_type}/>
            <InfoBlock label="Cuotas"        value={`${contract.installments_total} × ${formatCurrency(contract.installment_amount)}`} mono/>
            {parseFloat(contract.notary_expenses || 0) > 0 && (
              <div className="col-span-2">
                <div className="p-3 rounded-xl space-y-2"
                  style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color:'var(--color-text-muted)' }}>
                      Gastos notariales / papelería
                    </p>
                    {canPay && (
                      <label className="btn btn-secondary btn-sm cursor-pointer text-xs">
                        <Upload size={11}/> {contract.notary_document ? 'Reemplazar' : 'Subir evidencia'}
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                          onChange={async e => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append('file', file);
                            try {
                              const res = await contractsService.uploadNotaryDoc(id, fd);
                              if (res.data?.success) { toast.success('Evidencia subida correctamente'); refetch(); }
                              else toast.error(res.data?.message || 'Error al subir');
                            } catch { toast.error('Error al subir el documento'); }
                            e.target.value = '';
                          }}/>
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color:'var(--color-text-muted)' }}>Monto</p>
                      <p className="text-sm font-mono font-medium" style={{ color:'var(--color-text-primary)' }}>
                        {formatCurrency(contract.notary_expenses)}
                      </p>
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        Informativo — no incluido en el valor del contrato
                      </p>
                    </div>
                    {contract.notary_date && (
                      <div>
                        <p className="text-xs mb-0.5" style={{ color:'var(--color-text-muted)' }}>Fecha de registro</p>
                        <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                          {format(new Date(contract.notary_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}
                  </div>
                  {contract.notary_document && (() => {
                    const doc = typeof contract.notary_document === 'string'
                      ? JSON.parse(contract.notary_document)
                      : contract.notary_document;
                    return (
                      <div className="flex items-center gap-2 pt-1">
                        <Paperclip size={12} style={{ color:'var(--color-gold)', flexShrink:0 }}/>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs hover:underline flex-1 truncate"
                          style={{ color:'var(--color-text-accent)' }}>
                          {doc.filename}
                        </a>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          style={{ color:'var(--color-text-muted)' }}>
                          <ExternalLink size={11}/>
                        </a>
                      </div>
                    );
                  })()}
                  {!contract.notary_document && (
                    <p className="text-xs" style={{ color:'var(--color-text-muted)', fontStyle:'italic' }}>
                      Sin documento de evidencia adjunto
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Datos de financiación bancaria — solo si hay información */}
          {(contract.bank_name || contract.bank_credit_number || contract.interest_rate) && (
            <div className="mt-4 pt-4" style={{ borderTop:'1px solid var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color:'var(--color-text-muted)', letterSpacing:'0.08em' }}>
                Financiación bancaria
              </p>
              <div className="grid grid-cols-2 gap-3">
                {contract.bank_name && (
                  <InfoBlock label="Entidad bancaria" value={contract.bank_name}/>
                )}
                {contract.bank_credit_number && (
                  <InfoBlock label="N° de crédito" value={contract.bank_credit_number} mono/>
                )}
                {contract.interest_rate && parseFloat(contract.interest_rate) > 0 && (
                  <InfoBlock label="Tasa del banco (referencia)"
                    value={`${parseFloat(contract.interest_rate).toFixed(2)}% mensual`} mono
                    extra={<span style={{ color:'var(--color-text-muted)', fontSize:'11px' }}>
                      Informativa — no afecta las cuotas
                    </span>}/>
                )}
              </div>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Asesor y Fechas" icon={Calendar}>
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <InfoBlock label="Asesor"          value={contract.advisor_name || '—'}/>
            <InfoBlock label="Abogado"         value={abogadoName || '—'}/>
            <InfoBlock label="Supervisor"      value={supervisorName || '—'}/>
            <InfoBlock label="Fecha firma"     value={contract.signing_date?format(new Date(contract.signing_date),'dd/MM/yyyy'):'—'}/>
            <InfoBlock label="Registrado por"  value={contract.created_by_name}/>
            <InfoBlock label="Estado"          value={statusCfg.label}/>
            <InfoBlock label="Fecha de entrega"
              value={contract.delivery_date ? format(new Date(contract.delivery_date),'dd/MM/yyyy') : '—'}
              extra={!contract.delivery_date && (
                <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  No definida en el contrato
                </span>
              )}
            />
          </div>

          {/* Hitos de entrega */}
          <div className="pt-3" style={{ borderTop:'1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color:'var(--color-gold)', letterSpacing:'0.08em' }}>
              Hitos de entrega
            </p>
            <MilestonesPanel
              contractId={contract.id}
              tenant={tenant}
              deliveryDate={contract.delivery_date}
              canEdit={canPay}
              onRefresh={refetch}
              milestones={contract.milestones || {}}
            />
          </div>
        </SectionCard>
      </div>

      {/* Hash no repudio + Documentos del contrato */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4" style={{ borderColor:'var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={15} style={{ color:'var(--color-navy)' }}/>
            <span className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
              Integridad del Contrato
            </span>
          </div>
          <p className="font-mono text-xs break-all" style={{ color:'var(--color-navy)' }}>
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
                  <Paperclip size={12} style={{ color:'var(--color-gold)', flexShrink:0 }}/>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 truncate hover:underline" style={{ color:'var(--color-navy)' }}>
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
                onClick={() => setShowExportModal(true)}
                className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5">
                <Download size={12}/> Exportar
              </button>
            )}
            {hasRole('admin','gerente','contador') && contract.status !== 'cancelado' && (
              <button
                onClick={() => setShowEditSchedule(true)}
                className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5">
                <Edit size={12}/> Editar Plan
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
                          ? '4px solid var(--color-danger)'
                          : isPart
                          ? '4px solid var(--color-warning)'
                          : ps.status==='pagado'
                          ? '4px solid var(--color-gold)'
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
                        style={{ color:paid>0?'var(--color-navy)':'var(--color-text-muted)' }}>
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
              style={{ background:'rgba(13,27,62,0.07)', color:'var(--color-navy)' }}>
              {payments.length}
            </span>
          </h3>
          <span className="text-sm font-mono font-bold" style={{ color:'var(--color-navy)' }}>
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
                    <td className="font-mono text-sm font-bold" style={{ color:'var(--color-navy)' }}>
                      {p.receipt_number||'—'}
                      {p.notes?.includes('Cuota inicial') && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background:'rgba(200,168,75,0.15)', color:'var(--color-gold)' }}>
                          Inicial
                        </span>
                      )}
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                      {p.payment_date?format(new Date(p.payment_date),'dd/MM/yyyy'):'—'}
                    </td>
                    <td className="text-sm font-mono font-bold" style={{ color:'var(--color-navy)' }}>
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
                              style={{ color:'var(--color-navy)' }}>
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