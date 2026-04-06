// src/pages/Audit/AuditPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, CheckCircle, XCircle, Search, Download,
  RefreshCw, AlertTriangle, Lock, ChevronDown, ChevronUp
} from 'lucide-react';
import { auditService } from '../../services/api.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ── Configuración de acciones ────────────────────────────────
const ACTION_CONFIG = {
  LOGIN:                { label:'Login',              color:'#10b981', bg:'rgba(16,185,129,0.12)' },
  LOGOUT:               { label:'Logout',             color:'#94a3b8', bg:'rgba(148,163,184,0.12)' },
  LOGIN_FAILED:         { label:'Login Fallido',      color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  CREATE:               { label:'Creación',           color:'#3b82f6', bg:'rgba(59,130,246,0.12)' },
  READ:                 { label:'Consulta',           color:'#64748b', bg:'rgba(100,116,139,0.12)' },
  UPDATE:               { label:'Actualización',      color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  DELETE:               { label:'Eliminación',        color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  STATUS_CHANGE:        { label:'Cambio Estado',      color:'#a855f7', bg:'rgba(168,85,247,0.12)' },
  PAYMENT_RECORDED:     { label:'Pago Registrado',    color:'#10b981', bg:'rgba(16,185,129,0.12)' },
  UNAUTHORIZED_ACCESS:  { label:'Acceso Denegado',    color:'#ef4444', bg:'rgba(239,68,68,0.15)' },
  PASSWORD_CHANGED:     { label:'Cambio Contraseña',  color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  PASSWORD_CHANGE_FAILED:{ label:'Error Contraseña',  color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  EXPORT:               { label:'Exportación',        color:'#06b6d4', bg:'rgba(6,182,212,0.12)' },
  SYSTEM_ERROR:         { label:'Error Sistema',      color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
};

const RESOURCE_LABELS = {
  auth:'Autenticación', contracts:'Contratos', clients:'Clientes',
  payments:'Pagos', properties:'Inmuebles', projects:'Proyectos',
  reports:'Reportes', audit:'Auditoría', users:'Usuarios', advisors:'Asesores',
};

// ── Banner de verificación ───────────────────────────────────
const VerifyBanner = ({ result }) => {
  if (!result) return null;
  const ok = result.verified;
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl"
      style={{
        background: ok ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
        border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
      {ok
        ? <CheckCircle size={22} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
        : <XCircle    size={22} className="text-red-400 flex-shrink-0 mt-0.5"/>}
      <div>
        <p className="font-semibold text-sm" style={{ color: ok ? '#10b981':'#ef4444' }}>
          {ok
            ? `✓ Cadena íntegra — ${result.valid} de ${result.total} registros verificados`
            : `✗ Se detectaron ${result.invalid?.length} registros con integridad comprometida`}
        </p>
        {!ok && result.invalid?.length > 0 && (
          <p className="text-xs mt-1" style={{ color:'#fca5a5' }}>
            IDs afectados: {result.invalid.slice(0,3).map(r=>r.id).join(', ')}
            {result.invalid.length > 3 && ` y ${result.invalid.length-3} más`}
          </p>
        )}
        {result.demo && (
          <p className="text-xs mt-1" style={{ color:'#94a3b8' }}>
            (Verificación en modo demo — conecte la BD para verificación real)
          </p>
        )}
      </div>
    </div>
  );
};

// ── Parsear log para extraer info rica (contrato, cliente, etc) ──
const fmtNum = v => { try { return new Intl.NumberFormat('es-CO',{minimumFractionDigits:0}).format(v); } catch { return v; } };

const parseDescription = (log) => {
  const nv   = (() => { try { return typeof log.new_values === 'string' ? JSON.parse(log.new_values) : (log.new_values||{}); } catch{ return {}; } })();
  const ov   = (() => { try { return typeof log.old_values === 'string' ? JSON.parse(log.old_values) : (log.old_values||{}); } catch{ return {}; } })();
  const desc = log.description || '';
  const info = [];

  // Contrato — del backend enriquecido, new_values, o descripción
  const contract = log.contract_number || nv.contract_number || ov.contract_number || desc.match(/CONT-[0-9-]+/)?.[0];
  if (contract) info.push({ icon:'📄', label:'Contrato', value: contract, color:'#60a5fa' });

  // Cliente
  const client = log.client_name || nv.client_name || ov.client_name;
  if (client) info.push({ icon:'👤', label:'Cliente', value: client, color:'#a78bfa' });

  // Asesor — campo nuevo del backend
  const advisor = log.advisor_name || nv.advisor_name || ov.advisor_name;
  if (advisor) info.push({ icon:'🏆', label:'Asesor', value: advisor, color:'#f472b6' });

  // Teléfono del asesor
  const advisorPhone = nv.advisor_phone;
  if (advisorPhone) info.push({ icon:'📱', label:'Tel. Asesor', value: advisorPhone, color:'#fb923c' });

  // Proyecto
  const projectName = log.project_name || nv.project_name;
  if (projectName) info.push({ icon:'🏗️', label:'Proyecto', value: projectName, color:'#f97316' });

  // Unidad del inmueble
  const unit = nv.unit_number || ov.unit_number;
  if (unit) info.push({ icon:'🏠', label:'Unidad', value: unit, color:'#38bdf8' });

  // Recibo de pago
  const receipt = log.receipt_number || nv.receipt_number || desc.match(/PA-[0-9]+/)?.[0];
  if (receipt) info.push({ icon:'🧾', label:'Recibo', value: receipt, color:'#34d399' });

  // Monto — del backend enriquecido o new_values
  const amount = log.amount_logged || nv.amount || nv.total_amount || nv.total_commission;
  if (amount) info.push({ icon:'💰', label:'Monto', value: `$${fmtNum(amount)}`, color:'#fbbf24' });

  // Cuota de comisión
  const installNum = nv.installment_num;
  const totalComm  = nv.total_commission;
  if (installNum) info.push({ icon:'📑', label:'Cuota', value: `${installNum} de ${totalComm ? '$'+fmtNum(totalComm) : '?'}`, color:'#c084fc' });

  // Fecha de pago registrada
  const paidDate = nv.paid_date;
  if (paidDate) info.push({ icon:'📅', label:'Fecha pago', value: paidDate, color:'#67e8f9' });

  // Tipo de comisión
  const commType = nv.commission_type;
  if (commType) info.push({ icon:'📊', label:'Tipo comisión', value: commType==='fija'?'Monto fijo':'Porcentaje', color:'#86efac' });

  // Canal de interacción
  const itype = nv.interaction_type || ov.interaction_type;
  if (itype) info.push({ icon:'📞', label:'Canal', value:{llamada:'Llamada',whatsapp:'WhatsApp',email:'Email',visita:'Visita',otro:'Otro'}[itype]||itype, color:'#4ade80' });

  // Resultado de interacción
  const outcome = nv.outcome || ov.outcome;
  if (outcome) info.push({ icon:'📋', label:'Resultado', value:{acuerdo_pago:'Acuerdo de pago',interesado:'Interesado',sin_respuesta:'Sin respuesta',negativo:'No interesado',pendiente_seguimiento:'Pendiente'}[outcome]||outcome, color:'#94a3b8' });

  return info;
};

// ── Fila del log con expansión ───────────────────────────────
const LogRow = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const actionCfg = ACTION_CONFIG[log.action] || { label:log.action, color:'#94a3b8', bg:'rgba(148,163,184,0.1)' };

  const formatDate = (d) => {
    try { return format(new Date(d), 'dd/MM/yy HH:mm:ss'); } catch { return d || '—'; }
  };

  return (
    <>
      {/* Fila principal */}
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor:'pointer', background: expanded ? 'var(--color-bg-elevated)' : undefined }}
      >
        <td style={{ whiteSpace:'nowrap' }}>
          <span className="text-xs font-mono" style={{ color:'var(--color-text-muted)' }}>
            {formatDate(log.occurred_at)}
          </span>
        </td>
        <td>
          <p className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
            {log.username || '—'}
          </p>
          {log.user_role && (
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{log.user_role}</p>
          )}
        </td>
        <td>
          <span className="badge text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background:actionCfg.bg, color:actionCfg.color }}>
            {actionCfg.label}
          </span>
        </td>
        <td>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
            {RESOURCE_LABELS[log.resource_type] || log.resource_type}
          </p>
          {log.resource_id && (
            <p className="text-xs font-mono truncate max-w-[140px]"
              style={{ color:'var(--color-text-muted)' }}
              title={log.resource_id}>
              #{log.resource_id}
            </p>
          )}
        </td>
        <td>
          <p className="text-sm truncate max-w-[260px]"
            style={{ color:'var(--color-text-secondary)' }}>
            {log.description || '—'}
          </p>
          {/* Mini badges inline para contrato y cliente */}
          {(() => {
            const nv = typeof log.new_values === 'string'
              ? (() => { try { return JSON.parse(log.new_values); } catch{ return {}; }})()
              : log.new_values || {};
            const contract = log.contract_number || nv.contract_number || log.description?.match(/CONT-[0-9-]+/)?.[0];
            const client   = log.client_name || nv.client_name;
            const advisor  = log.advisor_name || nv.advisor_name;
            const receipt  = log.receipt_number || nv.receipt_number;
            if (!contract && !client && !advisor && !receipt) return null;
            return (
              <div className="flex gap-1 mt-1 flex-wrap" onClick={e => e.stopPropagation()}>
                {contract && <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa' }}>{contract}</span>}
                {client && <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background:'rgba(167,139,250,0.12)', color:'#a78bfa' }}>{client}</span>}
                {advisor && <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background:'rgba(244,114,182,0.12)', color:'#f472b6' }}>🏆 {advisor}</span>}
                {receipt && <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background:'rgba(52,211,153,0.12)', color:'#34d399' }}>{receipt}</span>}
              </div>
            );
          })()}
        </td>
        <td>
          <span className="badge text-xs"
            style={{
              background: log.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color:      log.success ? '#10b981'              : '#ef4444',
            }}>
            {log.success ? '✓ OK' : '✗ Error'}
          </span>
        </td>
        <td>
          <span className="text-xs font-mono" style={{ color:'var(--color-text-muted)' }}
            title={log.log_hash}>
            {log.log_hash?.substring(0,10)}...
          </span>
        </td>
        <td>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            className="btn btn-ghost btn-sm">
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </td>
      </tr>

      {/* Fila expandida — información completa en ambos lados */}
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding:0 }}>
            <div className="px-6 py-5"
              style={{ background:'var(--color-bg-primary)', borderBottom:'1px solid var(--color-border)' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* LADO IZQUIERDO — Integridad */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color:'var(--color-text-muted)' }}>
                    Integridad del Registro
                  </p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock size={11} style={{ color:'var(--color-text-muted)' }}/>
                        <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>Hash actual:</span>
                      </div>
                      <p className="font-mono text-xs break-all leading-relaxed" style={{ color:'#60a5fa' }}>
                        {log.log_hash || '—'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock size={11} style={{ color:'var(--color-text-muted)' }}/>
                        <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>Hash anterior:</span>
                      </div>
                      <p className="font-mono text-xs break-all leading-relaxed"
                        style={{ color:'var(--color-text-muted)' }}>
                        {log.previous_log_hash || 'GENESIS'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* LADO CENTRAL — Contexto de acceso */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color:'var(--color-text-muted)' }}>
                    Contexto de Acceso
                  </p>
                  <div className="space-y-2 text-xs">
                    {[
                      ['IP',        log.ip_address  || '—'],
                      ['Rol',       log.user_role   || '—'],
                      ['Sesión',    log.session_id  ? log.session_id.substring(0,16)+'...' : '—'],
                      ['Timestamp', log.occurred_at ? format(new Date(log.occurred_at), "dd/MM/yyyy HH:mm:ss", {locale:es}) : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-16" style={{ color:'var(--color-text-muted)' }}>
                          {label}:
                        </span>
                        <span style={{ color:'var(--color-text-secondary)' }}>{value}</span>
                      </div>
                    ))}
                    {log.error_message && (
                      <div className="mt-2 p-2 rounded text-xs"
                        style={{ background:'rgba(239,68,68,0.08)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.2)' }}>
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                </div>

                {/* LADO DERECHO — Datos del cambio */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color:'var(--color-text-muted)' }}>
                    Datos del Cambio
                  </p>
                  {/* Info rica: contrato, cliente, monto, etc */}
                  {(() => {
                    const info = parseDescription(log);
                    if (info.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {info.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                            style={{ background:`${item.color}15`, border:`1px solid ${item.color}30` }}>
                            <span>{item.icon}</span>
                            <span style={{ color:'var(--color-text-muted)' }}>{item.label}:</span>
                            <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {(log.old_values || log.new_values) ? (
                    <div className="space-y-3">
                      {log.old_values && (
                        <div>
                          <p className="text-xs mb-1 font-medium" style={{ color:'#ef4444' }}>
                            Antes:
                          </p>
                          <pre className="text-xs p-2 rounded overflow-auto max-h-24"
                            style={{ background:'var(--color-bg-secondary)', color:'#fca5a5',
                                     border:'1px solid rgba(239,68,68,0.2)' }}>
                            {typeof log.old_values === 'string'
                              ? log.old_values
                              : JSON.stringify(log.old_values, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_values && (
                        <div>
                          <p className="text-xs mb-1 font-medium" style={{ color:'#10b981' }}>
                            Después:
                          </p>
                          <pre className="text-xs p-2 rounded overflow-auto max-h-24"
                            style={{ background:'var(--color-bg-secondary)', color:'#86efac',
                                     border:'1px solid rgba(16,185,129,0.2)' }}>
                            {typeof log.new_values === 'string'
                              ? log.new_values
                              : JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {/* Acción descriptiva cuando no hay old/new values */}
                      <div className="p-3 rounded-lg text-xs"
                        style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                        <p style={{ color:'var(--color-text-muted)' }}>Descripción:</p>
                        <p className="mt-1 font-medium" style={{ color:'var(--color-text-secondary)' }}>
                          {log.description || 'Sin descripción adicional'}
                        </p>
                      </div>
                      {log.user_agent && (
                        <div className="p-2 rounded text-xs"
                          style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                          <p style={{ color:'var(--color-text-muted)' }}>Agente:</p>
                          <p className="mt-0.5 truncate" style={{ color:'var(--color-text-muted)' }}
                            title={log.user_agent}>
                            {log.user_agent?.substring(0,60)}...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Página principal ─────────────────────────────────────────
const AuditPage = () => {
  const queryClient  = useQueryClient();
  const [filters, setFilters] = useState({
    action:'', resource_type:'', username:'',
    success:'', date_from:'', date_to:'',
    page:1, limit:50,
  });
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying,    setVerifying]    = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn:  () => auditService.getLogs(filters),
  });

  const logs       = data?.data?.data        || [];
  const pagination = data?.data?.pagination  || {};

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]:v, page:1 }));
  const setPage   = (p)    => setFilters(f => ({ ...f, page:p }));

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await auditService.verifyChain({ from_date:filters.date_from, to_date:filters.date_to });
      setVerifyResult(res.data.data);
      if (res.data.data.verified) {
        toast.success(`Cadena íntegra: ${res.data.data.valid} registros verificados`);
      } else {
        toast.error(`Se detectaron ${res.data.data.invalid?.length} registros alterados`);
      }
    } catch {
      toast.error('Error al verificar la cadena de auditoría');
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = () => {
    const headers = ['Fecha','Usuario','Rol','Acción','Recurso','ID','Descripción','IP','Resultado','Hash'];
    const csv = [
      headers.join(','),
      ...logs.map(l => [
        l.occurred_at, l.username, l.user_role||'', l.action,
        l.resource_type, l.resource_id||'',
        `"${(l.description||'').replace(/"/g,'""')}"`,
        l.ip_address||'', l.success?'OK':'ERROR', l.log_hash,
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${format(new Date(),'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // KPIs rápidos
  const stats = {
    total:     pagination.total ?? logs.length,
    errors:    logs.filter(l => !l.success).length,
    logins:    logs.filter(l => l.action==='LOGIN').length,
    payments:  logs.filter(l => l.action==='PAYMENT_RECORDED').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)' }}>
            <Shield size={20} className="text-blue-400"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              Auditoría · No Repudio
            </h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Log inmutable con cadena de integridad HMAC-SHA256
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleVerify} disabled={verifying} className="btn btn-secondary btn-sm">
            {verifying
              ? <RefreshCw size={14} className="animate-spin"/>
              : <CheckCircle size={14}/>}
            Verificar Integridad
          </button>
          <button onClick={handleExport} className="btn btn-secondary btn-sm">
            <Download size={14}/> Exportar CSV
          </button>
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
        </div>
      </div>

      {/* Banner de verificación */}
      <VerifyBanner result={verifyResult}/>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Total registros', value:stats.total,   color:'#3b82f6' },
          { label:'Errores',         value:stats.errors,  color:'#ef4444' },
          { label:'Inicios sesión',  value:stats.logins,  color:'#10b981' },
          { label:'Pagos',           value:stats.payments, color:'#a855f7' },
        ].map((s,i) => (
          <div key={i} className="card p-3">
            <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color:'var(--color-text-muted)' }}/>
            <input type="text" placeholder="Buscar usuario..."
              value={filters.username}
              onChange={e => setFilter('username', e.target.value)}
              className="input pl-9 text-sm" style={{ height:'36px' }}/>
          </div>

          <select value={filters.action}
            onChange={e => setFilter('action', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_CONFIG).map(([k,v]) =>
              <option key={k} value={k}>{v.label}</option>
            )}
          </select>

          <select value={filters.resource_type}
            onChange={e => setFilter('resource_type', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}>
            <option value="">Todos los recursos</option>
            {Object.entries(RESOURCE_LABELS).map(([k,v]) =>
              <option key={k} value={k}>{v}</option>
            )}
          </select>

          <select value={filters.success}
            onChange={e => setFilter('success', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}>
            <option value="">Todos</option>
            <option value="true">Solo exitosos</option>
            <option value="false">Solo errores</option>
          </select>

          <input type="date" value={filters.date_from}
            onChange={e => setFilter('date_from', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}/>
          <input type="date" value={filters.date_to}
            onChange={e => setFilter('date_to', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}/>
        </div>
      </div>

      {/* Aviso legal */}
      <div className="flex items-start gap-3 p-4 rounded-xl text-sm"
        style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
        <p style={{ color:'var(--color-text-secondary)' }}>
          <strong style={{ color:'#f59e0b' }}>Aviso Legal:</strong> Este registro de auditoría
          es inmutable y constituye evidencia de no repudio. Cada entrada está protegida con un
          hash HMAC-SHA256 encadenado. Cualquier alteración es detectable mediante la verificación
          de integridad. Retención mínima: 5 años (1.825 días).
        </p>
      </div>

      {/* Tabla */}
      <div className="table-container">
        {isFetching && logs.length === 0 ? (
          <div className="p-8 text-center" style={{ color:'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="animate-spin mx-auto mb-2"/>
            Cargando registros de auditoría...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Shield size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }}/>
            <p style={{ color:'var(--color-text-secondary)' }}>
              No hay registros de auditoría para los filtros seleccionados
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Recurso</th>
                <th>Descripción</th>
                <th>Resultado</th>
                <th>Hash</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log}/>)}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pagination.total > filters.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {pagination.total} registros totales
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, filters.page-1))}
              disabled={filters.page <= 1}
              className="btn btn-secondary btn-sm">
              ← Anterior
            </button>
            <span className="btn btn-secondary btn-sm" style={{ cursor:'default' }}>
              Página {filters.page}
            </span>
            <button
              onClick={() => setPage(filters.page+1)}
              disabled={filters.page * filters.limit >= pagination.total}
              className="btn btn-secondary btn-sm">
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditPage;