// ─── src/pages/Clients/ClientsPage.jsx ───────────────────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, Eye, Users,
         ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clientsService } from '../../services/api.service';
import useAuthStore from '../../store/authStore';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const ClientsPage = () => {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const to = (path) => `/${tenant}/${path.replace(/^\//, '')}`;
  const { hasRole } = useAuthStore();
  const isAsesor = hasRole('asesor');

  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);
  const [limit,  setLimit]  = useState(50);
  const [jumpTo, setJumpTo] = useState('');

  // Al cambiar búsqueda o tamaño de página, resetear a la página 1
  useEffect(() => { setPage(1); }, [search, limit]);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['clients', search, page, limit],
    queryFn:  () => clientsService.getAll({ search, page, limit }),
    keepPreviousData: true,
  });
  const isLoading = data === undefined;

  const clients    = data?.data?.data       || [];
  const pagination = data?.data?.pagination || { total: 0, page: 1, limit, pages: 1 };
  const total      = pagination.total;
  const pages      = pagination.pages || 1;

  // Rango visible (para el texto "Mostrando X–Y de Z")
  const rangeFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeTo   = Math.min(page * limit, total);

  const goTo = (n) => {
    const num = Math.max(1, Math.min(parseInt(n) || 1, pages));
    setPage(num);
  };

  const handleJump = (e) => {
    e.preventDefault();
    if (!jumpTo) return;
    goTo(jumpTo);
    setJumpTo('');
  };

  // Genera los botones de páginas con puntos suspensivos cuando hay hueco.
  // Muestra siempre la 1, la última, la página actual, y sus vecinas.
  const pageButtons = () => {
    const buttons = [];
    const push = (n) => buttons.push(n);
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) push(i);
    } else {
      push(1);
      if (page > 4) push('…');
      const start = Math.max(2, page - 1);
      const end   = Math.min(pages - 1, page + 1);
      for (let i = start; i <= end; i++) push(i);
      if (page < pages - 3) push('…');
      push(pages);
    }
    return buttons;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color:'var(--color-text-primary)' }}>Clientes</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {total} clientes registrados
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => navigate(to('clients/new'))} className="btn btn-primary btn-sm">
            <Plus size={14} /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Búsqueda + selector de tamaño */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color:'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o documento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm w-full"
              style={{ height:'36px' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color:'var(--color-text-muted)' }}>Por página:</label>
            <select value={limit}
              onChange={e => setLimit(parseInt(e.target.value))}
              className="input text-sm"
              style={{ height:'36px', width:'80px' }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-container">
        {isLoading ? (
          <div className="p-8 text-center" style={{ color:'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto mb-3" style={{ color:'var(--color-text-muted)' }} />
            <p style={{ color:'var(--color-text-secondary)' }}>
              {search ? 'No hay clientes que coincidan con la búsqueda' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Ciudad</th>
                <th>Contrato</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}
                  style={{ cursor: isAsesor ? 'default' : 'pointer' }}
                  onClick={() => !isAsesor && navigate(to(`clients/${c.id}`))}>
                  <td className="font-mono text-sm" style={{ color:'var(--color-text-muted)' }}>
                    {c.document_type} · {c.document_number}
                  </td>
                  <td className="font-medium text-sm" style={{ color:'var(--color-text-primary)' }}>
                    {c.full_name}
                  </td>
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
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-activo' : 'badge-cancelado'}`}>
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{!isAsesor && <button className="btn btn-ghost btn-sm"><Eye size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="card p-3 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>
            Mostrando <strong style={{ color:'var(--color-text-primary)' }}>{rangeFrom}–{rangeTo}</strong>
            {' '}de <strong style={{ color:'var(--color-text-primary)' }}>{total}</strong>
          </p>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => goTo(1)}
              disabled={page <= 1}
              title="Primera página"
              className="btn btn-secondary btn-sm">
              <ChevronsLeft size={13}/>
            </button>
            <button
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              title="Anterior"
              className="btn btn-secondary btn-sm">
              <ChevronLeft size={13}/>
            </button>

            {pageButtons().map((p, i) => (
              p === '…' ? (
                <span key={`dots-${i}`} className="px-2 text-xs"
                  style={{ color:'var(--color-text-muted)' }}>…</span>
              ) : (
                <button key={p}
                  onClick={() => goTo(p)}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth:'34px' }}>
                  {p}
                </button>
              )
            ))}

            <button
              onClick={() => goTo(page + 1)}
              disabled={page >= pages}
              title="Siguiente"
              className="btn btn-secondary btn-sm">
              <ChevronRight size={13}/>
            </button>
            <button
              onClick={() => goTo(pages)}
              disabled={page >= pages}
              title="Última página"
              className="btn btn-secondary btn-sm">
              <ChevronsRight size={13}/>
            </button>
          </div>

          {/* Ir a página #  */}
          <form onSubmit={handleJump} className="flex items-center gap-2">
            <label className="text-xs" style={{ color:'var(--color-text-muted)' }}>Ir a:</label>
            <input
              type="number"
              min={1}
              max={pages}
              value={jumpTo}
              onChange={e => setJumpTo(e.target.value)}
              placeholder={`1–${pages}`}
              className="input text-sm"
              style={{ height:'32px', width:'80px' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!jumpTo}>
              Ir
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
