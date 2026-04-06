// src/components/Auth/ProtectedRoute.jsx
import { Navigate, Outlet, useParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { getSavedTenantSlug } from '../../utils/tenant';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { tenant } = useParams();
  const slug = tenant || getSavedTenantSlug() || '';
  const prefix = slug ? `/${slug}` : '';

  if (!isAuthenticated) {
    return <Navigate to={`${prefix}/login`} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to={`${prefix}/dashboard`} replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;