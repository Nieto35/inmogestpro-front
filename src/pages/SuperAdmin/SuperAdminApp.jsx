// src/pages/SuperAdmin/SuperAdminApp.jsx
// ============================================================
// PANEL SUPER-ADMIN — Emmanuel Franco
// URL: /super-admin
// Gestión completa de todas las empresas registradas
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { superAdminService } from '../../services/api.service';
import { todayISO } from '../../utils/dates';
import toast, { Toaster } from 'react-hot-toast';
import {
  Building2, Users, CreditCard, TrendingUp, Plus, Eye, EyeOff,
  Power, PowerOff, RefreshCw, Globe, CheckCircle, AlertTriangle,
  LogOut, BarChart2, Edit, X, Save,
} from 'lucide-react';

// ── Query Client propio para el super-admin ────────────────
const qc = new QueryClient({ defaultOptions:{ queries:{ retry:1, staleTime:30000 } } });

// ── Login del Super-Admin ─────────────────────────────────
const SALogin = ({ onLogin }) => {
  const [form, setForm] = useState({ username:'', password:'' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await superAdminService.login(form);
      const { token, user } = res.data.data;
      localStorage.setItem('inmogest_sa_token', token);
      onLogin(user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0D1B3E', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1A2F5E', border:'1.5px solid #C8A84B', borderRadius:8, padding:40, width:380, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, background:'#0D1B3E', border:'2px solid #C8A84B', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>🏢</div>
          <h1 style={{ color:'#F5F3EE', fontSize:24, fontWeight:800, marginBottom:4, fontFamily:'Georgia,serif' }}>InmoGest <span style={{ color:'#C8A84B' }}>Pro</span></h1>
          <p style={{ color:'rgba(200,168,75,0.6)', fontSize:12, letterSpacing:'0.15em', textTransform:'uppercase' }}>Panel de Administración Global</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:6, letterSpacing:'0.1em' }}>USUARIO O CORREO</label>
            <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}
              style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.3)', borderRadius:4, padding:'10px 12px', color:'#F5F3EE', fontSize:14 }}
              placeholder="superadmin" required/>
          </div>
          <div>
            <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:6, letterSpacing:'0.1em' }}>CONTRASEÑA</label>
            <div style={{ position:'relative' }}>
              <input type={show?'text':'password'} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.3)', borderRadius:4, padding:'10px 36px 10px 12px', color:'#F5F3EE', fontSize:14 }}
                required/>
              <button type="button" onClick={()=>setShow(s=>!s)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(200,168,75,0.5)', cursor:'pointer' }}>
                {show ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ background:'#C8A84B', color:'#0D1B3E', border:'none', borderRadius:4, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', marginTop:8, letterSpacing:'0.05em' }}>
            {loading ? 'Verificando...' : '🔐 Ingresar al Panel'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Modal crear empresa ───────────────────────────────────
const NewTenantModal = ({ plans, onClose, onCreated }) => {
  const [form, setForm] = useState({
    slug:'', name:'', legal_name:'', nit:'', email:'', phone:'',
    city:'', country:'Colombia', plan_slug:'basic',
    currency_code:'COP',
    gerente_name:'', gerente_email:'', gerente_username:'', gerente_password:'',
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const CURRENCIES = [
    {code:'COP',label:'$ Peso Colombiano'},{code:'USD',label:'$ Dólar Americano'},
    {code:'EUR',label:'€ Euro'},{code:'MXN',label:'$ Peso Mexicano'},
    {code:'PEN',label:'S/ Sol Peruano'},{code:'CLP',label:'$ Peso Chileno'},
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.slug || !form.name || !form.gerente_password)
      return toast.error('Slug, nombre y contraseña del gerente son requeridos');
    setSaving(true);
    try {
      await superAdminService.createTenant(form);
      toast.success(`Empresa "${form.name}" creada. URL: /${form.slug}/login`);
      onCreated();
      onClose();
    } catch(err) {
      toast.error(err.response?.data?.message || 'Error al crear empresa');
    } finally { setSaving(false); }
  };

  const inp = (label, key, type='text', placeholder='') => (
    <div>
      <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.08em' }}>{label}</label>
      <input type={type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder}
        style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'8px 10px', color:'#F5F3EE', fontSize:13 }}/>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(13,27,62,0.85)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:40, zIndex:9999 }}>
      <div style={{ background:'#1A2F5E', border:'1.5px solid #C8A84B', borderRadius:8, padding:32, width:560, maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, borderBottom:'2px solid #C8A84B', paddingBottom:16 }}>
          <h2 style={{ color:'#F5F3EE', fontSize:18, fontWeight:700, fontFamily:'Georgia,serif' }}>🏢 Nueva Empresa</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(200,168,75,0.6)', cursor:'pointer' }}><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <p style={{ color:'#C8A84B', fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' }}>IDENTIFICACIÓN</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.08em' }}>SLUG (URL)* <span style={{color:'rgba(200,168,75,0.4)'}}>solo letras, números y guiones</span></label>
              <input value={form.slug} onChange={e=>set('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                placeholder="inmobiliaria-abc" required
                style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'8px 10px', color:'#F5F3EE', fontSize:13 }}/>
              {form.slug && <p style={{ color:'#C8A84B', fontSize:11, marginTop:4 }}>URL: /{form.slug}/login</p>}
            </div>
            {inp('NOMBRE DE LA EMPRESA*', 'name', 'text', 'Inmobiliaria ABC SAS')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {inp('NIT / RUC', 'nit', 'text', '900123456-1')}
            {inp('EMAIL', 'email', 'email', 'contacto@empresa.com')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {inp('CIUDAD', 'city', 'text', 'Bogotá')}
            {inp('TELÉFONO', 'phone', 'text', '3001234567')}
          </div>

          <p style={{ color:'#C8A84B', fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginTop:8 }}>PLAN Y MONEDA</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.08em' }}>PLAN*</label>
              <select value={form.plan_slug} onChange={e=>set('plan_slug',e.target.value)}
                style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'8px 10px', color:'#F5F3EE', fontSize:13 }}>
                {plans.map(p => <option key={p.slug} value={p.slug}>{p.name} — ${p.price_usd}/mes ({p.max_users} usuarios)</option>)}
              </select>
            </div>
            <div>
              <label style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.08em' }}>MONEDA</label>
              <select value={form.currency_code} onChange={e=>set('currency_code',e.target.value)}
                style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'8px 10px', color:'#F5F3EE', fontSize:13 }}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <p style={{ color:'#C8A84B', fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginTop:8 }}>GERENTE DE LA EMPRESA</p>
          <div style={{ background:'rgba(200,168,75,0.06)', border:'1px solid rgba(200,168,75,0.2)', borderRadius:4, padding:12, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {inp('NOMBRE COMPLETO', 'gerente_name', 'text', 'Juan Pérez')}
              {inp('EMAIL', 'gerente_email', 'email', 'gerente@empresa.com')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {inp('USUARIO', 'gerente_username', 'text', 'gerente_abc')}
              {inp('CONTRASEÑA*', 'gerente_password', 'password', 'mínimo 8 caracteres')}
            </div>
            <p style={{ color:'rgba(200,168,75,0.5)', fontSize:11 }}>El gerente tendrá acceso completo a su empresa. Podrá crear usuarios dentro del límite del plan.</p>
          </div>

          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1, background:'rgba(255,255,255,0.05)', color:'#F5F3EE', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'10px', fontSize:13, cursor:'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex:2, background:'#C8A84B', color:'#0D1B3E', border:'none', borderRadius:4, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {saving ? 'Creando...' : '✓ Crear Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Tarjeta de empresa ────────────────────────────────────
const TenantCard = ({ tenant, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [showResetForm, setShowResetForm] = useState(null);

  const { data: statsData } = useQuery({
    queryKey: ['sa-stats', tenant.slug],
    queryFn:  () => superAdminService.getTenantStats(tenant.slug),
    enabled:  expanded,
    staleTime: 30000,
  });

  const { data: managersData, refetch: refetchManagers } = useQuery({
    queryKey: ['sa-managers', tenant.slug],
    queryFn:  () => superAdminService.getTenantManagers(tenant.slug),
    enabled:  expanded,
    staleTime: 30000,
  });

  const stats    = statsData?.data?.data;
  const managers = managersData?.data?.data || [];

  const handleToggle = async () => {
    try {
      if (tenant.is_active) {
        await superAdminService.suspendTenant(tenant.slug);
        toast.success(`Empresa "${tenant.name}" suspendida`);
      } else {
        await superAdminService.activateTenant(tenant.slug);
        toast.success(`Empresa "${tenant.name}" activada`);
      }
      onRefresh();
    } catch(err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleResetPassword = async (mgr) => {
    if (!newPass || newPass.length < 8) return toast.error('Mínimo 8 caracteres');
    setResetting(mgr.id);
    try {
      await superAdminService.resetManagerPassword(tenant.slug, { user_id: mgr.id, new_password: newPass });
      toast.success(`Contraseña de ${mgr.full_name} restablecida`);
      setShowResetForm(null);
      setNewPass('');
    } catch(err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setResetting(null); }
  };

  const today = todayISO();
  const expired = tenant.subscription_end && tenant.subscription_end < today;
  const usageColor = tenant.active_users >= tenant.max_users ? '#C0392B' : tenant.active_users >= tenant.max_users*0.8 ? '#92660A' : '#C8A84B';

  return (
    <div style={{ background:'#1A2F5E', border:`1.5px solid ${tenant.is_active ? 'rgba(200,168,75,0.3)' : '#7f1d1d'}`, borderRadius:8, overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, background:tenant.is_active?'rgba(200,168,75,0.15)':'rgba(192,57,43,0.2)', border:`1.5px solid ${tenant.is_active?'rgba(200,168,75,0.4)':'rgba(192,57,43,0.4)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            🏢
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <p style={{ color:'#F5F3EE', fontWeight:700, fontSize:15 }}>{tenant.name}</p>
              <span style={{ background:tenant.is_active?'rgba(200,168,75,0.15)':'rgba(192,57,43,0.15)', color:tenant.is_active?'#C8A84B':'#C0392B', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:2 }}>
                {tenant.is_active ? 'ACTIVA' : 'SUSPENDIDA'}
              </span>
              {expired && <span style={{ background:'rgba(146,102,10,0.2)', color:'#92660A', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:2 }}>VENCIDA</span>}
            </div>
            <p style={{ color:'rgba(200,168,75,0.5)', fontSize:12 }}>
              /{tenant.slug}/login &nbsp;·&nbsp; Plan: <strong style={{color:'rgba(245,243,238,0.7)'}}>{tenant.plan_slug}</strong> &nbsp;·&nbsp; {tenant.currency_code}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ color:usageColor, fontWeight:700, fontSize:16 }}>{tenant.active_users}/{tenant.max_users}</p>
            <p style={{ color:'rgba(200,168,75,0.4)', fontSize:10 }}>usuarios</p>
          </div>
          <button onClick={() => setExpanded(e=>!e)}
            style={{ background:'rgba(200,168,75,0.1)', border:'1px solid rgba(200,168,75,0.3)', color:'#C8A84B', borderRadius:4, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>
            {expanded ? 'Cerrar' : 'Ver más'}
          </button>
          <button onClick={handleToggle}
            style={{ background:tenant.is_active?'rgba(192,57,43,0.1)':'rgba(200,168,75,0.1)', border:`1px solid ${tenant.is_active?'rgba(192,57,43,0.3)':'rgba(200,168,75,0.3)'}`, color:tenant.is_active?'#C0392B':'#C8A84B', borderRadius:4, padding:'6px 10px', cursor:'pointer' }}>
            {tenant.is_active ? <PowerOff size={14}/> : <Power size={14}/>}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop:'1px solid rgba(200,168,75,0.2)', padding:'16px 20px', background:'rgba(0,0,0,0.2)' }}>
          {/* Gerentes */}
          <div style={{ marginBottom:12 }}>
            <p style={{ color:'rgba(200,168,75,0.7)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              👤 Gerentes
            </p>
            {managers.length === 0 ? (
              <p style={{ color:'rgba(245,243,238,0.3)', fontSize:12 }}>Sin gerentes registrados</p>
            ) : managers.map(mgr => (
              <div key={mgr.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(200,168,75,0.15)', borderRadius:4, padding:'10px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <p style={{ color:'#F5F3EE', fontWeight:600, fontSize:13 }}>{mgr.full_name}</p>
                    <p style={{ color:'rgba(200,168,75,0.5)', fontSize:12 }}>
                      👤 <strong style={{color:'rgba(245,243,238,0.7)'}}>{mgr.username}</strong>
                      {mgr.email && ` · ${mgr.email}`}
                    </p>
                    {mgr.last_login && (
                      <p style={{ color:'rgba(200,168,75,0.4)', fontSize:11 }}>
                        Último acceso: {new Date(mgr.last_login).toLocaleString('es-CO')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowResetForm(showResetForm === mgr.id ? null : mgr.id)}
                    style={{ background:'rgba(200,168,75,0.1)', border:'1px solid rgba(200,168,75,0.3)', color:'#C8A84B', borderRadius:4, padding:'5px 10px', fontSize:12, cursor:'pointer' }}>
                    🔑 Restablecer contraseña
                  </button>
                </div>
                {showResetForm === mgr.id && (
                  <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <input
                      type="password"
                      placeholder="Nueva contraseña (mín. 8 caracteres)"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      style={{ flex:1, minWidth:220, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(200,168,75,0.25)', borderRadius:4, padding:'7px 10px', color:'#F5F3EE', fontSize:13 }}
                    />
                    <button
                      onClick={() => handleResetPassword(mgr)}
                      disabled={resetting === mgr.id}
                      style={{ background:'#C8A84B', color:'#0D1B3E', border:'none', borderRadius:4, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      {resetting === mgr.id ? 'Guardando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => { setShowResetForm(null); setNewPass(''); }}
                      style={{ background:'rgba(255,255,255,0.05)', color:'rgba(245,243,238,0.5)', border:'1px solid rgba(200,168,75,0.2)', borderRadius:4, padding:'7px 10px', fontSize:13, cursor:'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Estadísticas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
            {[
              { label:'Contratos activos', val:stats?.active_contracts ?? '…', color:'#F5F3EE' },
              { label:'Clientes',          val:stats?.total_clients   ?? '…', color:'#F5F3EE' },
              { label:'Inmuebles',         val:stats?.total_properties?? '…', color:'#F5F3EE' },
              { label:'Total recaudado',   val:stats ? `${tenant.currency_code} ${Number(stats.total_collected).toLocaleString()}` : '…', color:'#C8A84B' },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(200,168,75,0.1)', borderRadius:4, padding:'10px 12px' }}>
                <p style={{ color:s.color, fontSize:18, fontWeight:700, fontFamily:'Georgia,serif' }}>{s.val}</p>
                <p style={{ color:'rgba(200,168,75,0.5)', fontSize:11 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <a href={`/${tenant.slug}/login`} target="_blank" rel="noopener noreferrer"
              onClick={() => {
                localStorage.removeItem('inmogest_token');
                localStorage.removeItem('inmogest_refresh_token');
                localStorage.removeItem('inmogest-auth');
                sessionStorage.setItem('inmogest_tenant', tenant.slug);
              }}
              style={{ background:'rgba(200,168,75,0.12)', border:'1px solid rgba(200,168,75,0.3)', color:'#C8A84B', borderRadius:4, padding:'6px 12px', fontSize:12, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
              <Globe size={12}/> Abrir empresa
            </a>
          </div>
          {tenant.notes && (
            <p style={{ color:'rgba(200,168,75,0.4)', fontSize:12, marginTop:8 }}>📝 {tenant.notes}</p>
          )}

          {/* Qué ve cada rol en ESTA empresa. Lo que a una inmobiliaria le
              sirve a otra no, por eso se configura una por una. */}
          <SAPermisos tenant={tenant}/>
        </div>
      )}
    </div>
  );
};

// ── Bitácora del super-admin ──────────────────────────────
//
// Las acciones de este panel ocurren POR ENCIMA de todas las empresas, así
// que no caben en la auditoría de ninguna. Aquí es donde se ven.
//
// La más sensible es el restablecimiento de contraseña: quien la ejecuta
// puede entrar como ese usuario, y la auditoría de la empresa diría que fue
// el usuario mismo. Sin este registro no habría cómo demostrar lo contrario.
const SAAuditoria = () => {
  const [filtro, setFiltro] = useState('');
  const [page, setPage]     = useState(1);

  const { data, isFetching } = useQuery({
    queryKey: ['sa-audit', filtro, page],
    queryFn:  () => superAdminService.getAudit({ action: filtro || undefined, page, limit: 50 }),
  });
  const { data: verifyData } = useQuery({
    queryKey: ['sa-audit-verify'],
    queryFn:  () => superAdminService.verifyAudit(),
  });

  const rows = data?.data?.data || [];
  const pag  = data?.data?.pagination || { total:0, pages:1, page:1 };
  const integridad = verifyData?.data?.data;

  const ACCIONES = {
    LOGIN:               { label:'Acceso al panel',        color:'#94a3b8' },
    LOGIN_FAILED:        { label:'Acceso fallido',         color:'#C0392B' },
    TENANT_CREATE:       { label:'Empresa creada',         color:'#22c55e' },
    TENANT_UPDATE:       { label:'Empresa actualizada',    color:'#3b82f6' },
    TENANT_SUSPEND:      { label:'Empresa suspendida',     color:'#f59e0b' },
    TENANT_ACTIVATE:     { label:'Empresa reactivada',     color:'#22c55e' },
    RESET_USER_PASSWORD: { label:'Contraseña restablecida',color:'#C0392B' },
  };

  const card = { background:'#1A2F5E', border:'1px solid rgba(200,168,75,0.2)', borderRadius:8 };

  return (
    <div>
      {/* Estado de la cadena de integridad */}
      {integridad && (
        <div style={{ ...card, padding:'14px 20px', marginBottom:20,
          borderLeft:`4px solid ${integridad.integridad_ok ? '#22c55e' : '#C0392B'}` }}>
          <p style={{ color: integridad.integridad_ok ? '#22c55e' : '#C0392B', fontWeight:700, fontSize:14 }}>
            {integridad.integridad_ok ? '🔒 Cadena íntegra' : '⚠️ Cadena alterada'}
          </p>
          <p style={{ color:'rgba(245,243,238,0.6)', fontSize:13, marginTop:2 }}>
            {integridad.integridad_ok
              ? `${integridad.total_revisados} registro(s) verificados. Cada uno firma al anterior: borrar o modificar uno rompería la cadena.`
              : `${integridad.registros_alterados.length} registro(s) no coinciden con su firma. Alguien modificó la bitácora.`}
          </p>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontSize:18, fontWeight:700, fontFamily:'Georgia,serif', color:'#F5F3EE' }}>
          🛡️ Bitácora de Super-Admin
        </h2>
        <select value={filtro} onChange={e => { setFiltro(e.target.value); setPage(1); }}
          style={{ background:'#0D1B3E', border:'1px solid rgba(200,168,75,0.3)', color:'#F5F3EE',
                   borderRadius:4, padding:'7px 12px', fontSize:13 }}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isFetching && rows.length === 0 ? (
        <div style={{ ...card, padding:40, textAlign:'center', color:'rgba(245,243,238,0.5)' }}>
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, padding:40, textAlign:'center' }}>
          <p style={{ color:'rgba(245,243,238,0.6)', fontSize:14 }}>
            Todavía no hay movimientos registrados.
          </p>
          <p style={{ color:'rgba(200,168,75,0.5)', fontSize:13, marginTop:6 }}>
            A partir de ahora, cada acción de este panel queda aquí.
          </p>
        </div>
      ) : (
        <div style={{ ...card, overflow:'hidden' }}>
          {rows.map((r, i) => {
            const cfg = ACCIONES[r.action] || { label:r.action, color:'#94a3b8' };
            return (
              <div key={r.id} style={{ padding:'14px 20px',
                borderTop: i === 0 ? 'none' : '1px solid rgba(200,168,75,0.12)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ background:`${cfg.color}22`, color:cfg.color, fontSize:11,
                    fontWeight:700, padding:'3px 8px', borderRadius:4, textTransform:'uppercase',
                    letterSpacing:'0.04em' }}>
                    {cfg.label}
                  </span>
                  {r.tenant_name && (
                    <span style={{ color:'#C8A84B', fontSize:13 }}>{r.tenant_name}</span>
                  )}
                  <span style={{ color:'rgba(245,243,238,0.4)', fontSize:12, marginLeft:'auto' }}>
                    {new Date(r.occurred_at).toLocaleString('es-CO')}
                  </span>
                </div>
                <p style={{ color:'#F5F3EE', fontSize:14 }}>{r.description}</p>
                <p style={{ color:'rgba(245,243,238,0.4)', fontSize:12, marginTop:3 }}>
                  {r.username}{r.ip_address ? ` · IP ${r.ip_address}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {pag.pages > 1 && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
          <span style={{ color:'rgba(245,243,238,0.5)', fontSize:13 }}>
            Página {pag.page} de {pag.pages} · {pag.total} registro(s)
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={pag.page <= 1}
              style={{ background:'#1A2F5E', border:'1px solid rgba(200,168,75,0.3)', color:'#F5F3EE',
                       borderRadius:4, padding:'6px 14px', cursor:'pointer', opacity: pag.page<=1?0.4:1 }}>
              Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(pag.pages, p+1))} disabled={pag.page >= pag.pages}
              style={{ background:'#1A2F5E', border:'1px solid rgba(200,168,75,0.3)', color:'#F5F3EE',
                       borderRadius:4, padding:'6px 14px', cursor:'pointer', opacity: pag.page>=pag.pages?0.4:1 }}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Permisos por empresa ──────────────────────────────────
//
// Matriz de módulos × roles. En cada casilla, uno de tres niveles:
//
//   Sin acceso    el módulo no existe para ese rol
//   Solo lectura  ve el listado, no entra al detalle de un registro
//   Total         ve, entra, crea, edita y borra
//
// Un clic avanza al siguiente nivel. Las casillas que difieren del valor
// por defecto quedan marcadas, para distinguir de un vistazo qué se tocó
// en esta empresa y qué viene de fábrica.
const NIVELES = ['sin_acceso','lectura','total'];
const NIVEL_CFG = {
  sin_acceso: { corto:'—', label:'Sin acceso',   bg:'rgba(120,120,130,0.15)', color:'#8a8a95' },
  lectura:    { corto:'L', label:'Solo lectura', bg:'rgba(59,130,246,0.18)',  color:'#6aa9ff' },
  total:      { corto:'✓', label:'Total',        bg:'rgba(200,168,75,0.22)',  color:'#C8A84B' },
};

const SAPermisos = ({ tenant }) => {
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState(null);

  const { data, isFetching } = useQuery({
    queryKey: ['sa-permisos', tenant.slug],
    queryFn:  () => superAdminService.getTenantPermissions(tenant.slug),
  });
  const d       = data?.data?.data;
  const roles   = d?.roles  || [];
  const matriz  = d?.matriz || [];
  const tocadas = d?.excepciones ?? 0;

  const cambiar = async (modulo, rol, nivelActual) => {
    const siguiente = NIVELES[(NIVELES.indexOf(nivelActual) + 1) % NIVELES.length];
    setGuardando(`${modulo}:${rol}`);
    try {
      const res = await superAdminService.setTenantPermission(tenant.slug, {
        role: rol, module: modulo, level: siguiente,
      });
      toast.success(res?.data?.message || 'Guardado');
      qc.invalidateQueries({ queryKey:['sa-permisos', tenant.slug] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    } finally { setGuardando(null); }
  };

  const AMBITO = {
    ambas:     { label:'En ambas pestañas', color:'#F5F3EE' },
    ventas:    { label:'Solo en Ventas',    color:'#6aa9ff' },
    arriendos: { label:'Solo en Arriendos', color:'#C8A84B' },
    admin:     { label:'Administración',    color:'#c084fc' },
  };

  const filas = [];
  for (const amb of ['ambas','ventas','arriendos','admin']) {
    const mods = matriz.filter(m => m.scope === amb);
    if (mods.length) filas.push({ separador: AMBITO[amb] }, ...mods);
  }

  return (
    <div style={{ marginTop:16, background:'#12224A', border:'1px solid rgba(200,168,75,0.25)',
                  borderRadius:8, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                    flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <div>
          <h3 style={{ color:'#F5F3EE', fontSize:16, fontWeight:700, fontFamily:'Georgia,serif' }}>
            Permisos por rol
          </h3>
          <p style={{ color:'rgba(245,243,238,0.5)', fontSize:13, marginTop:2 }}>
            Clic en una casilla para cambiar el nivel · {tocadas === 0
              ? 'esta empresa usa la configuración por defecto'
              : `${tocadas} ajuste${tocadas === 1 ? '' : 's'} propio${tocadas === 1 ? '' : 's'}`}
          </p>
        </div>
        <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
          {NIVELES.map(n => (
            <span key={n} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
                                   color:'rgba(245,243,238,0.65)' }}>
              <span style={{ width:22, height:22, borderRadius:4, display:'flex',
                             alignItems:'center', justifyContent:'center', fontWeight:700,
                             background:NIVEL_CFG[n].bg, color:NIVEL_CFG[n].color }}>
                {NIVEL_CFG[n].corto}
              </span>
              {NIVEL_CFG[n].label}
            </span>
          ))}
        </div>
      </div>

      {isFetching && !matriz.length ? (
        <p style={{ color:'rgba(245,243,238,0.5)', padding:'24px 0', textAlign:'center' }}>Cargando…</p>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'6px 10px', color:'rgba(200,168,75,0.7)',
                             fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Módulo
                </th>
                {roles.map(r => (
                  <th key={r} style={{ padding:'6px 4px', color:'rgba(200,168,75,0.7)', fontSize:11,
                                       textTransform:'uppercase', letterSpacing:'0.04em', minWidth:64 }}>
                    {r.slice(0,4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => f.separador ? (
                <tr key={'sep'+i}>
                  <td colSpan={roles.length + 1}
                      style={{ padding:'14px 10px 6px', color:f.separador.color, fontSize:11,
                               fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {f.separador.label}
                  </td>
                </tr>
              ) : (
                <tr key={f.module} style={{ borderTop:'1px solid rgba(200,168,75,0.1)' }}>
                  <td style={{ padding:'8px 10px', color:'#F5F3EE' }}>{f.label}</td>
                  {roles.map(rol => {
                    const c   = f.niveles[rol];
                    const cfg = NIVEL_CFG[c.level];
                    const key = `${f.module}:${rol}`;
                    return (
                      <td key={rol} style={{ padding:'4px 3px', textAlign:'center' }}>
                        <button
                          onClick={() => cambiar(f.module, rol, c.level)}
                          disabled={guardando === key}
                          title={`${f.label} · ${rol} — ${cfg.label}${c.is_default ? ' (por defecto)' : ' (ajustado)'}`}
                          style={{
                            width:'100%', minWidth:54, padding:'7px 0', cursor:'pointer',
                            background:cfg.bg, color:cfg.color, fontWeight:700, fontSize:13,
                            border:`1px solid ${c.is_default ? 'transparent' : cfg.color}`,
                            borderRadius:4, opacity: guardando === key ? 0.4 : 1,
                            position:'relative',
                          }}>
                          {guardando === key ? '·' : cfg.corto}
                          {!c.is_default && (
                            <span style={{ position:'absolute', top:2, right:4, fontSize:9,
                                           color:cfg.color, opacity:0.8 }}>•</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color:'rgba(245,243,238,0.4)', fontSize:12, marginTop:14, lineHeight:1.5 }}>
        El punto marca las casillas ajustadas para esta empresa; sin punto, viene del valor por
        defecto. <strong style={{ color:'rgba(245,243,238,0.6)' }}>Solo lectura</strong> permite ver
        el listado pero no abrir un registro. Las acciones de borrado conservan además sus propias
        restricciones: dar acceso total no habilita borrar lo que hoy solo puede el gerente.
      </p>
    </div>
  );
};

// ── Panel principal ───────────────────────────────────────
const SADashboard = ({ user, onLogout }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  // Pestañas del panel: empresas (lo de siempre) y la bitácora.
  const [tab, setTab] = useState('empresas');

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn:  () => superAdminService.getDashboard(),
  });
  const { data: plansData } = useQuery({
    queryKey: ['sa-plans'],
    queryFn:  () => superAdminService.getPlans(),
  });

  const dashboard = data?.data?.data;
  const plans     = plansData?.data?.data || [];
  const tenants   = dashboard?.tenants    || [];

  const handleLogout = () => {
    localStorage.removeItem('inmogest_sa_token');
    onLogout();
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0D1B3E', color:'#F5F3EE' }}>
      {showModal && (
        <NewTenantModal
          plans={plans}
          onClose={() => setShowModal(false)}
          onCreated={() => { queryClient.invalidateQueries({ queryKey:['sa-dashboard'] }); refetch(); }}
        />
      )}

      {/* Header */}
      <div style={{ background:'#1A2F5E', borderBottom:'3px solid #C8A84B', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, background:'#0D1B3E', border:'2px solid #C8A84B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🏢</div>
          <div>
            <p style={{ fontWeight:800, fontSize:16, fontFamily:'Georgia,serif', color:'#F5F3EE' }}>
              InmoGest <span style={{ color:'#C8A84B' }}>Pro</span> — Panel Global
            </p>
            <p style={{ color:'rgba(200,168,75,0.5)', fontSize:12, letterSpacing:'0.05em' }}>Super Admin: {user.fullName}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => refetch()} style={{ background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.25)', color:'rgba(200,168,75,0.7)', borderRadius:4, padding:'6px 12px', cursor:'pointer' }}>
            <RefreshCw size={14} className={isFetching?'animate-spin':''}/>
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ background:'#C8A84B', color:'#0D1B3E', border:'none', borderRadius:4, padding:'6px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14}/> Nueva Empresa
          </button>
          <button onClick={handleLogout}
            style={{ background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.3)', color:'#C0392B', borderRadius:4, padding:'6px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <LogOut size={14}/> Salir
          </button>
        </div>
      </div>

      <div style={{ padding:32 }}>

        {/* Pestañas */}
        <div style={{ display:'flex', gap:4, marginBottom:24,
          borderBottom:'1px solid rgba(200,168,75,0.2)' }}>
          {[['empresas','🏢 Empresas'],['auditoria','🛡️ Bitácora']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                background:'transparent', border:'none', cursor:'pointer',
                padding:'10px 18px', fontSize:14,
                fontWeight: tab === id ? 700 : 400,
                color:      tab === id ? '#C8A84B' : 'rgba(245,243,238,0.5)',
                borderBottom: `2px solid ${tab === id ? '#C8A84B' : 'transparent'}`,
                marginBottom:-1,
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'auditoria' && <SAAuditoria/>}

        {tab === 'empresas' && <>
        {/* KPIs globales */}
        {dashboard && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
            {[
              { label:'Total empresas',   val:dashboard.summary.total,    icon:'🏢', color:'#F5F3EE' },
              { label:'Empresas activas', val:dashboard.summary.active,   icon:'✅', color:'#C8A84B'  },
              { label:'Suspendidas',      val:dashboard.summary.inactive, icon:'⏸️', color:'#C0392B'  },
              { label:'MRR (USD)',         val:`$${dashboard.summary.mrr_usd?.toFixed(0)||0}`, icon:'💰', color:'#C8A84B' },
            ].map(k => (
              <div key={k.label} style={{ background:'#1A2F5E', border:'1px solid rgba(200,168,75,0.2)', borderRadius:8, padding:'20px 24px', borderLeft:'4px solid rgba(200,168,75,0.4)' }}>
                <p style={{ fontSize:28, marginBottom:4 }}>{k.icon}</p>
                <p style={{ color:k.color, fontSize:28, fontWeight:800, fontFamily:'Georgia,serif' }}>{k.val}</p>
                <p style={{ color:'rgba(200,168,75,0.5)', fontSize:13 }}>{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista de empresas */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:700, fontFamily:'Georgia,serif', color:'#F5F3EE' }}>🏢 Empresas Registradas</h2>
          <p style={{ color:'rgba(200,168,75,0.5)', fontSize:13 }}>{tenants.length} empresa{tenants.length!==1?'s':''}</p>
        </div>

        {tenants.length === 0 ? (
          <div style={{ background:'#1A2F5E', border:'1.5px solid rgba(200,168,75,0.25)', borderRadius:8, padding:48, textAlign:'center' }}>
            <p style={{ fontSize:48, marginBottom:12 }}>🏢</p>
            <p style={{ color:'rgba(245,243,238,0.7)', fontSize:16, marginBottom:8 }}>No hay empresas registradas aún</p>
            <p style={{ color:'rgba(200,168,75,0.4)', fontSize:13, marginBottom:24 }}>Crea la primera empresa con el botón "Nueva Empresa"</p>
            <button onClick={() => setShowModal(true)}
              style={{ background:'#C8A84B', color:'#0D1B3E', border:'none', borderRadius:4, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              + Nueva Empresa
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {tenants.map(t => (
              <TenantCard key={t.slug} tenant={t} onRefresh={() => { queryClient.invalidateQueries({queryKey:['sa-dashboard']}); refetch(); }}/>
            ))}
          </div>
        )}
        </>}
      </div>
    </div>
  );
};

// ── App del Super-Admin ───────────────────────────────────
const SuperAdminApp = () => {
  const [saUser, setSaUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('inmogest_sa_token');
    if (token) {
      superAdminService.me()
        .then(r => setSaUser(r.data.data))
        .catch(() => localStorage.removeItem('inmogest_sa_token'));
    }
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <Toaster position="top-right"/>
      {saUser
        ? <SADashboard user={saUser} onLogout={() => setSaUser(null)}/>
        : <SALogin onLogin={setSaUser}/>
      }
    </QueryClientProvider>
  );
};

export default SuperAdminApp;