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

// Paleta de gráficas alineada al manual: navy, gold, y semánticos
const CHART_COLORS = [
  '#0D1B3E', // navy
  '#C8A84B', // gold
  '#2D7A3A', // success green
  '#C0392B', // danger red
  '#92660A', // warning amber
  '#1A2F5E', // navy light
];

// KPICard — navy/gold/semánticos según tipo
const KPICard = ({ title, value, subtitle, icon:Icon, color='navy', loading }) => {
  const colorMap = {
    navy:    { bg:'rgba(13,27,62,0.07)',    icon:'var(--color-navy)',    border:'rgba(13,27,62,0.15)'    },
    gold:    { bg:'rgba(200,168,75,0.10)',  icon:'var(--color-gold)',    border:'rgba(200,168,75,0.25)'  },
    warning: { bg:'var(--color-warning-bg)',icon:'var(--color-warning)', border:'var(--color-warning-border)' },
    danger:  { bg:'var(--color-danger-bg)', icon:'var(--color-danger)',  border:'var(--color-danger-border)'  },
    success: { bg:'var(--color-success-bg)',icon:'var(--color-success)', border:'var(--color-success-border)' },
  };
  const c = colorMap[color] || colorMap.navy;
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide"
            style={{ color:'var(--color-text-muted)', letterSpacing:'0.06em' }}>
            {title}
          </p>
          {loading ? (
            <div className="h-7 w-24 skeleton mt-2 rounded"/>
          ) : (
            <p className="text-2xl font-bold mt-1 font-mono"
              style={{ color:'var(--color-navy)', fontFamily:'var(--font-mono)' }}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{subtitle}</p>
          )}
        </div>
        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0"
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
    <div className="p-3 rounded text-sm shadow-xl"
      style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>
      <p className="font-semibold mb-1" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)', fontSize:'0.8rem' }}>
        {label}
      </p>
      {payload.map((e,i) => (
        <p key={i} style={{ color:e.color, fontFamily:'var(--font-mono)', fontSize:'0.8rem' }}>
          {e.name}: {typeof e.value === 'number' && e.value > 1000 ? formatM(e.value) : e.value}
        </p>
      ))}
    </div>
  );
};

