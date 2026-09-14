// src/components/Payments/VoidPaymentModal.jsx
//
// Anular un pago. Se usa desde la lista de Pagos y desde el detalle del
// contrato, para que el flujo sea el mismo en los dos sitios.
//
// Un pago no se edita ni se borra: se anula con motivo y, si el valor real
// era otro, se registra uno nuevo. El anulado queda como evidencia. Es la
// misma regla que aplica el reemplazo de la cuota inicial y Liquidaciones.
import { useState } from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import Modal from '../UI/Modal';
import { paymentsService } from '../../services/api.service';
import toast from 'react-hot-toast';

const fmt = (v) =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v || 0);

const VoidPaymentModal = ({ payment, onClose, onVoided }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const ok = reason.trim().length >= 10;

  const submit = async () => {
    if (!ok) return toast.error('Explica el motivo: mínimo 10 caracteres');
    setSaving(true);
    try {
      const r = await paymentsService.void(payment.id, reason.trim());
      toast.success(r.data?.message || `Pago ${payment.receipt_number} anulado`);
      onVoided?.();
      onClose();
    } catch (err) {
      // El backend explica por qué no se puede: ya anulado, o un canon que
      // ya entró en una liquidación. Se muestra tal cual.
      toast.error(err.response?.data?.message || 'No se pudo anular el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      {/* Modal solo aporta el fondo oscuro: la tarjeta con fondo, borde y
          sombra la pone cada modal — igual que PaymentModal. */}
      <div className="w-full max-w-lg rounded-xl shadow-2xl p-5 space-y-4"
        style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-border)' }}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center"
            style={{ background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.25)' }}>
            <Ban size={16} style={{ color:'var(--color-danger)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
              Anular pago {payment.receipt_number}
            </h3>
            <p className="text-sm mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {fmt(payment.amount)} · {payment.contract_number || ''}
            </p>
          </div>
        </div>

        <div className="text-sm p-3 flex gap-2"
          style={{ background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.3)', color:'var(--color-text-secondary)' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color:'var(--color-gold)' }} />
          <span>
            El pago no se borra: queda anulado con tu nombre, la fecha y este motivo, y deja
            de contar en saldos, cuotas y reportes. Si el valor real era otro, después
            regístralo como un pago nuevo.
          </span>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1" style={{ color:'var(--color-text-primary)' }}>
            Motivo <span style={{ color:'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            className="input w-full text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: se registró $12.000 y el cliente pagó $11.000"
            autoFocus
          />
          <p className="text-xs mt-1" style={{ color: ok ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>
            {reason.trim().length} caracteres (mínimo 10)
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>
            Cancelar
          </button>
          <button onClick={submit} className="btn btn-sm" disabled={!ok || saving}
            style={{ background:'var(--color-danger)', color:'#fff', borderColor:'var(--color-danger)' }}>
            <Ban size={13} /> {saving ? 'Anulando…' : 'Anular pago'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default VoidPaymentModal;
