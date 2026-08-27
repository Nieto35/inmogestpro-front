// src/components/Auth/ModuloRoute.jsx
//
// Guarda de ruta que consulta los permisos configurados para la empresa.
//
// Reemplaza a `<ProtectedRoute roles={[...]}>` en las pantallas que
// pertenecen a un módulo. La diferencia es que la lista de roles ya no está
// escrita en App.jsx: sale del catálogo compartido y de las excepciones que
// el super-admin haya puesto para esta empresa.
//
// Eso resuelve el problema que veníamos arrastrando: el menú decía una cosa
// y la ruta otra, así que aparecían enlaces que terminaban en pantalla
// bloqueada.
//
// NIVELES
//   sin_acceso  no entra
//   lectura     entra al listado, no al detalle de un registro
//   total       entra a todo
//
// Las rutas de detalle se marcan con `requiere="total"`, igual que el
// backend exige `total` para las rutas con `:id`.
//
// GARANTÍA: si la consulta de permisos falla o no hay excepciones, se usa
// el valor del código — el mismo comportamiento de siempre. Nunca deja a
// alguien fuera por un problema de red.
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import { configService } from '../../services/api.service';
import { nivelDeModulo } from '../../config/modules';

const SinAcceso = ({ mensaje }) => (
  <div className="card flex flex-col items-center py-16 gap-3 text-center">
    <p className="text-lg font-semibold"
      style={{ color:'var(--color-navy)', fontFamily:'var(--font-display)' }}>
      Sin acceso
    </p>
    <p className="text-sm max-w-md" style={{ color:'var(--color-text-muted)' }}>
      {mensaje}
    </p>
  </div>
);

const ModuloRoute = ({ modulo, requiere = 'lectura', escritura, children }) => {
  const { user } = useAuthStore();
  const { tenant } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['config-permissions'],
    queryFn:  () => configService.getPermissions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(user),
  });

  // Mientras carga no se bloquea: se deja pasar. El backend es quien decide
  // de verdad, así que un parpadeo no abre nada.
  if (isLoading) return children;

  const overrides = data?.data?.data?.overrides || [];
  const nivel     = nivelDeModulo(modulo, user?.role, overrides);

  if (nivel === 'sin_acceso')
    return <Navigate to={`/${tenant}/dashboard`} replace />;

  if (requiere === 'total' && nivel !== 'total')
    return (
      <SinAcceso mensaje={
        'Tu rol puede ver el listado de este módulo, pero no abrir un registro. ' +
        'Si necesitas más, pídeselo al administrador de la plataforma.'
      }/>
    );

  // Crear y editar era más restringido que ver: un asesor entraba a
  // Contratos pero no podía crear uno. El catálogo tiene una sola lista por
  // módulo, así que sin este piso esas pantallas se abrirían de más.
  //
  // Solo manda mientras esta empresa no tenga configurada una excepción para
  // el módulo. En cuanto el super-admin decide, decide él.
  const hayExcepcion = overrides.some(
    o => o.role === user?.role && o.module === modulo
  );
  if (requiere === 'total' && !hayExcepcion &&
      Array.isArray(escritura) && !escritura.includes(user?.role))
    return (
      <SinAcceso mensaje={
        'Tu rol puede consultar este módulo, pero no crear ni modificar ' +
        'registros. Si necesitas más, pídeselo al administrador de la plataforma.'
      }/>
    );

  return children;
};

export default ModuloRoute;
