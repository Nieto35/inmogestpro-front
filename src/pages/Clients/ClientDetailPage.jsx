// src/pages/Clients/ClientDetailPage.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, User, FileText, Edit, Save, X,
  Phone, Mail, MapPin, RefreshCw, Plus,
  MessageSquare, Star, AlertTriangle, CheckCircle, TrendingUp
} from 'lucide-react';
import { clientsService, contractsService, interactionsService, commissionsService } from '../../services/api.service';
import { NewInteractionModal } from './ClientInteractionsPage';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import * as XLSX from 'xlsx';

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const STATUS_CFG = {
  activo:       { label:'Activo',       class:'badge-activo'      },
  cancelado:    { label:'Cancelado',    class:'badge-cancelado'   },
  escriturado:  { label:'Escriturado',  class:'badge-escriturado' },
  en_mora:      { label:'En Mora',      class:'badge-en_mora'     },
  refinanciado: { label:'Refinanciado', class:'badge-pendiente'   },
};

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium mb-1"
      style={{ color:'var(--color-text-muted)' }}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const InfoItem = ({ icon:Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ background:'rgba(13,27,62,0.07)' }}>
      <Icon size={14} style={{ color:'var(--color-navy)' }}/>
    </div>
    <div>
      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
        {value || '—'}
      </p>
    </div>
  </div>
);

