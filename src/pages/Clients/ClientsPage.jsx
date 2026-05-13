// ============================================================
// INSTRUCCIÓN: Cada bloque de código es un archivo separado.
// Crear cada uno en su ruta indicada.
// ============================================================

// ─── src/pages/Clients/ClientsPage.jsx ───────────────────────────────────────
// [COPIAR DESDE AQUÍ]
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, Eye, Users } from 'lucide-react';
import { clientsService } from '../../services/api.service';

const ClientsPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const [search, setSearch] = useState('');

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsService.getAll({ search }),
  });
  const isLoading = data === undefined;

  const clients = data?.data?.data || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>Clientes</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{data?.data?.pagination?.total ?? clients.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm"><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /></button>
          <button onClick={() => navigate(to('clients/new'))} className="btn btn-primary btn-sm"><Plus size={14} /> Nuevo Cliente</button>
        </div>
      </div>
      <div className="card p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar por nombre o documento..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm" style={{ height:'36px' }} />
        </div>
      </div>
      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color:'var(--color-text-muted)' }}><RefreshCw size={24} className="animate-spin mx-auto mb-2" />Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center"><Users size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }} /><p style={{ color:'var(--color-text-secondary)' }}>No hay clientes registrados</p></div>
        ) : (
          <table>
            <thead><tr><th>Documento</th><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Ciudad</th><th>Contrato</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => navigate(to(`clients/${c.id}`))}>
                  <td className="font-mono text-sm" style={{ color:'var(--color-text-muted)' }}>{c.document_type} · {c.document_number}</td>
                  <td className="font-medium text-sm" style={{ color:'var(--color-text-primary)' }}>{c.full_name}</td>
                  <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{c.mobile || '—'}</td>
                  <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{c.email || '—'}</td>
                  <td className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{c.city || '—'}</td>
                  <td>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={c.has_contract
                        ? { background:'rgba(16,185,129,0.12)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)' }
                        : { background:'rgba(148,163,184,0.1)', color:'#94a3b8', border:'1px solid rgba(148,163,184,0.2)' }
                      }>
                      {c.has_contract ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td><span className={`badge ${c.is_active ? 'badge-activo' : 'badge-cancelado'}`}>{c.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td><button className="btn btn-ghost btn-sm"><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ClientsPage;
// [COPIAR HASTA AQUÍ] → guardar en: src/pages/Clients/ClientsPage.jsx