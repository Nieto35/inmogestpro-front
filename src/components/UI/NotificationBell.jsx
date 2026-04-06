// src/components/UI/NotificationBell.jsx
// Sistema de notificaciones en tiempo real (polling cada 3 minutos)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, X, AlertTriangle, Clock, DollarSign, FileText } from 'lucide-react';
import { paymentsService, reportsService, commissionsService } from '../../services/api.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = v =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const NOTIF_ICONS = {
  mora:    { icon:AlertTriangle, color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
  vence:   { icon:Clock,         color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
  pago:    { icon:DollarSign,    color:'#10b981', bg:'rgba(16,185,129,0.1)' },
  contrato:{ icon:FileText,      color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);

  // Cargar cuotas vencidas y próximas a vencer
  const { data: overdueData } = useQuery({
    queryKey: ['notif-overdue'],
    queryFn:  () => paymentsService.getOverdue(),
    refetchInterval: 5 * 60 * 1000,   // cada 5 minutos
    refetchIntervalInBackground: false, // NO polling en background
  });

  // Cargar KPIs para detectar alertas globales
  const { data: kpisData } = useQuery({
    queryKey:  ['notif-kpis'],
    queryFn:   () => reportsService.getDashboardKPIs(),
    refetchInterval: 5 * 60 * 1000,
  });

  // Cargar comisiones vencidas (cuotas de comisión no pagadas con fecha pasada)
  const { data: commData } = useQuery({
    queryKey: ['notif-commissions-overdue'],
    queryFn:  () => commissionsService.getOverdue(),
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const overdue = overdueData?.data?.data || [];
  const kpis    = kpisData?.data?.data?.kpis || {};

  // Cuotas de comisión VENCIDAS (ya pasó su fecha y no están pagadas)
  const overdueCommPayments = (commData?.data?.data || []).map(o => ({
    advisor:  o.advisor_name,
    contract: o.contract_number,
    pending:  parseFloat(o.amount || 0),
    days:     o.days_overdue,
  }));

  // Construir lista de notificaciones
  const notifications = [];

  // Cuotas en mora
  if (overdue.length > 0) {
    notifications.push({
      id:    'mora-summary',
      type:  'mora',
      title: `${overdue.length} cuota${overdue.length>1?'s':''} en mora`,
      body:  overdue.slice(0,3).map(o =>
        `${o.client_name} — ${formatCurrency(o.amount)} (${o.days_overdue} días)`
      ).join('\n'),
      time:  'Actualizado ahora',
      count: overdue.length,
    });
  }

  // Cuotas vencidas hace poco (1-7 días)
  const recent = overdue.filter(o => o.days_overdue <= 7 && o.days_overdue > 0);
  if (recent.length > 0 && recent.length !== overdue.length) {
    notifications.push({
      id:    'mora-recent',
      type:  'vence',
      title: `${recent.length} cuota${recent.length>1?'s':''} vencida${recent.length>1?'s':''} recientemente`,
      body:  recent.map(o => `${o.client_name} — vencida hace ${o.days_overdue} día${o.days_overdue>1?'s':''}`).join('\n'),
      time:  'Últimos 7 días',
      count: recent.length,
    });
  }

  // Alertas de comisiones pendientes de pagar a asesores
  if (overdueCommPayments.length > 0) {
    const totalPending = overdueCommPayments.reduce((s,c) => s + c.pending, 0);
    notifications.push({
      id:    'comm-pending',
      type:  'mora',
      title: `${overdueCommPayments.length} cuota${overdueCommPayments.length>1?'s':''} de comisión vencida${overdueCommPayments.length>1?'s':''}`,
      body:  overdueCommPayments.slice(0,3).map(c =>
        `${c.advisor} — ${c.contract} — ${formatCurrency(c.pending)} (${c.days} día${c.days!==1?'s':''})`
      ).join('\n') + (overdueCommPayments.length > 3 ? `\n+${overdueCommPayments.length-3} más...` : ''),
      time:  'Comisiones atrasadas',
      count: overdueCommPayments.length,
    });
  }

  // Alerta si hay muchas cuotas en mora
  if (kpis.overdue_count > 10) {
    notifications.push({
      id:    'mora-critical',
      type:  'mora',
      title: '⚠️ Cartera crítica',
      body:  `Hay ${kpis.overdue_count} cuotas vencidas. Revisar con urgencia.`,
      time:  'Alerta del sistema',
    });
  }

  const totalUnread = notifications.length;

  return (
    <div className="relative">
      {/* Botón campana */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ background: open ? 'var(--color-bg-tertiary)' : 'transparent' }}
        title={totalUnread > 0 ? `${totalUnread} notificaciones` : 'Sin notificaciones'}>
        <Bell size={18} style={{ color:'var(--color-text-secondary)' }}/>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full
                           flex items-center justify-center text-xs font-bold text-white"
            style={{ background:'#ef4444', fontSize:'10px', padding:'0 4px' }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {open && (
        <>
          {/* Overlay para cerrar */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>

          <div className="absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50"
            style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b"
              style={{ borderColor:'var(--color-border)' }}>
              <h3 className="font-bold text-sm" style={{ color:'var(--color-text-primary)' }}>
                Notificaciones
                {totalUnread > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs text-white"
                    style={{ background:'#ef4444' }}>
                    {totalUnread}
                  </span>
                )}
              </h3>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
                <X size={14}/>
              </button>
            </div>

            {/* Lista de notificaciones */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto mb-2" style={{ color:'var(--color-text-muted)' }}/>
                  <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                    Sin alertas pendientes
                  </p>
                  <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                    Todos los pagos están al día ✓
                  </p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg  = NOTIF_ICONS[n.type] || NOTIF_ICONS.pago;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} className="p-4 border-b hover:bg-slate-800 transition-colors"
                      style={{ borderColor:'var(--color-border)' }}>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background:cfg.bg }}>
                          <Icon size={15} style={{ color:cfg.color }}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color:'var(--color-text-primary)' }}>
                            {n.title}
                          </p>
                          <p className="text-xs mt-0.5 whitespace-pre-line"
                            style={{ color:'var(--color-text-secondary)' }}>
                            {n.body}
                          </p>
                          <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>
                            {n.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t" style={{ borderColor:'var(--color-border)' }}>
              <p className="text-xs text-center" style={{ color:'var(--color-text-muted)' }}>
                Se actualiza automáticamente cada 3 minutos
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;