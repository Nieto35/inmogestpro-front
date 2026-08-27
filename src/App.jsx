// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import ProtectedRoute from './components/Auth/ProtectedRoute';
// Guarda que consulta los permisos configurados para la empresa, en vez de
// una lista fija de roles. Ver components/Auth/ModuloRoute.jsx
import ModuloRoute    from './components/Auth/ModuloRoute';
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
const OwnersPage             = lazy(() => import('./pages/Owners/OwnersPage'));
const SettlementsPage        = lazy(() => import('./pages/Settlements/SettlementsPage'));
const RentalNewPage          = lazy(() => import('./pages/Rentals/RentalNewPage'));
const RentalAlertsPage       = lazy(() => import('./pages/Rentals/RentalAlertsPage'));
const ClientDetailPage       = lazy(() => import('./pages/Clients/ClientDetailPage'));
const ClientNewPage          = lazy(() => import('./pages/Clients/ClientNewPage'));
const ClientInteractionsPage = lazy(() => import('./pages/Clients/ClientInteractionsPage'));
const ProjectsPage           = lazy(() => import('./pages/Projects/ProjectsPage'));
const ProjectNewPage         = lazy(() => import('./pages/Projects/ProjectNewPage'));
const BlocksPage             = lazy(() => import('./pages/Blocks/BlocksPage'));
const BlockNewPage           = lazy(() => import('./pages/Blocks/BlockNewPage'));
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
      'audit','users','profile','interactions','settings','owners','blocks',
      'rentals','settlements','rental-alerts']);
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
            <Route path="contracts"          element={<ModuloRoute modulo="contracts"><S><ContractsPage/></S></ModuloRoute>}/>
            <Route path="contracts/new"      element={<ModuloRoute modulo="contracts" requiere="total" escritura={['admin','gerente','contador','abogado']}><S><ContractNewPage/></S></ModuloRoute>}/>
            <Route path="contracts/:id"      element={<ModuloRoute modulo="contracts" requiere="total"><S><ContractDetailPage/></S></ModuloRoute>}/>
            {/* Editar contrato mueve dinero (la cuota inicial se registra como
                pago real), por eso queda solo para los roles financieros */}
            <Route path="contracts/:id/edit" element={<ModuloRoute modulo="contracts" requiere="total" escritura={['admin','gerente','contador']}><S><ContractEditPage/></S></ModuloRoute>}/>

            {/* Clientes */}
            <Route path="clients"     element={<ModuloRoute modulo="clients"><S><ClientsPage/></S></ModuloRoute>}/>
            <Route path="clients/new" element={<ModuloRoute modulo="clients" requiere="total" escritura={['admin','gerente','contador','abogado']}><S><ClientNewPage/></S></ModuloRoute>}/>
            <Route path="clients/:id" element={<ModuloRoute modulo="clients" requiere="total" escritura={['admin','gerente','contador','abogado','readonly']}><S><ClientDetailPage/></S></ModuloRoute>}/>

            {/* Propietarios — solo en la pestaña de Arriendos */}
            <Route path="owners" element={<ModuloRoute modulo="owners"><S><OwnersPage/></S></ModuloRoute>}/>

            {/* Liquidaciones al propietario — solo en Arriendos */}
            <Route path="settlements" element={<ModuloRoute modulo="settlements"><S><SettlementsPage/></S></ModuloRoute>}/>

            {/* Crear contrato de arriendo */}
            <Route path="rentals/new" element={<ModuloRoute modulo="contracts" requiere="total" escritura={['admin','gerente','contador','asesor']}><S><RentalNewPage/></S></ModuloRoute>}/>

            {/* Alertas de arriendo: incrementos, vencimientos y mora */}
            <Route path="rental-alerts" element={<ModuloRoute modulo="rental-alerts"><S><RentalAlertsPage/></S></ModuloRoute>}/>

            {/* CRM */}
            <Route path="interactions" element={<ModuloRoute modulo="interactions"><S><ClientInteractionsPage/></S></ModuloRoute>}/>

            {/* Proyectos */}
            <Route path="projects"     element={<ModuloRoute modulo="projects"><S><ProjectsPage/></S></ModuloRoute>}/>
            <Route path="projects/new" element={<ModuloRoute modulo="projects" requiere="total" escritura={['admin','gerente','contador']}><S><ProjectNewPage/></S></ModuloRoute>}/>

            {/* Manzanas / Edificios */}
            <Route path="blocks"     element={<ModuloRoute modulo="blocks"><S><BlocksPage/></S></ModuloRoute>}/>
            <Route path="blocks/new" element={<ModuloRoute modulo="blocks" requiere="total" escritura={['admin','gerente','contador']}><S><BlockNewPage/></S></ModuloRoute>}/>

            {/* Inmuebles */}
            <Route path="properties"      element={<ModuloRoute modulo="properties"><S><PropertiesPage/></S></ModuloRoute>}/>
            <Route path="properties/new"  element={<ModuloRoute modulo="properties" requiere="total" escritura={['admin','gerente','contador']}><S><PropertyNewPage/></S></ModuloRoute>}/>
            <Route path="properties/bulk" element={<ModuloRoute modulo="properties" requiere="total" escritura={['admin','gerente','contador']}><S><PropertyBulkPage/></S></ModuloRoute>}/>

            {/* Pagos */}
            <Route path="payments" element={<ModuloRoute modulo="payments"><S><PaymentsPage/></S></ModuloRoute>}/>

            {/* Asesores y comisiones */}
            <Route path="advisors"     element={<ModuloRoute modulo="advisors"><S><AdvisorsPage/></S></ModuloRoute>}/>
            <Route path="advisors/new" element={<ModuloRoute modulo="advisors" requiere="total" escritura={['admin','gerente','contador']}><S><AdvisorNewPage/></S></ModuloRoute>}/>
            <Route path="commissions"  element={<ModuloRoute modulo="commissions"><S><CommissionsPage/></S></ModuloRoute>}/>

            {/* Reportes */}
            <Route path="reports" element={<ModuloRoute modulo="reports"><S><ReportsPage/></S></ModuloRoute>}/>

            {/* Auditoría — solo gerente */}
            <Route path="audit" element={<ModuloRoute modulo="audit"><S><AuditPage/></S></ModuloRoute>}/>

            {/* Configuración
            <Route path="settings/currency" element={<ProtectedRoute roles={['gerente']}><S><CurrencySettingsPage/></S></ProtectedRoute>}/>*/}

            {/* Usuarios — solo gerente */}
            <Route path="users" element={<ModuloRoute modulo="users"><S><UsersPage/></S></ModuloRoute>}/>

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