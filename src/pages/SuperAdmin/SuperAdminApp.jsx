// src/pages/SuperAdmin/SuperAdminApp.jsx
// ============================================================
// PANEL SUPER-ADMIN — Emmanuel Franco
// URL: /super-admin
// Gestión completa de todas las empresas registradas
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { superAdminService } from '../../services/api.service';
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

  const today = new Date().toISOString().split('T')[0];
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
        </div>
      )}
    </div>
  );
};

// ── Panel principal ───────────────────────────────────────
const SADashboard = ({ user, onLogout }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

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