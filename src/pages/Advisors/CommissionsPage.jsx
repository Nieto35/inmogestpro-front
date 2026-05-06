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
import { useParams } from 'react-router-dom';

// ── Modal Nueva Comisión ──────────────────────────────────────
const NewCommissionModal = ({ onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const { formatCurrency } = useCurrencyFormat();
  const [contractSearch, setContractSearch] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [benefSearch, setBenefSearch] = useState('');
  const [form, setForm] = useState({
    advisor_id:      '',
    commission_type: 'porcentaje',
    percentage:      '3',
    total_amount:    '',
    installments:    '1',
    cuotas:          [],
    notes:           '',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const { data: advisorsData } = useQuery({ queryKey:['advisors'], queryFn:()=>advisorsService.getAll() });
  const { data: usersData }    = useQuery({ queryKey:['users-all'], queryFn:()=>usersService.getAll() });
  const advisors = advisorsData?.data?.data || [];
  const allUsers = usersData?.data?.data    || [];

  // Lista completa de beneficiarios (sin filtrar por búsqueda — el filtro va en el render)
  const allBeneficiaries = [
    ...advisors,
    ...allUsers
      .filter(u => !advisors.some(a => a.user_id===u.id || a.email===u.email))
      .map(u => ({ id:`user-${u.id}`, full_name:u.full_name, email:u.email, advisor_type:u.role, _isUser:true, _userId:u.id }))
  ];

  // Filtrado solo para mostrar en el select (no afecta el estado del input)
  const beneficiaries = allBeneficiaries.filter(b =>
    !benefSearch ||
    b.full_name.toLowerCase().includes(benefSearch.toLowerCase()) ||
    (b.email||'').toLowerCase().includes(benefSearch.toLowerCase())
  );

  const selectedBenef = allBeneficiaries.find(b => b.id === form.advisor_id);
  const isAdvisorType  = selectedBenef && ['planta','freelance','referido','externo','asesor'].includes(selectedBenef.advisor_type);
  const isAbogado      = selectedBenef?.advisor_type === 'abogado';
  const isSupervisor   = selectedBenef?.advisor_type === 'supervisor';

  // Determinar el campo de filtro correcto para la API según el tipo de beneficiario
  // Para asesores → advisor_id, para abogado → abogado_user_id, para supervisor → supervisor_user_id
  const contractQueryKey = ['contracts-comm-search', contractSearch, form.advisor_id, isAdvisorType, isAbogado, isSupervisor];
  const contractQueryParams = () => {
    const base = { search: contractSearch || undefined, limit: 50 };
    if (isAdvisorType) return { ...base, advisor_id: form.advisor_id };
    if (isAbogado)     return { ...base, abogado_user_id: selectedBenef?.user_id || selectedBenef?._userId };
    if (isSupervisor)  return { ...base, supervisor_user_id: selectedBenef?.user_id || selectedBenef?._userId };
    return base; // gerente, contador, admin → ven todos los contratos
  };

  const { data: existingComms } = useQuery({
    queryKey: ['existing-comms', form.advisor_id],
    queryFn:  () => commissionsService.getAll({ advisor_id:form.advisor_id }),
    enabled:  !!form.advisor_id,
  });
  const paidContractIds = new Set((existingComms?.data?.data||[]).map(c=>c.contract_id));

  const { data: contractsData } = useQuery({
    queryKey: contractQueryKey,
    queryFn:  () => contractsService.getAll(contractQueryParams()),
    enabled: !!form.advisor_id,
  });
  const allContracts = contractsData?.data?.data || [];
  const contracts    = allContracts.filter(c => !paidContractIds.has(c.id));

  const calcAmount = () => {
    if (!selectedContract || !form.percentage) return;
    const pct = parseFloat(form.percentage)/100;
    const val = parseFloat(selectedContract.net_value||selectedContract.total_value||0);
    set('total_amount', String(Math.round(val*pct)));
  };

  const perInstallment = form.total_amount && form.installments
    ? Math.ceil(parseFloat(form.total_amount)/parseInt(form.installments)) : 0;

  const handleSubmit = async () => {
    if (!form.advisor_id)  return toast.error('Seleccione el beneficiario');
    if (!selectedContract) return toast.error('Seleccione el contrato');
    if (!form.total_amount || parseFloat(form.total_amount) <= 0)
      return toast.error('El monto de comisión debe ser mayor a 0');
    setSaving(true);
    try {
      let advisorId = form.advisor_id;
      if (advisorId.startsWith('user-')) {
        const benef = beneficiaries.find(b => b.id === advisorId);
        if (!benef) return toast.error('Beneficiario no encontrado');
        const roleToType = { admin:'gerente', gerente:'gerente', contador:'externo', asesor:'planta', abogado:'abogado', supervisor:'supervisor', readonly:'externo' };
        const res = await advisorsService.create({
          full_name:       benef.full_name, email:benef.email||null,
          advisor_type:    roleToType[benef.advisor_type]||'externo',
          commission_rate: 0, user_id:benef._userId,
        });
        advisorId = res.data?.data?.id;
        if (!advisorId) throw new Error('No se pudo crear el beneficiario');
      }
      await commissionsService.create({
        advisor_id:      advisorId,
        contract_id:     selectedContract.id,
        commission_type: form.commission_type,
        total_amount:    parseFloat(form.total_amount),
        installments:    parseInt(form.installments)||1,
        cuotas:          form.cuotas?.length > 1 ? form.cuotas : null,
        notes:           form.notes||null,
      });
      toast.success('Comisión registrada correctamente');
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message||err.message||'Error al registrar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background:'rgba(13,27,62,0.55)', paddingTop:'4vh' }}>
      <div className="w-full rounded-xl shadow-2xl flex flex-col"
        style={{ maxWidth:'520px', margin:'0 16px', background:'var(--color-bg-card)',
                 border:'1px solid var(--color-border)', maxHeight:'92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background:'var(--color-navy)', borderBottom:'3px solid var(--color-gold)' }}>
          <h2 className="font-bold" style={{ color:'#F5F3EE', fontFamily:'var(--font-display)' }}>
            Nueva Comisión
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ color:'rgba(245,243,238,0.7)' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Beneficiario */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>
              Beneficiario (asesor, gerente, abogado...) *
            </label>
            <input
              type="text"
              value={benefSearch}
              onChange={e => setBenefSearch(e.target.value)}
              className="input text-sm mb-1.5"
              placeholder="🔍 Buscar por nombre o email..."
              autoComplete="off"
            />
            <select
              value={form.advisor_id}
              onChange={e => { set('advisor_id', e.target.value); setSelectedContract(null); setContractSearch(''); }}
              className="input text-sm">
              <option value="">Seleccionar beneficiario...</option>
              {beneficiaries.map(a => {
                const typeLabel = {
                  planta:'Planta', freelance:'Freelance', referido:'Referido',
                  gerente:'Gerente', abogado:'Abogado', supervisor:'Supervisor', externo:'Externo',
                  admin:'Administrador', contador:'Contador', asesor:'Asesor', readonly:'Solo lectura'
                }[a.advisor_type]||a.advisor_type;
                return (
                  <option key={a.id} value={a.id}>
                    {a.full_name} · {typeLabel}{a._isUser?' (usuario)':''}
                  </option>
                );
              })}
            </select>
            {form.advisor_id && (() => {
              const sel = beneficiaries.find(b=>b.id===form.advisor_id);
              return sel ? (
                <p className="text-xs mt-1" style={{ color:'var(--color-gold)' }}>
                  ✓ {sel.full_name} {sel.email?`· ${sel.email}`:''}
                </p>
              ) : null;
            })()}
          </div>

          {/* Contrato */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>Contrato *</label>
            {!selectedContract ? (
              <div className="space-y-2">
                {!form.advisor_id ? (
                  <div className="p-3 rounded text-sm text-center"
                    style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
                    ☝️ Selecciona primero el beneficiario para ver los contratos
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="p-3 rounded text-sm text-center"
                    style={{ background:'var(--color-bg-secondary)', color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
                    {isAdvisorType
                      ? 'Este asesor no tiene contratos activos'
                      : isAbogado
                      ? 'Este abogado no tiene contratos asignados'
                      : isSupervisor
                      ? 'Este supervisor no tiene contratos asignados'
                      : 'No se encontraron contratos. Busca por número o cliente.'}
                  </div>
                ) : (
                  <div>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color:'var(--color-text-muted)' }}/>
                      <input value={contractSearch} onChange={e=>setContractSearch(e.target.value)}
                        className="input pl-9 text-sm"
                        placeholder={
                          isAdvisorType
                            ? `Filtrar entre ${contracts.length} contrato${contracts.length!==1?'s':''} del asesor...`
                            : isAbogado
                            ? `Filtrar entre ${contracts.length} contrato${contracts.length!==1?'s':''} del abogado...`
                            : isSupervisor
                            ? `Filtrar entre ${contracts.length} contrato${contracts.length!==1?'s':''} del supervisor...`
                            : `Buscar en todos los contratos...`
                        }/>
                    </div>
                    <div className="rounded overflow-hidden" style={{ border:'1px solid var(--color-border)' }}>
                      {contracts
                        .filter(c => !contractSearch ||
                          c.contract_number?.toLowerCase().includes(contractSearch.toLowerCase()) ||
                          c.client_name?.toLowerCase().includes(contractSearch.toLowerCase()))
                        .map((c,idx,arr) => (
                          <button key={c.id}
                            onClick={() => {
                              setSelectedContract(c); setContractSearch('');
                              if (form.commission_type==='porcentaje'&&form.percentage) {
                                const pct=parseFloat(form.percentage)/100;
                                const val=parseFloat(c.net_value||c.total_value||0);
                                set('total_amount',String(Math.round(val*pct)));
                              }
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between"
                            style={{
                              borderBottom: idx<arr.length-1 ? '1px solid var(--color-border)' : 'none',
                              background: 'var(--color-bg-card)',
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='var(--color-navy-subtle)'}
                            onMouseLeave={e=>e.currentTarget.style.background='var(--color-bg-card)'}>
                            <div>
                              <p className="font-mono font-medium" style={{ color:'var(--color-gold)' }}>
                                {c.contract_number}
                              </p>
                              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                                {c.client_name} · {c.status}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              {/* Valor contrato — navy, no verde */}
                              <p className="text-xs font-mono font-bold" style={{ color:'var(--color-navy)' }}>
                                {formatCurrency(c.net_value||c.total_value)}
                              </p>
                              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{c.payment_type}</p>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded"
                style={{ background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.3)' }}>
                <div>
                  <p className="text-sm font-mono font-bold" style={{ color:'var(--color-gold)' }}>
                    {selectedContract.contract_number}
                  </p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    {selectedContract.client_name} · {formatCurrency(selectedContract.net_value||selectedContract.total_value)}
                  </p>
                </div>
                <button onClick={()=>{setSelectedContract(null);setContractSearch('');}}
                  style={{ color:'var(--color-danger)' }}>
                  <X size={13}/>
                </button>
              </div>
            )}
          </div>

          {/* Tipo de comisión */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>Tipo de comisión</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['porcentaje','% Porcentaje','Calculado sobre el valor del contrato'],
                ['fija','$ Monto fijo','Valor fijo acordado independiente del contrato'],
              ].map(([val,lbl,hint]) => (
                <button key={val} onClick={()=>set('commission_type',val)}
                  className="p-3 rounded text-left text-sm transition-all"
                  style={{
                    background: form.commission_type===val ? 'rgba(13,27,62,0.07)' : 'var(--color-bg-secondary)',
                    border:     `1.5px solid ${form.commission_type===val ? 'var(--color-navy)' : 'var(--color-border)'}`,
                    color:      form.commission_type===val ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                  }}>
                  <p className="font-semibold">{lbl}</p>
                  <p className="text-xs mt-0.5 opacity-70">{hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          {form.commission_type==='porcentaje' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color:'var(--color-text-primary)' }}>Porcentaje (%)</label>
                <div className="flex gap-2">
                  <input type="number" value={form.percentage} onChange={e=>set('percentage',e.target.value)}
                    className="input text-sm flex-1" min="0" max="50" step="0.5" placeholder="3"/>
                  <button onClick={calcAmount} className="btn btn-outline btn-sm whitespace-nowrap">Calcular</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5"
                  style={{ color:'var(--color-text-primary)' }}>Monto total</label>
                <input type="number" value={form.total_amount} onChange={e=>set('total_amount',e.target.value)}
                  className="input text-sm" placeholder="0" min="0" step="1000"/>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1.5"
                style={{ color:'var(--color-text-primary)' }}>Monto fijo de comisión *</label>
              <input type="number" value={form.total_amount} onChange={e=>set('total_amount',e.target.value)}
                className="input text-sm" placeholder="500000" min="0" step="1000"/>
            </div>
          )}

          {/* Dividir en cuotas */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>¿En cuántos pagos se divide?</label>
            <select value={form.installments}
              onChange={e => {
                const n=parseInt(e.target.value)||1;
                set('installments',String(n));
                if (n>0&&form.total_amount) {
                  const base=Math.floor(parseFloat(form.total_amount)/n);
                  const last=parseFloat(form.total_amount)-base*(n-1);
                  set('cuotas', Array.from({length:n},(_,i)=>({ amount:i===n-1?String(last):String(base), date:'' })));
                }
              }}
              className="input text-sm">
              {[1,2,3,4,5,6,8,10,12].map(n=>(
                <option key={n} value={n}>
                  {n===1?'Pago único (un solo pago)':`${n} pagos`}
                </option>
              ))}
            </select>
          </div>

          {/* Cuotas detalladas */}
          {form.cuotas&&form.cuotas.length>1&&form.total_amount && (
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color:'var(--color-text-primary)' }}>Detalle de cada pago</label>
              <div className="space-y-2">
                {form.cuotas.map((cuota,idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 p-3 rounded"
                    style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                    <div>
                      <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Pago {idx+1} — Monto</p>
                      <input type="number" value={cuota.amount}
                        onChange={e => {
                          const updated=[...form.cuotas];
                          updated[idx]={...updated[idx],amount:e.target.value};
                          set('cuotas',updated);
                        }}
                        className="input text-sm" placeholder="0" min="0" step="1000"/>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Fecha programada</p>
                      <input type="date" value={cuota.date}
                        onChange={e => {
                          const updated=[...form.cuotas];
                          updated[idx]={...updated[idx],date:e.target.value};
                          set('cuotas',updated);
                        }}
                        className="input text-sm"/>
                    </div>
                  </div>
                ))}
                {(() => {
                  const suma=form.cuotas.reduce((s,c)=>s+parseFloat(c.amount||0),0);
                  const total=parseFloat(form.total_amount||0);
                  const diff=Math.abs(suma-total);
                  return diff>1 ? (
                    <p className="text-xs" style={{ color:'var(--color-warning)' }}>
                      ⚠ Los pagos suman {formatCurrency(suma)} — el total es {formatCurrency(total)}. Diferencia: {formatCurrency(diff)}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color:'var(--color-success)' }}>
                      ✓ Los pagos suman exactamente {formatCurrency(suma)}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-semibold mb-1.5"
              style={{ color:'var(--color-text-primary)' }}>Observaciones</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
              className="input text-sm resize-none w-full" rows={2}
              placeholder="Acuerdos, condiciones especiales..."/>
          </div>

          {/* Resumen — navy en lugar de verde */}
          {form.total_amount&&parseFloat(form.total_amount)>0 && (
            <div className="p-3 rounded"
              style={{ background:'rgba(13,27,62,0.04)', border:'1px solid var(--color-border)', borderLeft:'4px solid var(--color-gold)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color:'var(--color-gold)' }}>
                Resumen de la comisión
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p style={{ color:'var(--color-text-muted)' }}>Total comisión</p>
                  <p className="font-bold font-mono text-sm" style={{ color:'var(--color-navy)' }}>
                    {formatCurrency(parseFloat(form.total_amount))}
                  </p>
                </div>
                <div>
                  <p style={{ color:'var(--color-text-muted)' }}>
                    {parseInt(form.installments)===1?'Pago único':`${form.installments} pagos`}
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
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary flex-1">
            <Save size={14}/> {saving?'Guardando...':'Registrar Comisión'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Fila de comisión con sus cuotas ──────────────────────────
const CommissionRow = ({ comm, canEdit, onRefresh, compact=false }) => {
  const [open,          setOpen]         = useState(false);
  const [paying,        setPaying]       = useState(null);
  const [paidDates,     setPaidDates]    = useState({});
  const [pendingFiles,  setPendingFiles] = useState({});
  const { formatCurrency } = useCurrencyFormat();
  const queryClient = useQueryClient();
  const { tenant }  = useParams();
  const API_URL = import.meta.env.VITE_API_URL || 'https://back.inmogestpro.com';
  const apiBase = () => `${API_URL}/api/v1/${tenant}`;

  const { data:paymentsData, refetch:refetchPayments } = useQuery({
    queryKey: ['comm-payments', comm.id],
    queryFn:  () => commissionsService.getPayments(comm.id),
    enabled:  open,
  });
  const payments = paymentsData?.data?.data || [];

  const paidAmount = parseFloat(comm.paid_amount||0);
  const total      = parseFloat(comm.total_amount||0);
  const pct        = total>0 ? Math.round((paidAmount/total)*100) : 0;
  const allPaid    = paidAmount>=total;

  const getPayDate = (payId) => paidDates[payId]||new Date().toISOString().split('T')[0];

  const handleMarkPaid = async (payId) => {
    const dateToUse=getPayDate(payId);
    setPaying(payId);
    try {
      await commissionsService.markPaid(payId,{paid_date:dateToUse});
      const pendingFile=pendingFiles[payId];
      if (pendingFile) {
        try {
          const fd=new FormData(); fd.append('file',pendingFile);
          const token=localStorage.getItem('inmogest_token');
          const res=await fetch(`${apiBase()}/commissions/payments/${payId}/evidence`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
          const json=await res.json();
          if (json.success) toast.success(`Cuota pagada y evidencia subida`);
          else { toast.success(`Cuota marcada pagada el ${format(new Date(dateToUse),'dd/MM/yyyy')}`); toast.error('La evidencia no se pudo subir'); }
          setPendingFiles(prev=>{const n={...prev};delete n[payId];return n;});
        } catch {
          toast.success(`Cuota marcada pagada el ${format(new Date(dateToUse),'dd/MM/yyyy')}`);
          toast.error('Error al subir la evidencia');
        }
      } else {
        toast.success(`Cuota marcada como pagada el ${format(new Date(dateToUse),'dd/MM/yyyy')}`);
      }
      refetchPayments(); onRefresh();
    } catch(err) { toast.error(err.response?.data?.message||'Error');
    } finally { setPaying(null); }
  };

  const handleMarkUnpaid = async (payId) => {
    setPaying(payId);
    try {
      await commissionsService.markUnpaid(payId);
      toast.success('Cuota desmarcada'); refetchPayments(); onRefresh();
    } catch(err) { toast.error(err.response?.data?.message||'Error');
    } finally { setPaying(null); }
  };

  return (
    <div className={compact?'px-5 py-3':'card'}>
      <div className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={()=>setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {!compact && (
              <span className="font-semibold text-sm" style={{ color:'var(--color-navy)' }}>
                {comm.advisor_name}
              </span>
            )}
            {/* Badge tipo — oro/navy en lugar de purple/blue */}
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: comm.commission_type==='fija' ? 'rgba(200,168,75,0.12)' : 'rgba(13,27,62,0.07)',
                color:      comm.commission_type==='fija' ? 'var(--color-gold)'      : 'var(--color-navy)',
                border:     `1px solid ${comm.commission_type==='fija' ? 'rgba(200,168,75,0.25)' : 'rgba(13,27,62,0.15)'}`,
              }}>
              {comm.commission_type==='fija'?'$ Fija':'% Porcentaje'}
            </span>
            {allPaid && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid var(--color-success-border)' }}>
                ✓ Pagada completa
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
            {comm.contract_number} · {comm.client_name}
          </p>
          {/* Barra progreso — dorada */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ background:'var(--color-bg-secondary)' }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{ width:`${pct}%`, background: allPaid ? 'var(--color-gold)' : 'var(--color-navy)' }}/>
            </div>
            <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              {formatCurrency(paidAmount)} / {formatCurrency(total)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            {/* Total comisión — navy, no verde */}
            <p className="font-bold font-mono text-sm" style={{ color:'var(--color-navy)' }}>
              {formatCurrency(total)}
            </p>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
              {comm.installments} pago{comm.installments!==1?'s':''}
            </p>
          </div>
          {open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        </div>
      </div>

      {/* Cuotas expandidas */}
      {open && (
        <div className="mt-4 pt-4 space-y-2" style={{ borderTop:'1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color:'var(--color-text-muted)' }}>
              Cuotas de pago de comisión
            </p>
            <button
              onClick={() => {
                const wb=XLSX.utils.book_new();
                const rows=[['Cuota','Monto','Estado','Fecha Pago','Pagado por','Notas']];
                payments.forEach(p=>rows.push([`Pago ${p.installment_num}`,parseFloat(p.amount||0),p.is_paid?'Pagado':'Pendiente',p.paid_date?new Date(p.paid_date).toLocaleDateString('es-CO'):'',p.paid_by_name||'',p.notes||'']));
                rows.push(['TOTAL',parseFloat(comm.total_amount||0),'','','','']);
                const ws=XLSX.utils.aoa_to_sheet(rows);
                ws['!cols']=[10,16,12,14,18,20].map(w=>({wch:w}));
                XLSX.utils.book_append_sheet(wb,ws,'Comisión');
                XLSX.writeFile(wb,`Comision_${comm.advisor_name.replace(/ /g,'_')}_${comm.contract_number}.xlsx`);
              }}
              className="btn btn-outline btn-sm text-xs flex items-center gap-1">
              <Download size={11}/> Exportar
            </button>
          </div>
          {payments.length===0 ? (
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Cargando...</p>
          ) : (
            payments.map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded"
                style={{
                  background: pay.is_paid ? 'rgba(200,168,75,0.06)' : 'var(--color-bg-secondary)',
                  border: `1px solid ${pay.is_paid ? 'rgba(200,168,75,0.25)' : 'var(--color-border)'}`,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: pay.is_paid ? 'rgba(200,168,75,0.15)' : 'rgba(13,27,62,0.07)' }}>
                    {pay.is_paid
                      ? <CheckCircle size={14} style={{ color:'var(--color-gold)' }}/>
                      : <Clock size={14} style={{ color:'var(--color-text-muted)' }}/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                      Pago {pay.installment_num} — {formatCurrency(pay.amount)}
                    </p>
                    {pay.is_paid&&pay.paid_date && (
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        Pagado el {format(new Date(pay.paid_date),'dd/MM/yyyy')}
                        {pay.paid_by_name&&` por ${pay.paid_by_name}`}
                      </p>
                    )}
                    {!pay.is_paid&&pay.paid_date && (
                      <p className="text-xs" style={{ color:'var(--color-warning)' }}>
                        📅 Programado: {format(new Date(pay.paid_date),'dd/MM/yyyy')}
                      </p>
                    )}
                    {/* Evidencias adjuntas */}
                    {pay.documents&&Array.isArray(pay.documents)&&pay.documents.length>0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {pay.documents.map((doc,idx) => {
                          const filename=doc.filename||'archivo';
                          const ext=filename.split('.').pop().toLowerCase();
                          const icon=['jpg','jpeg','png','webp'].includes(ext)?'🖼️':ext==='pdf'?'📄':ext==='mp3'?'🎵':ext==='mp4'?'🎬':'📎';
                          return (
                            <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors hover:opacity-80"
                              style={{ background:'rgba(13,27,62,0.06)', border:'1px solid var(--color-border)', color:'var(--color-navy)' }}>
                              <span>{icon}</span>
                              <span>{filename.length>25?filename.substring(0,22)+'...':filename}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <label className="btn btn-ghost btn-sm text-xs cursor-pointer"
                      title={pendingFiles[pay.id]?`Evidencia lista: ${pendingFiles[pay.id].name}`:'Subir evidencia de pago'}
                      style={{ color: pendingFiles[pay.id]?'var(--color-gold)':'var(--color-text-muted)' }}>
                      {pendingFiles[pay.id]?<CheckCircle size={12}/>:<Upload size={12}/>}
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={async e => {
                          const file=e.target.files[0];
                          if (!file) return;
                          if (pay.is_paid) {
                            const fd=new FormData(); fd.append('file',file);
                            try {
                              const token=localStorage.getItem('inmogest_token');
                              const res=await fetch(`${apiBase()}/commissions/payments/${pay.id}/evidence`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
                              const json=await res.json();
                              if (json.success){toast.success('Evidencia subida');refetchPayments();}
                              else toast.error(json.message||'Error');
                            } catch{toast.error('Error al subir');}
                          } else {
                            setPendingFiles(prev=>({...prev,[pay.id]:file}));
                            toast.success(`Evidencia lista: "${file.name}" — se subirá al marcar pagado`,{duration:4000});
                          }
                          e.target.value='';
                        }}/>
                    </label>
                    {!pay.is_paid && (
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs" style={{ color:'var(--color-text-muted)' }}>Fecha real del pago:</label>
                        <input type="date" value={getPayDate(pay.id)}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={e=>setPaidDates(prev=>({...prev,[pay.id]:e.target.value}))}
                          className="input text-xs"
                          style={{ padding:'4px 8px', height:'30px', minWidth:'130px' }}/>
                      </div>
                    )}
                    <button
                      onClick={()=>pay.is_paid?handleMarkUnpaid(pay.id):handleMarkPaid(pay.id)}
                      disabled={paying===pay.id}
                      className={`btn btn-sm text-xs ${pay.is_paid?'btn-outline':'btn-primary'}`}
                      style={{ minWidth:'110px' }}>
                      {paying===pay.id?'...':pay.is_paid?'↩ Desmarcar':'✓ Marcar pagado'}
                    </button>
                  </div>
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
  const { hasRole, user }   = useAuthStore();
  const queryClient         = useQueryClient();
  const canEdit             = hasRole('admin','gerente','contador');
  const isAsesor            = user?.role === 'asesor';
  const { formatCurrency }  = useCurrencyFormat();
  const [showModal,     setShowModal]     = useState(false);
  const [activeTab,     setActiveTab]     = useState('todas');
  const [filterAdvisor, setFilterAdvisor] = useState('');
  const [filterSearch,  setFilterSearch]  = useState('');

  // El backend filtra automáticamente por asesor según el token (igual que contratos)
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['commissions', filterAdvisor],
    queryFn:  () => commissionsService.getAll(filterAdvisor?{advisor_id:filterAdvisor}:{}),
  });
  const { data:overdueData, refetch:refetchOverdue } = useQuery({
    queryKey: ['commissions-overdue'],
    queryFn:  () => commissionsService.getOverdue(),
    staleTime: 0,
  });
  const { data:advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
    enabled:  !isAsesor,
  });

  const advisors    = advisorsData?.data?.data || [];
  const commissions = data?.data?.data         || [];
  const overdues    = overdueData?.data?.data  || [];

  const totalPending = commissions.reduce((s,c)=>s+(parseFloat(c.total_amount||0)-parseFloat(c.paid_amount||0)),0);
  const totalPaid    = commissions.reduce((s,c)=>s+parseFloat(c.paid_amount||0),0);

  const handleSaved = () => {
    queryClient.invalidateQueries({queryKey:['commissions']});
    queryClient.invalidateQueries({queryKey:['commissions-overdue']});
    refetch(); refetchOverdue();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {showModal && <NewCommissionModal onClose={()=>setShowModal(false)} onSaved={handleSaved}/>}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold"
            style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            {isAsesor ? 'Mis Comisiones' : 'Comisiones de Asesores'}
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {isAsesor
              ? 'Historial de tus comisiones por ventas realizadas'
              : 'Comisiones para asesores, gerentes, abogados y más'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{refetch();refetchOverdue();}} className="btn btn-outline btn-sm">
            <RefreshCw size={14} className={isFetching?'animate-spin':''}/>
          </button>
          {canEdit && (
            <button onClick={()=>setShowModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nueva Comisión
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 p-1 rounded w-fit"
        style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
        {[
          ['todas', <DollarSign size={14}/>, 'Todas las comisiones'],
          ['vencidas', <Clock size={14}/>, 'Cuotas vencidas'],
        ].map(([key,icon,label]) => (
          <button key={key} onClick={()=>setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
            style={{
              background:   activeTab===key ? 'var(--color-navy)' : 'transparent',
              color:        activeTab===key ? '#F5F3EE'
                          : key==='vencidas'&&overdues.length>0 ? 'var(--color-danger)'
                          : 'var(--color-text-muted)',
              borderBottom: activeTab===key ? '2px solid var(--color-gold)' : '2px solid transparent',
            }}>
            {icon} {label}
            {key==='vencidas'&&overdues.length>0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background:'var(--color-danger)', color:'#fff' }}>
                {overdues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: VENCIDAS */}
      {activeTab==='vencidas' && (
        <div className="space-y-4">
          {overdues.length===0 ? (
            <div className="card flex flex-col items-center py-16 gap-3">
              <CheckCircle size={48} style={{ color:'var(--color-success)' }}/>
              <p className="font-semibold" style={{ color:'var(--color-text-secondary)' }}>
                ✓ No hay cuotas de comisión vencidas
              </p>
              <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
                Todas las cuotas programadas están al día
              </p>
            </div>
          ) : (
            <>
              <div className="card p-4 flex items-center justify-between"
                style={{ background:'var(--color-danger-bg)', border:'1px solid var(--color-danger-border)', borderLeft:'4px solid var(--color-danger)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'var(--color-danger)' }}>
                    ⚠️ {overdues.length} cuota{overdues.length!==1?'s':''} de comisión vencida{overdues.length!==1?'s':''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                    Total pendiente vencido: {formatCurrency(overdues.reduce((s,o)=>s+parseFloat(o.amount||0),0))}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const wb=XLSX.utils.book_new();
                    const rows=[['Asesor','Email','Contrato','Cliente','Cuota','Monto','Fecha Programada','Días Vencido']];
                    overdues.forEach(o=>rows.push([o.advisor_name,o.advisor_email||'',o.contract_number,o.client_name,`Pago ${o.installment_num}`,parseFloat(o.amount||0),o.due_date?format(new Date(o.due_date),'dd/MM/yyyy'):'',o.days_overdue]));
                    rows.push(['','','','','TOTAL',overdues.reduce((s,o)=>s+parseFloat(o.amount||0),0),'','']);
                    const ws=XLSX.utils.aoa_to_sheet(rows);
                    ws['!cols']=[20,24,16,20,10,16,16,12].map(w=>({wch:w}));
                    XLSX.utils.book_append_sheet(wb,ws,'Cuotas Vencidas');
                    XLSX.writeFile(wb,`Comisiones_Vencidas_${format(new Date(),'yyyyMMdd')}.xlsx`);
                  }}
                  className="btn btn-outline btn-sm text-xs">
                  ⬇ Exportar Excel
                </button>
              </div>

              <div className="card p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
                      {['Asesor','Contrato','Cliente','Cuota','Monto','Fecha programada','Días vencido','Acción'].map(h=>(
                        <th key={h} className="px-3 py-2.5 text-left font-semibold"
                          style={{ color:'rgba(245,243,238,0.75)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overdues.map((o,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid var(--color-border)', borderLeft:'3px solid var(--color-danger)' }}>
                        <td className="px-3 py-3">
                          <p className="font-semibold" style={{ color:'var(--color-navy)' }}>{o.advisor_name}</p>
                          {o.advisor_phone&&<p style={{ color:'var(--color-text-muted)' }}>{o.advisor_phone}</p>}
                        </td>
                        <td className="px-3 py-3 font-mono" style={{ color:'var(--color-gold)' }}>{o.contract_number}</td>
                        <td className="px-3 py-3" style={{ color:'var(--color-text-secondary)' }}>{o.client_name}</td>
                        <td className="px-3 py-3" style={{ color:'var(--color-text-muted)' }}>Pago {o.installment_num}</td>
                        <td className="px-3 py-3 font-bold font-mono" style={{ color:'var(--color-danger)' }}>
                          {formatCurrency(o.amount)}
                        </td>
                        <td className="px-3 py-3" style={{ color:'var(--color-warning)' }}>
                          {o.due_date?format(new Date(o.due_date),'dd/MM/yyyy'):'—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-1 rounded-full font-bold"
                            style={{ background:'var(--color-danger-bg)', color:'var(--color-danger)' }}>
                            {o.days_overdue} día{o.days_overdue!==1?'s':''}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                              max={new Date().toISOString().split('T')[0]}
                              id={`overdue-date-${o.id}`} className="input text-xs"
                              style={{ padding:'3px 6px', height:'28px' }}/>
                            <button
                              onClick={async()=>{
                                const dateInput=document.getElementById(`overdue-date-${o.id}`);
                                const dateToUse=dateInput?.value||new Date().toISOString().split('T')[0];
                                try {
                                  await commissionsService.markPaid(o.id,{paid_date:dateToUse});
                                  toast.success(`Pagada el ${format(new Date(dateToUse),'dd/MM/yyyy')}`);
                                  refetchOverdue(); handleSaved();
                                } catch{toast.error('Error al marcar');}
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

      {/* TAB: TODAS */}
      {activeTab==='todas' && (
        <>
          {/* KPIs — warning para pendiente, gold para pagado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Total pendiente por pagar</p>
              <p className="text-2xl font-bold font-mono" style={{ color:'var(--color-warning)' }}>
                {formatCurrency(totalPending)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Total pagado históricamente</p>
              {/* Pagado — dorado en lugar de verde */}
              <p className="text-2xl font-bold font-mono" style={{ color:'var(--color-gold)' }}>
                {formatCurrency(totalPaid)}
              </p>
            </div>
          </div>

          {/* Filtro por beneficiario — oculto para asesores */}
          {!isAsesor && (
          <div className="card p-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1" style={{ minWidth:'200px', maxWidth:'350px' }}>
              <input type="text" value={filterSearch}
                onChange={e=>{setFilterSearch(e.target.value);setFilterAdvisor('');}}
                placeholder="🔍 Filtrar por beneficiario..."
                className="input text-sm w-full"/>
              {filterSearch && (
                <button onClick={()=>{setFilterSearch('');setFilterAdvisor('');}}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color:'var(--color-text-muted)' }}>×</button>
              )}
            </div>
            {filterSearch && (
              <div className="flex flex-wrap gap-1">
                {advisors.filter(a=>a.full_name.toLowerCase().includes(filterSearch.toLowerCase())).map(a=>(
                  <button key={a.id}
                    onClick={()=>{setFilterAdvisor(a.id);setFilterSearch(a.full_name);}}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      background: filterAdvisor===a.id ? 'rgba(13,27,62,0.1)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${filterAdvisor===a.id ? 'var(--color-navy)' : 'var(--color-border)'}`,
                      color:  filterAdvisor===a.id ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                    }}>
                    {a.full_name}
                  </button>
                ))}
              </div>
            )}
            {filterAdvisor && (
              <button onClick={()=>{setFilterAdvisor('');setFilterSearch('');}}
                className="btn btn-ghost btn-sm text-xs"
                style={{ color:'var(--color-danger)' }}>
                ✕ Quitar filtro
              </button>
            )}
          </div>
          )} {/* fin !isAsesor */}

          {/* Lista */}
          {commissions.length===0 ? (
            <div className="card flex flex-col items-center py-16 gap-4">
              <DollarSign size={48} style={{ color:'var(--color-text-muted)' }}/>
              <div className="text-center">
                <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>No hay comisiones registradas</p>
                <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
                  Registra las comisiones de los asesores por sus ventas
                </p>
              </div>
              {canEdit && (
                <button onClick={()=>setShowModal(true)} className="btn btn-primary btn-sm">
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
const PAGE_SIZE=4;
const GroupedCommissions=({commissions,canEdit,onRefresh})=>{
  const [pages,setPages]=useState({});
  const {formatCurrency}=useCurrencyFormat();

  const groups=commissions.reduce((acc,c)=>{
    const key=c.advisor_id;
    if (!acc[key]) acc[key]={advisor_id:key,advisor_name:c.advisor_name,items:[]};
    acc[key].items.push(c);
    return acc;
  },{});
  const advisorGroups=Object.values(groups);

  const getPage=(advisorId)=>pages[advisorId]||0;
  const setPage=(advisorId,p)=>setPages(prev=>({...prev,[advisorId]:p}));

  return (
    <div className="space-y-4">
      {advisorGroups.map(group=>{
        const page=getPage(group.advisor_id);
        const totalPages=Math.ceil(group.items.length/PAGE_SIZE);
        const visible=group.items.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
        const totalComm=group.items.reduce((s,c)=>s+parseFloat(c.total_amount||0),0);
        const totalPaid=group.items.reduce((s,c)=>s+parseFloat(c.paid_amount||0),0);
        const pct=totalComm>0?Math.round(totalPaid/totalComm*100):0;

        return (
          <div key={group.advisor_id} className="card p-0 overflow-hidden">
            {/* Header del beneficiario — navy con línea dorada */}
            <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2"
              style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
              <div className="flex items-center gap-3">
                {/* Avatar — dorado sobre navy */}
                <div className="w-9 h-9 flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background:'rgba(200,168,75,0.2)', color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>
                  {group.advisor_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color:'#F5F3EE' }}>
                    {group.advisor_name}
                  </p>
                  <p className="text-xs" style={{ color:'rgba(245,243,238,0.55)' }}>
                    {group.items.length} comisión{group.items.length!==1?'es':''} ·{' '}
                    <span style={{ color:'var(--color-gold)' }}>{formatCurrency(totalPaid)}</span>
                    {' '}pagado de{' '}
                    <span style={{ color:'rgba(245,243,238,0.7)' }}>{formatCurrency(totalComm)}</span>
                  </p>
                </div>
              </div>
              {/* Progreso + paginación */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full" style={{ background:'rgba(255,255,255,0.15)' }}>
                    <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background:'var(--color-gold)' }}/>
                  </div>
                  <span className="text-xs font-mono" style={{ color:'var(--color-gold)' }}>{pct}%</span>
                </div>
                {totalPages>1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={()=>setPage(group.advisor_id,Math.max(0,page-1))} disabled={page===0}
                      className="btn btn-ghost btn-sm text-xs px-2"
                      style={{ opacity:page===0?0.3:1, color:'rgba(245,243,238,0.7)' }}>‹</button>
                    <span className="text-xs" style={{ color:'rgba(245,243,238,0.5)' }}>{page+1}/{totalPages}</span>
                    <button onClick={()=>setPage(group.advisor_id,Math.min(totalPages-1,page+1))} disabled={page===totalPages-1}
                      className="btn btn-ghost btn-sm text-xs px-2"
                      style={{ opacity:page===totalPages-1?0.3:1, color:'rgba(245,243,238,0.7)' }}>›</button>
                  </div>
                )}
              </div>
            </div>

            {/* Comisiones */}
            <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
              {visible.map(c=>(
                <CommissionRow key={c.id} comm={c} canEdit={canEdit} onRefresh={onRefresh} compact/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CommissionsPage;