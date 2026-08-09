// src/pages/Rentals/RentalAlertsPage.jsx
//
// Alertas de arriendo.
//
// Un arriendo no avisa solo. El aniversario llega, el contrato vence, y si
// nadie mira, el canon se queda congelado un año más o el inmueble sigue
// ocupado sin contrato vigente. Esta pantalla es lo que hay que revisar
// cada semana.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, TrendingUp, CalendarClock, AlertTriangle, X, Check, Loader2, Wallet,
} from 'lucide-react';
import { rentalsService, settlementsService } from '../../services/api.service';
import { formatDate, todayISO } from '../../utils/dates';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const fmt = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--color-text-secondary)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

// ── Modal: aplicar el incremento ──────────────────────────────
// Tres caminos, como se acordó: IPC, monto manual, o mantener sin cambio.
// Los tres dejan registro — decidir NO subir también es una decisión.
const IncrementModal = ({ contrato, onClose, onSaved }) => {
  const [modo, setModo]   = useState('ipc');
  const [pct, setPct]     = useState(contrato.increment_pct ? String(contrato.increment_pct) : '');
  const [manual, setManual] = useState('');
  const [desde, setDesde] = useState(contrato.next_increment_date?.slice(0,10) || todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const actual = parseFloat(contrato.canon_amount) || 0;
  const nuevo  = modo === 'ninguno' ? actual
               : modo === 'manual'  ? (parseFloat(manual) || 0)
               : Math.round(actual * (1 + (parseFloat(pct) || 0) / 100));
  const diferencia = nuevo - actual;

  const submit = async () => {
    if (modo === 'ipc'    && !(parseFloat(pct) >= 0))    return toast.error('Indica el porcentaje del IPC');
    if (modo === 'manual' && !(parseFloat(manual) > 0))  return toast.error('Indica el nuevo canon');
    setSaving(true);
    try {
      const res = await rentalsService.applyIncrement(contrato.id, {
        increment_type: modo === 'ipc' ? 'ipc' : modo === 'manual' ? 'manual' : 'ninguno',
        increment_pct:  modo === 'ipc' ? parseFloat(pct) : undefined,
        ipc_reference:  modo === 'ipc' ? parseFloat(pct) : undefined,
        new_canon:      modo === 'manual' ? parseFloat(manual) : undefined,
        effective_date: desde,
        notes:          notes || null,
      });
      toast.success(res?.data?.message || 'Canon actualizado', { duration:8000, style:{ maxWidth:'560px' } });
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo aplicar', { duration:9000, style:{ maxWidth:'560px' } });
    } finally { setSaving(false); }
  };

  const Opcion = ({ id, label, children }) => (
    <button onClick={() => setModo(id)}
      className="w-full text-left p-3 rounded transition-all"
      style={{
        background: modo === id ? 'rgba(200,168,75,0.1)' : 'var(--color-bg-tertiary)',
        border: `1px solid ${modo === id ? 'rgba(200,168,75,0.5)' : 'var(--color-border)'}`,
      }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border:`2px solid ${modo === id ? '#C8A84B' : 'var(--color-text-muted)'}` }}>
          {modo === id && <div className="w-1.5 h-1.5 rounded-full" style={{ background:'#C8A84B' }}/>}
        </div>
        <span className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>{label}</span>
      </div>
      {modo === id && <div className="mt-2 pl-5">{children}</div>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background:'var(--color-bg-secondary)' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <div>
            <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
              Ajustar canon
            </h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {contrato.contract_number} · {contrato.unit_number} · {contrato.client_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70"
            style={{ color:'var(--color-text-muted)' }}><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="p-3 rounded" style={{ background:'var(--color-bg-tertiary)' }}>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Canon actual</p>
            <p className="text-xl font-semibold" style={{ color:'var(--color-text-primary)' }}>{fmt(actual)}</p>
          </div>

          <Opcion id="ipc" label="Aplicar IPC">
            <input type="number" value={pct} onChange={e => setPct(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="input text-sm w-full" placeholder="9.28" step="0.01" min="0"/>
            <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
              Queda registrado el IPC exacto que usaste. Un año después nadie recuerda si fue 9,28 o 9,82.
            </p>
          </Opcion>

          <Opcion id="manual" label="Monto pactado">
            <input type="number" value={manual} onChange={e => setManual(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="input text-sm w-full" placeholder="0" step="1000" min="0"/>
          </Opcion>

          <Opcion id="ninguno" label="Mantener sin cambio">
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              Queda constancia de que revisaste el aniversario y decidiste no subir.
            </p>
          </Opcion>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <Field label="Rige desde" hint="Solo cambian las cuotas pendientes desde esta fecha">
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="input text-sm w-full"/>
            </Field>
            <Field label="Observaciones">
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="input text-sm w-full" placeholder="Opcional"/>
            </Field>
          </div>

          {modo !== 'ninguno' && nuevo > 0 && (
            <div className="p-3 rounded"
              style={{ background:'rgba(200,168,75,0.07)', border:'1px solid rgba(200,168,75,0.25)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color:'var(--color-text-secondary)' }}>Nuevo canon</span>
                <span className="text-lg font-semibold" style={{ color:'var(--color-text-accent)' }}>
                  {fmt(nuevo)}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                {diferencia >= 0 ? '+' : ''}{fmt(diferencia)} mensuales
                {actual > 0 && ` (${((diferencia/actual)*100).toFixed(2)}%)`}
              </p>
            </div>
          )}

          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
            Las cuotas ya pagadas o con abono no cambian: se pactaron al canon anterior.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4" style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={submit} className="btn btn-primary flex items-center gap-1.5" disabled={saving}>
            <Check size={14}/> {saving ? 'Aplicando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RentalAlertsPage = () => {
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const { tenant }  = useParams();
  const to = (x) => `/${tenant}/${x}`;
  const { hasRole } = useAuthStore();
  const canApply = hasRole('admin','gerente','contador');
  const [target, setTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rentals','alerts'],
    queryFn:  () => rentalsService.getAlerts(),
  });
  const d = data?.data?.data;

  // Plata de propietarios. Va en Alertas y no solo en Liquidaciones porque es
  // deuda: no puede depender de que alguien entre a buscarla.
  const { data: pendData } = useQuery({
    queryKey: ['settlements','pending'],
    queryFn:  () => settlementsService.getPending(),
  });
  const deuda = pendData?.data?.data || {};

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey:['rentals'] });
    queryClient.invalidateQueries({ queryKey:['contracts'] });
    setTarget(null);
  };

  const Bloque = ({ icon:Icon, titulo, subtitulo, color, rows, children }) => (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:'1px solid var(--color-border)' }}>
        <Icon size={16} style={{ color }}/>
        <div className="flex-1">
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>{titulo}</h3>
          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{subtitulo}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded font-semibold"
          style={{ background:`${color}22`, color }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center" style={{ color:'var(--color-text-muted)' }}>
          Nada pendiente aquí.
        </p>
      ) : children}
    </div>
  );

  if (isLoading) return (
    <div className="card p-8 flex items-center justify-center gap-2" style={{ color:'var(--color-text-muted)' }}>
      <Loader2 size={16} className="animate-spin"/> Cargando alertas…
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"
          style={{ color:'var(--color-text-primary)', fontFamily:'var(--font-display)' }}>
          <Bell size={20} style={{ color:'var(--color-text-accent)' }}/>
          Alertas de arriendo
        </h1>
        <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
          {d?.total_alertas
            ? `${d.total_alertas} asunto${d.total_alertas === 1 ? '' : 's'} que requieren atención`
            : 'Todo al día'}
        </p>
      </div>

      {/* Lo primero: plata que no es tuya y sigue en tu cuenta. */}
      {deuda.total_deuda > 0 && (
        <div className="card p-4 flex items-start gap-3"
          style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.3)' }}>
          <Wallet size={18} className="text-amber-400 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-semibold" style={{ color:'#f59e0b' }}>
              Le debes {fmt(deuda.total_deuda)} a propietarios
            </p>
            <p className="text-sm mt-0.5" style={{ color:'var(--color-text-secondary)' }}>
              {deuda.total_sin_liquidar > 0 && (
                <>{fmt(deuda.total_sin_liquidar)} de canon cobrado sin liquidar</>
              )}
              {deuda.total_sin_liquidar > 0 && deuda.total_por_girar > 0 && ' · '}
              {deuda.total_por_girar > 0 && (
                <>{fmt(deuda.total_por_girar)} liquidado sin girar</>
              )}
            </p>
          </div>
          <button onClick={() => navigate(to('settlements'))} className="btn btn-primary btn-sm">
            Ir a Liquidaciones
          </button>
        </div>
      )}

      <Bloque icon={TrendingUp} titulo="Canon por ajustar" color="#C8A84B"
        subtitulo="Aniversarios que ya llegaron o llegan en 30 días"
        rows={d?.incrementos_pendientes || []}>
        <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
          {(d?.incrementos_pendientes || []).map(r => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                  {r.unit_number} · {r.client_name}
                </p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  {r.contract_number} · propietario {r.owner_name} · canon {fmt(r.canon_amount)}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded"
                style={{ background: r.dias <= 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                         color:      r.dias <= 0 ? '#ef4444' : '#f59e0b' }}>
                {r.dias <= 0 ? `Vencido hace ${Math.abs(r.dias)} día(s)` : `En ${r.dias} día(s)`}
              </span>
              {canApply && (
                <button onClick={() => setTarget(r)} className="btn btn-primary btn-sm">
                  Ajustar
                </button>
              )}
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque icon={CalendarClock} titulo="Contratos por vencer" color="#3b82f6"
        subtitulo="Vencen en los próximos 60 días — hay que renovar o liberar el inmueble"
        rows={d?.contratos_por_vencer || []}>
        <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
          {(d?.contratos_por_vencer || []).map(r => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                  {r.unit_number} · {r.client_name}
                </p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  {r.contract_number} · vence {formatDate(r.end_date)} · canon {fmt(r.canon_amount)}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded"
                style={{ background:'rgba(59,130,246,0.15)', color:'#3b82f6' }}>
                {r.dias <= 0 ? 'Vencido' : `${r.dias} día(s)`}
              </span>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque icon={AlertTriangle} titulo="Arrendatarios en mora" color="#ef4444"
        subtitulo="Canon vencido sin pagar"
        rows={d?.arrendatarios_en_mora || []}>
        <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
          {(d?.arrendatarios_en_mora || []).map(r => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                  {r.unit_number} · {r.client_name}
                </p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  {r.contract_number} · {r.cuotas_vencidas} cuota(s) · {fmt(r.valor_vencido)}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded"
                style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>
                {r.dias_mora} día(s) de mora
              </span>
            </div>
          ))}
        </div>
      </Bloque>

      {target && (
        <IncrementModal contrato={target} onClose={() => setTarget(null)} onSaved={refresh}/>
      )}
    </div>
  );
};

export default RentalAlertsPage;