const ClientDetailPage = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const queryClient  = useQueryClient();
  const { hasRole }  = useAuthStore();
  const canEdit      = hasRole('admin','gerente','asesor');

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState(null);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn:  () => clientsService.getById(id),
  });

  const client    = data?.data?.data?.client;
  const contracts = data?.data?.data?.contracts || [];

  const startEdit = () => {
    setForm({
      full_name:      client?.full_name      || '',
      email:          client?.email          || '',
      mobile:         client?.mobile         || '',
      phone:          client?.phone          || '',
      city:           client?.city           || '',
      department:     client?.department     || '',
      address:        client?.address        || '',
      occupation:     client?.occupation     || '',
      monthly_income: client?.monthly_income || '',
      notes:          client?.notes          || '',
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setForm(null); };

  const handleSave = async () => {
    if (!form.full_name)
      return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      await clientsService.update(id, form);
      toast.success('Cliente actualizado correctamente');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey:['client', id] });
      queryClient.invalidateQueries({ queryKey:['clients'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 gap-3"
      style={{ color:'var(--color-text-muted)' }}>
      <RefreshCw size={20} className="animate-spin"/>
      <span>Cargando cliente...</span>
    </div>
  );

  if (!client) return (
    <div className="card flex flex-col items-center py-16 gap-3">
      <User size={40} style={{ color:'var(--color-text-muted)' }}/>
      <p style={{ color:'var(--color-text-secondary)' }}>Cliente no encontrado</p>
      <button onClick={() => navigate('/clients')} className="btn btn-secondary btn-sm">
        <ArrowLeft size={14}/> Volver
      </button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clients')} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color:'var(--color-text-primary)' }}>
              {client.full_name}
            </h1>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              {client.document_type} · {client.document_number}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14}/>
          </button>
          {canEdit && !editing && (
            <button onClick={startEdit} className="btn btn-primary btn-sm">
              <Edit size={14}/> Editar
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} className="btn btn-secondary btn-sm">
                <X size={14}/> Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                <Save size={14}/> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Datos del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Identificación */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 pb-2"
            style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
            Identificación
          </h3>
          <div className="space-y-3">
            <InfoItem icon={User}  label="Nombre completo" value={client.full_name}/>
            <InfoItem icon={FileText} label="Tipo documento"  value={client.document_type}/>
            <InfoItem icon={FileText} label="Número documento" value={client.document_number}/>
            {client.date_of_birth && (
              <InfoItem icon={FileText} label="Fecha nacimiento"
                value={format(new Date(client.date_of_birth),'dd/MM/yyyy')}/>
            )}
            {client.occupation && (
              <InfoItem icon={FileText} label="Ocupación" value={client.occupation}/>
            )}
            {client.monthly_income && (
              <InfoItem icon={FileText} label="Ingresos mensuales"
                value={formatCurrency(client.monthly_income)}/>
            )}
          </div>
        </div>

        {/* Contacto */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 pb-2"
            style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
            Contacto
          </h3>
          <div className="space-y-3">
            <InfoItem icon={Phone} label="Celular"   value={client.mobile}/>
            <InfoItem icon={Phone} label="Teléfono"  value={client.phone}/>
            <InfoItem icon={Mail}  label="Correo"    value={client.email}/>
          </div>
        </div>

        {/* Ubicación */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 pb-2"
            style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
            Ubicación
          </h3>
          <div className="space-y-3">
            <InfoItem icon={MapPin} label="Ciudad"      value={client.city}/>
            <InfoItem icon={MapPin} label="Departamento" value={client.department}/>
            <InfoItem icon={MapPin} label="Dirección"   value={client.address}/>
          </div>
          {client.notes && (
            <div className="mt-4 pt-3" style={{ borderTop:'1px solid var(--color-border)' }}>
              <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>Observaciones:</p>
              <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Formulario de edición */}
      {editing && form && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 pb-3"
            style={{ color:'var(--color-text-primary)', borderBottom:'1px solid var(--color-border)' }}>
            Editando información del cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Field label="Nombre completo" required>
                <input type="text" value={form.full_name} onChange={e=>set('full_name',e.target.value)}
                  className="input text-sm w-full" placeholder="Apellidos y nombres"/>
              </Field>
            </div>
            <Field label="Correo electrónico">
              <input type="email" value={form.email} onChange={e=>set('email',e.target.value)}
                className="input text-sm" placeholder="correo@ejemplo.com"/>
            </Field>
            <Field label="Celular">
              <input type="tel" value={form.mobile} onChange={e=>set('mobile',e.target.value)}
                className="input text-sm" placeholder="3001234567"/>
            </Field>
            <Field label="Teléfono fijo">
              <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}
                className="input text-sm" placeholder="6022345678"/>
            </Field>
            <Field label="Ciudad">
              <input type="text" value={form.city} onChange={e=>set('city',e.target.value)}
                className="input text-sm" placeholder="Cali"/>
            </Field>
            <Field label="Departamento">
              <input type="text" value={form.department} onChange={e=>set('department',e.target.value)}
                className="input text-sm" placeholder="Valle del Cauca"/>
            </Field>
            <Field label="Ocupación">
              <input type="text" value={form.occupation} onChange={e=>set('occupation',e.target.value)}
                className="input text-sm" placeholder="Empleado, Independiente..."/>
            </Field>
            <Field label="Ingresos mensuales (COP)">
              <input type="number" value={form.monthly_income} onChange={e=>set('monthly_income',e.target.value)}
                className="input text-sm" placeholder="3500000"/>
            </Field>
            <div className="md:col-span-3">
              <Field label="Dirección">
                <input type="text" value={form.address} onChange={e=>set('address',e.target.value)}
                  className="input text-sm w-full" placeholder="Carrera 5 # 10-20, Barrio..."/>
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Observaciones">
                <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
                  className="input text-sm resize-none w-full" rows={2}/>
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4"
            style={{ borderTop:'1px solid var(--color-border)' }}>
            <button onClick={cancelEdit} className="btn btn-secondary btn-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* Contratos asociados */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor:'var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Contratos del Cliente
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
              style={{ background:'rgba(13,27,62,0.07)', color:'var(--color-navy)' }}>
              {contracts.length}
            </span>
          </h3>
          {hasRole('admin','gerente','asesor') && (
            <button onClick={() => navigate(to('contracts/new'))} className="btn btn-primary btn-sm">
              <Plus size={13}/> Nuevo Contrato
            </button>
          )}
        </div>

        {contracts.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={36} className="mx-auto mb-2" style={{ color:'var(--color-text-muted)' }}/>
            <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
              Este cliente no tiene contratos registrados
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Proyecto / Unidad</th>
                  <th>Asesor</th>
                  <th>Fecha Firma</th>
                  <th>Estado</th>
                  <th>Tipo Pago</th>
                  <th>Valor</th>
                  <th>Recaudado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => {
                  const s = STATUS_CFG[c.status] || { label:c.status, class:'badge-pendiente' };
                  const pct = c.installments_total > 0
                    ? Math.round((parseFloat(c.total_paid||0) / parseFloat(c.net_value||1)) * 100)
                    : 0;
                  return (
                    <tr key={c.id} style={{ cursor:'pointer' }}
                      onClick={() => navigate(`/contracts/${c.id}`)}>
                      <td className="font-mono text-sm" style={{ color:'var(--color-text-accent)' }}>
                        {c.contract_number}
                      </td>
                      <td>
                        <p className="text-sm font-medium" style={{ color:'var(--color-text-primary)' }}>
                          {c.project_name}
                        </p>
                        <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                          Unidad {c.unit_number}
                        </p>
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                        {c.advisor_name || '—'}
                      </td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)', whiteSpace:'nowrap' }}>
                        {c.signing_date ? format(new Date(c.signing_date),'dd/MM/yyyy') : '—'}
                      </td>
                      <td><span className={`badge ${s.class}`}>{s.label}</span></td>
                      <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                        {c.payment_type}
                      </td>
                      <td className="text-sm font-mono" style={{ color:'var(--color-text-primary)' }}>
                        {formatCurrency(c.net_value)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full min-w-[50px]"
                            style={{ background:'var(--color-bg-primary)' }}>
                            <div className="h-1.5 rounded-full"
                              style={{ width:`${Math.min(pct,100)}%`,
                                       background: pct>=100?'var(--color-gold)':'var(--color-navy)' }}/>
                          </div>
                          <span className="text-xs" style={{ color:'var(--color-text-muted)', whiteSpace:'nowrap' }}>
                            {pct}%
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                          {formatCurrency(c.total_paid)}
                        </p>
                      </td>
                      <td onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>navigate(`/contracts/${c.id}`)}
                          className="btn btn-ghost btn-sm text-xs">
                          Ver →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Evaluación automática del cliente + Historial de interacciones ── */}
      <ClientEvaluation clientId={id} contracts={contracts} clientData={client}/>
    </div>
  );
};

// ── Componente de evaluación + interacciones ──────────────────
const INTERACTION_TYPES = {
  llamada:  { label:'Llamada',  Icon:Phone,         color:'#0D1B3E' }, // navy
  whatsapp: { label:'WhatsApp', Icon:MessageSquare, color:'#0D1B3E' }, // navy
  email:    { label:'Email',    Icon:Mail,          color:'#C8A84B' }, // gold
  visita:   { label:'Visita',   Icon:User,          color:'#0D1B3E' }, // navy
  otro:     { label:'Otro',     Icon:MessageSquare, color:'#0D1B3E' }, // navy
};

const OUTCOMES = {
  sin_respuesta:         'Sin respuesta',
  interesado:            'Interesado',
  negativo:              'No interesado',
  acuerdo_pago:          'Acuerdo de pago',
  pendiente_seguimiento: 'Pendiente seguimiento',
};

const ClientEvaluation = ({ clientId, contracts, clientData }) => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const { tenant }     = useParams();

  const { data: intData } = useQuery({
    queryKey: ['client-interactions', clientId],
    queryFn:  () => interactionsService.getAll({ client_id: clientId, limit: 100 }),
    enabled:  !!clientId,
  });
  const interactions = intData?.data?.data || [];

  // Comisiones vinculadas a contratos de este cliente
  const contractIds = (contracts || []).map(c => c.id);
  const { data: commData } = useQuery({
    queryKey: ['client-commissions', clientId],
    queryFn:  async () => {
      const all = await commissionsService.getAll();
      const rows = all?.data?.data || [];
      // Filtrar las que pertenecen a contratos de este cliente
      return rows.filter(c => contractIds.includes(c.contract_id));
    },
    enabled: contractIds.length > 0,
  });

  // ── Calcular evaluación automática ───────────────────────────
  const evaluate = () => {
    if (!contracts || contracts.length === 0) return null;

    const totalContracts     = contracts.length;
    const activeContracts    = contracts.filter(c => c.status === 'activo').length;
    const cancelledContracts = contracts.filter(c => c.status === 'cancelado').length;
    const deedContracts      = contracts.filter(c => c.status === 'escriturado').length;

    // Cuotas en mora REALES (campo del backend)
    const totalOverdue = contracts.reduce((s,c) => s + (parseInt(c.overdue_count)||0), 0);
    const totalPaidInstallments = contracts.reduce((s,c) => s + (parseInt(c.paid_count)||0), 0);
    const totalInstallments = contracts.reduce((s,c) => s + (parseInt(c.installments_total)||0), 0);

    // Porcentaje pagado en dinero
    const avgPaid = contracts.reduce((s,c) => {
      const pct = parseFloat(c.net_value) > 0
        ? (parseFloat(c.total_paid||0) / parseFloat(c.net_value)) * 100
        : 0;
      return s + pct;
    }, 0) / (totalContracts || 1);

    // Interacciones
    const negativeCalls = interactions.filter(i =>
      i.outcome === 'sin_respuesta' || i.outcome === 'negativo'
    ).length;
    const positiveCalls = interactions.filter(i =>
      i.outcome === 'acuerdo_pago' || i.outcome === 'interesado'
    ).length;

    // ── Score base: 60 puntos ────────────────────────────────
    let score = 60;

    // Contratos cancelados: -15 cada uno
    score -= cancelledContracts * 15;

    // Cuotas en mora — penalización fuerte
    if (totalOverdue >= 12)       score -= 35;
    else if (totalOverdue >= 6)   score -= 25;
    else if (totalOverdue >= 3)   score -= 15;
    else if (totalOverdue >= 1)   score -= 8;

    // Porcentaje pagado en dinero
    if (avgPaid >= 90)       score += 25;
    else if (avgPaid >= 70)  score += 15;
    else if (avgPaid >= 50)  score += 8;
    else if (avgPaid >= 30)  score += 3;
    else if (avgPaid < 10 && totalContracts > 0) score -= 15;

    // Escriturados = terminó bien = muy positivo
    score += deedContracts * 20;

    // Interacciones
    if (negativeCalls > positiveCalls && negativeCalls > 2) score -= 10;
    if (positiveCalls > negativeCalls && positiveCalls > 1) score += 5;

    score = Math.max(0, Math.min(100, score));

    let label, color, bg, icon, description;
    if (score >= 80) {
      label = 'Excelente cliente'; color = '#2D7A3A'; bg = '#f0f8f0';
      icon  = '⭐';
      description = 'Historial de pagos impecable. Prioridad alta para nuevas ofertas.';
    } else if (score >= 60) {
      label = 'Buen cliente'; color = '#1A2F5E'; bg = 'rgba(13,27,62,0.05)';
      icon  = '👍';
      description = 'Buen comportamiento de pago. Seguimiento normal recomendado.';
    } else if (score >= 40) {
      label = 'Cliente regular'; color = '#92660A'; bg = '#fef9ec';
      icon  = '⚠️';
      description = 'Presenta irregularidades en pagos. Se recomienda seguimiento cercano antes de nuevos contratos.';
    } else {
      label = 'Cliente de riesgo'; color = '#C0392B'; bg = '#fdf0f0';
      icon  = '🚨';
      description = 'Alto nivel de mora o incumplimiento. Evalúa cuidadosamente antes de firmar nuevos contratos.';
    }

    return { score, label, color, bg, icon, description,
             totalContracts, activeContracts, totalOverdue,
             avgPaid, negativeCalls, positiveCalls, deedContracts };
  };

  const eval_ = evaluate();

  return (
    <div className="space-y-5">

      {/* Evaluación automática */}
      {eval_ && (
        <div className="card"
          style={{ background: eval_.bg, border:`1px solid ${eval_.color}40`, borderLeft:`4px solid ${eval_.color}` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{eval_.icon}</span>
                <div>
                  <h3 className="font-bold text-lg"
                    style={{ color: eval_.color, fontFamily:'var(--font-display)' }}>
                    {eval_.label}
                  </h3>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    Evaluación automática basada en historial
                  </p>
                </div>
              </div>
              <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                {eval_.description}
              </p>
            </div>

            {/* Score visual */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke="var(--color-bg-primary)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={eval_.color} strokeWidth="3"
                    strokeDasharray={`${eval_.score} 100`}
                    strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color:eval_.color }}>
                    {eval_.score}
                  </span>
                </div>
              </div>
              <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                Puntuación
              </p>
            </div>
          </div>

          {/* Métricas de evaluación */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4"
            style={{ borderTop:`1px solid ${eval_.color}25` }}>
            {[
              ['Contratos activos', eval_.activeContracts, eval_.activeContracts>0?'var(--color-navy)':'var(--color-text-muted)'],
              ['Cuotas en mora',    eval_.totalOverdue,    eval_.totalOverdue>0?'var(--color-danger)':'var(--color-success)'],
              ['% Pagado promedio', `${Math.round(eval_.avgPaid)}%`, eval_.avgPaid>=70?'var(--color-success)':eval_.avgPaid>=40?'var(--color-warning)':'var(--color-danger)'],
              ['Interacciones',     interactions.length,  'var(--color-text-secondary)'],
            ].map(([lbl, val, color]) => (
              <div key={lbl} className="text-center p-2 rounded"
                style={{ background:'rgba(255,255,255,0.6)', border:'1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-lg font-bold" style={{ color }}>{val}</p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal nueva interacción con datos prellenados */}
      {showModal && (
        <NewInteractionModal
          tenant={tenant}
          preselectedClient={clientData}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey:['client-interactions', clientId] });
            setShowModal(false);
          }}
        />
      )}

      {/* Historial de interacciones */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Historial de Interacciones
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
              style={{ background:'rgba(13,27,62,0.07)', color:'var(--color-navy)' }}>
              {interactions.length}
            </span>
          </h3>
          <button onClick={() => setShowModal(true)}
            className="btn btn-primary btn-sm text-xs">
            <Plus size={12}/> Nueva interacción
          </button>
        </div>

        {interactions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={32} className="mx-auto mb-2" style={{ color:'var(--color-text-muted)' }}/>
            <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
              Sin interacciones registradas con este cliente
            </p>
            <button onClick={() => setShowModal(true)}
              className="btn btn-primary btn-sm mt-3 text-xs">
              Registrar primera interacción
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {interactions.map(i => {
              const t = INTERACTION_TYPES[i.interaction_type] || INTERACTION_TYPES.otro;
              return (
                <div key={i.id}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>

                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background:`${t.color}20`, border:`1.5px solid ${t.color}40` }}>
                    <t.Icon size={14} style={{ color:t.color }}/>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background:`${t.color}18`, color:t.color, border:`1px solid ${t.color}35` }}>
                        {t.label}
                      </span>
                      {i.outcome && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background:'var(--color-bg-primary)', color:'var(--color-text-muted)', border:'1px solid var(--color-border)' }}>
                          {OUTCOMES[i.outcome] || i.outcome}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color:'var(--color-text-muted)' }}>
                        {i.created_at ? format(new Date(i.created_at), 'dd/MM/yyyy HH:mm') : ''}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                      {i.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs"
                      style={{ color:'var(--color-text-muted)' }}>
                      <span>👤 {i.user_name || 'Sistema'}</span>
                      {i.next_contact && (
                        <span style={{ color:'var(--color-warning)' }}>
                          📅 Próx: {format(new Date(i.next_contact), 'dd/MM/yyyy')}
                        </span>
                      )}
                      {i.documents?.length > 0 && (
                        <span>📎 {i.documents.length} archivo{i.documents.length!==1?'s':''}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comisiones de asesores vinculadas a este cliente */}
      {commData && commData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
              💰 Comisiones de Asesores
              <span className="ml-2 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                Lo que se debe pagar por contratos de este cliente
              </span>
            </h3>
            <button
              onClick={() => {
                const wb = XLSX.utils.book_new();
                const fm = v => parseFloat(v||0);
                const rows = [
                  ['Asesor','Contrato','Tipo Comisión','Total Comisión','Pagado','Pendiente','Estado']
                ];
                commData.forEach(c => {
                  const total   = fm(c.total_amount);
                  const paid    = fm(c.paid_amount);
                  const pending = total - paid;
                  rows.push([
                    c.advisor_name,
                    c.contract_number,
                    c.commission_type === 'fija' ? 'Monto fijo' : 'Porcentaje',
                    total, paid, pending,
                    paid >= total ? 'Pagada completa' : paid > 0 ? 'Parcial' : 'Pendiente',
                  ]);
                });
                const totalPend = commData.reduce((s,c) => s + Math.max(0, fm(c.total_amount) - fm(c.paid_amount)), 0);
                const totalPaid = commData.reduce((s,c) => s + fm(c.paid_amount), 0);
                rows.push(['', '', 'TOTALES', commData.reduce((s,c)=>s+fm(c.total_amount),0), totalPaid, totalPend, '']);
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [20,16,16,18,18,18,16].map(w=>({wch:w}));
                XLSX.utils.book_append_sheet(wb, ws, 'Comisiones');
                XLSX.writeFile(wb, `Comisiones_${clientData?.full_name?.replace(/ /g,'_')}_${format(new Date(),'yyyyMMdd')}.xlsx`);
              }}
              className="btn btn-secondary btn-sm text-xs flex items-center gap-1">
              ⬇ Exportar Excel
            </button>
          </div>
          <div className="space-y-2">
            {commData.map(comm => {
              const total   = parseFloat(comm.total_amount || 0);
              const paid    = parseFloat(comm.paid_amount  || 0);
              const pending = total - paid;
              const allPaid = paid >= total;
              const pct     = total > 0 ? Math.round(paid/total*100) : 0;
              const fm      = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v);
              return (
                <div key={comm.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                  background: allPaid ? 'rgba(200,168,75,0.07)' : pending > 0 ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)',
                    border: `1px solid ${allPaid ? 'rgba(200,168,75,0.3)' : pending > 0 ? 'var(--color-warning-border)' : 'var(--color-border)'}`,
                  }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
                        {comm.advisor_name}
                      </span>
                      <span className="text-xs font-mono" style={{ color:'var(--color-gold)' }}>
                        {comm.contract_number}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: allPaid ? 'rgba(200,168,75,0.12)' : 'var(--color-warning-bg)',
                          color:      allPaid ? 'var(--color-gold)'      : 'var(--color-warning)',
                          border:     `1px solid ${allPaid ? 'rgba(200,168,75,0.3)' : 'var(--color-warning-border)'}`,
                        }}>
                        {allPaid ? '✓ Pagada' : `⏳ Pendiente ${fm(pending)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background:'var(--color-bg-primary)', maxWidth:'120px' }}>
                        <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background: allPaid ? 'var(--color-gold)' : 'var(--color-navy)' }}/>
                      </div>
                      <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        {fm(paid)} / {fm(total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Resumen total */}
          {(() => {
            const totalPend = commData.reduce((s,c) => s + Math.max(0, parseFloat(c.total_amount||0) - parseFloat(c.paid_amount||0)), 0);
            const fm = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v);
            return totalPend > 0 ? (
              <div className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop:'1px solid var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color:'var(--color-text-muted)' }}>
                  Total pendiente por pagar a asesores:
                </span>
                <span className="font-bold text-sm" style={{ color:'var(--color-warning)' }}>
                  {fm(totalPend)}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-center" style={{ color:'var(--color-success)' }}>
                ✅ Todas las comisiones de este cliente están pagadas
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ClientDetailPage;