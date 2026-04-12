// src/pages/Settings/CurrencySettingsPage.jsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { configService } from '../../services/api.service';
import useCurrencyStore from '../../store/currencyStore';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { Save, Globe } from 'lucide-react';

const CurrencySettingsPage = () => {
  const { hasRole }       = useAuthStore();
  const { setCurrency }   = useCurrencyStore();
  const queryClient       = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState('COP');
  const canEdit = hasRole('admin');

  const { data } = useQuery({
    queryKey: ['system-config'],
    queryFn:  () => configService.get(),
  });

  const config     = data?.data?.data?.config     || {};
  const currencies = data?.data?.data?.currencies || [];

  useEffect(() => {
    if (config.currency_code) setSelected(config.currency_code);
  }, [config.currency_code]);

  const selectedCur = currencies.find(c => c.code === selected);

  const handleSave = async () => {
    if (!selectedCur) return;
    setSaving(true);
    try {
      await configService.update({ currency_code: selected });
      // Actualizar store local
      setCurrency(selectedCur.code, selectedCur.symbol, selectedCur.name, selectedCur.locale);
      queryClient.invalidateQueries({ queryKey:['system-config'] });
      toast.success(`✅ Moneda actualizada a ${selectedCur.name} (${selectedCur.code})`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold"
          style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
          🌍 Moneda del Sistema
        </h1>
        <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
          Selecciona la moneda de tu país. Todos los valores del sistema se mostrarán con este formato.
        </p>
      </div>

      {/* Moneda actual */}
      {config.currency_code && (
        <div className="card p-4 flex items-center gap-4"
          style={{ background:'rgba(200,168,75,0.07)', border:'1px solid rgba(200,168,75,0.3)', borderLeft:'4px solid var(--color-gold)' }}>
          <span style={{ fontSize:'32px' }}>💱</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color:'var(--color-gold)', letterSpacing:'0.08em' }}>Moneda activa</p>
            <p className="text-lg font-bold" style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
              {config.currency_name} — {config.currency_symbol} ({config.currency_code})
            </p>
          </div>
        </div>
      )}

      {/* Selector */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-sm" style={{ color:'var(--color-text-primary)' }}>
          Seleccionar moneda
        </h3>

        <div className="grid grid-cols-1 gap-2">
          {currencies.map(cur => (
            <button
              key={cur.code}
              type="button"
              disabled={!canEdit}
              onClick={() => setSelected(cur.code)}
              className="flex items-center gap-4 px-4 py-3 rounded text-left transition-all"
              style={{
                background: selected === cur.code
                  ? 'rgba(200,168,75,0.08)'
                  : 'var(--color-bg-secondary)',
                border: `2px solid ${selected === cur.code ? 'var(--color-gold)' : 'var(--color-border)'}`,
                cursor: canEdit ? 'pointer' : 'default',
              }}>
              <div className="w-12 text-center">
                <span className="text-xl font-bold"
                  style={{ color: selected === cur.code ? 'var(--color-gold)' : 'var(--color-text-muted)', fontFamily:'var(--font-display)' }}>
                  {cur.symbol}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color:'var(--color-navy)' }}>
                  {cur.name}
                </p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                  Código: {cur.code} · Formato: {new Intl.NumberFormat(cur.locale, { style:'currency', currency:cur.code, minimumFractionDigits:0 }).format(1234567)}
                </p>
              </div>
              {selected === cur.code && (
                <span style={{ color:'var(--color-gold)', fontWeight:700, fontSize:'1.1rem' }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {!canEdit && (
          <p className="text-xs text-center" style={{ color:'var(--color-text-muted)' }}>
            Solo el Administrador puede cambiar la moneda del sistema.
          </p>
        )}
      </div>

      {/* Preview */}
      {selectedCur && (
        <div className="card p-4"
          style={{ background:'rgba(13,27,62,0.04)', border:'1px solid var(--color-border)', borderLeft:'3px solid var(--color-gold)' }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide"
            style={{ color:'var(--color-gold)', letterSpacing:'0.08em' }}>
            Vista previa de formato:
          </p>
          <div className="flex flex-wrap gap-4">
            {[100000, 1500000, 50000000].map(v => (
              <div key={v} className="text-center">
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{v.toLocaleString()}</p>
                <p className="font-bold text-sm font-mono" style={{ color:'var(--color-navy)' }}>
                  {new Intl.NumberFormat(selectedCur.locale, { style:'currency', currency:selectedCur.code, minimumFractionDigits:0 }).format(v)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save size={15}/>
            {saving ? 'Guardando...' : `Guardar — ${selectedCur?.name || ''}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default CurrencySettingsPage;