// src/pages/Reports/ReportsPage.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Home, AlertTriangle, DollarSign, Users,
  Building, FileText, RefreshCw, ChevronDown, ChevronUp,
  Calendar
} from 'lucide-react';
import { reportsService } from '../../services/api.service';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { es } from 'date-fns/locale';

const fm = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);
const fmM = v => {
  if (!v) return '$0';
  if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(0)}K`;
  return `$${v}`;
};


// ── Utilidad de exportación a Excel ──────────────────────────
const exportToExcel = (sheets, filename) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data, headers }) => {
    const rows = [headers, ...data.map(row => headers.map((_, i) => row[i]))];
    const ws   = XLSX.utils.aoa_to_sheet(rows);

    // Estilos de encabezado (ancho automático)
    const colWidths = headers.map((h, hi) => ({
      wch: Math.max(h.length, ...data.map(row => String(row[hi] ?? '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
  });
  XLSX.writeFile(wb, `${filename}_${format(new Date(),'yyyyMMdd_HHmm')}.xlsx`);
};

// Botón de exportar reutilizable
const ExportBtn = ({ onClick, label='Exportar Excel', loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="btn btn-secondary btn-sm flex items-center gap-2">
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    {label}
  </button>
);

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const COLORS = ['#0D1B3E','#C8A84B','#2D7A3A','#C0392B','#92660A','#1A2F5E'];

const TABS = [
  { id:'resumen',      label:'Resumen',          icon:TrendingUp   },
  { id:'vacancia',     label:'Vacancia',         icon:Home         },
  { id:'cartera',      label:'Estado Cartera',   icon:FileText     },
  { id:'liquidacion',  label:'Liquidación Mensual', icon:DollarSign },
];

// ── Tooltip personalizado ─────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl shadow-xl text-xs"
      style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>
      <p className="font-semibold mb-1" style={{ color:'var(--color-text-primary)' }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmM(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────
const KPI = ({ icon:Icon, label, value, sub, color='var(--color-navy)', loading }) => (
  <div className="card p-4">
    <div className="flex items-start justify-between mb-3">
      <div className="w-9 h-9 flex items-center justify-center"
        style={{ background:`${color}18`, border:`1px solid ${color}30` }}>
        <Icon size={16} style={{ color }}/>
      </div>
    </div>
    {loading ? (
      <div className="h-7 w-24 rounded animate-pulse"
        style={{ background:'var(--color-bg-secondary)' }}/>
    ) : (
      <p className="text-xl font-bold font-mono" style={{ color:'var(--color-navy)' }}>{value}</p>
    )}
    <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{label}</p>
    {sub && <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>{sub}</p>}
  </div>
);

// ── Tab: Resumen General ──────────────────────────────────────
const TabResumen = () => {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: kpiData, isFetching: loadKpi } = useQuery({
    queryKey: ['report-kpis'],
    queryFn:  () => reportsService.getDashboardKPIs(),
  });
  const { data: monthData } = useQuery({
    queryKey: ['report-monthly', year],
    queryFn:  () => reportsService.getMonthly({ year }),
  });
  const { data: advData } = useQuery({
    queryKey: ['report-advisors'],
    queryFn:  () => reportsService.getSalesPerAdvisor(),
  });

  const kpis    = kpiData?.data?.data?.kpis || {};
  const monthly = monthData?.data?.data     || [];
  const advisors= advData?.data?.data       || [];

  const handleExport = () => {
    exportToExcel([
      {
        name: `Mensual ${year}`,
        headers: ['Mes','Contratos','Valor Contratos','Recaudado'],
        data: monthly.map(m => [m.month, m.contratos, parseFloat(m.valor||0), parseFloat(m.recaudado||0)]),
      },
      {
        name: 'Ranking Asesores',
        headers: ['Asesor','Contratos','Valor Vendido'],
        data: advisors.map(a => [a.name, a.contratos, parseFloat(a.valor||0)]),
      },
    ], `Resumen_${year}`);
  };

  return (
    <div className="space-y-5">
      {/* Exportar */}
      <div className="flex justify-end">
        <ExportBtn onClick={handleExport} label={`Exportar Resumen ${year}`}/>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={FileText}     label="Contratos activos"    value={kpis.active_contracts||0}      color="#0D1B3E" loading={loadKpi}/>
        <KPI icon={DollarSign}   label="Recaudado total"       value={fmM(kpis.total_collected)}     color="#C8A84B" loading={loadKpi}/>
        <KPI icon={AlertTriangle}label="Cuotas en mora"        value={kpis.overdue_count||0}          color="#C0392B" loading={loadKpi}/>
        <KPI icon={Home}         label="Inmuebles disponibles" value={kpis.available_properties||0}  color="#2D7A3A" loading={loadKpi}/>
      </div>

      {/* Contratos y recaudo por mes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Contratos y Recaudo Mensual
          </h3>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="input text-xs" style={{ width:'90px', height:'32px' }}>
            {[2023,2024,2025,2026,2027].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
        {monthly.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color:'var(--color-text-muted)' }}>
            Sin datos para {year}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top:5, right:5, left:5, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)"/>
              <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:11 }}/>
              <YAxis yAxisId="left" tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmM}/>
              <YAxis yAxisId="right" orientation="right" tick={{ fill:'#94a3b8', fontSize:10 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize:'11px', color:'#94a3b8' }}/>
              <Bar yAxisId="left"  dataKey="recaudado" name="Recaudado"        fill="#C8A84B" radius={[4,4,0,0]}/>
              <Bar yAxisId="left"  dataKey="valor"     name="Valor contratos"  fill="#0D1B3E" radius={[4,4,0,0]} opacity={0.7}/>
              <Bar yAxisId="right" dataKey="contratos" name="Contratos"        fill="#1A2F5E" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ranking asesores */}
      {advisors.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color:'var(--color-text-primary)' }}>
            Ranking de Asesores
          </h3>
          <div className="space-y-3">
            {advisors.filter(a => a.contratos > 0).map((a, i) => {
              const maxVal = Math.max(...advisors.map(x => parseFloat(x.valor)||0));
              const pct    = maxVal > 0 ? Math.round((parseFloat(a.valor)||0)/maxVal*100) : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-5 text-center"
                        style={{ color:COLORS[i%COLORS.length] }}>#{i+1}</span>
                      <span style={{ color:'var(--color-text-primary)' }}>{a.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span style={{ color:'var(--color-text-muted)' }}>{a.contratos} contratos</span>
                      <span className="font-mono font-bold" style={{ color:'var(--color-navy)' }}>
                        {fmM(a.valor)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background:'var(--color-bg-primary)' }}>
                    <div className="h-1.5 rounded-full"
                      style={{ width:`${pct}%`, background:COLORS[i%COLORS.length] }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Vacancia ─────────────────────────────────────────────
const TabVacancia = () => {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-vacancy'],
    queryFn:  () => reportsService.getVacancy(),
  });
  const projects = data?.data?.data || [];

  const totalVacant   = projects.reduce((s,p) => s + (parseInt(p.vacant)||0), 0);
  const totalCreated  = projects.reduce((s,p) => s + (parseInt(p.total_created)||0), 0);
  const totalSold     = projects.reduce((s,p) => s + (parseInt(p.promised)||0) + (parseInt(p.deeded)||0), 0);
  const vacantValue   = projects.reduce((s,p) => s + parseFloat(p.vacant_value||0), 0);
  const globalVacancy = totalCreated > 0 ? Math.round(totalVacant/totalCreated*100) : 0;

  const handleExport = () => {
    exportToExcel([{
      name: 'Vacancia por Proyecto',
      headers: ['Proyecto','Ciudad','Unidades Creadas','Vacantes','Reservadas','Prometidas','Escrituradas','% Vacancia','% Vendido','Valor Vacante COP'],
      data: projects.map(p => [
        p.project_name, p.city,
        parseInt(p.total_created)||0,
        parseInt(p.vacant)||0,
        parseInt(p.reserved)||0,
        parseInt(p.promised)||0,
        parseInt(p.deeded)||0,
        parseFloat(p.vacancy_rate)||0,
        parseFloat(p.sold_rate)||0,
        parseFloat(p.vacant_value)||0,
      ]),
    }], 'Reporte_Vacancia');
  };

  return (
    <div className="space-y-5">
      {/* Exportar */}
      <div className="flex justify-end">
        <ExportBtn onClick={handleExport} label="Exportar Vacancia"/>
      </div>
      {/* KPIs vacancia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Home}       label="Unidades vacantes"            value={totalVacant}         color="#C0392B"/>
        <KPI icon={TrendingUp} label="Tasa de vacancia global"       value={`${globalVacancy}%`} color="#92660A"/>
        <KPI icon={FileText}   label="Unidades vendidas/prometidas"  value={totalSold}           color="#2D7A3A"/>
        <KPI icon={DollarSign} label="Valor cartera vacante"         value={fmM(vacantValue)}    color="#C8A84B"/>
      </div>

      {/* Tabla por proyecto */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor:'var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Vacancia por Proyecto
          </h3>
          <button onClick={() => refetch()} className="btn btn-ghost btn-sm">
            <RefreshCw size={13} className={isFetching?'animate-spin':''}/>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
                {['Proyecto','Ciudad','Creadas','Vacantes','Reserv.','Prometidas','Escrituradas','% Vacancia','% Vendido','Valor Vacante'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap"
                    style={{ color:'rgba(245,243,238,0.75)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => {
                const vr = parseFloat(p.vacancy_rate)||0;
                const sr = parseFloat(p.sold_rate)||0;
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--color-border)' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color:'var(--color-text-primary)' }}>
                      {p.project_name}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-muted)' }}>{p.city}</td>
                    <td className="px-3 py-2.5 text-center font-mono" style={{ color:'var(--color-text-primary)' }}>
                      {p.total_created}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-bold" style={{ color: p.vacant > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {p.vacant}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{ color:'var(--color-warning)' }}>{p.reserved}</td>
                    <td className="px-3 py-2.5 text-center" style={{ color:'var(--color-gold)' }}>{p.promised}</td>
                    <td className="px-3 py-2.5 text-center" style={{ color:'var(--color-navy)' }}>{p.deeded}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full" style={{ background:'var(--color-bg-primary)' }}>
                          <div className="h-1.5 rounded-full"
                            style={{ width:`${vr}%`, background: vr > 50 ? 'var(--color-danger)' : vr > 25 ? 'var(--color-warning)' : 'var(--color-success)' }}/>
                        </div>
                        <span style={{ color: vr > 50 ? 'var(--color-danger)' : vr > 25 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          {vr}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full" style={{ background:'var(--color-bg-secondary)' }}>
                          <div className="h-1.5 rounded-full" style={{ width:`${sr}%`, background:'var(--color-gold)' }}/>
                        </div>
                        <span style={{ color:'var(--color-navy)' }}>{sr}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold" style={{ color:'var(--color-navy)' }}>
                      {fmM(p.vacant_value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--color-bg-secondary)', borderTop:'2px solid var(--color-border)' }}>
                <td className="px-3 py-2.5 font-bold text-xs" style={{ color:'var(--color-text-primary)' }}>
                  TOTAL
                </td>
                <td/>
                <td className="px-3 py-2.5 text-center font-bold" style={{ color:'var(--color-text-primary)' }}>
                  {totalCreated}
                </td>
                <td className="px-3 py-2.5 text-center font-bold" style={{ color:'var(--color-danger)' }}>
                  {totalVacant}
                </td>
                <td colSpan={3}/>
                <td className="px-3 py-2.5 font-bold" style={{ color: globalVacancy > 50 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {globalVacancy}%
                </td>
                <td/>
                <td className="px-3 py-2.5 font-bold font-mono" style={{ color:'var(--color-navy)' }}>
                  {fmM(vacantValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gráfico distribución */}
      {projects.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color:'var(--color-text-primary)' }}>
            Distribución por Estado
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projects.map(p => ({
              name:       p.project_name,
              Vacantes:   parseInt(p.vacant)||0,
              Prometidos: parseInt(p.promised)||0,
              Escriturados:parseInt(p.deeded)||0,
              Reservados: parseInt(p.reserved)||0,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)"/>
              <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }}/>
              <YAxis tick={{ fill:'#94a3b8', fontSize:10 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize:'11px', color:'#94a3b8' }}/>
              <Bar dataKey="Vacantes"     fill="#C0392B" stackId="a" radius={[0,0,0,0]}/>
              <Bar dataKey="Reservados"   fill="#92660A" stackId="a"/>
              <Bar dataKey="Prometidos"   fill="#C8A84B" stackId="a"/>
              <Bar dataKey="Escriturados" fill="#0D1B3E" stackId="a" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ── Tab: Estado Cartera ───────────────────────────────────────
const TabCartera = () => {
  const [filter, setFilter] = useState('todos');

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-cartera'],
    queryFn:  () => reportsService.getCartera(),
  });
  const all = data?.data?.data || [];

  const filtered = filter === 'mora'   ? all.filter(c => c.overdue_installments > 0) :
                   filter === 'al_dia' ? all.filter(c => c.overdue_installments === 0) : all;

  const totalBalance   = all.reduce((s,c) => s + parseFloat(c.balance||0), 0);
  const totalOverdue   = all.reduce((s,c) => s + parseFloat(c.overdue_value||0), 0);
  const countMora      = all.filter(c => c.overdue_installments > 0).length;

  const handleExport = () => {
    exportToExcel([
      {
        name: 'Estado Cartera',
        headers: ['Contrato','Cliente','Teléfono','Proyecto','Unidad','Asesor','Valor Neto','Recaudado','Saldo','Cuotas Mora','Valor Mora','Próx. Vencimiento','Tipo Pago'],
        data: filtered.map(c => [
          c.contract_number, c.client_name, c.client_phone||'',
          c.project_name, c.unit_number, c.advisor_name||'',
          parseFloat(c.net_value||0),
          parseFloat(c.total_paid||0),
          parseFloat(c.balance||0),
          parseInt(c.overdue_installments||0),
          parseFloat(c.overdue_value||0),
          c.next_due_date ? format(new Date(c.next_due_date),'dd/MM/yyyy') : '',
          c.payment_type||'',
        ]),
      },
    ], `Cartera_${filter}`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KPI icon={DollarSign}    label="Saldo total cartera"    value={fmM(totalBalance)}   color="#C8A84B"/>
        <KPI icon={AlertTriangle} label="Valor en mora"          value={fmM(totalOverdue)}   color="#C0392B"/>
        <KPI icon={FileText}      label="Contratos en mora"      value={countMora}           color="#92660A"/>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[['todos','Todos'],['mora','En mora'],['al_dia','Al día']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="btn btn-sm text-xs"
            style={{
              background: filter===v ? 'var(--color-navy)' : 'var(--color-bg-secondary)',
              color:      filter===v ? '#F5F3EE'           : 'var(--color-text-secondary)',
              border:     `1px solid ${filter===v ? 'var(--color-gold)' : 'var(--color-border)'}`,
              borderBottom: filter===v ? '2px solid var(--color-gold)' : undefined,
            }}>
            {l} {v==='mora' && countMora > 0 && (
              <span className="ml-1 px-1.5 rounded-full text-xs"
                style={{ background:'var(--color-danger)', color:'#fff' }}>
                {countMora}
              </span>
            )}
          </button>
        ))}
        <button onClick={() => refetch()} className="btn btn-ghost btn-sm ml-auto">
          <RefreshCw size={13} className={isFetching?'animate-spin':''}/>
        </button>
        <ExportBtn onClick={handleExport} label={`Exportar ${filter==='mora'?'En Mora':filter==='al_dia'?'Al Día':'Cartera'}`}/>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
                {['Contrato','Cliente','Proyecto','Asesor','Valor Neto','Recaudado','Saldo','Cuotas Mora','Valor Mora','Próx. Vto.'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap"
                    style={{ color:'rgba(245,243,238,0.75)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c,i) => {
                const mora = c.overdue_installments > 0;
                return (
                  <tr key={i}
                    style={{
                      borderBottom:'1px solid var(--color-border)',
                      background: mora ? 'var(--color-danger-bg)' : undefined,
                      borderLeft: mora ? '3px solid var(--color-danger)' : '3px solid transparent',
                    }}>
                    <td className="px-3 py-2.5 font-mono font-medium" style={{ color:'var(--color-gold)' }}>
                      {c.contract_number}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-primary)' }}>
                      <p>{c.client_name}</p>
                      {c.client_phone && <p style={{ color:'var(--color-text-muted)' }}>{c.client_phone}</p>}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-secondary)' }}>
                      {c.project_name} · {c.unit_number}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-muted)' }}>
                      {c.advisor_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color:'var(--color-navy)' }}>
                      {fmM(c.net_value)}
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color:'var(--color-navy)' }}>
                      {fmM(c.total_paid)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold" style={{ color:'var(--color-warning)' }}>
                      {fmM(c.balance)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {mora
                        ? <span className="px-2 py-0.5 rounded-full font-bold"
                            style={{ background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid var(--color-danger-border)' }}>
                            {c.overdue_installments} cuota{c.overdue_installments!==1?'s':''}
                          </span>
                        : <span style={{ color:'var(--color-success)' }}>✓ Al día</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: mora ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {mora ? fmM(c.overdue_value) : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"
                      style={{ color: mora ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {c.next_due_date ? format(new Date(c.next_due_date),'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color:'var(--color-text-muted)' }}>
              {filter === 'mora' ? '✅ No hay contratos en mora' : 'Sin datos'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Tab: Liquidación Mensual ──────────────────────────────────
const TabLiquidacion = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-liquidacion', month, year],
    queryFn:  () => reportsService.getLiquidacion({ month, year }),
  });
  const liq = data?.data?.data || {};
  const pagos = liq.pagos || [];

  const byMethod = pagos.reduce((acc, p) => {
    acc[p.payment_method] = (acc[p.payment_method]||0) + parseFloat(p.amount||0);
    return acc;
  }, {});

  const handleExport = () => {
    const sheets = [
      {
        name: 'Pagos del Mes',
        headers: ['Recibo','Contrato','Cliente','Proyecto','Unidad','Fecha','Monto COP','Método','Asesor'],
        data: pagos.map(p => [
          p.receipt_number, p.contract_number, p.client_name,
          p.project_name, p.unit_number,
          p.payment_date ? format(new Date(p.payment_date),'dd/MM/yyyy') : '',
          parseFloat(p.amount||0), p.payment_method, p.advisor_name||'',
        ]),
      },
      {
        name: 'Resumen',
        headers: ['Concepto','Valor COP'],
        data: [
          ['Total Recaudado',   parseFloat(liq.total_recaudado||0)],
          ['Total Comisiones',  parseFloat(liq.total_comisiones||0)],
          ['Neto Inmobiliaria', parseFloat(liq.neto_inmobiliaria||0)],
          ['N° de Pagos',       pagos.length],
        ],
      },
    ];
    if (liq.comisiones_pagadas?.length > 0) {
      sheets.push({
        name: 'Comisiones Pagadas',
        headers: ['Asesor','Contrato','Tipo','Monto COP','Fecha'],
        data: liq.comisiones_pagadas.map(c => [
          c.advisor_name, c.contract_number, c.commission_type,
          parseFloat(c.paid_amount||0),
          c.paid_date ? format(new Date(c.paid_date),'dd/MM/yyyy') : '',
        ]),
      });
    }
    exportToExcel(sheets, `Liquidacion_${MONTHS[month-1]}_${year}`);
  };

  return (
    <div className="space-y-5">
      {/* Selector mes/año */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <Calendar size={16} style={{ color:'var(--color-text-muted)' }}/>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="input text-sm" style={{ width:'150px', height:'36px' }}>
          {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="input text-sm" style={{ width:'90px', height:'36px' }}>
          {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
          <RefreshCw size={13} className={isFetching?'animate-spin':''}/>
          {isFetching ? 'Cargando...' : 'Actualizar'}
        </button>
        <ExportBtn
          onClick={handleExport}
          label={`Exportar ${MONTHS[month-1]} ${year}`}
          loading={isFetching || pagos.length === 0}
        />
      </div>

      {/* KPIs liquidación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={DollarSign}    label="Total recaudado"   value={fmM(liq.total_recaudado)}    color="#C8A84B"/>
        <KPI icon={Users}         label="Pagos registrados" value={pagos.length}                 color="#0D1B3E"/>
        <KPI icon={TrendingUp}    label="Comisiones pagadas" value={fmM(liq.total_comisiones)}   color="#92660A"/>
        <KPI icon={Building}      label="Neto inmobiliaria" value={fmM(liq.neto_inmobiliaria)}   color="#0D1B3E"/>
      </div>

      {/* Distribución por método de pago */}
      {Object.keys(byMethod).length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4" style={{ color:'var(--color-text-primary)' }}>
            Recaudo por Método de Pago
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(byMethod).map(([method, total], i) => (
              <div key={method} className="rounded-xl p-3 text-center"
                style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}>
                <p className="text-xs capitalize mb-1" style={{ color:'var(--color-text-muted)' }}>
                  {method}
                </p>
                <p className="font-bold font-mono text-sm" style={{ color:'var(--color-navy)' }}>
                  {fmM(total)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle de pagos */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b"
          style={{ borderColor:'var(--color-border)' }}>
          <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
            Detalle de Pagos — {MONTHS[month-1]} {year}
          </h3>
        </div>
        {pagos.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color:'var(--color-text-muted)' }}>
            Sin pagos registrados en {MONTHS[month-1]} {year}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
                  {['Recibo','Contrato','Cliente','Proyecto','Fecha','Monto','Método','Asesor'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap"
                      style={{ color:'rgba(245,243,238,0.75)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--color-border)' }}>
                    <td className="px-3 py-2.5 font-mono font-bold"
                      style={{ color:'var(--color-navy)' }}>{p.receipt_number}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ color:'var(--color-gold)' }}>
                      {p.contract_number}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-primary)' }}>
                      {p.client_name}
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-muted)' }}>
                      {p.project_name} · {p.unit_number}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color:'var(--color-text-muted)' }}>
                      {p.payment_date ? format(new Date(p.payment_date),'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold" style={{ color:'var(--color-navy)' }}>
                      {fm(p.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded capitalize"
                        style={{ background:'rgba(13,27,62,0.07)', color:'var(--color-navy)', border:'1px solid rgba(13,27,62,0.15)' }}>
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-text-muted)' }}>
                      {p.advisor_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'var(--color-navy)', borderTop:'2px solid var(--color-gold)' }}>
                  <td colSpan={5} className="px-3 py-2.5 text-right font-bold text-xs"
                    style={{ color:'rgba(245,243,238,0.7)' }}>
                    TOTAL RECAUDADO:
                  </td>
                  <td className="px-3 py-2.5 font-bold font-mono" style={{ color:'var(--color-gold)' }}>
                    {fm(liq.total_recaudado)}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Comisiones pagadas en el mes */}
      {liq.comisiones_pagadas?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor:'var(--color-border)' }}>
            <h3 className="font-semibold text-sm"
              style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
              Comisiones Pagadas a Asesores
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background:'var(--color-navy)', borderBottom:'2px solid var(--color-gold)' }}>
                  {['Asesor','Contrato','Tipo','Monto Pagado','Fecha'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold"
                      style={{ color:'rgba(245,243,238,0.75)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liq.comisiones_pagadas.map((c,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--color-border)' }}>
                    <td className="px-3 py-2.5" style={{ color:'var(--color-navy)' }}>
                      {c.advisor_name}
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color:'var(--color-gold)' }}>
                      {c.contract_number}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: c.commission_type==='fija' ? 'rgba(200,168,75,0.12)' : 'rgba(13,27,62,0.07)',
                          color:      c.commission_type==='fija' ? 'var(--color-gold)'      : 'var(--color-navy)',
                          border:     `1px solid ${c.commission_type==='fija' ? 'rgba(200,168,75,0.3)' : 'rgba(13,27,62,0.15)'}`,
                        }}>
                        {c.commission_type === 'fija' ? '$ Fija' : '% Porc.'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold" style={{ color:'var(--color-navy)' }}>
                      {fm(c.paid_amount)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color:'var(--color-text-muted)' }}>
                      {c.paid_date ? format(new Date(c.paid_date),'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('resumen');

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
            Reportes
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Análisis gerencial · Vacancia · Cartera · Liquidación
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background:'var(--color-bg-secondary)', width:'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const sel  = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: sel ? 'var(--color-navy)' : 'transparent',
                color:      sel ? '#F5F3EE'           : 'var(--color-text-muted)',
                borderBottom: sel ? '2px solid var(--color-gold)' : '2px solid transparent',
                boxShadow:  'none',
              }}>
              <Icon size={14}/>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {activeTab === 'resumen'     && <TabResumen/>}
      {activeTab === 'vacancia'    && <TabVacancia/>}
      {activeTab === 'cartera'     && <TabCartera/>}
      {activeTab === 'liquidacion' && <TabLiquidacion/>}

    </div>
  );
};

export default ReportsPage;