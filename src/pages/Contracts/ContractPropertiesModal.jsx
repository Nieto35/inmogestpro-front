// src/pages/Contracts/ContractPropertiesModal.jsx
//
// Permite quitar y agregar inmuebles a un contrato ya creado. Antes esto no
// existía: un inmueble mal elegido solo se corregía cancelando el contrato.
//
// Se envía al backend la lista COMPLETA que debe quedar, no altas/bajas
// sueltas, para que la operación no dependa del estado que el navegador creía
// tener. El backend libera los que salen (vuelven a 'disponible') y reserva los
// que entran ('prometido').
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Plus, Trash2, Search, Star, AlertTriangle, Loader2 } from 'lucide-react';
import { propertiesService } from '../../services/api.service';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v||0);

const describe = (p) =>
  [p.project_name, p.block_name, p.unit_number ? `Unidad ${p.unit_number}` : null]
    .filter(Boolean).join(' · ');

const ContractPropertiesModal = ({ contract, currentProperties, onClose, onSave, saving }) => {
  // Selección de trabajo. El primero de la lista es el inmueble principal.
  const [selected, setSelected] = useState(() =>
    (currentProperties || [])
      .filter(p => p?.id)
      .map(p => ({
        id:           p.id,
        unit_number:  p.unit_number,
        project_name: p.project_name,
        block_name:   p.block_name,
        base_price:   p.base_price,
      }))
  );
  const [search, setSearch] = useState('');

  // Solo se pueden agregar inmuebles libres. 'reservado' también sirve porque
  // al crear contrato el backend ya lo acepta (la reserva pasa a convertida).
  const { data: propsData, isLoading } = useQuery({
    queryKey: ['properties','seleccionables', search],
    queryFn:  () => propertiesService.getAll({ search }),
  });

  const selectedIds = useMemo(() => new Set(selected.map(p => p.id)), [selected]);

  const originalIds = useMemo(
    () => new Set((currentProperties || []).map(p => p.id).filter(Boolean)),
    [currentProperties]
  );

  // Los que ya estaban en el contrato figuran como 'prometido' por culpa de
  // este mismo contrato: si se quitan aquí deben poder volver a agregarse sin
  // tener que cerrar el modal y guardar.
  const candidates = (propsData?.data?.data || [])
    .filter(p => !selectedIds.has(p.id))
    .filter(p => ['disponible','reservado'].includes(p.status) || originalIds.has(p.id));

  const added   = selected.filter(p => !originalIds.has(p.id));
  const removed = (currentProperties || []).filter(p => p.id && !selectedIds.has(p.id));
  const dirty   = added.length > 0 || removed.length > 0
                  || selected[0]?.id !== (currentProperties || [])[0]?.id;

  const sumBase = selected.reduce((acc,p) => acc + (parseFloat(p.base_price) || 0), 0);
  const total   = parseFloat(contract?.total_value) || 0;

  const add    = (p) => setSelected(s => [...s, {
    id:p.id, unit_number:p.unit_number, project_name:p.project_name,
    block_name:p.block_name, base_price:p.base_price,
  }]);
  const remove = (id) => setSelected(s => s.filter(p => p.id !== id));
  // Mover al frente = volverlo principal. El backend usa el primero como
  // `property_id`, que es por donde los reportes hacen JOIN.
  const makePrimary = (id) => setSelected(s => {
    const target = s.find(p => p.id === id);
    return target ? [target, ...s.filter(p => p.id !== id)] : s;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ background:'var(--color-bg-secondary)' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between pb-3 mb-4"
          style={{ borderBottom:'1px solid var(--color-border)' }}>
          <div>
            <h3 className="font-semibold" style={{ color:'var(--color-text-primary)' }}>
              Inmuebles del contrato
            </h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
              {contract?.contract_number}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:opacity-70"
            style={{ color:'var(--color-text-muted)' }}>
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5">

          {/* Seleccionados */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color:'var(--color-text-muted)' }}>
              En el contrato ({selected.length})
            </p>

            {selected.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded"
                style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5"/>
                <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                  El contrato debe tener al menos un inmueble.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {selected.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded"
                  style={{ background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate"
                      style={{ color:'var(--color-text-primary)' }}>
                      {describe(p)}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                          style={{ background:'rgba(200,168,75,0.15)', color:'#C8A84B' }}>
                          Principal
                        </span>
                      )}
                      {!originalIds.has(p.id) && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                          style={{ background:'rgba(34,197,94,0.15)', color:'#22c55e' }}>
                          Nuevo
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
                      Precio de lista {formatCurrency(p.base_price)}
                    </p>
                  </div>
                  {i !== 0 && (
                    <button onClick={() => makePrimary(p.id)} title="Marcar como principal"
                      className="p-1.5 rounded hover:opacity-70" style={{ color:'var(--color-text-muted)' }}>
                      <Star size={15}/>
                    </button>
                  )}
                  <button onClick={() => remove(p.id)} title="Quitar del contrato"
                    className="p-1.5 rounded hover:opacity-70 text-red-400">
                    <Trash2 size={15}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Buscador para agregar */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color:'var(--color-text-muted)' }}>
              Agregar inmueble
            </p>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color:'var(--color-text-muted)' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por unidad o proyecto…"
                className="input w-full pl-9"/>
            </div>

            {isLoading ? (
              <p className="text-sm py-3 flex items-center gap-2"
                style={{ color:'var(--color-text-muted)' }}>
                <Loader2 size={14} className="animate-spin"/> Buscando…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm py-3" style={{ color:'var(--color-text-muted)' }}>
                No hay inmuebles disponibles que coincidan.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {candidates.map(p => (
                  <button key={p.id} onClick={() => add(p)}
                    className="w-full flex items-center gap-3 p-2.5 rounded text-left hover:opacity-80"
                    style={{ background:'var(--color-bg-tertiary)', border:'1px solid var(--color-border)' }}>
                    <Plus size={15} style={{ color:'#22c55e' }}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color:'var(--color-text-primary)' }}>
                        {describe(p)}
                      </p>
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                        {formatCurrency(p.base_price)} · {p.status}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resumen del cambio */}
          {dirty && (
            <div className="p-3 rounded space-y-1.5"
              style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'#f59e0b' }}>
                Resumen del cambio
              </p>
              {added.length > 0 && (
                <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                  Se vincularán y pasarán a <strong>prometido</strong>:{' '}
                  {added.map(p => p.unit_number).join(', ')}
                </p>
              )}
              {removed.length > 0 && (
                <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                  Se liberarán y volverán a <strong>disponible</strong>:{' '}
                  {removed.map(p => p.unit_number).join(', ')}
                </p>
              )}
              {sumBase !== total && (
                <p className="text-sm pt-1.5"
                  style={{ color:'var(--color-text-secondary)', borderTop:'1px solid rgba(245,158,11,0.2)' }}>
                  El valor del contrato seguirá en <strong>{formatCurrency(total)}</strong>. La suma
                  de precios de lista de la nueva selección es <strong>{formatCurrency(sumBase)}</strong>.
                  Si el valor pactado cambió, edítalo en el contrato para que el plan de cuotas se
                  recalcule respetando lo ya pagado.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4"
          style={{ borderTop:'1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(selected.map(p => p.id))}
            disabled={saving || selected.length === 0 || !dirty}
            className="btn btn-primary">
            {saving ? 'Guardando…' : 'Guardar inmuebles'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractPropertiesModal;
