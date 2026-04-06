// src/pages/Advisors/CommissionsPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, Plus, X, Save, CheckCircle, Clock,
  RefreshCw, Search, ChevronDown, ChevronUp, Trash2, Download, Upload
} from 'lucide-react';
import { commissionsService, advisorsService, contractsService, usersService } from '../../services/api.service';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { getActiveTenantSlug } from '../../utils/tenant';
import useAuthStore from '../../store/authStore';
import { useCurrencyFormat } from '../../utils/currency';

// ── Modal Nueva Comisión ──────────────────────────────────────
const NewCommissionModal = ({ onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const { formatCurrency } = useCurrencyFormat();
  const [contractSearch, setContractSearch] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [benefSearch, setBenefSearch] = useState('');
  const [form, setForm] = useState({
    advisor_id:       '',
    commission_type:  'porcentaje',
    percentage:       '3',
    total_amount:     '',
    installments:     '1',
    cuotas:           [],  // [{amount, date}]
    notes:            '',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn:  () => usersService.getAll(),
  });
  const advisors = advisorsData?.data?.data || [];
  // Combinar: asesores registrados + todos los usuarios del sistema
  const allUsers = usersData?.data?.data || [];
  const beneficiaries = [
    ...advisors,
    ...allUsers
      .filter(u => !advisors.some(a => a.user_id === u.id || a.email === u.email))
      .map(u => ({
        id: `user-${u.id}`,
        full_name: u.full_name,
        email: u.email,
        advisor_type: u.role,
        _isUser: true,
        _userId: u.id,
      }))
  ].filter(b =>
    !benefSearch ||
    b.full_name.toLowerCase().includes(benefSearch.toLowerCase()) ||
    (b.email||'').toLowerCase().includes(benefSearch.toLowerCase())
  );

  // Determinar si el beneficiario seleccionado es asesor (planta/freelance/referido)
  // o un rol gerencial (gerente, admin, abogado, contador) que ve todos los contratos
  const selectedBenef = beneficiaries.find(b => b.id === form.advisor_id);
  const isAdvisorType = selectedBenef && ['planta','freelance','referido','externo','asesor']
    .includes(selectedBenef.advisor_type);

  // Comisiones ya existentes para este asesor (para excluir contratos ya pagados)
  const { data: existingComms } = useQuery({
    queryKey: ['existing-comms', form.advisor_id],
    queryFn:  () => commissionsService.getAll({ advisor_id: form.advisor_id }),
    enabled:  !!form.advisor_id,
  });
  const paidContractIds = new Set(
    (existingComms?.data?.data || [])
      .map(c => c.contract_id) // excluir TODOS los contratos que ya tienen comisión registrada
  );

  const { data: contractsData } = useQuery({
    queryKey: ['contracts-comm-search', contractSearch, form.advisor_id, isAdvisorType],
    queryFn:  () => contractsService.getAll({
      search:     contractSearch || undefined,
      advisor_id: isAdvisorType ? form.advisor_id : undefined,
      limit:      50,
    }),
    // Cargar contratos del asesor apenas se selecciona, sin necesitar buscar
    enabled:  !!form.advisor_id,
  });
  // Excluir contratos que ya tienen comisión pagada completamente
  const allContracts = contractsData?.data?.data || [];
  const contracts    = allContracts.filter(c => !paidContractIds.has(c.id));

  // Calcular monto cuando es porcentaje y hay contrato
  const calcAmount = () => {
    if (!selectedContract || !form.percentage) return;
    const pct = parseFloat(form.percentage) / 100;
    const val = parseFloat(selectedContract.net_value || selectedContract.total_value || 0);
    set('total_amount', String(Math.round(val * pct)));
  };

  const perInstallment = form.total_amount && form.installments
    ? Math.ceil(parseFloat(form.total_amount) / parseInt(form.installments))
    : 0;

  // Auto-init cuotas when total changes
  const initCuotas = (total, n) => {
    if (!total || n <= 1) return;
    const base = Math.floor(parseFloat(total) / n);
    const last = parseFloat(total) - base * (n - 1);
    return Array.from({ length:n }, (_, i) => ({
      amount: String(i === n-1 ? last : base),
      date:   '',
    }));
  };

  const handleSubmit = async () => {
    if (!form.advisor_id)   return toast.error('Seleccione el beneficiario');
    if (!selectedContract)  return toast.error('Seleccione el contrato');
    if (!form.total_amount || parseFloat(form.total_amount) <= 0)
      return toast.error('El monto de comisión debe ser mayor a 0');

    setSaving(true);
    try {
      let advisorId = form.advisor_id;

      // Si es un usuario sin registro en advisors, crearlo automáticamente
      if (advisorId.startsWith('user-')) {
        const benef = beneficiaries.find(b => b.id === advisorId);
        if (!benef) return toast.error('Beneficiario no encontrado');

        // Crear registro en advisors
        // Mapear rol de usuario a advisor_type válido
        const roleToType = {
          admin: 'gerente', gerente: 'gerente', contador: 'externo',
          asesor: 'planta', abogado: 'abogado', readonly: 'externo',
        };
        const res = await advisorsService.create({
          full_name:       benef.full_name,
          email:           benef.email || null,
          advisor_type:    roleToType[benef.advisor_type] || 'externo',
          commission_rate: 0,
          user_id:         benef._userId,
        });
        advisorId = res.data?.data?.id;
        if (!advisorId) throw new Error('No se pudo crear el beneficiario');
      }

      await commissionsService.create({
        advisor_id:      advisorId,
        contract_id:     selectedContract.id,
        commission_type: form.commission_type,
        total_amount:    parseFloat(form.total_amount),
        installments:    parseInt(form.installments) || 1,
        cuotas:          form.cuotas?.length > 1 ? form.cuotas : null,
        notes:           form.notes || null,
      });
      toast.success('Comisión registrada correctamente');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background:'rgba(0,0,0,0.7)', paddingTop:'4vh' }}>
      <div className="w-full rounded-2xl shadow-2xl flex flex-col"
        style={{ maxWidth:'520px', margin:'0 16px', background:'var(--color-bg-card)',
                 border:'1px solid var(--color-border)', maxHeight:'92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <h2 className="font-bold" style={{ color:'var(--color-text-primary)' }}>
            Nueva Comisión
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Asesor */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              Beneficiario (asesor, gerente, abogado...) *
            </label>
            {/* Buscador de beneficiario */}
            <input
              type="text"
              value={benefSearch}
              onChange={e => setBenefSearch(e.target.value)}
              className="input text-sm mb-1.5"
              placeholder="🔍 Buscar por nombre o email..."
            />
            <select value={form.advisor_id} onChange={e => {
              set('advisor_id', e.target.value);
              setSelectedContract(null);
              setContractSearch('');
            }}
            className="input text-sm"
            size={beneficiaries.length > 0 && benefSearch ? Math.min(beneficiaries.length+1, 6) : 1}>
              <option value="">Seleccionar beneficiario...</option>
              {beneficiaries.map(a => {
                const typeLabel = {
                  planta:'Planta', freelance:'Freelance', referido:'Referido',
                  gerente:'Gerente', abogado:'Abogado', externo:'Externo',
                  admin:'Administrador', contador:'Contador', asesor:'Asesor', readonly:'Solo lectura'
                }[a.advisor_type] || a.advisor_type;
                return (
                  <option key={a.id} value={a.id}>
                    {a.full_name} · {typeLabel}
                    {a._isUser ? ' (usuario)' : ''}
                  </option>
                );
              })}
            </select>
            {form.advisor_id && (() => {
              const sel = beneficiaries.find(b => b.id === form.advisor_id);
              return sel ? (
                <p className="text-xs mt-1" style={{ color:'#60a5fa' }}>
                  ✓ {sel.full_name} {sel.email ? `· ${sel.email}` : ''}
                </p>
              ) : null;
            })()}
          </div>

          {/* Contrato */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              Contrato *
            </label>
            {!selectedContract ? (
              <div className="space-y-2">
                {!form.advisor_id ? (
                  <div className="p-3 rounded-xl text-sm text-center"
                    style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)',
                             border:'1px solid var(--color-border)' }}>
                    ☝️ Selecciona primero el beneficiario para ver los contratos
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="p-3 rounded-xl text-sm text-center"
                    style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)',
                             border:'1px solid var(--color-border)' }}>
                    {isAdvisorType
                      ? 'Este asesor no tiene contratos activos'
                      : 'No se encontraron contratos. Busca por número o cliente.'}
                  </div>
                ) : (
                  <div>
                    {/* Buscador opcional dentro de los contratos del asesor */}
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color:'var(--color-text-muted)' }}/>
                      <input value={contractSearch} onChange={e => setContractSearch(e.target.value)}
                        className="input pl-9 text-sm"
                        placeholder={isAdvisorType
                          ? `Filtrar entre ${contracts.length} contrato${contracts.length!==1?'s':''} del asesor...`
                          : `Buscar en todos los contratos por número o cliente...`}/>
                    </div>
                    <div className="rounded-xl overflow-hidden"
                      style={{ border:'1px solid var(--color-border)' }}>
                      {contracts
                        .filter(c => !contractSearch ||
                          c.contract_number?.toLowerCase().includes(contractSearch.toLowerCase()) ||
                          c.client_name?.toLowerCase().includes(contractSearch.toLowerCase()))
                        .map((c, idx, arr) => (
                        <button key={c.id}
                          onClick={() => {
                            setSelectedContract(c);
                            setContractSearch('');
                            // Calcular monto si es porcentaje
                            if (form.commission_type === 'porcentaje' && form.percentage) {
                              const pct = parseFloat(form.percentage)/100;
                              const val = parseFloat(c.net_value||c.total_value||0);
                              set('total_amount', String(Math.round(val*pct)));
                            }
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between"
                          style={{
                            borderBottom: idx < arr.length-1 ? '1px solid var(--color-border)' : 'none',
                            background: 'var(--color-bg-secondary)',
                          }}>
                          <div>
                            <p className="font-mono font-medium"
                              style={{ color:'var(--color-text-accent)' }}>
                              {c.contract_number}
                            </p>
                            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                              {c.client_name} · {c.status}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-xs font-mono font-bold"
                              style={{ color:'#10b981' }}>
                              {formatCurrency(c.net_value||c.total_value)}
                            </p>
                            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                              {c.payment_type}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.3)' }}>
                <div>
                  <p className="text-sm font-mono font-bold" style={{ color:'#60a5fa' }}>
                    {selectedContract.contract_number}
                  </p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    {selectedContract.client_name} · {formatCurrency(selectedContract.net_value||selectedContract.total_value)}
                  </p>
                </div>
                <button onClick={() => { setSelectedContract(null); setContractSearch(''); }}
                  className="text-red-400 hover:text-red-300">
                  <X size={13}/>
                </button>
              </div>
            )}
          </div>

          {/* Tipo de comisión */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              Tipo de comisión
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['porcentaje', '% Porcentaje', 'Calculado sobre el valor del contrato'],
                ['fija',       '$ Monto fijo', 'Valor fijo acordado independiente del contrato'],
              ].map(([val, lbl, hint]) => (
                <button key={val} onClick={() => set('commission_type', val)}
                  className="p-3 rounded-xl text-left text-sm transition-all"
                  style={{
                    background: form.commission_type===val ? 'rgba(59,130,246,0.12)' : 'var(--color-bg-secondary)',
                    border:     `1.5px solid ${form.commission_type===val ? '#3b82f6' : 'var(--color-border)'}`,
                    color:      form.commission_type===val ? '#60a5fa' : 'var(--color-text-secondary)',
                  }}>
                  <p className="font-semibold">{lbl}</p>
                  <p className="text-xs mt-0.5 opacity-70">{hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          {form.commission_type === 'porcentaje' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color:'var(--color-text-primary)' }}>
                  Porcentaje (%)
                </label>
                <div className="flex gap-2">
                  <input type="number" value={form.percentage}
                    onChange={e => set('percentage', e.target.value)}
                    className="input text-sm flex-1" min="0" max="50" step="0.5" placeholder="3"/>
                  <button onClick={calcAmount} className="btn btn-secondary btn-sm whitespace-nowrap">
                    Calcular
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color:'var(--color-text-primary)' }}>
                  Monto total
                </label>
                <input type="number" value={form.total_amount}
                  onChange={e => set('total_amount', e.target.value)}
                  className="input text-sm" placeholder="0" min="0" step="1000"/>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1.5"
                style={{ color:'var(--color-text-primary)' }}>
                Monto fijo de comisión *
              </label>
              <input type="number" value={form.total_amount}
                onChange={e => set('total_amount', e.target.value)}
                className="input text-sm" placeholder="500000" min="0" step="1000"/>
            </div>
          )}

          {/* Dividir en cuotas */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              ¿En cuántos pagos se divide?
            </label>
            <select value={form.installments}
              onChange={e => {
                const n = parseInt(e.target.value) || 1;
                set('installments', String(n));
                // Generar cuotas con montos iguales y fechas vacías
                if (n > 0 && form.total_amount) {
                  const base = Math.floor(parseFloat(form.total_amount) / n);
                  const last = parseFloat(form.total_amount) - base * (n - 1);
                  const cuotas = Array.from({ length:n }, (_, i) => ({
                    amount: i === n-1 ? String(last) : String(base),
                    date:   '',
                  }));
                  set('cuotas', cuotas);
                }
              }}
              className="input text-sm">
              {[1,2,3,4,5,6,8,10,12].map(n => (
                <option key={n} value={n}>
                  {n === 1 ? 'Pago único (un solo pago)' : `${n} pagos`}
                </option>
              ))}
            </select>
          </div>

          {/* Cuotas detalladas — solo cuando hay más de 1 */}
          {form.cuotas && form.cuotas.length > 1 && form.total_amount && (
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color:'var(--color-text-primary)' }}>
                Detalle de cada pago
              </label>
              <div className="space-y-2">
                {form.cuotas.map((cuota, idx) => (
                  <div key={idx}
                    className="grid grid-cols-2 gap-2 p-3 rounded-xl"
                    style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                    <div>
                      <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
                        Pago {idx + 1} — Monto
                      </p>
                      <input
                        type="number"
                        value={cuota.amount}
                        onChange={e => {
                          const updated = [...form.cuotas];
                          updated[idx] = { ...updated[idx], amount: e.target.value };
                          set('cuotas', updated);
                        }}
                        className="input text-sm"
                        placeholder="0"
                        min="0"
                        step="1000"
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
                        Fecha programada de pago
                      </p>
                      <input
                        type="date"
                        value={cuota.date}
                        onChange={e => {
                          const updated = [...form.cuotas];
                          updated[idx] = { ...updated[idx], date: e.target.value };
                          set('cuotas', updated);
                        }}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                ))}
                {/* Verificar que sumen bien */}
                {(() => {
                  const suma = form.cuotas.reduce((s, c) => s + parseFloat(c.amount||0), 0);
                  const total = parseFloat(form.total_amount||0);
                  const diff  = Math.abs(suma - total);
                  return diff > 1 ? (
                    <p className="text-xs" style={{ color:'#f59e0b' }}>
                      ⚠ Los pagos suman {formatCurrency(suma)} — el total es {formatCurrency(total)}.
                      Diferencia: {formatCurrency(diff)}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color:'#10b981' }}>
                      ✓ Los pagos suman exactamente {formatCurrency(suma)}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              Observaciones
            </label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              className="input text-sm resize-none w-full" rows={2}
              placeholder="Acuerdos, condiciones especiales..."/>
          </div>

          {/* Resumen */}
          {form.total_amount && parseFloat(form.total_amount) > 0 && (
            <div className="p-3 rounded-xl"
              style={{ background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color:'#10b981' }}>
                Resumen de la comisión
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p style={{ color:'var(--color-text-muted)' }}>Total comisión</p>
                  <p className="font-bold font-mono text-sm" style={{ color:'#10b981' }}>
                    {formatCurrency(parseFloat(form.total_amount))}
                  </p>
                </div>
                <div>
                  <p style={{ color:'var(--color-text-muted)' }}>
                    {parseInt(form.installments)===1 ? 'Pago único' : `${form.installments} pagos`}
                  </p>
                  <p className="font-bold font-mono text-sm" style={{ color:'var(--color-text-primary)' }}>
                    {parseInt(form.installments)===1
                      ? formatCurrency(parseFloat(form.total_amount))
                      : `${formatCurrency(perInstallment)} c/u`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary flex-1">
            <Save size={14}/> {saving ? 'Guardando...' : 'Registrar Comisión'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Fila de comisión con sus cuotas ──────────────────────────
const CommissionRow = ({ comm, canEdit, onRefresh, compact = false }) => {
  const [open,         setOpen]       = useState(false);
  const [paying,       setPaying]     = useState(null);
  const [paidDates,    setPaidDates]  = useState({});
  const [pendingFiles, setPendingFiles] = useState({}); // evidencia pendiente por payId
  const { formatCurrency } = useCurrencyFormat();
  const queryClient = useQueryClient();

  const { data: paymentsData, refetch: refetchPayments } = useQuery({
    queryKey: ['comm-payments', comm.id],
    queryFn:  () => commissionsService.getPayments(comm.id),
    enabled:  open,
  });
  const payments = paymentsData?.data?.data || [];

  const paidAmount = parseFloat(comm.paid_amount || 0);
  const total      = parseFloat(comm.total_amount || 0);
  const pct        = total > 0 ? Math.round((paidAmount/total)*100) : 0;
  const allPaid    = paidAmount >= total;

  const getPayDate = (payId) =>
    paidDates[payId] || new Date().toISOString().split('T')[0];

  const handleMarkPaid = async (payId) => {
    const dateToUse = getPayDate(payId);
    setPaying(payId);
    try {
      await commissionsService.markPaid(payId, { paid_date: dateToUse });

      // Si hay evidencia pendiente, subirla ahora que el pago existe
      const pendingFile = pendingFiles[payId];
      if (pendingFile) {
        try {
          const fd = new FormData();
          fd.append('file', pendingFile);
          const token = localStorage.getItem('inmogest_token');
          const res = await fetch(`/api/v1/${getActiveTenantSlug()}/commissions/payments/${payId}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const json = await res.json();
          if (json.success) {
            toast.success(`Cuota pagada y evidencia subida correctamente`);
          } else {
            toast.success(`Cuota marcada como pagada el ${format(new Date(dateToUse), 'dd/MM/yyyy')}`);
            toast.error('La evidencia no se pudo subir: ' + (json.message || 'Error'));
          }
          // Limpiar archivo pendiente
          setPendingFiles(prev => { const n = {...prev}; delete n[payId]; return n; });
        } catch {
          toast.success(`Cuota marcada como pagada el ${format(new Date(dateToUse), 'dd/MM/yyyy')}`);
          toast.error('Error al subir la evidencia');
        }
      } else {
        toast.success(`Cuota marcada como pagada el ${format(new Date(dateToUse), 'dd/MM/yyyy')}`);
      }

      refetchPayments();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setPaying(null);
    }
  };

  const handleMarkUnpaid = async (payId) => {
    setPaying(payId);
    try {
      await commissionsService.markUnpaid(payId);
      toast.success('Cuota desmarcada');
      refetchPayments();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className={compact ? 'px-5 py-3' : 'card'}>
      {/* Fila principal */}
      <div className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Solo mostrar nombre del asesor si no está en modo compacto (agrupado) */}
            {!compact && (
              <span className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
                {comm.advisor_name}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: comm.commission_type==='fija' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                color:      comm.commission_type==='fija' ? '#c084fc' : '#60a5fa',
              }}>
              {comm.commission_type === 'fija' ? '$ Fija' : '% Porcentaje'}
            </span>
            {allPaid && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background:'rgba(16,185,129,0.1)', color:'#10b981' }}>
                ✓ Pagada completa
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
            {comm.contract_number} · {comm.client_name}
          </p>
          {/* Barra de progreso */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full"
              style={{ background:'var(--color-bg-primary)' }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{ width:`${pct}%`, background: allPaid ? '#10b981' : '#3b82f6' }}/>
            </div>
            <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              {formatCurrency(paidAmount)} / {formatCurrency(total)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="font-bold font-mono text-sm" style={{ color:'#10b981' }}>
              {formatCurrency(total)}
            </p>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              {comm.installments} pago{comm.installments!==1?'s':''}
            </p>
          </div>
          {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {/* Cuotas expandidas */}
      {open && (
        <div className="mt-4 pt-4 space-y-2"
          style={{ borderTop:'1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color:'var(--color-text-muted)' }}>
              Cuotas de pago de comisión
            </p>
            <button
              onClick={() => {
                const wb = XLSX.utils.book_new();
                const rows = [['Cuota','Monto','Estado','Fecha Pago','Pagado por','Notas']];
                payments.forEach(p => rows.push([
                  `Pago ${p.installment_num}`,
                  parseFloat(p.amount||0),
                  p.is_paid ? 'Pagado' : 'Pendiente',
                  p.paid_date ? new Date(p.paid_date).toLocaleDateString('es-CO') : '',
                  p.paid_by_name || '',
                  p.notes || '',
                ]));
                rows.push(['TOTAL', parseFloat(comm.total_amount||0), '', '', '', '']);
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [10,16,12,14,18,20].map(w=>({wch:w}));
                XLSX.utils.book_append_sheet(wb, ws, 'Comisión');
                // Hoja resumen
                const ws2 = XLSX.utils.aoa_to_sheet([
                  ['Asesor',          comm.advisor_name],
                  ['Contrato',        comm.contract_number],
                  ['Cliente',         comm.client_name],
                  ['Tipo comisión',   comm.commission_type==='fija'?'Monto fijo':'Porcentaje'],
                  ['Total comisión',  parseFloat(comm.total_amount||0)],
                  ['Total pagado',    parseFloat(comm.paid_amount||0)],
                  ['Pendiente',       parseFloat(comm.total_amount||0)-parseFloat(comm.paid_amount||0)],
                  ['N° pagos',        comm.installments],
                ]);
                ws2['!cols'] = [{wch:18},{wch:25}];
                XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
                XLSX.writeFile(wb, `Comision_${comm.advisor_name.replace(/ /g,'_')}_${comm.contract_number}.xlsx`);
              }}
              className="btn btn-secondary btn-sm text-xs flex items-center gap-1"
              style={{ color:'#10b981' }}>
              <Download size={11}/> Exportar
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              Cargando...
            </p>
          ) : (
            payments.map(pay => (
              <div key={pay.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: pay.is_paid ? 'rgba(16,185,129,0.06)' : 'var(--color-bg-secondary)',
                  border: `1px solid ${pay.is_paid ? 'rgba(16,185,129,0.2)' : 'var(--color-border)'}`,
                }}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center`}
                    style={{
                      background: pay.is_paid ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                    }}>
                    {pay.is_paid
                      ? <CheckCircle size={14} className="text-emerald-400"/>
                      : <Clock size={14} style={{ color:'var(--color-text-muted)' }}/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                      Pago {pay.installment_num} — {formatCurrency(pay.amount)}
                    </p>
                    {pay.is_paid && pay.paid_date && (
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        Pagado el {format(new Date(pay.paid_date), 'dd/MM/yyyy')}
                        {pay.paid_by_name && ` por ${pay.paid_by_name}`}
                      </p>
                    )}
                    {!pay.is_paid && pay.paid_date && (
                      <p className="text-xs" style={{ color:'#f59e0b' }}>
                        📅 Programado: {format(new Date(pay.paid_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                    {/* Mostrar evidencias adjuntas */}
                    {pay.notes && pay.notes.includes('[evidencia:') && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {pay.notes.match(/\[evidencia:([^\]]+)\]/g)?.map((match, ei) => {
                          const url = match.replace('[evidencia:','').replace(']','');
                          const filename = url.split('/').pop();
                          const ext = filename.split('.').pop().toLowerCase();
                          const icon = ['jpg','jpeg','png','webp'].includes(ext) ? '🖼️'
                                     : ext === 'pdf' ? '📄' : '📎';
                          return (
                            <a key={ei}
                              href={`/api/v1/${getActiveTenantSlug()}${url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors hover:opacity-80"
                              style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', color:'#60a5fa' }}>
                              <span>{icon}</span>
                              <span>Evidencia {ei+1}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    {/* Subir evidencia del pago */}
                    <label className="btn btn-ghost btn-sm text-xs cursor-pointer"
                      title={pendingFiles[pay.id] ? `Evidencia lista: ${pendingFiles[pay.id].name}` : 'Subir evidencia de pago'}
                      style={{ color: pendingFiles[pay.id] ? '#10b981' : 'var(--color-text-muted)' }}>
                      {pendingFiles[pay.id] ? <CheckCircle size={12}/> : <Upload size={12}/>}
                      <input type="file" className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={async e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (pay.is_paid) {
                            // Ya está pagado — subir directamente
                            const fd = new FormData();
                            fd.append('file', file);
                            try {
                              const token = localStorage.getItem('inmogest_token');
                              const res = await fetch(`/api/v1/${getActiveTenantSlug()}/commissions/payments/${pay.id}/evidence`, {
                                method:'POST',
                                headers:{ Authorization:`Bearer ${token}` },
                                body: fd,
                              });
                              const json = await res.json();
                              if (json.success) { toast.success('Evidencia subida'); refetchPayments(); }
                              else toast.error(json.message||'Error');
                            } catch { toast.error('Error al subir'); }
                          } else {
                            // Aún no pagado — guardar para subir junto con "Marcar pagado"
                            setPendingFiles(prev => ({ ...prev, [pay.id]: file }));
                            toast.success(`Evidencia lista: "${file.name}" — se subirá al marcar pagado`, { duration:4000 });
                          }
                          e.target.value = '';
                        }}/>
                    </label>
                    {/* Fecha real del pago — solo si no está pagado */}
                    {!pay.is_paid && (
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                          Fecha real del pago:
                        </label>
                        <input
                          type="date"
                          value={getPayDate(pay.id)}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={e => setPaidDates(prev => ({ ...prev, [pay.id]: e.target.value }))}
                          className="input text-xs"
                          style={{ padding:'4px 8px', height:'30px', minWidth:'130px' }}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => pay.is_paid ? handleMarkUnpaid(pay.id) : handleMarkPaid(pay.id)}
                      disabled={paying === pay.id}
                      className={`btn btn-sm text-xs ${pay.is_paid ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ minWidth:'110px' }}>
                      {paying === pay.id ? '...' : pay.is_paid ? '↩ Desmarcar' : '✓ Marcar pagado'}
                    </button>                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const CommissionsPage = () => {
  const { hasRole }     = useAuthStore();
  const queryClient     = useQueryClient();
  const canEdit         = hasRole('admin','gerente','contador');
  const { formatCurrency } = useCurrencyFormat();
  const [showModal, setShowModal] = useState(false);
  const [activeTab,     setActiveTab]     = useState('todas');
  const [filterAdvisor, setFilterAdvisor] = useState('');
  const [filterSearch,  setFilterSearch]  = useState('');

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['commissions', filterAdvisor],
    queryFn:  () => commissionsService.getAll(filterAdvisor ? { advisor_id:filterAdvisor } : {}),
  });

  const { data: overdueData, refetch: refetchOverdue } = useQuery({
    queryKey: ['commissions-overdue'],
    queryFn:  () => commissionsService.getOverdue(),
    staleTime: 0,
  });

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const advisors    = advisorsData?.data?.data || [];
  const commissions = data?.data?.data || [];
  const overdues    = overdueData?.data?.data || [];

  const totalPending = commissions.reduce((s,c) =>
    s + (parseFloat(c.total_amount||0) - parseFloat(c.paid_amount||0)), 0);
  const totalPaid    = commissions.reduce((s,c) => s + parseFloat(c.paid_amount||0), 0);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['commissions'] });
    queryClient.invalidateQueries({ queryKey:['commissions-overdue'] });
    refetch();
    refetchOverdue();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {showModal && (
        <NewCommissionModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>
            Comisiones de Asesores
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Comisiones para asesores, gerentes, abogados y más
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { refetch(); refetchOverdue(); }} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nueva Comisión
            </button>
          )}
        </div>
      </div>

      

      {/* TABS */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background:'var(--color-bg-secondary)', width:'fit-content' }}>
        <button
          onClick={() => setActiveTab('todas')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeTab==='todas' ? 'var(--color-bg-card)' : 'transparent',
            color:      activeTab==='todas' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            boxShadow:  activeTab==='todas' ? 'var(--shadow-sm)' : 'none',
          }}>
          <DollarSign size={14}/> Todas las comisiones
        </button>
        <button
          onClick={() => setActiveTab('vencidas')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activeTab==='vencidas' ? 'var(--color-bg-card)' : 'transparent',
            color:      activeTab==='vencidas' ? '#ef4444' : 'var(--color-text-muted)',
            boxShadow:  activeTab==='vencidas' ? 'var(--shadow-sm)' : 'none',
          }}>
          <Clock size={14}/> Cuotas vencidas
          {overdues.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background:'#ef4444', color:'#fff' }}>
              {overdues.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB: VENCIDAS */}
      {activeTab === 'vencidas' && (
        <div className="space-y-4">
          {overdues.length === 0 ? (
            <div className="card flex flex-col items-center py-16 gap-3">
              <CheckCircle size={48} style={{ color:'#10b981' }}/>
              <p className="font-semibold" style={{ color:'var(--color-text-secondary)' }}>
                ✅ No hay cuotas de comisión vencidas
              </p>
              <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
                Todas las cuotas programadas están al día
              </p>
            </div>
          ) : (
            <>
              <div className="card p-4 flex items-center justify-between"
                style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'#ef4444' }}>
                    ⚠️ {overdues.length} cuota{overdues.length!==1?'s':''} de comisión vencida{overdues.length!==1?'s':''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                    Total pendiente vencido: {formatCurrency(overdues.reduce((s,o)=>s+parseFloat(o.amount||0),0))}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const rows = [['Asesor','Email','Contrato','Cliente','Cuota','Monto','Fecha Programada','Días Vencido']];
                    overdues.forEach(o => rows.push([
                      o.advisor_name, o.advisor_email||'', o.contract_number, o.client_name,
                      `Pago ${o.installment_num}`, parseFloat(o.amount||0),
                      o.due_date ? format(new Date(o.due_date),'dd/MM/yyyy') : '',
                      o.days_overdue,
                    ]));
                    rows.push(['','','','','TOTAL', overdues.reduce((s,o)=>s+parseFloat(o.amount||0),0),'','']);
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    ws['!cols'] = [20,24,16,20,10,16,16,12].map(w=>({wch:w}));
                    XLSX.utils.book_append_sheet(wb, ws, 'Cuotas Vencidas');
                    XLSX.writeFile(wb, `Comisiones_Vencidas_${format(new Date(),'yyyyMMdd')}.xlsx`);
                  }}
                  className="btn btn-secondary btn-sm text-xs"
                  style={{ color:'#10b981', borderColor:'rgba(16,185,129,0.3)' }}>
                  ⬇ Exportar Excel
                </button>
              </div>

              <div className="card p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background:'var(--color-bg-secondary)' }}>
                      {['Asesor','Contrato','Cliente','Cuota','Monto','Fecha programada','Días vencido','Acción'].map(h=>(
                        <th key={h} className="px-3 py-2.5 text-left font-semibold"
                          style={{ color:'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overdues.map((o,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid var(--color-border)', borderLeft:'3px solid #ef4444' }}>
                        <td className="px-3 py-3">
                          <p className="font-semibold" style={{ color:'var(--color-text-primary)' }}>{o.advisor_name}</p>
                          {o.advisor_phone && <p style={{ color:'var(--color-text-muted)' }}>{o.advisor_phone}</p>}
                        </td>
                        <td className="px-3 py-3 font-mono" style={{ color:'#60a5fa' }}>{o.contract_number}</td>
                        <td className="px-3 py-3" style={{ color:'var(--color-text-secondary)' }}>{o.client_name}</td>
                        <td className="px-3 py-3" style={{ color:'var(--color-text-muted)' }}>Pago {o.installment_num}</td>
                        <td className="px-3 py-3 font-bold font-mono" style={{ color:'#ef4444' }}>
                          {formatCurrency(o.amount)}
                        </td>
                        <td className="px-3 py-3" style={{ color:'#f59e0b' }}>
                          {o.due_date ? format(new Date(o.due_date),'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-1 rounded-full font-bold"
                            style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>
                            {o.days_overdue} día{o.days_overdue!==1?'s':''}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="date"
                              defaultValue={new Date().toISOString().split('T')[0]}
                              max={new Date().toISOString().split('T')[0]}
                              id={`overdue-date-${o.id}`}
                              className="input text-xs"
                              style={{ padding:'3px 6px', height:'28px' }}
                            />
                            <button
                              onClick={async () => {
                                const dateInput = document.getElementById(`overdue-date-${o.id}`);
                                const dateToUse = dateInput?.value || new Date().toISOString().split('T')[0];
                                try {
                                  await commissionsService.markPaid(o.id, { paid_date: dateToUse });
                                  toast.success(`Pagada el ${format(new Date(dateToUse),'dd/MM/yyyy')}`);
                                  refetchOverdue();
                                  handleSaved();
                                } catch { toast.error('Error al marcar'); }
                              }}
                              className="btn btn-primary btn-sm text-xs">
                              ✓ Marcar pagado
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: TODAS — existing content */}
      {activeTab === 'todas' && (
        <>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
            Total pendiente por pagar
          </p>
          <p className="text-2xl font-bold font-mono" style={{ color:'#f59e0b' }}>
            {formatCurrency(totalPending)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
            Total pagado históricamente
          </p>
          <p className="text-2xl font-bold font-mono" style={{ color:'#10b981' }}>
            {formatCurrency(totalPaid)}
          </p>
        </div>
      </div>

      {/* Filtro por beneficiario — con búsqueda */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1" style={{ minWidth:'200px', maxWidth:'350px' }}>
          <input
            type="text"
            value={filterSearch}
            onChange={e => {
              setFilterSearch(e.target.value);
              setFilterAdvisor('');
            }}
            placeholder="🔍 Filtrar por beneficiario..."
            className="input text-sm w-full"
          />
          {filterSearch && (
            <button onClick={() => { setFilterSearch(''); setFilterAdvisor(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
              ×
            </button>
          )}
        </div>
        {filterSearch && (
          <div className="flex flex-wrap gap-1">
            {advisors.filter(a => a.full_name.toLowerCase().includes(filterSearch.toLowerCase())).map(a => (
              <button key={a.id}
                onClick={() => { setFilterAdvisor(a.id); setFilterSearch(a.full_name); }}
                className="px-2 py-1 rounded-lg text-xs"
                style={{
                  background: filterAdvisor===a.id ? 'rgba(59,130,246,0.2)' : 'var(--color-bg-secondary)',
                  border: `1px solid ${filterAdvisor===a.id ? '#3b82f6' : 'var(--color-border)'}`,
                  color: filterAdvisor===a.id ? '#60a5fa' : 'var(--color-text-secondary)',
                }}>
                {a.full_name}
              </button>
            ))}
          </div>
        )}
        {filterAdvisor && (
          <button onClick={() => { setFilterAdvisor(''); setFilterSearch(''); }}
            className="btn btn-ghost btn-sm text-xs"
            style={{ color:'#ef4444' }}>
            ✕ Quitar filtro
          </button>
        )}
      </div>

      {/* Lista */}
      {commissions.length === 0 ? (
        <div className="card flex flex-col items-center py-16 gap-4">
          <DollarSign size={48} style={{ color:'var(--color-text-muted)' }}/>
          <div className="text-center">
            <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
              No hay comisiones registradas
            </p>
            <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
              Registra las comisiones de los asesores por sus ventas
            </p>
          </div>
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14}/> Primera Comisión
            </button>
          )}
        </div>
      ) : (
        <GroupedCommissions commissions={commissions} canEdit={canEdit} onRefresh={handleSaved}/>
      )}
      </>
      )}
    </div>
  );
};

// ── Comisiones agrupadas por beneficiario ─────────────────────
const PAGE_SIZE = 4;

const GroupedCommissions = ({ commissions, canEdit, onRefresh }) => {
  const [pages, setPages] = useState({});
  const { formatCurrency } = useCurrencyFormat();

  // Agrupar por advisor_id
  const groups = commissions.reduce((acc, c) => {
    const key = c.advisor_id;
    if (!acc[key]) acc[key] = { advisor_id: key, advisor_name: c.advisor_name, items: [] };
    acc[key].items.push(c);
    return acc;
  }, {});

  const advisorGroups = Object.values(groups);

  const getPage = (advisorId) => pages[advisorId] || 0;
  const setPage  = (advisorId, p) => setPages(prev => ({ ...prev, [advisorId]: p }));

  return (
    <div className="space-y-4">
      {advisorGroups.map(group => {
        const page      = getPage(group.advisor_id);
        const totalPages= Math.ceil(group.items.length / PAGE_SIZE);
        const visible   = group.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const totalComm = group.items.reduce((s,c) => s + parseFloat(c.total_amount||0), 0);
        const totalPaid = group.items.reduce((s,c) => s + parseFloat(c.paid_amount||0), 0);
        const pct       = totalComm > 0 ? Math.round(totalPaid/totalComm*100) : 0;

        return (
          <div key={group.advisor_id} className="card p-0 overflow-hidden">
            {/* Header del beneficiario */}
            <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2"
              style={{ background:'var(--color-bg-secondary)', borderBottom:'1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa' }}>
                  {group.advisor_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
                    {group.advisor_name}
                  </p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    {group.items.length} comisión{group.items.length!==1?'es':''} ·{' '}
                    <span style={{ color:'#10b981' }}>
                      {formatCurrency(totalPaid)}
                    </span>
                    {' '}pagado de{' '}
                    <span style={{ color:'var(--color-text-secondary)' }}>
                      {formatCurrency(totalComm)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Progreso total + paginación */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full" style={{ background:'var(--color-bg-primary)' }}>
                    <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background:'#10b981' }}/>
                  </div>
                  <span className="text-xs font-mono" style={{ color:'#10b981' }}>{pct}%</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(group.advisor_id, Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="btn btn-ghost btn-sm text-xs px-2"
                      style={{ opacity: page===0 ? 0.3 : 1 }}>
                      ‹
                    </button>
                    <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                      {page+1}/{totalPages}
                    </span>
                    <button
                      onClick={() => setPage(group.advisor_id, Math.min(totalPages-1, page+1))}
                      disabled={page === totalPages-1}
                      className="btn btn-ghost btn-sm text-xs px-2"
                      style={{ opacity: page===totalPages-1 ? 0.3 : 1 }}>
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Comisiones de esta página */}
            <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
              {visible.map(c => (
                <CommissionRow
                  key={c.id}
                  comm={c}
                  canEdit={canEdit}
                  onRefresh={onRefresh}
                  compact
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CommissionsPage;