// ── Estado vacío ──────────────────────────────────────────────
const EmptyState = ({ navigate, prefix }) => (
  <div className="card flex flex-col items-center py-16 gap-4 text-center"
    style={{ borderTop:'3px solid var(--color-gold)' }}>
    <div className="w-16 h-16 flex items-center justify-center"
      style={{ background:'var(--color-navy)', border:'1.5px solid var(--color-gold)' }}>
      <Building size={28} style={{ color:'var(--color-gold)' }}/>
    </div>
    <div>
      <p className="text-lg font-bold"
        style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
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
      <button onClick={() => navigate(`${prefix}/clients/new`)} className="btn btn-outline btn-sm">
        <Plus size={14}/> Registrar Cliente
      </button>
      <button onClick={() => navigate(`${prefix}/advisors/new`)} className="btn btn-outline btn-sm">
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

  const monthlySales     = d.monthly_sales     || [];
  const payTypeDist      = d.payment_type_dist || [];
  const advisorRanking   = d.advisor_ranking   || [];
  const collectionStatus = d.collection_status || [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold"
          style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
          Dashboard
        </h1>
        {isAdvisor && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium mt-1"
            style={{
              background:'rgba(13,27,62,0.07)',
              color:'var(--color-navy)',
              border:'1px solid rgba(13,27,62,0.15)',
            }}>
            👤 Viendo solo tus datos personales
          </div>
        )}
        <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
          {format(new Date(),"EEEE, d 'de' MMMM 'de' yyyy",{locale:es})}
        </p>
      </div>

      {/* Estado vacío */}
      {!isLoading && !hasData && <EmptyState navigate={navigate} prefix={prefix}/>}

      {/* KPIs fila 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Contratos Activos"
          value={kpis.active_contracts ?? 0}
          subtitle={`${kpis.total_contracts ?? 0} en total`}
          icon={FileText} color="navy" loading={isLoading}/>
        <KPICard title="Recaudado Total"
          value={isLoading ? '—' : formatCurrency(kpis.total_collected)}
          subtitle="Acumulado histórico"
          icon={DollarSign} color="gold" loading={isLoading}/>
        <KPICard
          title={isAdvisor ? "Mis Contratos Totales" : "Clientes Registrados"}
          value={isAdvisor ? (kpis.total_contracts ?? 0) : (kpis.total_clients ?? 0)}
          subtitle={isAdvisor
            ? `${kpis.active_contracts ?? 0} contratos activos`
            : `${kpis.contracts_this_month ?? 0} contratos este mes`}
          icon={Users} color="navy" loading={isLoading}/>
        <KPICard title="Inmuebles Disponibles"
          value={kpis.available_properties ?? 0}
          subtitle="Listos para vender"
          icon={Home} color="success" loading={isLoading}/>
      </div>

      {/* KPIs fila 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ingreso Este Mes"
          value={isLoading ? '—' : formatCurrency(kpis.monthly_revenue)}
          subtitle="Recaudado en el mes actual"
          icon={TrendingUp} color="gold" loading={isLoading}/>
        <KPICard
          title={isAdvisor ? "Valor Total Vendido" : "Contratos Este Mes"}
          value={isAdvisor
            ? (isLoading ? '—' : formatCurrency(kpis.total_value))
            : (kpis.contracts_this_month ?? 0)}
          subtitle={isAdvisor ? "Valor total de mis contratos" : "Firmados este mes"}
          icon={FileText} color="navy" loading={isLoading}/>
        <KPICard title="Cuotas en Mora"
          value={kpis.overdue_count ?? 0}
          subtitle="Cuotas vencidas sin pagar"
          icon={AlertTriangle} color="danger" loading={isLoading}/>
        <KPICard title="Asesores Activos"
          value={advisorRanking.length || 0}
          subtitle="Con contratos asignados"
          icon={UserCheck} color="navy" loading={isLoading}/>
      </div>

      {/* Gráficas — solo si hay datos */}
      {hasData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Ventas mensuales — línea navy con relleno dorado */}
            <div className="card lg:col-span-2">
              <h3 className="font-semibold mb-4 text-sm"
                style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                Ventas Mensuales
                <span className="ml-2 text-xs font-normal" style={{ color:'var(--color-text-muted)' }}>
                  últimos 9 meses
                </span>
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
                        <stop offset="5%"  stopColor="#C8A84B" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#C8A84B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                    <XAxis dataKey="month" stroke="var(--color-text-muted)" tick={{ fontSize:12 }}/>
                    <YAxis tickFormatter={formatM} stroke="var(--color-text-muted)" tick={{ fontSize:11 }}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="valor" name="Valor vendido"
                      stroke="#0D1B3E" fill="url(#colorValor)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tipo de pago — paleta brand */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm"
                style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
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
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>
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
              <h3 className="font-semibold mb-4 text-sm"
                style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
                Ranking Asesores
              </h3>
              {advisorRanking.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2"
                  style={{ color:'var(--color-text-muted)' }}>
                  <UserCheck size={32}/>
                  <p className="text-sm">No hay asesores con contratos aún</p>
                  <button onClick={() => navigate(`${prefix}/advisors/new`)}
                    className="btn btn-outline btn-sm mt-2">
                    <Plus size={13}/> Agregar Asesor
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {advisorRanking.map((a,i) => (
                    <div key={i} className="flex items-center gap-3">
                      {/* Número ranking — dorado para #1, navy para el resto */}
                      <span className="w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i===0 ? 'rgba(200,168,75,0.2)' : 'rgba(13,27,62,0.07)',
                          color:      i===0 ? 'var(--color-gold)'     : 'var(--color-text-muted)',
                          fontFamily: 'var(--font-display)',
                        }}>
                        {i+1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate"
                            style={{ color:'var(--color-navy)' }}>{a.name}</span>
                          <span className="text-xs flex-shrink-0 ml-2"
                            style={{ color:'var(--color-text-muted)' }}>
                            {a.contratos} contratos
                          </span>
                        </div>
                        <div className="w-full rounded-full h-1.5"
                          style={{ background:'var(--color-bg-secondary)' }}>
                          <div className="h-1.5 rounded-full transition-all" style={{
                            width: `${(parseInt(a.contratos) / (parseInt(advisorRanking[0]?.contratos)||1)) * 100}%`,
                            background: i===0 ? 'var(--color-gold)' : 'var(--color-navy)',
                          }}/>
                        </div>
                      </div>
                      <span className="text-xs font-mono flex-shrink-0"
                        style={{ color:'var(--color-navy)', fontWeight:600 }}>
                        {formatM(a.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estado de contratos */}
            <div className="card">
              <h3 className="font-semibold mb-4 text-sm"
                style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
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
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>
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