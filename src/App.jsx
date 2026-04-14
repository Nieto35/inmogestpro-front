// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoadingScreen  from './components/UI/LoadingScreen';
import Layout         from './components/Layout/Layout';
import SuperAdminApp  from './pages/SuperAdmin/SuperAdminApp';
import { saveTenantSlug } from './utils/tenant';
import { configService } from './services/api.service';
import useCurrencyStore from './store/currencyStore';

// Lazy imports
const LoginPage              = lazy(() => import('./pages/Login/LoginPage'));
const DashboardPage          = lazy(() => import('./pages/Dashboard/DashboardPage'));
const ContractsPage          = lazy(() => import('./pages/Contracts/ContractsPage'));
const ContractDetailPage     = lazy(() => import('./pages/Contracts/ContractDetailPage'));
const ContractEditPage       = lazy(() => import('./pages/Contracts/ContractEditPage'));
const ContractNewPage        = lazy(() => import('./pages/Contracts/ContractNewPage'));
const ClientsPage            = lazy(() => import('./pages/Clients/ClientsPage'));
const ClientDetailPage       = lazy(() => import('./pages/Clients/ClientDetailPage'));
const ClientNewPage          = lazy(() => import('./pages/Clients/ClientNewPage'));
const ClientInteractionsPage = lazy(() => import('./pages/Clients/ClientInteractionsPage'));
const ProjectsPage           = lazy(() => import('./pages/Projects/ProjectsPage'));
const ProjectNewPage         = lazy(() => import('./pages/Projects/ProjectNewPage'));
const PropertiesPage         = lazy(() => import('./pages/Properties/PropertiesPage'));
const PropertyNewPage        = lazy(() => import('./pages/Properties/PropertyNewPage'));
const PropertyBulkPage       = lazy(() => import('./pages/Properties/PropertyBulkPage'));
const PaymentsPage           = lazy(() => import('./pages/Payments/PaymentsPage'));
const AdvisorsPage           = lazy(() => import('./pages/Advisors/AdvisorsPage'));
const AdvisorNewPage         = lazy(() => import('./pages/Advisors/AdvisorNewPage'));
const CommissionsPage        = lazy(() => import('./pages/Advisors/CommissionsPage'));
const ReportsPage            = lazy(() => import('./pages/Reports/ReportsPage'));
const AuditPage              = lazy(() => import('./pages/Audit/AuditPage'));
const CurrencySettingsPage   = lazy(() => import('./pages/Settings/CurrencySettingsPage'));
const UsersPage              = lazy(() => import('./pages/Users/UsersPage'));
const ProfilePage            = lazy(() => import('./pages/Profile/ProfilePage'));

const S = ({ children }) => <Suspense fallback={<LoadingScreen/>}>{children}</Suspense>;

// Guarda el slug del tenant y carga la moneda configurada
const TenantLayout = () => {
  const { tenant } = useParams();
  useEffect(() => {
    const reserved = new Set(['super-admin','login','dashboard','contracts','clients',
      'projects','properties','payments','advisors','commissions','reports',
      'audit','users','profile','interactions','settings']);
    if (!tenant || reserved.has(tenant)) return;
    saveTenantSlug(tenant);
    configService.get().then(res => {
      const cfg        = res?.data?.data?.config     || {};
      const currencies = res?.data?.data?.currencies || [];
      if (cfg.currency_code) {
        const cur = currencies.find(c => c.code === cfg.currency_code);
        useCurrencyStore.getState().setCurrency(
          cfg.currency_code,
          cfg.currency_symbol || '$',
          cfg.currency_name   || cfg.currency_code,
          cur?.locale         || 'es-CO'
        );
      }
    }).catch(() => {});
  }, [tenant]);
  return <Outlet />;
};

