// src/pages/Dashboard/DashboardPage.jsx
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  FileText, DollarSign, Users, Home, TrendingUp,
  AlertTriangle, UserCheck, ArrowUpRight, Building, Plus
} from 'lucide-react';
import { reportsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import { getSavedTenantSlug } from '../../utils/tenant';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const formatM = v => {
  if (!v || v === 0) return '$0';
  if (v >= 1000000000) return `$${(v/1000000000).toFixed(1)}B`;
  if (v >= 1000000)    return `$${(v/1000000).toFixed(1)}M`;
  if (v >= 1000)       return `$${(v/1000).toFixed(0)}K`;
  return `$${v}`;
};

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#06b6d4'];

const KPICard = ({ title, value, subtitle, icon:Icon, trend, trendValue, color='blue', loading }) => {
  const colorMap = {
    blue:   { bg:'rgba(59,130,246,0.1)',  icon:'#3b82f6',  border:'rgba(59,130,246,0.2)' },
    green:  { bg:'rgba(16,185,129,0.1)',  icon:'#10b981',  border:'rgba(16,185,129,0.2)' },
    orange: { bg:'rgba(245,158,11,0.1)',  icon:'#f59e0b',  border:'rgba(245,158,11,0.2)' },
    red:    { bg:'rgba(239,68,68,0.1)',   icon:'#ef4444',  border:'rgba(239,68,68,0.2)'  },
    purple: { bg:'rgba(168,85,247,0.1)',  icon:'#a855f7',  border:'rgba(168,85,247,0.2)' },
  };
  const c = colorMap[color];
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color:'var(--color-text-muted)' }}>{title}</p>
          {loading ? (
            <div className="h-7 w-24 skeleton mt-2 rounded"/>
          ) : (
            <p className="text-2xl font-bold mt-1" style={{ color:'var(--color-text-primary)' }}>{value}</p>
          )}
          {subtitle && <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{subtitle}</p>}
          {trendValue !== undefined && !loading && (
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight size={14} className={trend==='up' ? 'text-emerald-400' : 'text-red-400'}/>
              <span className={`text-xs font-medium ${trend==='up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {trendValue}% vs mes anterior
              </span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:c.bg, border:`1px solid ${c.border}` }}>
          <Icon size={20} style={{ color:c.icon }}/>
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded-lg text-sm shadow-xl"
      style={{ background:'var(--color-bg-elevated)', border:'1px solid var(--color-border)' }}>
      <p className="font-medium mb-1" style={{ color:'var(--color-text-secondary)' }}>{label}</p>
      {payload.map((e,i) => (
        <p key={i} style={{ color:e.color }}>
          {e.name}: {typeof e.value === 'number' && e.value > 1000 ? formatM(e.value) : e.value}
        </p>
      ))}
    </div>
  );
};

// ── Estado vacío cuando no hay datos ─────────────────────────
// FIX: recibe prefix para construir rutas absolutas con tenant
const EmptyState = ({ navigate, prefix }) => (
  <div className="card flex flex-col items-center py-16 gap-4 text-center">
    <Building size={52} style={{ color:'var(--color-text-muted)' }}/>
    <div>
      <p className="text-lg font-semibold" style={{ color:'var(--color-text-primary)' }}>
        Bienvenido a InmoGest Pro
      </p>
      <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
        Aún no hay datos registrados. Comienza creando el primer proyecto.
      </p>
    </div>
    <div className="flex gap-3 flex-wrap justify-center">
      <button onClick={() => navigate(`${prefix}/projects/new`)} className="btn btn-primary btn-sm">
        <Plus size={14}/> Crear Proyecto
      </button>
      <button onClick={() => navigate(`${prefix}/clients/new`)} className="btn btn-secondary btn-sm">
        <Plus size={14}/> Registrar Cliente
      </button>
      <button onClick={() => navigate(`${prefix}/advisors/new`)} className="btn btn-secondary btn-sm">
        <Plus size={14}/> Agregar Asesor
      </button>
    </div>
    <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
      Orden recomendado: Proyectos → Inmuebles → Asesores → Clientes → Contratos
    </p>
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();

  // FIX: construir prefix con tenant para rutas absolutas
  const slug   = tenant || getSavedTenantSlug() || '';
  const prefix = slug ? `/${slug}` : '';

  const { user } = useAuthStore();
  const isAdvisor = user?.role === 'asesor';

  const { data: kpisData, isLoading } = useQuery({
    queryKey: ['dashboard-kpis', isAdvisor],
    queryFn:  () => isAdvisor
      ? reportsService.getAdvisorKPIs()
      : reportsService.getDashboardKPIs(),
    refetchInterval: 5 * 60 * 1000,
  });

  const d     = kpisData?.data?.data || {};
  const kpis  = d.kpis || {};
  const hasData = (kpis.total_contracts || 0) > 0 || (kpis.total_clients || 0) > 0;

  const monthlySales    = d.monthly_sales      || [];
  const payTypeDist     = d.payment_type_dist  || [];
  const advisorRanking  = d.advisor_ranking    || [];
  const collectionStatus= d.collection_status  || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>Dashboard</h1>
        {isAdvisor && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mt-1"
            style={{ background:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)' }}>
            👤 Viendo solo tus datos personales
          </div>
        )}
        <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
          {format(new Date(),"EEEE, d 'de' MMMM 'de' yyyy",{locale:es})}
        </p>
      </div>

      {/* Estado vacío si no hay datos */}
      {!isLoading && !hasData && <EmptyState navigate={navigate} prefix={prefix}/>}

      {/* KPIs fila 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Contratos Activos"   value={kpis.active_contracts ?? 0}
          subtitle={`${kpis.total_contracts ?? 0} en total`}
          icon={FileText} color="blue" loading={isLoading}/>
        <KPICard title="Recaudado Total"     value={isLoading ? '—' : formatCurrency(kpis.total_collected)}
          subtitle="Acumulado histórico"
          icon={DollarSign} color="green" loading={isLoading}/>
        <KPICard title={isAdvisor ? "Mis Contratos Totales" : "Clientes Registrados"} value={isAdvisor ? (kpis.total_contracts ?? 0) : (kpis.total_clients ?? 0)}
          subtitle={isAdvisor ? `${kpis.active_contracts ?? 0} contratos activos` : `${kpis.contracts_this_month ?? 0} contratos este mes`}
          icon={Users} color="purple" loading={isLoading}/>
        <KPICard title="Inmuebles Disponibles" value={kpis.available_properties ?? 0}
          subtitle="Listos para vender"
          icon={Home} color="orange" loading={isLoading}/>
      </div>

      {/* KPIs fila 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ingreso Este Mes"  value={isLoading ? '—' : formatCurrency(kpis.monthly_revenue)}
          subtitle="Recaudado en el mes actual"
          icon={TrendingUp} color="green" loading={isLoading}/>
        <KPICard title={isAdvisor ? "Valor Total Vendido" : "Contratos Este Mes"} value={isAdvisor ? (isLoading ? '—' : formatCurrency(kpis.total_value)) : (kpis.contracts_this_month ?? 0)}
          subtitle={isAdvisor ? "Valor total de mis contratos" : "Firmados este mes"}
          icon={FileText} color="blue" loading={isLoading}/>
        <KPICard title="Cuotas en Mora" value={kpis.overdue_count ?? 0}
          subtitle="Cuotas vencidas sin pagar"
          icon={AlertTriangle} color="red" loading={isLoading}/>
        <KPICard title="Asesores Activos" value={advisorRanking.length || 0}
          subtitle="Con contratos asignados"
          icon={UserCheck} color="purple" loading={isLoading}/>
      </div>

      {/* Gráficas — solo si hay datos */}
      {hasData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Ventas mensuales */}
            <div className="card lg:col-span-2">
              <h3 className="font-semibold mb-4 text-sm" style={{ color:'var(--color-text-primary)' }}>
                Ventas Mensuales (últimos 9 meses)
              </h3>
              {monthlySales.length === 0 ? (
                <div className="flex items-center justify-center h-48"
                  style={{ color:'var(--color-text-muted)' }}>
                  Sin datos de ventas mensuales aún
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlySales}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                    <XAxis dataKey="month" stroke="var(--color-text-muted)" tick={{ fontSize:12 }}/>
                    <YAxis tickFormatter={formatM} stroke="var(--color-text-muted)" tick={{ fontSize:11 }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="valor" name="Valor vendido"
                      stroke="#3b82f6" fill="url(#colorValor)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tipo de pago */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm" style={{ color:'var(--color-text-primary)' }}>
                Tipo de Pago
              </h3>
              {payTypeDist.length === 0 ? (
                <div className="flex items-center justify-center h-48"
                  style={{ color:'var(--color-text-muted)' }}>
                  Sin datos aún
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={payTypeDist} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80}
                      dataKey="value" nameKey="name">
                      {payTypeDist.map((_,i) =>
                        <Cell key={i} fill={COLORS[i % COLORS.length]}/>
                      )}
                    </Pie>
                    <Tooltip formatter={v => `${v} contratos`}/>
                    <Legend iconSize={10} formatter={v => (
                      <span style={{ color:'var(--color-text-secondary)', fontSize:'12px' }}>{v}</span>
                    )}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ranking asesores */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm" style={{ color:'var(--color-text-primary)' }}>
                Ranking Asesores
              </h3>
              {advisorRanking.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2"
                  style={{ color:'var(--color-text-muted)' }}>
                  <UserCheck size={32}/>
                  <p className="text-sm">No hay asesores con contratos aún</p>
                  {/* FIX: ruta absoluta con tenant */}
                  <button onClick={() => navigate(`${prefix}/advisors/new`)} className="btn btn-secondary btn-sm mt-2">
                    <Plus size={13}/> Agregar Asesor
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {advisorRanking.map((a,i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i===0 ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.15)',
                          color:      i===0 ? '#f59e0b' : 'var(--color-text-muted)',
                        }}>
                        {i+1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate"
                            style={{ color:'var(--color-text-primary)' }}>{a.name}</span>
                          <span className="text-xs flex-shrink-0 ml-2"
                            style={{ color:'var(--color-text-muted)' }}>
                            {a.contratos} contratos
                          </span>
                        </div>
                        <div className="w-full rounded-full h-1.5"
                          style={{ background:'var(--color-bg-primary)' }}>
                          <div className="h-1.5 rounded-full" style={{
                            width: `${(parseInt(a.contratos) / (parseInt(advisorRanking[0]?.contratos)||1)) * 100}%`,
                            background: COLORS[i],
                          }}/>
                        </div>
                      </div>
                      <span className="text-xs font-mono flex-shrink-0"
                        style={{ color:'var(--color-text-muted)' }}>
                        {formatM(a.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estado contratos */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm" style={{ color:'var(--color-text-primary)' }}>
                Estado de Contratos
              </h3>
              {collectionStatus.length === 0 ? (
                <div className="flex items-center justify-center h-48"
                  style={{ color:'var(--color-text-muted)' }}>
                  Sin contratos registrados aún
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={collectionStatus} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false}/>
                    <XAxis type="number" stroke="var(--color-text-muted)" tick={{ fontSize:11 }}/>
                    <YAxis dataKey="status" type="category"
                      stroke="var(--color-text-muted)" tick={{ fontSize:12 }} width={80}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="value" name="Contratos" radius={[0,4,4,0]}>
                      {collectionStatus.map((_,i) =>
                        <Cell key={i} fill={COLORS[i]}/>
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;