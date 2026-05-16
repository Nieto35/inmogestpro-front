// src/pages/Advisors/AdvisorsPage.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, RefreshCw, Plus, X, Save, Eye,
  FileText, DollarSign, TrendingUp, Edit, ChevronDown, ChevronUp,
  LayoutGrid, List, Briefcase, Scale, Crown
} from 'lucide-react';
import { advisorsService, usersService, commissionsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Modal from '../../components/UI/Modal';

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium mb-1" style={{ color:'var(--color-text-muted)' }}>
      {label}
    </label>
    {children}
  </div>
);

// ── Modal Editar Asesor ───────────────────────────────────────
const EditAdvisorModal = ({ advisor, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name:       advisor.full_name       || '',
    email:           advisor.email           || '',
    phone:           advisor.phone           || '',
    advisor_type:    advisor.advisor_type    || 'planta',
    commission_rate: String(advisor.commission_rate || 3.0),
    is_active:       advisor.is_active !== false,
    user_id:         advisor.user_id         || '',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const { data: usersData } = useQuery({
    queryKey: ['users-for-advisor'],
    queryFn:  () => usersService.getAll(),
  });
  // Filtrar usuarios según el tipo del asesor que se está editando
  const advisorUsers = (usersData?.data?.data || []).filter(u => {
    if (form.advisor_type === 'abogado')    return u.role === 'abogado';
    if (form.advisor_type === 'supervisor') return u.role === 'supervisor';
    return u.role === 'asesor';
  });

  const handleSave = async () => {
    if (!form.full_name) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      await advisorsService.update(advisor.id, {
        full_name:       form.full_name,
        email:           form.email       || null,
        phone:           form.phone       || null,
        advisor_type:    form.advisor_type,
        commission_rate: parseFloat(form.commission_rate) || 3.0,
        is_active:       form.is_active,
        user_id:         form.user_id     || null,
      });
      toast.success('Asesor actualizado correctamente');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-5 sticky top-0"
          style={{ background:'var(--color-navy)', borderBottom:'3px solid var(--color-gold)' }}>
          <h2 className="font-bold" style={{ color:'#F5F3EE', fontFamily:'var(--font-display)' }}>
            Editar Asesor — {advisor.full_name}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ color:'rgba(245,243,238,0.7)' }}>
            <X size={16}/>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nombre completo *">
            <input value={form.full_name} onChange={e=>set('full_name',e.target.value)}
              className="input text-sm w-full" placeholder="Nombre del asesor"/>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={e=>set('email',e.target.value)}
                className="input text-sm" placeholder="correo@email.com"/>
            </Field>
            <Field label="Teléfono">
              <input value={form.phone} onChange={e=>set('phone',e.target.value)}
                className="input text-sm" placeholder="3001234567"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de asesor">
              <select value={form.advisor_type} onChange={e=>set('advisor_type',e.target.value)}
                className="input text-sm">
                <option value="planta">Planta (empleado)</option>
                <option value="freelance">Freelance / Externo</option>
                <option value="referido">Referido</option>
                <option value="gerente">Gerente</option>
                <option value="abogado">Abogado</option>
                <option value="externo">Externo</option>
              </select>
            </Field>
            <Field label="Comisión (%)">
              <input type="number" value={form.commission_rate}
                onChange={e=>set('commission_rate',e.target.value)}
                className="input text-sm" min="0" max="20" step="0.5"/>
            </Field>
          </div>
          <Field label="Usuario del sistema vinculado">
            <select value={form.user_id} onChange={e=>set('user_id',e.target.value)}
              className="input text-sm">
              <option value="">Sin usuario vinculado</option>
              {advisorUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} — @{u.username}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-3 p-3 rounded"
            style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={e=>set('is_active',e.target.checked)}
              className="w-4 h-4"/>
            <label htmlFor="is_active" className="text-sm"
              style={{ color:'var(--color-text-secondary)' }}>
              Asesor activo (desmarcar para desactivar sin eliminar)
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Panel de detalle del asesor ───────────────────────────────
const AdvisorDetail = ({ advisor, onEdit }) => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;

  const { data: contractsData } = useQuery({
    queryKey: ['advisor-contracts', advisor.id],
    queryFn:  () => advisorsService.getCommissions(advisor.id),
    staleTime: 0,
    enabled:   !!advisor?.id,
  });
  const contracts = contractsData?.data?.data || [];

  const { data: commData } = useQuery({
    queryKey: ['commissions-advisor', advisor.id],
    queryFn:  () => commissionsService.getAll({ advisor_id: advisor.id }),
    staleTime: 0,
    enabled:   !!advisor?.id,
  });
  const commissions = commData?.data?.data || [];

  const totalComm   = commissions.reduce((s,c) => s + parseFloat(c.total_amount||0), 0);
  const paidComm    = commissions.reduce((s,c) => s + parseFloat(c.paid_amount||0), 0);
  const pendingComm = totalComm - paidComm;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs mb-1" style={{ color:'var(--color-text-muted)' }}>
            {advisor.advisor_type === 'freelance' ? 'Freelance / Externo' :
             advisor.advisor_type === 'gerente'   ? 'Gerente'            :
             advisor.advisor_type === 'abogado'   ? 'Abogado'            :
             advisor.advisor_type === 'externo'   ? 'Externo'            :
             advisor.advisor_type === 'referido'  ? 'Referido'           : 'Planta'}
          </p>
          <div className="flex gap-3 flex-wrap text-xs" style={{ color:'var(--color-text-muted)' }}>
            {advisor.email && <span>✉ {advisor.email}</span>}
            {advisor.phone && <span>📞 {advisor.phone}</span>}
          </div>
        </div>
        <button onClick={onEdit} className="btn btn-outline btn-sm">
          <Edit size={13}/> Editar
        </button>
      </div>

      {/* KPIs — navy/gold/warning en lugar de blue/green */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded p-3 text-center"
          style={{ background:'rgba(13,27,62,0.05)', border:'1px solid rgba(13,27,62,0.12)' }}>
          <p className="text-xs mb-1" style={{ color:'var(--color-navy)' }}>Contratos</p>
          <p className="font-bold text-lg" style={{ color:'var(--color-navy)' }}>{contracts.length}</p>
          <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            {formatCurrency(advisor.total_value)} vendido
          </p>
        </div>
        <div className="rounded p-3 text-center"
          style={{ background:'var(--color-warning-bg)', border:'1px solid var(--color-warning-border)' }}>
          <p className="text-xs mb-1" style={{ color:'var(--color-warning)' }}>Comisión pendiente</p>
          <p className="font-bold text-sm" style={{ color:'var(--color-warning)' }}>
            {formatCurrency(pendingComm)}
          </p>
          <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>por pagar</p>
        </div>
        <div className="rounded p-3 text-center"
          style={{ background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.2)' }}>
          <p className="text-xs mb-1" style={{ color:'var(--color-gold)' }}>Comisión pagada</p>
          <p className="font-bold text-sm" style={{ color:'var(--color-gold)' }}>
            {formatCurrency(paidComm)}
          </p>
          <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>acumulado</p>
        </div>
      </div>

      {/* Comisiones registradas */}
      <div className="rounded overflow-hidden"
        style={{ border:'1px solid var(--color-border)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between"
          style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide"
            style={{ color:'rgba(245,243,238,0.7)' }}>
            Comisiones Registradas
          </p>
          <button
            onClick={() => navigate(to('commissions'))}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ background:'rgba(200,168,75,0.15)', color:'var(--color-gold)', border:'1px solid rgba(200,168,75,0.3)' }}>
            Ver todas →
          </button>
        </div>

        {commissions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs" style={{ color:'var(--color-text-muted)' }}>
            Sin comisiones registradas aún.{' '}
            <button onClick={() => navigate(to('commissions'))}
              className="underline" style={{ color:'var(--color-gold)' }}>
              Registrar en Comisiones
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor:'var(--color-border)' }}>
            {commissions.map(comm => {
              const total   = parseFloat(comm.total_amount||0);
              const paid    = parseFloat(comm.paid_amount||0);
              const pending = total - paid;
              const pct     = total > 0 ? Math.round((paid/total)*100) : 0;
              const allPaid = pending <= 0;

              return (
                <div key={comm.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-medium"
                          style={{ color:'var(--color-gold)' }}>
                          {comm.contract_number}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: comm.commission_type==='fija' ? 'rgba(200,168,75,0.1)' : 'rgba(13,27,62,0.07)',
                            color:      comm.commission_type==='fija' ? 'var(--color-gold)'    : 'var(--color-navy)',
                            border:     `1px solid ${comm.commission_type==='fija' ? 'rgba(200,168,75,0.2)' : 'rgba(13,27,62,0.12)'}`,
                          }}>
                          {comm.commission_type === 'fija' ? '$ Fija' : '% Porc.'}
                        </span>
                        {allPaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid var(--color-success-border)' }}>
                            ✓ Pagada
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                        {comm.client_name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold font-mono" style={{ color:'var(--color-navy)' }}>
                        {formatCurrency(total)}
                      </p>
                      {!allPaid && (
                        <p className="text-xs" style={{ color:'var(--color-warning)' }}>
                          {formatCurrency(pending)} pend.
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Barra progreso — dorada */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full"
                      style={{ background:'var(--color-bg-secondary)' }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width:`${pct}%`, background: allPaid ? 'var(--color-gold)' : 'var(--color-navy)' }}/>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color:'var(--color-text-muted)' }}>
                      {pct}% · {comm.installments} pago{comm.installments!==1?'s':''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial contratos */}
      {contracts.length > 0 && (
        <div className="rounded overflow-hidden"
          style={{ border:'1px solid var(--color-border)' }}>
          <div className="px-4 py-2.5"
            style={{ background:'var(--color-bg-secondary)', borderBottom:'1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color:'var(--color-text-muted)' }}>
              Contratos del Asesor
            </p>
          </div>
          <div className="divide-y text-xs" style={{ borderColor:'var(--color-border)' }}>
            {contracts.map((c,i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-2">
                <div>
                  <p className="font-mono font-medium" style={{ color:'var(--color-gold)' }}>
                    {c.contract_number}
                  </p>
                  <p style={{ color:'var(--color-text-muted)' }}>{c.client_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono" style={{ color:'var(--color-navy)', fontWeight:600 }}>
                    {formatCurrency(c.net_value)}
                  </p>
                  <p style={{ color:'var(--color-text-muted)' }}>
                    {c.signing_date ? format(new Date(c.signing_date),'dd/MM/yyyy') : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contracts.length === 0 && (
        <div className="text-center py-6" style={{ color:'var(--color-text-muted)' }}>
          <FileText size={28} className="mx-auto mb-2"/>
          <p className="text-sm">No hay contratos asignados a este asesor</p>
        </div>
      )}
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const AdvisorsPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path}`;
  const queryClient  = useQueryClient();
  const { hasRole }  = useAuthStore();
  const canCreate    = hasRole('admin','gerente');
  const canEdit      = hasRole('admin','gerente');

  const [selected,   setSelected]   = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [activeTab,  setActiveTab]  = useState('asesores');
  const [viewMode,   setViewMode]   = useState(() => localStorage.getItem('advisors_view') || 'grid');

  const setView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('advisors_view', mode);
    setSelected(null);
  };

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['advisors'],
    queryFn:  () => advisorsService.getAll(),
  });
  const advisors = data?.data?.data || [];

  const ASESOR_TYPES = ['planta','externo','freelance','referido','gerente','asesor'];
  const filteredAdvisors = advisors.filter(a => {
    if (activeTab === 'abogados')    return a.advisor_type === 'abogado';
    if (activeTab === 'supervisores') return a.advisor_type === 'supervisor';
    return ASESOR_TYPES.includes(a.advisor_type);
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['advisors'] });
    queryClient.invalidateQueries({ queryKey:['advisor-commissions'] });
    refetch();
  };

  return (
    <div className="animate-fade-in">

      {editTarget && (
        <EditAdvisorModal
          advisor={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold"
            style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            Equipo Comercial
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {filteredAdvisors.length} {activeTab === 'abogados' ? 'abogado' : activeTab === 'supervisores' ? 'supervisor' : 'asesor'}{filteredAdvisors.length !== 1 ? 'es' : ''} registrado{filteredAdvisors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex rounded overflow-hidden" style={{ border:'1px solid var(--color-border)' }}>
            <button
              onClick={() => setView('grid')}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: viewMode==='grid' ? 'var(--color-navy)' : 'var(--color-bg-card)',
                color:      viewMode==='grid' ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}
              title="Vista cuadrícula">
              <LayoutGrid size={14}/>
            </button>
            <button
              onClick={() => setView('list')}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                background: viewMode==='list' ? 'var(--color-navy)' : 'var(--color-bg-card)',
                color:      viewMode==='list' ? 'var(--color-gold)' : 'var(--color-text-muted)',
                borderLeft: '1px solid var(--color-border)',
              }}
              title="Vista lista">
              <List size={14}/>
            </button>
          </div>
          <button onClick={() => refetch()} className="btn btn-outline btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          {canCreate && (
            <button onClick={() => navigate(to('advisors/new'))} className="btn btn-primary btn-sm">
              <Plus size={14}/> Nuevo {activeTab === 'abogados' ? 'Abogado' : activeTab === 'supervisores' ? 'Supervisor' : 'Asesor'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background:'var(--color-bg-secondary)', width:'fit-content' }}>
        {[
          { key:'asesores',    label:'Asesores',    icon:<Briefcase size={13}/> },
          { key:'abogados',    label:'Abogados',    icon:<Scale size={13}/> },
          { key:'supervisores',label:'Supervisores', icon:<Crown size={13}/> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelected(null); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--color-navy)' : 'transparent',
              color:      activeTab === tab.key ? 'var(--color-gold)' : 'var(--color-text-muted)',
              boxShadow:  activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
            }}>
            {tab.icon} {tab.label}
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: activeTab === tab.key ? 'rgba(200,168,75,0.2)' : 'var(--color-bg-card)',
                color:      activeTab === tab.key ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}>
              {advisors.filter(a => {
                if (tab.key==='abogados')    return a.advisor_type==='abogado';
                if (tab.key==='supervisores') return a.advisor_type==='supervisor';
                return ['planta','externo','freelance','referido','gerente','asesor'].includes(a.advisor_type);
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── VISTA LISTA ── */}
      {viewMode === 'list' && (
        <>
        <div className="table-container">
          {filteredAdvisors.length === 0 && !isFetching ? (
            <div className="p-12 text-center">
              <UserCheck size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }}/>
              <p style={{ color:'var(--color-text-secondary)' }}>
                No hay {activeTab === 'abogados' ? 'abogados' : activeTab === 'supervisores' ? 'supervisores' : 'asesores'} registrados
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Contratos</th>
                  <th>Comisión</th>
                  <th>Vendido</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAdvisors.map((a, i) => (
                  <tr key={a.id}
                    style={{ cursor:'pointer' }}
                    onClick={() => setSelected(selected?.id === a.id ? null : a)}>
                    <td className="font-bold text-sm" style={{ color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>#{i+1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background:'var(--color-navy)', color:'var(--color-gold)', fontFamily:'var(--font-display)', borderRadius:'6px' }}>
                          {a.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm" style={{ color:'var(--color-navy)' }}>{a.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge text-xs ${a.advisor_type==='freelance'?'badge-freelance':'badge-planta'}`}>
                        {a.advisor_type}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{a.email || '—'}</td>
                    <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{a.phone || '—'}</td>
                    <td className="text-sm font-semibold text-center" style={{ color:'var(--color-navy)' }}>{a.contracts_count ?? 0}</td>
                    <td className="text-sm font-semibold text-center" style={{ color:'var(--color-navy)' }}>{a.commission_rate ?? 3}%</td>
                    <td className="text-sm font-semibold font-mono" style={{ color:'var(--color-gold)' }}>
                      {a.total_value > 0 ? `$${(parseFloat(a.total_value)/1000000).toFixed(1)}M` : '$0'}
                    </td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-activo' : 'badge-cancelado'}`}>
                        {a.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {canEdit && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditTarget(a); }}
                          className="btn btn-ghost btn-sm">
                          <Edit size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel de detalle en vista lista */}
        {selected && (
          <div className="mt-4 card" style={{ borderTop:'3px solid var(--color-gold)' }}>
            <div className="flex items-center justify-between mb-4 pb-3"
              style={{ borderBottom:'1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center font-bold"
                  style={{ background:'var(--color-navy)', color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>
                  {selected.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                    {selected.full_name}
                  </h2>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                    Contratos y comisiones
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">
                <X size={16}/>
              </button>
            </div>
            <AdvisorDetail
              advisor={selected}
              onEdit={() => setEditTarget(selected)}
            />
          </div>
        )}
        </>
      )}

      {/* ── VISTA CUADRÍCULA ── */}
      {viewMode === 'grid' && (
        <div className="flex gap-4" style={{ alignItems:'flex-start' }}>

          {/* Tarjetas */}
          <div className={`${selected ? 'space-y-3 w-72 flex-shrink-0' : 'w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}`}
            style={{ transition:'all 0.3s' }}>

            {filteredAdvisors.length === 0 && !isFetching && (
              <div className="card flex flex-col items-center py-16 gap-4 col-span-3">
                <UserCheck size={48} style={{ color:'var(--color-text-muted)' }}/>
                <div className="text-center">
                  <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
                    No hay {activeTab === 'abogados' ? 'abogados' : activeTab === 'supervisores' ? 'supervisores' : 'asesores'} registrados
                  </p>
                  <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
                    Regístralos para asignarlos a contratos
                  </p>
                </div>
                {canCreate && (
                  <button onClick={() => navigate(to('advisors/new'))} className="btn btn-primary btn-sm">
                    <Plus size={14}/> Registrar
                  </button>
                )}
              </div>
            )}

            {filteredAdvisors.map((a, i) => {
              const isSelected = selected?.id === a.id;
              return (
                <div key={a.id}
                  className="card cursor-pointer transition-all"
                  style={{
                    borderLeft: isSelected ? '4px solid var(--color-gold)' : '4px solid transparent',
                    boxShadow:  isSelected ? 'var(--shadow-md)' : undefined,
                  }}
                  onClick={() => setSelected(isSelected ? null : a)}>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 flex items-center justify-center font-bold text-lg flex-shrink-0"
                      style={{ background:'var(--color-navy)', color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>
                      {a.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color:'var(--color-navy)' }}>
                        {a.full_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`badge text-xs ${a.advisor_type==='freelance'?'badge-freelance':'badge-planta'}`}>
                          {a.advisor_type}
                        </span>
                        {!a.is_active && (
                          <span className="badge badge-cancelado text-xs">Inactivo</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xl font-bold flex-shrink-0"
                      style={{ color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>
                      #{i+1}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded p-1.5" style={{ background:'var(--color-bg-secondary)' }}>
                      <p className="font-bold text-sm" style={{ color:'var(--color-navy)' }}>
                        {a.contracts_count ?? 0}
                      </p>
                      <p style={{ color:'var(--color-text-muted)' }}>Contratos</p>
                    </div>
                    <div className="rounded p-1.5" style={{ background:'var(--color-bg-secondary)' }}>
                      <p className="font-bold text-sm" style={{ color:'var(--color-navy)' }}>
                        {a.commission_rate ?? 3}%
                      </p>
                      <p style={{ color:'var(--color-text-muted)' }}>Comisión</p>
                    </div>
                    <div className="rounded p-1.5" style={{ background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.15)' }}>
                      <p className="font-bold text-sm" style={{ color:'var(--color-gold)' }}>
                        {a.total_value > 0 ? `$${(parseFloat(a.total_value)/1000000).toFixed(1)}M` : '$0'}
                      </p>
                      <p style={{ color:'var(--color-text-muted)' }}>Vendido</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2"
                    style={{ borderTop:'1px solid var(--color-border)' }}>
                    {canEdit ? (
                      <button
                        onClick={e => { e.stopPropagation(); setEditTarget(a); }}
                        className="btn btn-ghost btn-sm text-xs">
                        <Edit size={12}/> Editar
                      </button>
                    ) : <span/>}
                    <button className="btn btn-ghost btn-sm text-xs"
                      style={{ color:'var(--color-gold)' }}>
                      <Eye size={12}/> {isSelected ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Panel de detalle */}
          {selected && (
            <div className="flex-1 card" style={{ minWidth:0, borderTop:'3px solid var(--color-gold)' }}>
              <div className="flex items-center justify-between mb-4 pb-3"
                style={{ borderBottom:'1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center font-bold"
                    style={{ background:'var(--color-navy)', color:'var(--color-gold)', fontFamily:'var(--font-display)' }}>
                    {selected.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                      {selected.full_name}
                    </h2>
                    <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                      Contratos y comisiones
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">
                  <X size={16}/>
                </button>
              </div>
              <AdvisorDetail
                advisor={selected}
                onEdit={() => setEditTarget(selected)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvisorsPage;