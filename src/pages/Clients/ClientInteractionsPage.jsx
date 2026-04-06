// src/pages/Clients/ClientInteractionsPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Plus, X, Save, MessageSquare, Mail,
  User, RefreshCw, Calendar, Search, CheckCircle,
  Paperclip, Upload, ExternalLink, Trash2
} from 'lucide-react';
import { interactionsService, clientsService, contractsService } from '../../services/api.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { getActiveTenantSlug } from '../../utils/tenant';
import useAuthStore from '../../store/authStore';

const FILE_ICONS = {
  imagen: '🖼️', pdf: '📄', audio: '🎵', video: '🎬', archivo: '📎'
};

const TYPES = {
  llamada:  { label:'Llamada',  Icon:Phone,          color:'#3b82f6' },
  whatsapp: { label:'WhatsApp', Icon:MessageSquare,  color:'#10b981' },
  email:    { label:'Email',    Icon:Mail,           color:'#f59e0b' },
  visita:   { label:'Visita',   Icon:User,           color:'#a855f7' },
  otro:     { label:'Otro',     Icon:MessageSquare,  color:'#94a3b8' },
};

const OUTCOMES = {
  sin_respuesta:         'Sin respuesta',
  interesado:            'Interesado / positivo',
  negativo:              'No interesado',
  acuerdo_pago:          'Acuerdo de pago',
  pendiente_seguimiento: 'Pendiente seguimiento',
};


// ── Selector de contrato con estado visual ────────────────────
const ContractSelector = ({ clientId, selected, onSelect }) => {
  const { data } = useQuery({
    queryKey: ['client-contracts-int', clientId],
    queryFn:  () => contractsService.getAll({ client_id: clientId, limit:20 }),
    enabled:  !!clientId,
  });
  const contracts = data?.data?.data || [];

  if (contracts.length === 0) return null;

  return (
    <div>
      <label className="block text-sm font-semibold mb-2"
        style={{ color:'var(--color-text-primary)' }}>
        2. Contrato relacionado
      </label>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {/* Opción sin contrato */}
        <button
          onClick={() => onSelect(null)}
          className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all"
          style={{
            background: !selected ? 'rgba(59,130,246,0.1)' : 'var(--color-bg-secondary)',
            border: `1px solid ${!selected ? '#3b82f6' : 'var(--color-border)'}`,
            color: !selected ? '#60a5fa' : 'var(--color-text-muted)',
          }}>
          Sin contrato específico
        </button>
        {contracts.map(c => {
          const isSelected = selected?.id === c.id;
          const isMora     = c.status === 'en_mora' ||
            (parseInt(c.overdue_count||0) > 0);
          const isOk       = c.status === 'activo' && !isMora;
          const color      = c.status === 'cancelado' ? '#94a3b8'
                           : isMora   ? '#ef4444'
                           : c.status === 'escriturado' ? '#3b82f6'
                           : '#10b981';
          const dot        = c.status === 'cancelado' ? '⊘'
                           : isMora   ? '🔴'
                           : c.status === 'escriturado' ? '🔵'
                           : '🟢';
          return (
            <button key={c.id}
              onClick={() => onSelect(isSelected ? null : c)}
              className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all"
              style={{
                background: isSelected ? `${color}15` : 'var(--color-bg-secondary)',
                border: `1px solid ${isSelected ? color : 'var(--color-border)'}`,
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{dot}</span>
                  <span className="font-mono font-semibold"
                    style={{ color: isSelected ? color : 'var(--color-text-accent)' }}>
                    {c.contract_number}
                  </span>
                  <span style={{ color:'var(--color-text-muted)' }}>
                    {c.project_name} · {c.property_unit}
                  </span>
                </div>
                <span className="font-medium" style={{ color }}>
                  {c.status === 'en_mora' || isMora ? '⚠ En mora'
                   : c.status === 'activo' ? 'Al día'
                   : c.status === 'escriturado' ? 'Escriturado'
                   : c.status}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="text-xs mt-1.5" style={{ color:'var(--color-text-muted)' }}>
          ✓ Contrato seleccionado: <span style={{ color:'#60a5fa' }}>{selected.contract_number}</span>
        </p>
      )}
    </div>
  );
};

// ── Modal Nueva Interacción ───────────────────────────────────
const NewInteractionModal = ({ onClose, onSaved, preselectedClient = null, preselectedContract = null }) => {
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState(preselectedClient?.full_name || '');
  const [client,    setClient]    = useState(preselectedClient);
  const [showDrop,  setShowDrop]  = useState(false);
  const [contract,  setContract]  = useState(preselectedContract);
  const [form,    setForm]    = useState({
    interaction_type: 'llamada',
    summary:          '',
    outcome:          'pendiente_seguimiento',
    next_contact:     '',
  });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const { data: searchData } = useQuery({
    queryKey: ['client-search-int', search],
    queryFn:  () => clientsService.search(search),
    enabled:  search.length >= 2 && !client,
  });
  const results = searchData?.data?.data || [];

  const selectClient = (c) => {
    setClient(c);
    setSearch(c.full_name);
    setShowDrop(false);
  };

  const clearClient = () => {
    setClient(null);
    setSearch('');
  };

  const handleSubmit = async () => {
    if (!client)
      return toast.error('Debe seleccionar un cliente');
    if (!form.summary || form.summary.trim().length < 5)
      return toast.error('El resumen debe tener al menos 5 caracteres');

    setSaving(true);
    try {
      const res = await interactionsService.create({
        client_id:        client.id,
        contract_id:      contract?.id || null,
        interaction_type: form.interaction_type,
        summary:          form.summary.trim(),
        outcome:          form.outcome || null,
        next_contact:     form.next_contact || null,
      });

      const newId = res.data?.data?.id;

      // Subir archivos adjuntos si hay
      if (newId && attachedFiles.length > 0) {
        const token = localStorage.getItem('inmogest_token');
        for (const file of attachedFiles) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            await fetch(`/api/v1/${getActiveTenantSlug()}/interactions/${newId}/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: fd,
            });
          } catch {
            // Continuar aunque falle algún archivo
          }
        }
        toast.success(`Interacción registrada con ${attachedFiles.length} archivo${attachedFiles.length!==1?'s':''} adjunto${attachedFiles.length!==1?'s':''}`);
      } else {
        toast.success('Interacción registrada correctamente');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background:'rgba(0,0,0,0.7)', paddingTop:'5vh' }}
    >
      {/* Modal — ancho fijo, sin max-h para no cortar */}
      <div
        className="w-full rounded-2xl shadow-2xl"
        style={{
          maxWidth:        '500px',
          margin:          '0 16px',
          background:      'var(--color-bg-card)',
          border:          '1px solid var(--color-border)',
          maxHeight:       '90vh',
          display:         'flex',
          flexDirection:   'column',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom:'1px solid var(--color-border)' }}
        >
          <h2 className="font-bold text-base" style={{ color:'var(--color-text-primary)' }}>
            Registrar Interacción
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16}/></button>
        </div>

        {/* ── Body scrollable ── */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">

          {/* 1. Buscar cliente */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color:'var(--color-text-primary)' }}>
              1. Cliente <span className="text-red-400">*</span>
            </label>

            {!client ? (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color:'var(--color-text-muted)' }}/>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                  className="input pl-9 text-sm w-full"
                  placeholder="Escriba nombre o documento del cliente..."
                  autoFocus
                />
                {showDrop && results.length > 0 && (
                  <div
                    className="absolute z-30 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                    style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)' }}
                  >
                    {results.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-slate-700 flex items-center justify-between"
                      >
                        <span className="font-medium" style={{ color:'var(--color-text-primary)' }}>
                          {c.full_name}
                        </span>
                        <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                          {c.document_type} {c.document_number}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {search.length >= 2 && results.length === 0 && (
                  <p className="text-xs mt-1.5" style={{ color:'var(--color-text-muted)' }}>
                    Sin resultados — intente con otro nombre o documento
                  </p>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)' }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-semibold" style={{ color:'#10b981' }}>
                      {client.full_name}
                    </p>
                    <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                      {client.document_type} {client.document_number}
                    </p>
                  </div>
                </div>
                <button onClick={clearClient}
                  className="text-red-400 hover:text-red-300 transition-colors p-1 rounded">
                  <X size={14}/>
                </button>
              </div>
            )}
          </div>

          {/* 2. Contrato (carga cuando hay cliente) */}
          {client && (
            <ContractSelector
              clientId={client.id}
              selected={contract}
              onSelect={setContract}
            />
          )}

          {/* 3. Tipo de interacción */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color:'var(--color-text-primary)' }}>
              3. Tipo de interacción
            </label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(TYPES).map(([k, v]) => {
                const sel = form.interaction_type === k;
                return (
                  <button
                    key={k}
                    onClick={() => set('interaction_type', k)}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: sel ? `${v.color}20` : 'var(--color-bg-secondary)',
                      border:     `1.5px solid ${sel ? v.color : 'var(--color-border)'}`,
                      color:      sel ? v.color : 'var(--color-text-muted)',
                    }}
                  >
                    <v.Icon size={16}/>
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Resumen */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color:'var(--color-text-primary)' }}>
              4. Resumen <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              className="input text-sm resize-none w-full"
              rows={4}
              placeholder="Describe lo hablado con el cliente, compromisos adquiridos, información relevante..."
            />
            <p className="text-xs mt-1"
              style={{ color: form.summary.length >= 5 ? '#10b981' : 'var(--color-text-muted)' }}>
              {form.summary.length} caracteres {form.summary.length >= 5 ? '✓' : '(mínimo 5)'}
            </p>
          </div>

          {/* 4. Resultado y próximo contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color:'var(--color-text-primary)' }}>
                5. Resultado
              </label>
              <select
                value={form.outcome}
                onChange={e => set('outcome', e.target.value)}
                className="input text-sm"
              >
                {Object.entries(OUTCOMES).map(([k,v]) =>
                  <option key={k} value={k}>{v}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color:'var(--color-text-primary)' }}>
                Próximo contacto
              </label>
              <input
                type="date"
                value={form.next_contact}
                onChange={e => set('next_contact', e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>

        </div>

        {/* Adjuntar archivos */}
        <div className="px-5 pb-4">
          <label className="block text-sm font-semibold mb-2"
            style={{ color:'var(--color-text-primary)' }}>
            Adjuntar evidencia (opcional)
          </label>
          <label
            className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all w-full"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1.5px dashed var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--color-border)'}
          >
            <Paperclip size={15}/>
            <span className="text-sm">
              {attachedFiles.length === 0
                ? 'Clic para adjuntar archivo (PDF, imagen, audio, video)'
                : `${attachedFiles.length} archivo${attachedFiles.length!==1?'s':''} seleccionado${attachedFiles.length!==1?'s':''}`}
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.mp4,.wav,.ogg"
              onChange={e => {
                const files = Array.from(e.target.files);
                setAttachedFiles(prev => [...prev, ...files]);
                e.target.value = '';
              }}
            />
          </label>

          {/* Lista de archivos adjuntos */}
          {attachedFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachedFiles.map((file, idx) => {
                const ext  = file.name.split('.').pop().toLowerCase();
                const icon = ['jpg','jpeg','png','webp'].includes(ext) ? '🖼️'
                           : ext === 'pdf' ? '📄'
                           : ['mp3','wav','ogg'].includes(ext) ? '🎵'
                           : ext === 'mp4' ? '🎬' : '📎';
                return (
                  <div key={idx}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
                    <span className="flex items-center gap-2" style={{ color:'#60a5fa' }}>
                      <span>{icon}</span>
                      <span className="max-w-[240px] truncate">{file.name}</span>
                      <span style={{ color:'var(--color-text-muted)' }}>
                        ({(file.size/1024).toFixed(0)} KB)
                      </span>
                    </span>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter((_,i) => i!==idx))}
                      className="ml-2 text-red-400 hover:text-red-300">
                      <X size={12}/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer con botones ── */}
        <div
          className="flex gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop:'1px solid var(--color-border)' }}
        >
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !client || form.summary.trim().length < 5}
            className="btn btn-primary flex-1"
          >
            <Save size={14}/>
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────
const ClientInteractionsPage = () => {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['interactions'],
    queryFn:  () => interactionsService.getAll({ limit:200 }),
    refetchInterval: 60000,
  });
  const interactions = data?.data?.data || [];

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey:['interactions'] });
    refetch();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta interacción?')) return;
    try {
      await interactionsService.delete(id);
      toast.success('Eliminada');
      refetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // Agrupar por fecha
  const grouped = interactions.reduce((acc, i) => {
    const day = i.created_at
      ? format(new Date(i.created_at), "EEEE d 'de' MMMM yyyy", { locale:es })
      : 'Sin fecha';
    if (!acc[day]) acc[day] = [];
    acc[day].push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-fade-in">

      {showModal && (
        <NewInteractionModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>
            Reporte de Interacciones
          </h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            Llamadas, WhatsApp, emails y visitas con clientes
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin':''}/>
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14}/> Registrar Interacción
          </button>
        </div>
      </div>

      {/* Lista */}
      {interactions.length === 0 ? (
        <div className="card flex flex-col items-center py-16 gap-4">
          <Phone size={48} style={{ color:'var(--color-text-muted)' }}/>
          <div className="text-center">
            <p className="font-medium" style={{ color:'var(--color-text-secondary)' }}>
              No hay interacciones registradas
            </p>
            <p className="text-sm mt-1" style={{ color:'var(--color-text-muted)' }}>
              Registra las llamadas y comunicaciones con tus clientes
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14}/> Primera Interacción
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              {/* Separador de fecha */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1" style={{ background:'var(--color-border)' }}/>
                <span
                  className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
                  style={{
                    color:      'var(--color-text-muted)',
                    background: 'var(--color-bg-secondary)',
                    border:     '1px solid var(--color-border)',
                  }}
                >
                  {day}
                </span>
                <div className="h-px flex-1" style={{ background:'var(--color-border)' }}/>
              </div>

              <div className="space-y-3">
                {items.map(i => {
                  const t    = TYPES[i.interaction_type] || TYPES.otro;
                  const isOwn= i.user_id === user?.id || i.user_id === user?.userId;

                  return (
                    <div key={i.id} className="card hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">

                        {/* Ícono tipo */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background:`${t.color}18`, border:`1px solid ${t.color}30` }}
                        >
                          <t.Icon size={15} style={{ color:t.color }}/>
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          {/* Fila superior */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm"
                              style={{ color:'var(--color-text-primary)' }}>
                              {i.client_name}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background:`${t.color}18`, color:t.color }}
                            >
                              {t.label}
                            </span>
                            {i.outcome && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  background: 'var(--color-bg-secondary)',
                                  color:      'var(--color-text-muted)',
                                  border:     '1px solid var(--color-border)',
                                }}
                              >
                                {OUTCOMES[i.outcome] || i.outcome}
                              </span>
                            )}
                            {/* Hora + botón borrar */}
                            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>
                                {i.created_at ? format(new Date(i.created_at), 'HH:mm') : ''}
                              </span>
                              {isOwn && (
                                <button
                                  onClick={() => handleDelete(i.id)}
                                  className="p-1 rounded text-red-400 hover:text-red-300 transition-colors"
                                  title="Eliminar">
                                  <X size={13}/>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Resumen */}
                          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>
                            {i.summary}
                          </p>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap"
                            style={{ color:'var(--color-text-muted)' }}>
                            <span>👤 {i.user_name || 'Sistema'}</span>
                            {i.contract_number && (
                              <span>📋 {i.contract_number}</span>
                            )}
                            {i.next_contact && (
                              <span style={{ color:'#f59e0b' }}>
                                📅 Próx. contacto:{' '}
                                {format(new Date(i.next_contact), 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>

                          {/* Documentos / Evidencias */}
                          {i.documents && i.documents.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {i.documents.map((doc, di) => (
                                <div key={di} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                                  style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)' }}>
                                  <span>{FILE_ICONS[doc.type] || '📎'}</span>
                                  <a href={`/api/v1/${getActiveTenantSlug()}${doc.url}`} target="_blank" rel="noopener noreferrer"
                                    className="max-w-[120px] truncate hover:underline" style={{ color:'#60a5fa' }}>
                                    {doc.filename}
                                  </a>
                                  <a href={`/api/v1/${getActiveTenantSlug()}${doc.url}`} target="_blank" rel="noopener noreferrer"
                                    style={{ color:'rgba(96,165,250,0.6)' }}>
                                    <ExternalLink size={10}/>
                                  </a>
                                  {isOwn && (
                                    <button
                                      onClick={async e => {
                                        e.stopPropagation();
                                        if (!confirm('¿Eliminar este archivo?')) return;
                                        const token = localStorage.getItem('inmogest_token');
                                        const res = await fetch(`/api/v1/${getActiveTenantSlug()}/interactions/${i.id}/documents/${di}`, {
                                          method:'DELETE', headers:{ Authorization:`Bearer ${token}` }
                                        });
                                        const json = await res.json();
                                        if (json.success) { toast.success('Eliminado'); refetch(); }
                                        else toast.error(json.message||'Error');
                                      }}
                                      className="hover:text-red-400 transition-colors flex-shrink-0"
                                      style={{ color:'rgba(96,165,250,0.5)' }}
                                      title="Eliminar archivo">
                                      <X size={11}/>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Subir evidencia */}
                          {isOwn && (
                            <label className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors hover:opacity-80"
                              style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border)', color:'var(--color-text-muted)' }}>
                              <Paperclip size={11}/>
                              Subir evidencia
                              <input type="file" className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.mp4,.wav"
                                onChange={async e => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const fd = new FormData();
                                  fd.append('file', file);
                                  try {
                                    const token = localStorage.getItem('inmogest_token');
                                    const res = await fetch(`/api/v1/${getActiveTenantSlug()}/interactions/${i.id}/upload`, {
                                      method:'POST',
                                      headers:{ Authorization:`Bearer ${token}` },
                                      body: fd,
                                    });
                                    const json = await res.json();
                                    if (json.success) {
                                      toast.success('Evidencia subida correctamente');
                                      refetch();
                                    } else {
                                      toast.error(json.message || 'Error al subir');
                                    }
                                  } catch {
                                    toast.error('Error al subir el archivo');
                                  }
                                  e.target.value = '';
                                }}/>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { NewInteractionModal };
export default ClientInteractionsPage;