// Catch-all con tenant absoluto para evitar bucle infinito
const TenantCatchAll = () => {
  const { tenant } = useParams();
  return <Navigate to={`/${tenant}/dashboard`} replace />;
};

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Suspense fallback={<LoadingScreen/>}>
      <Routes>

        {/* ── Super-Admin ───────────────────────────────────── */}
        <Route path="/super-admin/*" element={<SuperAdminApp/>}/>

        {/* ── Rutas de empresa: /:tenant/... ────────────────── */}
        <Route path="/:tenant" element={<TenantLayout/>}>

          {/* Login público */}
          <Route path="login" element={<S><LoginPage/></S>}/>

          {/* Rutas protegidas dentro del Layout */}
          <Route element={<ProtectedRoute><Layout/></ProtectedRoute>}>

            {/* Índice → dashboard absoluto */}
            <Route index element={<TenantCatchAll/>}/>

            <Route path="dashboard" element={<S><DashboardPage/></S>}/>

            {/* Contratos */}
            <Route path="contracts"          element={<S><ContractsPage/></S>}/>
            <Route path="contracts/new"      element={<ProtectedRoute roles={['gerente','abogado']}><S><ContractNewPage/></S></ProtectedRoute>}/>
            <Route path="contracts/:id"      element={<S><ContractDetailPage/></S>}/>
            <Route path="contracts/:id/edit" element={<ProtectedRoute roles={['gerente','contador','abogado']}><S><ContractEditPage/></S></ProtectedRoute>}/>

            {/* Clientes */}
            <Route path="clients"     element={<S><ClientsPage/></S>}/>
            <Route path="clients/new" element={<ProtectedRoute roles={['gerente','asesor','abogado']}><S><ClientNewPage/></S></ProtectedRoute>}/>
            <Route path="clients/:id" element={<S><ClientDetailPage/></S>}/>

            {/* CRM */}
            <Route path="interactions" element={<ProtectedRoute roles={['gerente','contador','abogado']}><S><ClientInteractionsPage/></S></ProtectedRoute>}/>

            {/* Proyectos */}
            <Route path="projects"     element={<ProtectedRoute roles={['gerente','contador','readonly','abogado','supervisor']}><S><ProjectsPage/></S></ProtectedRoute>}/>
            <Route path="projects/new" element={<ProtectedRoute roles={['gerente']}><S><ProjectNewPage/></S></ProtectedRoute>}/>

            {/* Inmuebles */}
            <Route path="properties"      element={<S><PropertiesPage/></S>}/>
            <Route path="properties/new"  element={<ProtectedRoute roles={['gerente','contador']}><S><PropertyNewPage/></S></ProtectedRoute>}/>
            <Route path="properties/bulk" element={<ProtectedRoute roles={['gerente','contador']}><S><PropertyBulkPage/></S></ProtectedRoute>}/>

            {/* Pagos */}
            <Route path="payments" element={<ProtectedRoute roles={['gerente','contador']}><S><PaymentsPage/></S></ProtectedRoute>}/>

            {/* Asesores y comisiones */}
            <Route path="advisors"     element={<ProtectedRoute roles={['gerente','readonly','abogado','supervisor']}><S><AdvisorsPage/></S></ProtectedRoute>}/>
            <Route path="advisors/new" element={<ProtectedRoute roles={['gerente']}><S><AdvisorNewPage/></S></ProtectedRoute>}/>
            <Route path="commissions"  element={<ProtectedRoute roles={['gerente','contador']}><S><CommissionsPage/></S></ProtectedRoute>}/>

            {/* Reportes */}
            <Route path="reports" element={<ProtectedRoute roles={['gerente','contador','readonly','abogado','supervisor']}><S><ReportsPage/></S></ProtectedRoute>}/>

            {/* Auditoría */}
            <Route path="audit" element={<ProtectedRoute roles={['gerente']}><S><AuditPage/></S></ProtectedRoute>}/>

            {/* Configuración 
            <Route path="settings/currency" element={<ProtectedRoute roles={['gerente']}><S><CurrencySettingsPage/></S></ProtectedRoute>}/>*/}

            {/* Usuarios */}
            <Route path="users" element={<ProtectedRoute roles={['gerente']}><S><UsersPage/></S></ProtectedRoute>}/>

            {/* Perfil */}
            <Route path="profile" element={<S><ProfilePage/></S>}/>
          </Route>

          {/* FIX: catch-all con ruta absoluta para evitar bucle infinito */}
          <Route path="*" element={<TenantCatchAll/>}/>
        </Route>

        {/* Raíz → super-admin */}
        <Route path="/" element={<Navigate to="/super-admin" replace/>}/>
        <Route path="*" element={<Navigate to="/super-admin" replace/>}/>

      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;