// src/pages/Settlements/SettlementsPage.jsx
//
// Liquidaciones al propietario.
//
// Lo primero que se ve es cuánta plata ajena sigue en la cuenta de la
// inmobiliaria. Ese dinero no es utilidad: es una deuda con el dueño del
// inmueble, y mientras no se gire hay que tenerla presente.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, AlertTriangle, CheckCircle2, Send, Ban, Plus,
  Loader2, X, FileText,
} from 'lucide-react';
import { settlementsService, rentalsService } from '../../services/api.service';
import { formatDate, todayISO } from '../../utils/dates';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const fmt = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const STATUS_CFG = {
  borrador: { label:'Borrador', bg:'rgba(148,163,184,0.15)', color:'#94a3b8' },
  aprobada: { label:'Aprobada', bg:'rgba(59,130,246,0.15)',  color:'#3b82f6' },
  pagada:   { label:'Girada',   bg:'rgba(34,197,94,0.15)',   color:'#22c55e' },
  anulada:  { label:'Anulada',  bg:'rgba(239,68,68,0.15)',   color:'#ef4444' },
};

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

// ── Modal: generar liquidación ────────────────────────────────
// `prefill` llega cuando se entra desde la lista de cobrado sin liquidar: ya
// se sabe qué contrato y qué mes hay que liquidar, así que no tiene sentido
// hacer que el usuario los vuelva a buscar.
const GenerateModal = ({ onClose, onSaved, prefill }) => {
  const now = new Date();
  const [form, setForm] = useState({
    rental_contract_id: prefill?.rental_contract_id || '',
    period_year:  String(prefill?.period_year  || now.getFullYear()),
    period_month: String(prefill?.period_month || now.getMonth() + 1),
    withholding_tax: '',
  });
  const [deducciones, setDeducciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const { data } = useQuery({
    queryKey: ['rentals','vigentes'],
    queryFn:  () => rentalsService.getAll({ rental_status:'vigente' }),
  });
  const contratos = data?.data?.data || [];

  const addDeduccion = () =>
    setDeducciones(d => [...d, { item_type:'reparacion', description:'', amount:'' }]);
  const setDeduccion = (i,k,v) =>
    setDeducciones(d => d.map((x,j) => j===i ? { ...x, [k]:v } : x));
  const delDeduccion = (i) => setDeducciones(d => d.filter((_,j) => j!==i));

  const submit = async () => {
    if (!form.rental_contract_id) return toast.error('Selecciona el contrato de arriendo');
    setSaving(true);
    try {
      const res = await settlementsService.generate({
        ...form,
        period_year:  parseInt(form.period_year),
        period_month: parseInt(form.period_month),
        withholding_tax: form.withholding_tax ? parseFloat(form.withholding_tax) : 0,
        deductions: deducciones
          .filter(d => parseFloat(d.amount) > 0)
          .map(d => ({ ...d, amount: parseFloat(d.amount) })),
      });
      toast.success(res?.data?.message || 'Liquidación generada', { duration:7000 });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo generar', { duration:9000, style:{ maxWidth:'560px' } });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ background:'var(--color-bg-secondary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
            Generar liquidación
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70"
            style={{ color:'var(--color-text-muted)' }}><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <Field label="Contrato de arriendo" required>
            <select value={form.rental_contract_id} onChange={e => set('rental_contract_id', e.target.value)}
              className="input text-sm w-full">
              <option value="">Selecciona…</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.contract_number} · {c.unit_number} · {c.owner_name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mes" required>
              <select value={form.period_month} onChange={e => set('period_month', e.target.value)}
                className="input text-sm w-full">
                {MESES.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Año" required>
              <input type="number" value={form.period_year}
                onChange={e => set('period_year', e.target.value)}
                className="input text-sm w-full" min="2000" max="2100"/>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide"
                style={{ color:'var(--color-text-muted)' }}>Descuentos al propietario</p>
              <button onClick={addDeduccion} className="btn btn-secondary btn-sm flex items-center gap-1">
                <Plus size={12}/> Agregar
              </button>
            </div>
            {deducciones.length === 0 ? (
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                Reparaciones, servicios públicos u otros gastos que se le descuentan del giro.
              </p>
            ) : (
              <div className="space-y-2">
                {deducciones.map((d,i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select value={d.item_type} onChange={e => setDeduccion(i,'item_type',e.target.value)}
                      className="input text-sm" style={{ width:150 }}>
                      <option value="reparacion">Reparación</option>
                      <option value="servicio_publico">Servicio público</option>
                      <option value="administracion">Administración</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input value={d.description} onChange={e => setDeduccion(i,'description',e.target.value)}
                      placeholder="Descripción" className="input text-sm flex-1"/>
                    <input type="number" value={d.amount} onChange={e => setDeduccion(i,'amount',e.target.value)}
                      placeholder="0" className="input text-sm" style={{ width:120 }} min="0"/>
                    <button onClick={() => delDeduccion(i)} className="p-2 text-red-400 hover:opacity-70">
                      <X size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Retención en la fuente" hint="Déjalo vacío si no aplica">
            <input type="number" value={form.withholding_tax}
              onChange={e => set('withholding_tax', e.target.value)}
              className="input text-sm w-full" min="0" placeholder="0"/>
          </Field>

          <div className="p-3 rounded text-sm"
            style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)',
                     color:'var(--color-text-secondary)' }}>
            Se liquida sobre lo <strong>efectivamente cobrado</strong> en el mes. Si el arrendatario
            no pagó, no hay nada que girar — así la inmobiliaria nunca financia al propietario.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4" style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={submit} className="btn btn-primary" disabled={saving}>
            {saving ? 'Generando…' : 'Generar liquidación'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal: registrar giro ─────────────────────────────────────
const PayModal = ({ settlement, onClose, onSaved }) => {
  const [form, setForm] = useState({
    payment_method:'transferencia', payment_reference:'', evidence_url:'', paid_at: todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const submit = async () => {
    setSaving(true);
    try {
      const res = await settlementsService.pay(settlement.id, form);
      toast.success(res?.data?.message || 'Giro registrado', { duration:7000 });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo registrar el giro');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-lg" style={{ background:'var(--color-bg-secondary)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
            Registrar giro al propietario
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70"
            style={{ color:'var(--color-text-muted)' }}><X size={18}/></button>
        </div>

        <div className="p-3 rounded mb-4" style={{ background:'var(--color-bg-tertiary)' }}>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            <strong style={{ color:'var(--color-text-primary)' }}>{settlement.owner_name}</strong>
            {' · '}{MESES[settlement.period_month]} {settlement.period_year}
          </p>
          <p className="text-lg font-semibold mt-1" style={{ color:'var(--color-text-accent)' }}>
            {fmt(settlement.net_to_pay)}
          </p>
          {settlement.bank_name && (
            <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
              {settlement.bank_name} · {settlement.bank_account_number}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Medio" required>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}
                className="input text-sm w-full">
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Fecha del giro">
              <input type="date" value={form.paid_at} onChange={e => set('paid_at', e.target.value)}
                className="input text-sm w-full"/>
            </Field>
          </div>
          <Field label="Referencia" hint="Número de transacción, cheque o comprobante">
            <input value={form.payment_reference} onChange={e => set('payment_reference', e.target.value)}
              className="input text-sm w-full"/>
          </Field>
          <Field label="Enlace al soporte" hint="Opcional. URL del comprobante si lo tienes guardado">
            <input value={form.evidence_url} onChange={e => set('evidence_url', e.target.value)}
              className="input text-sm w-full"/>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4" style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={submit} className="btn btn-primary flex items-center gap-1.5" disabled={saving}>
            <Send size={14}/> {saving ? 'Registrando…' : 'Confirmar giro'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettlementsPage = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const canManage = hasRole('admin','gerente','contador');
  const canVoid   = hasRole('admin','gerente');

  const [statusFilter, setStatusFilter] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  const { data: pendingData } = useQuery({
    queryKey: ['settlements','pending'],
    queryFn:  () => settlementsService.getPending(),
  });
  const p                = pendingData?.data?.data || {};
  const totalPorGirar    = p.total_por_girar    || 0;
  const pendientes       = p.pendientes         || [];
  const sinLiquidar      = p.sin_liquidar       || [];
  const totalSinLiquidar = p.total_sin_liquidar || 0;
  const totalDeuda       = p.total_deuda        || 0;

  const { data, isLoading } = useQuery({
    queryKey: ['settlements', statusFilter],
    queryFn:  () => settlementsService.getAll(statusFilter ? { status:statusFilter } : {}),
  });
  const settlements = data?.data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey:['settlements'] });
    setShowGenerate(false);
    setPayTarget(null);
  };

  const approve = async (s) => {
    try {
      await settlementsService.approve(s.id);
      toast.success('Liquidación aprobada');
      refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'No se pudo aprobar'); }
  };

  const voidIt = async (s) => {
    const reason = window.prompt('Motivo de la anulación:');
    if (!reason || !reason.trim()) return;
    try {
      const res = await settlementsService.void(s.id, reason.trim());
      toast.success(res?.data?.message || 'Liquidación anulada');
      if (res?.data?.warning) toast(res.data.warning, { icon:'⚠️', duration:11000, style:{ maxWidth:'560px' } });
      refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'No se pudo anular'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"
            style={{ color:'var(--color-text-primary)', fontFamily:'var(--font-display)' }}>
            <Wallet size={20} style={{ color:'var(--color-text-accent)' }}/>
            Liquidaciones
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            Lo que se le debe girar a cada propietario
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowGenerate(true)} className="btn btn-primary flex items-center gap-1.5">
            <Plus size={15}/> Generar liquidación
          </button>
        )}
      </div>

      {/* Lo que se le debe a los propietarios HOY.
          La deuda nace al cobrar el canon, no cuando alguien genera la
          liquidación. Por eso se suman las dos cosas: lo ya liquidado sin
          girar y lo cobrado que nadie ha liquidado todavía. */}
      {totalDeuda > 0 && (
        <div className="card p-4"
          style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5"/>
            <div className="flex-1">
              <p className="font-semibold" style={{ color:'#f59e0b' }}>
                Le debes {fmt(totalDeuda)} a propietarios
              </p>
              <p className="text-sm mt-0.5" style={{ color:'var(--color-text-secondary)' }}>
                Este dinero está en tu cuenta pero <strong>no es tuyo</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3"
            style={{ borderTop:'1px solid rgba(245,158,11,0.25)' }}>
            <div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Cobrado sin liquidar</p>
              <p className="text-lg font-semibold" style={{ color:'var(--color-text-primary)' }}>
                {fmt(totalSinLiquidar)}
              </p>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                {sinLiquidar.length} periodo(s) — hay que generar la liquidación
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Liquidado sin girar</p>
              <p className="text-lg font-semibold" style={{ color:'var(--color-text-primary)' }}>
                {fmt(totalPorGirar)}
              </p>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                {pendientes.length} liquidación(es) — falta enviar el dinero
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Canon cobrado que todavía no tiene liquidación */}
      {sinLiquidar.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom:'1px solid var(--color-border)' }}>
            <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
              Cobrado sin liquidar
            </h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              Ya recibiste este canon. Genera la liquidación para poder girarle al propietario.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background:'var(--color-bg-tertiary)' }}>
                  {['Propietario','Periodo','Inmueble','Cobrado','Tu comisión','Le debes',''].map((h,i) => (
                    <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                      style={{ color:'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sinLiquidar.map((r,i) => (
                  <tr key={i} style={{ borderTop:'1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color:'var(--color-text-primary)' }}>{r.owner_name}</div>
                      <div className="text-xs" style={{ color:'var(--color-text-muted)' }}>{r.contract_number}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>
                      {MESES[r.period_month]} {r.period_year}
                    </td>
                    <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>{r.unit_number}</td>
                    <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>{fmt(r.cobrado)}</td>
                    <td className="px-4 py-3" style={{ color:'#22c55e' }}>{fmt(r.comision)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color:'var(--color-text-accent)' }}>
                      {fmt(r.para_propietario)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          onClick={() => setShowGenerate({
                            rental_contract_id: r.rental_contract_id,
                            period_year:  r.period_year,
                            period_month: r.period_month,
                          })}
                          className="btn btn-primary btn-sm">
                          Liquidar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-3">
        <div className="flex gap-2 flex-wrap">
          {[['','Todas'],['borrador','Borrador'],['aprobada','Aprobadas'],
            ['pagada','Giradas'],['anulada','Anuladas']].map(([v,l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: statusFilter === v ? 'var(--color-navy)' : 'var(--color-bg-tertiary)',
                color:      statusFilter === v ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}>{l}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 flex items-center justify-center gap-2" style={{ color:'var(--color-text-muted)' }}>
          <Loader2 size={16} className="animate-spin"/> Cargando…
        </div>
      ) : settlements.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText size={32} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)', opacity:.4 }}/>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            No hay liquidaciones{statusFilter ? ' en ese estado' : ' todavía'}.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background:'var(--color-bg-tertiary)' }}>
                  {['Propietario','Periodo','Inmueble','Cobrado','Comisión','Neto a girar','Estado',''].map((h,i) => (
                    <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                      style={{ color:'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => {
                  const cfg = STATUS_CFG[s.status] || STATUS_CFG.borrador;
                  return (
                    <tr key={s.id} style={{ borderTop:'1px solid var(--color-border)' }}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color:'var(--color-text-primary)' }}>{s.owner_name}</div>
                        <div className="text-xs" style={{ color:'var(--color-text-muted)' }}>{s.contract_number}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>
                        {MESES[s.period_month]} {s.period_year}
                      </td>
                      <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>{s.unit_number}</td>
                      <td className="px-4 py-3" style={{ color:'var(--color-text-secondary)' }}>{fmt(s.canon_collected)}</td>
                      <td className="px-4 py-3" style={{ color:'#22c55e' }}>{fmt(s.agency_commission)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color:'var(--color-text-accent)' }}>
                        {fmt(s.net_to_pay)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-semibold"
                          style={{ background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                        {s.paid_at && (
                          <div className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                            {formatDate(s.paid_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManage && s.status === 'borrador' && (
                          <button onClick={() => approve(s)} title="Aprobar"
                            className="p-1.5 rounded hover:opacity-70" style={{ color:'#3b82f6' }}>
                            <CheckCircle2 size={15}/>
                          </button>
                        )}
                        {canManage && s.status === 'aprobada' && (
                          <button onClick={() => setPayTarget(s)} title="Registrar giro"
                            className="p-1.5 rounded hover:opacity-70" style={{ color:'#22c55e' }}>
                            <Send size={15}/>
                          </button>
                        )}
                        {canVoid && s.status !== 'anulada' && (
                          <button onClick={() => voidIt(s)} title="Anular"
                            className="p-1.5 rounded hover:opacity-70 text-red-400">
                            <Ban size={15}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          prefill={typeof showGenerate === 'object' ? showGenerate : null}
          onClose={() => setShowGenerate(false)}
          onSaved={refresh}
        />
      )}
      {payTarget   && <PayModal settlement={payTarget} onClose={() => setPayTarget(null)} onSaved={refresh}/>}
    </div>
  );
};

export default SettlementsPage;
