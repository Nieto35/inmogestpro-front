// src/pages/Contracts/ContractsPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Download, Eye, FileText,
  ChevronLeft, ChevronRight, RefreshCw, X, AlertTriangle, Edit
} from 'lucide-react';
import { contractsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v||0);

const STATUS_CONFIG = {
  activo:       { label:'Activo',       class:'badge-activo'      },
  cancelado:    { label:'Cancelado',    class:'badge-cancelado'   },
  escriturado:  { label:'Escriturado',  class:'badge-escriturado' },
  en_mora:      { label:'En Mora',      class:'badge-en_mora'     },
  refinanciado: { label:'Refinanciado', class:'badge-pendiente'   },
};

const PAYMENT_TYPE = {
  credito:     'Crédito',
  contado:     'Contado',
  leasing:     'Leasing',
  subsidio:    'Subsidio',
  permuta:     'Permuta',
  corto_plazo: 'Corto plazo',
};

// ── Modal cancelar contrato ───────────────────────────────────
const CancelContractModal = ({ contract, onClose, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCancel = async () => {
    if (!reason.trim() || reason.trim().length < 10)
      return toast.error('El motivo debe tener al menos 10 caracteres');
    setSaving(true);
    try {
      await contractsService.changeStatus(contract.id, 'cancelado', reason);
      toast.success(`Contrato ${contract.contract_number} cancelado`);
      onCancelled();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cancelar el contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background:'var(--color-bg-card)', border:'1px solid rgba(239,68,68,0.35)' }}>

        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor:'rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(239,68,68,0.1)' }}>
              <AlertTriangle size={20} className="text-red-400"/>
            </div>
            <div>
              <h2 className="font-bold" style={{ color:'var(--color-text-primary)' }}>
                Cancelar Contrato
              </h2>
              <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                {contract?.contract_number} · {contract?.client_name}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg text-sm"
            style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', color:'#fca5a5' }}>
            ⚠️ Esta acción liberará el inmueble y quedará registrada permanentemente en auditoría.
          </div>

          <div>
            <label className="block text-sm font-medium mb-2"
              style={{ color:'var(--color-text-secondary)' }}>
              Motivo de cancelación <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input text-sm resize-none w-full"
              rows={4}
              placeholder="Explique el motivo de la cancelación (mínimo 10 caracteres)..."
              autoFocus
            />
            <p className="text-xs mt-1.5 font-medium"
              style={{ color: reason.trim().length >= 10 ? '#10b981' : '#94a3b8' }}>
              {reason.trim().length} / 10 caracteres mínimos
              {reason.trim().length >= 10 && ' ✓'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn btn-secondary flex-1">
              No cancelar
            </button>
            <button
              onClick={handleCancel}
              disabled={saving || reason.trim().length < 10}
              className="btn flex-1 font-medium"
              style={{
                background: reason.trim().length >= 10 ? '#dc2626' : 'rgba(220,38,38,0.3)',
                color:      reason.trim().length >= 10 ? 'white'   : '#9ca3af',
                cursor:     reason.trim().length >= 10 ? 'pointer' : 'not-allowed',
              }}>
              {saving ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const ContractsPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const queryClient  = useQueryClient();
  const { hasRole }  = useAuthStore();
  const canCreate    = hasRole('admin','gerente');
  const canExport    = hasRole('admin','gerente','contador');
  const canCancel    = hasRole('admin','gerente','contador');
  const isAsesor     = hasRole('asesor');

  const [filters, setFilters] = useState({
    search:'', status:'', payment_type:'', page:1, limit:20,
  });
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data, isPending: isLoading, refetch, isFetching } = useQuery({
    queryKey: ['contracts', filters],
    queryFn:  () => contractsService.getAll(filters),
  });

  const contracts  = data?.data?.data        || [];
  const pagination = data?.data?.pagination  || {};

  const setFilter = (k, v) => setFilters(f => ({...f,[k]:v, page:1}));

  const clearFilters = () => setFilters({ search:'', status:'', payment_type:'', page:1, limit:20 });

  const activeFilterCount = [filters.status, filters.payment_type, filters.search].filter(Boolean).length;

  const handleCancelled = () => {
    queryClient.invalidateQueries({ queryKey:['contracts'] });
    refetch();
  };

  const handleExport = () => {
    const headers = ['Contrato','Cliente','Proyecto','Unidad','Asesor','Fecha Firma','Estado','Tipo Pago','Valor Total','Recaudado'];
    const csv = [
      headers.join(','),
      ...contracts.map(c => [
        c.contract_number,
        `"${c.client_name}"`,
        `"${c.project_name}"`,
        c.property_unit,
        `"${c.advisor_name||''}"`,
        c.signing_date,
        c.status,
        c.payment_type,
        c.total_value,
        c.total_paid,
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `contratos_${format(new Date(),'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getProgressPct = (c) =>
    c.installments_total > 0
      ? Math.round((c.paid_installments / c.installments_total) * 100)
      : 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Modal cancelar */}
      {cancelTarget && (
        <CancelContractModal
          contract={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>
            Contratos
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            {pagination.total ?? contracts.length} contratos registrados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          {canExport && (
            <button onClick={handleExport} className="btn btn-secondary btn-sm">
              <Download size={14}/> Exportar
            </button>
          )}
          {canCreate && (
            <button onClick={() => navigate(to('contracts/new'))} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nuevo Contrato
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color:'var(--color-text-muted)' }}/>
            <input
              type="text"
              placeholder="Buscar por cliente, contrato, documento..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              className="input pl-9 text-sm"
              style={{ height:'36px' }}
            />
          </div>

          <select value={filters.status}
            onChange={e => setFilter('status', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([k,v]) =>
              <option key={k} value={k}>{v.label}</option>
            )}
          </select>

          <select value={filters.payment_type}
            onChange={e => setFilter('payment_type', e.target.value)}
            className="input text-sm" style={{ height:'36px', width:'auto' }}>
            <option value="">Tipo de pago</option>
            {Object.entries(PAYMENT_TYPE).map(([k,v]) =>
              <option key={k} value={k}>{v}</option>
            )}
          </select>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="btn btn-ghost btn-sm text-red-400 hover:text-red-300">
              <X size={14}/> Limpiar ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color:'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="animate-spin mx-auto mb-2"/>
            Cargando contratos...
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }}/>
            <p style={{ color:'var(--color-text-secondary)' }}>
              No hay contratos que coincidan con los filtros
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="btn btn-secondary btn-sm mt-3">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Proyecto / Unidad</th>
                <th>Asesor</th>
                <th>Fecha Firma</th>
                <th>Estado</th>
                <th>Tipo Pago</th>
                <th>Valor Total</th>
                <th>Avance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const statusCfg = STATUS_CONFIG[c.status] || { label:c.status, class:'badge-pendiente' };
                const pct       = getProgressPct(c);
                return (
                  <tr key={c.id}
                    style={{ cursor: isAsesor ? 'default' : 'pointer' }}
                    onClick={() => !isAsesor && navigate(to(`contracts/${c.id}`))}>

                    <td>
                      <span className="font-mono text-sm font-medium"
                        style={{ color:'var(--color-text-accent)' }}>
                        {c.contract_number}
                      </span>
                    </td>

                    <td>
                      <p className="font-medium text-sm" style={{ color:'var(--color-text-primary)' }}>
                        {c.client_name}
                      </p>
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        {c.client_document}
                      </p>
                    </td>

                    <td>
                      <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                        {c.project_name}
                      </p>
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        Unidad {c.property_unit}
                        {c.m2_construction ? ` · ${c.m2_construction}m²` : ''}
                      </p>
                    </td>

                    <td>
                      <p className="text-sm" style={{ color:'var(--color-text-primary)' }}>
                        {c.advisor_name || '—'}
                      </p>
                      {c.advisor_type && (
                        <span className={`badge text-xs ${c.advisor_type==='freelance' ? 'badge-freelance' : 'badge-planta'} mt-0.5`}>
                          {c.advisor_type}
                        </span>
                      )}
                    </td>

                    <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                      {c.signing_date ? format(new Date(c.signing_date),'dd/MM/yyyy') : '—'}
                    </td>

                    <td>
                      <span className={`badge ${statusCfg.class}`}>{statusCfg.label}</span>
                    </td>

                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {PAYMENT_TYPE[c.payment_type] || c.payment_type}
                    </td>

                    <td>
                      <p className="text-sm font-mono font-medium" style={{ color:'var(--color-text-primary)', whiteSpace:'nowrap' }}>
                        {formatCurrency(c.total_value)}
                      </p>
                      {c.installments_total > 1 && (
                        <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                          {c.installments_total} cuotas
                        </p>
                      )}
                    </td>

                    <td style={{ minWidth:'110px' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full"
                          style={{ background:'var(--color-bg-primary)' }}>
                          <div className="h-1.5 rounded-full transition-all"
                            style={{
                              width:`${Math.min(pct,100)}%`,
                              background: pct>=100 ? '#10b981' : pct>50 ? '#3b82f6' : '#f59e0b',
                            }}/>
                        </div>
                        <span className="text-xs w-8 text-right"
                          style={{ color:'var(--color-text-muted)' }}>
                          {pct}%
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                        {c.paid_installments}/{c.installments_total} cuotas
                      </p>
                    </td>

                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {!isAsesor && (
                          <button
                            onClick={() => navigate(to(`contracts/${c.id}`))}
                            className="btn btn-ghost btn-sm"
                            title="Ver detalle">
                            <Eye size={14}/>
                          </button>
                        )}
                        {canCancel && c.status !== 'cancelado' && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(to(`contracts/${c.id}/edit`)); }}
                            className="btn btn-ghost btn-sm"
                            title="Editar contrato"
                            style={{ color:'#f59e0b' }}>
                            <Edit size={14}/>
                          </button>
                        )}
                        {canCancel && ['activo','en_mora'].includes(c.status) && (
                          <button
                            onClick={e => { e.stopPropagation(); setCancelTarget(c); }}
                            className="btn btn-ghost btn-sm"
                            title="Cancelar contrato"
                            style={{ color:'#ef4444' }}>
                            <X size={14}/>
                          </button>
                        )}
                      </div>
                      {/* Indicadores de comisión pagada */}
                      {(c.advisor_commission_paid || c.abogado_commission_paid || c.supervisor_commission_paid) && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.advisor_commission_paid && (
                            <span title="Comisión asesor pagada"
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background:'rgba(16,185,129,0.12)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)' }}>
                              Ase.
                            </span>
                          )}
                          {c.abogado_commission_paid && (
                            <span title="Comisión abogado pagada"
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.3)' }}>
                              Abo.
                            </span>
                          )}
                          {c.supervisor_commission_paid && (
                            <span title="Comisión supervisor pagada"
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background:'rgba(168,85,247,0.12)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.3)' }}>
                              Sup.
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Mostrando {((pagination.page-1)*pagination.limit)+1}–
            {Math.min(pagination.page*pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('page', filters.page-1)}
              disabled={filters.page <= 1}
              className="btn btn-secondary btn-sm">
              <ChevronLeft size={14}/>
            </button>
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_,i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setFilter('page', p)}
                  className={`btn btn-sm ${filters.page===p ? 'btn-primary':'btn-secondary'}`}
                  style={{ minWidth:'34px' }}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setFilter('page', filters.page+1)}
              disabled={filters.page >= pagination.pages}
              className="btn btn-secondary btn-sm">
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsPage;